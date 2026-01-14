from app.auth import CSRF_COOKIE_NAME


def register(client, email):
    resp = client.post("/api/auth/register", json={"email": email, "password": "pass1234", "remember": False, "invite_code": "test-code"})
    assert resp.status_code == 200
    csrf = client.cookies.get(CSRF_COOKIE_NAME)
    return csrf


def test_snapshot_share_rbac(client):
    csrf = register(client, "owner@example.com")
    payload = {
        "name": "Q1 Snapshot",
        "payload": {"schema_version": "v1", "data": {"summary": "payload"}},
    }
    create_resp = client.post("/api/snapshots", json=payload, headers={"X-CSRF-Token": csrf})
    assert create_resp.status_code == 200
    snapshot_id = create_resp.json()["id"]

    # Owner can view
    get_resp = client.get(f"/api/snapshots/{snapshot_id}")
    assert get_resp.status_code == 200

    # Share with second user
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    register(client, "editor@example.com")
    client.post("/api/auth/logout", headers={"X-CSRF-Token": client.cookies.get(CSRF_COOKIE_NAME)})

    # back to owner
    login_resp = client.post("/api/auth/login", json={"email": "owner@example.com", "password": "pass1234", "remember": False})
    assert login_resp.status_code == 200
    csrf = client.cookies.get(CSRF_COOKIE_NAME)
    share_resp = client.post(
        f"/api/snapshots/{snapshot_id}/shares",
        json={"email": "editor@example.com", "role": "editor"},
        headers={"X-CSRF-Token": csrf},
    )
    assert share_resp.status_code == 200

    # editor can update but cannot share
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    login_resp = client.post("/api/auth/login", json={"email": "editor@example.com", "password": "pass1234", "remember": False})
    assert login_resp.status_code == 200
    csrf = client.cookies.get(CSRF_COOKIE_NAME)
    update_resp = client.patch(
        f"/api/snapshots/{snapshot_id}",
        json={"name": "Updated"},
        headers={"X-CSRF-Token": csrf},
    )
    assert update_resp.status_code == 200
    share_block = client.post(
        f"/api/snapshots/{snapshot_id}/shares",
        json={"email": "owner@example.com", "role": "viewer"},
        headers={"X-CSRF-Token": csrf},
    )
    assert share_block.status_code == 403
