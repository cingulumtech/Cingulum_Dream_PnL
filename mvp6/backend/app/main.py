import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from sqlalchemy.exc import SQLAlchemyError

ENV_PATHS = [
    Path(__file__).resolve().parents[2] / ".env",
    Path(__file__).resolve().parents[1] / ".env",
]

for env_path in ENV_PATHS:
    if env_path.exists():
        load_dotenv(env_path)
        break

from .routers import auth, ledger, snapshots, state, users, xero

APP_NAME = os.environ.get("APP_NAME", "Accounting Atlas API")

app = FastAPI(title=APP_NAME)

raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
allow_origin_regex = None
if "*" in origins:
    origins = ["*"]
    allow_origin_regex = ".*"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(auth.router)
app.include_router(ledger.router)
app.include_router(state.router)
app.include_router(snapshots.router)
app.include_router(users.router)
app.include_router(xero.router)


@app.exception_handler(SQLAlchemyError)
def database_exception_handler(request, exc):
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})


@app.get("/api/health")
def health():
    return {"status": "ok"}
