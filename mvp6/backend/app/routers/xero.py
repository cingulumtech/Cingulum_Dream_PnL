import os
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user, require_csrf
from ..db import get_db

router = APIRouter(prefix="/api/xero", tags=["xero"])

XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize"
XERO_TOKEN_URL = "https://identity.xero.com/connect/token"
XERO_CONNECTIONS_URL = "https://api.xero.com/connections"
XERO_REPORT_PL_URL = "https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss"
XERO_REPORT_GL_URL = "https://api.xero.com/api.xro/2.0/Reports/GeneralLedger"

DEFAULT_SCOPES = "offline_access accounting.reports.read accounting.journals.read accounting.transactions.read app.connections"


def get_xero_config() -> Dict[str, str]:
    client_id = os.environ.get("XERO_CLIENT_ID")
    client_secret = os.environ.get("XERO_CLIENT_SECRET")
    redirect_uri = os.environ.get("XERO_REDIRECT_URI")
    scopes = os.environ.get("XERO_SCOPES", DEFAULT_SCOPES)
    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Xero OAuth is not configured. Set XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_REDIRECT_URI.",
        )
    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "scopes": scopes,
    }


def to_number(value: Optional[str]) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return 0.0
    s = value.strip()
    if s == "" or s == "-":
        return 0.0
    negative = s.startswith("(") and s.endswith(")")
    cleaned = s.replace("(", "").replace(")", "").replace(",", "").replace("$", "")
    try:
        num = float(cleaned)
    except ValueError:
        return 0.0
    return -num if negative else num


def normalize_month_label(label: str) -> Dict[str, str]:
    if not label:
        return {"key": "", "label": ""}
    label = label.strip()
    month_map = {
        "jan": 1,
        "january": 1,
        "feb": 2,
        "february": 2,
        "mar": 3,
        "march": 3,
        "apr": 4,
        "april": 4,
        "may": 5,
        "jun": 6,
        "june": 6,
        "jul": 7,
        "july": 7,
        "aug": 8,
        "august": 8,
        "sep": 9,
        "sept": 9,
        "september": 9,
        "oct": 10,
        "october": 10,
        "nov": 11,
        "november": 11,
        "dec": 12,
        "december": 12,
    }
    parts = label.split()
    if len(parts) == 2 and parts[0].lower() in month_map and parts[1].isdigit():
        month = month_map[parts[0].lower()]
        year = int(parts[1])
        key = f"{year}-{month:02d}"
        formatted = datetime(year, month, 1).strftime("%b %Y")
        return {"key": key, "label": formatted}
    return {"key": label, "label": label}


def section_from_header(label: str) -> str:
    s = label.strip().lower()
    if "trading income" in s:
        return "trading_income"
    if "cost of sales" in s or "costs of sales" in s or "cogs" in s:
        return "cost_of_sales"
    if "other income" in s:
        return "other_income"
    if "operating expenses" in s:
        return "operating_expenses"
    return "unknown"


def is_summary_row(label: str) -> bool:
    s = label.strip().lower()
    return s in {
        "net profit",
        "net income",
        "gross profit",
        "gross margin",
        "operating profit",
        "operating income",
    }


def parse_xero_pl(report: Dict[str, Any]) -> Dict[str, Any]:
    columns = report.get("Columns") or []
    titles = [str(col.get("Title") or "").strip() for col in columns]
    if not titles:
        raise HTTPException(status_code=400, detail="Xero report did not include columns")
    month_titles = titles[1:]
    total_included = False
    if month_titles and month_titles[-1].lower().startswith("total"):
        total_included = True
        month_titles = month_titles[:-1]

    months = []
    month_labels = []
    for title in month_titles:
        normalized = normalize_month_label(title)
        if normalized["key"]:
            months.append(normalized["key"])
            month_labels.append(normalized["label"])

    accounts = []
    section = "unknown"

    def handle_row(row: Dict[str, Any], section_name: str):
        cells = row.get("Cells") or []
        if not cells:
            return
        name = str(cells[0].get("Value") or "").strip()
        if not name or is_summary_row(name):
            return
        values = [to_number(cell.get("Value")) for cell in cells[1:1 + len(months)]]
        total = 0.0
        if total_included and len(cells) > len(months) + 1:
            total = to_number(cells[len(months) + 1].get("Value"))
        else:
            total = sum(values)
        accounts.append({
            "name": name,
            "section": section_name,
            "values": values + [0.0] * max(0, len(months) - len(values)),
            "total": total,
        })

    def walk_rows(rows: List[Dict[str, Any]], section_name: str):
        for row in rows:
            row_type = row.get("RowType")
            if row_type == "Section":
                header = row.get("Title") or ""
                next_section = section_name
                if header:
                    next_section = section_from_header(str(header)) or section_name
                walk_rows(row.get("Rows") or [], next_section)
            elif row_type == "Row":
                handle_row(row, section_name)

    for row in report.get("Rows") or []:
        row_type = row.get("RowType")
        if row_type == "Section":
            header = row.get("Title") or ""
            section = section_from_header(str(header))
            walk_rows(row.get("Rows") or [], section)
        elif row_type == "Row":
            handle_row(row, section)

    return {"months": months, "monthLabels": month_labels, "accounts": accounts}


def parse_xero_gl(report: Dict[str, Any]) -> Dict[str, Any]:
    columns = report.get("Columns") or []
    titles = [str(col.get("Title") or "").strip().lower() for col in columns]

    def cell_value(cells: List[Dict[str, Any]], idx: int) -> Optional[str]:
        if idx < 0 or idx >= len(cells):
            return None
        return cells[idx].get("Value")

    date_idx = next((i for i, t in enumerate(titles) if "date" in t), -1)
    desc_idx = next((i for i, t in enumerate(titles) if "description" in t or "narration" in t), -1)
    source_idx = next((i for i, t in enumerate(titles) if "source" in t or "reference" in t), -1)
    debit_idx = next((i for i, t in enumerate(titles) if "debit" in t), -1)
    credit_idx = next((i for i, t in enumerate(titles) if "credit" in t), -1)
    amount_idx = next((i for i, t in enumerate(titles) if "amount" in t and "balance" not in t), -1)

    txns = []

    def walk(rows: List[Dict[str, Any]], account: Optional[str]):
        for row in rows:
            row_type = row.get("RowType")
            if row_type == "Section":
                next_account = row.get("Title") or account
                walk(row.get("Rows") or [], next_account)
            elif row_type == "Row":
                cells = row.get("Cells") or []
                date = cell_value(cells, date_idx) or ""
                desc = cell_value(cells, desc_idx) or ""
                source = cell_value(cells, source_idx) or ""
                debit = to_number(cell_value(cells, debit_idx)) if debit_idx >= 0 else 0.0
                credit = to_number(cell_value(cells, credit_idx)) if credit_idx >= 0 else 0.0
                amount = debit - credit
                if amount_idx >= 0 and debit == 0.0 and credit == 0.0:
                    amount = to_number(cell_value(cells, amount_idx))
                    debit = amount if amount > 0 else 0.0
                    credit = -amount if amount < 0 else 0.0
                if not date and not desc and debit == 0.0 and credit == 0.0:
                    continue
                txns.append({
                    "account": account or "",
                    "date": date,
                    "source": source,
                    "description": desc,
                    "reference": source,
                    "debit": debit,
                    "credit": credit,
                    "amount": amount,
                })

    walk(report.get("Rows") or [], None)
    return {"txns": txns}


def upsert_connection(db: Session, user_id: str, token_data: Dict[str, Any]) -> models.XeroConnection:
    expires_in = int(token_data.get("expires_in", 1800))
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
    connection = db.query(models.XeroConnection).filter(models.XeroConnection.user_id == user_id).first()
    if connection is None:
        connection = models.XeroConnection(
            user_id=user_id,
            access_token=token_data["access_token"],
            refresh_token=token_data["refresh_token"],
            expires_at=expires_at,
        )
    else:
        connection.access_token = token_data["access_token"]
        connection.refresh_token = token_data.get("refresh_token", connection.refresh_token)
        connection.expires_at = expires_at
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return connection


def ensure_access_token(db: Session, connection: models.XeroConnection, config: Dict[str, str]) -> str:
    if connection.expires_at > datetime.utcnow() + timedelta(seconds=60):
        return connection.access_token

    response = httpx.post(
        XERO_TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "refresh_token": connection.refresh_token,
        },
        auth=(config["client_id"], config["client_secret"]),
        timeout=30,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Failed to refresh Xero token")
    token_data = response.json()
    connection = upsert_connection(db, connection.user_id, token_data)
    return connection.access_token


@router.get("/status")
def xero_status(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    connection = db.query(models.XeroConnection).filter(models.XeroConnection.user_id == user.id).first()
    return {
        "connected": bool(connection),
        "tenantId": connection.tenant_id if connection else None,
        "expiresAt": connection.expires_at.isoformat() if connection else None,
    }


@router.get("/authorize")
def xero_authorize(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = get_xero_config()
    state = secrets.token_urlsafe(24)
    db.add(models.XeroOAuthState(user_id=user.id, state=state))
    db.commit()
    params = {
        "response_type": "code",
        "client_id": config["client_id"],
        "redirect_uri": config["redirect_uri"],
        "scope": config["scopes"],
        "state": state,
    }
    query = str(httpx.QueryParams(params))
    url = f"{XERO_AUTHORIZE_URL}?{query}"
    return {"url": url}


@router.get("/callback")
def xero_callback(code: str, state: str, db: Session = Depends(get_db)):
    config = get_xero_config()
    stored_state = db.query(models.XeroOAuthState).filter(models.XeroOAuthState.state == state).first()
    if not stored_state:
        raise HTTPException(status_code=400, detail="Invalid Xero OAuth state")

    response = httpx.post(
        XERO_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": config["redirect_uri"],
        },
        auth=(config["client_id"], config["client_secret"]),
        timeout=30,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Failed to exchange Xero authorization code")

    token_data = response.json()
    upsert_connection(db, stored_state.user_id, token_data)
    db.query(models.XeroOAuthState).filter(models.XeroOAuthState.id == stored_state.id).delete()
    db.commit()

    return HTMLResponse("<html><body><h3>Xero connection successful. You can close this tab.</h3></body></html>")


@router.get("/tenants")
def xero_tenants(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = get_xero_config()
    connection = db.query(models.XeroConnection).filter(models.XeroConnection.user_id == user.id).first()
    if not connection:
        raise HTTPException(status_code=400, detail="Xero connection not found")
    access_token = ensure_access_token(db, connection, config)
    response = httpx.get(
        XERO_CONNECTIONS_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Failed to fetch Xero tenants")
    return response.json()


@router.post("/tenant")
def xero_set_tenant(
    payload: Dict[str, str],
    request: Request,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_csrf(request)
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id is required")
    connection = db.query(models.XeroConnection).filter(models.XeroConnection.user_id == user.id).first()
    if not connection:
        raise HTTPException(status_code=400, detail="Xero connection not found")
    connection.tenant_id = tenant_id
    db.add(connection)
    db.commit()
    return {"ok": True, "tenantId": tenant_id}


@router.post("/sync")
def xero_sync(
    payload: Dict[str, Any],
    request: Request,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_csrf(request)
    from_date = payload.get("from_date")
    to_date = payload.get("to_date")
    include_gl = payload.get("include_gl", True)
    if not from_date or not to_date:
        raise HTTPException(status_code=400, detail="from_date and to_date are required")

    config = get_xero_config()
    connection = db.query(models.XeroConnection).filter(models.XeroConnection.user_id == user.id).first()
    if not connection or not connection.tenant_id:
        raise HTTPException(status_code=400, detail="Xero tenant is not selected")

    access_token = ensure_access_token(db, connection, config)
    headers = {
        "Authorization": f"Bearer {access_token}",
        "xero-tenant-id": connection.tenant_id,
        "Accept": "application/json",
    }

    pl_response = httpx.get(
        XERO_REPORT_PL_URL,
        params={"fromDate": from_date, "toDate": to_date},
        headers=headers,
        timeout=60,
    )
    if pl_response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Failed to fetch Xero Profit & Loss")
    pl_data = pl_response.json()
    pl_report = (pl_data.get("Reports") or [None])[0]
    if not pl_report:
        raise HTTPException(status_code=502, detail="Xero Profit & Loss report was empty")
    pl_parsed = parse_xero_pl(pl_report)

    gl_parsed = None
    if include_gl:
        gl_response = httpx.get(
            XERO_REPORT_GL_URL,
            params={"fromDate": from_date, "toDate": to_date},
            headers=headers,
            timeout=60,
        )
        if gl_response.status_code >= 400:
            raise HTTPException(status_code=502, detail="Failed to fetch Xero General Ledger")
        gl_data = gl_response.json()
        gl_report = (gl_data.get("Reports") or [None])[0]
        if gl_report:
            gl_parsed = parse_xero_gl(gl_report)

    return {"pl": pl_parsed, "gl": gl_parsed, "tenantId": connection.tenant_id}
