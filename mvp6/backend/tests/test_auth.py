from app.auth import CSRF_COOKIE_NAME


def test_register_and_me(client):
    resp = client.post("/api/auth/register", json={"email": "user@example.com", "password": "pass1234", "remember": False})
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["email"] == "user@example.com"

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "user@example.com"


def test_login_invalid(client):
    client.post("/api/auth/register", json={"email": "user2@example.com", "password": "pass1234", "remember": False})
    resp = client.post("/api/auth/login", json={"email": "user2@example.com", "password": "wrong", "remember": False})
    assert resp.status_code == 401


def test_logout_clears_session(client):
    client.post("/api/auth/register", json={"email": "user3@example.com", "password": "pass1234", "remember": False})
    csrf = client.cookies.get(CSRF_COOKIE_NAME)
    resp = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    assert resp.status_code == 200
    me = client.get("/api/auth/me")
    assert me.status_code == 401
