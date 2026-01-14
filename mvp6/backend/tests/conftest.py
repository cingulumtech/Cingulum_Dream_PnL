import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db import Base, get_db


@pytest.fixture()
def client():
    os.environ["ALLOWED_SIGNUP_CODES"] = "test-code"
    db_url = "sqlite:///./test.db"
    if os.path.exists("test.db"):
        os.remove("test.db")
    engine = create_engine(db_url, connect_args={"check_same_thread": False}, future=True)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
    if os.path.exists("test.db"):
        os.remove("test.db")
