from app.auth import CSRF_COOKIE_NAME


def register(client, email):
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": "pass1234", "remember": False, "invite_code": "test-code"},
    )
    assert resp.status_code == 200
    return client.cookies.get(CSRF_COOKIE_NAME)


def test_upsert_and_delete_txn_override(client):
    csrf = register(client, "override@example.com")
    payload = {
        "source": "XERO_GL",
        "document_id": "BILL-123",
        "line_item_id": None,
        "hash": "abc123",
        "treatment": "NON_OPERATING",
        "deferral_start_month": None,
        "deferral_months": None,
        "deferral_include_in_operating_kpis": None,
    }
    upsert = client.put("/api/ledger/overrides", json=payload, headers={"X-CSRF-Token": csrf})
    assert upsert.status_code == 200
    override_id = upsert.json()["id"]

    listed = client.get("/api/ledger/overrides")
    assert listed.status_code == 200
    assert any(item["id"] == override_id for item in listed.json())

    deleted = client.delete(f"/api/ledger/overrides/{override_id}", headers={"X-CSRF-Token": csrf})
    assert deleted.status_code == 200
