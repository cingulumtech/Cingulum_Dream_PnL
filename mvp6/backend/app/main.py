import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import Base, engine
from .routers import auth, state, snapshots, users

APP_NAME = os.environ.get("APP_NAME", "Accounting Atlas API")

app = FastAPI(title=APP_NAME)

origins = [origin.strip() for origin in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if origin]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(auth.router)
app.include_router(state.router)
app.include_router(snapshots.router)
app.include_router(users.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
