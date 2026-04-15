"""Integration tests for task endpoints."""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.anyio
async def test_create_task(auth_headers, created_project):
    pid = created_project["id"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            f"/projects/{pid}/tasks",
            json={"title": "My Task", "priority": "high", "status": "todo"},
            headers=auth_headers,
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Task"
    assert data["status"] == "todo"


@pytest.mark.anyio
async def test_list_tasks_with_status_filter(auth_headers, created_project):
    pid = created_project["id"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create two tasks with different statuses
        await client.post(
            f"/projects/{pid}/tasks",
            json={"title": "Todo Task", "status": "todo"},
            headers=auth_headers,
        )
        await client.post(
            f"/projects/{pid}/tasks",
            json={"title": "Done Task", "status": "done"},
            headers=auth_headers,
        )
        # Filter by status=done
        resp = await client.get(
            f"/projects/{pid}/tasks?status=done",
            headers=auth_headers,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert all(t["status"] == "done" for t in data["tasks"])


@pytest.mark.anyio
async def test_update_task_status(auth_headers, created_project):
    pid = created_project["id"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create_resp = await client.post(
            f"/projects/{pid}/tasks",
            json={"title": "Status Test Task"},
            headers=auth_headers,
        )
        task_id = create_resp.json()["id"]
        update_resp = await client.patch(
            f"/tasks/{task_id}",
            json={"status": "in_progress"},
            headers=auth_headers,
        )
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "in_progress"


@pytest.mark.anyio
async def test_update_task_status_forbidden_for_other_user(auth_headers, created_project):
    pid = created_project["id"]
    import uuid

    other_email = f"other-{uuid.uuid4().hex[:8]}@test.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create_resp = await client.post(
            f"/projects/{pid}/tasks",
            json={"title": "Protected Task"},
            headers=auth_headers,
        )
        task_id = create_resp.json()["id"]

        other_reg = await client.post(
            "/auth/register",
            json={"name": "Other User", "email": other_email, "password": "password123"},
        )
        other_token = other_reg.json()["token"]
        other_headers = {"Authorization": f"Bearer {other_token}"}

        update_resp = await client.patch(
            f"/tasks/{task_id}",
            json={"status": "done"},
            headers=other_headers,
        )

    assert update_resp.status_code == 403
    assert update_resp.json()["detail"]["error"] == "forbidden"


@pytest.mark.anyio
async def test_delete_task(auth_headers, created_project):
    pid = created_project["id"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create_resp = await client.post(
            f"/projects/{pid}/tasks",
            json={"title": "Delete Me"},
            headers=auth_headers,
        )
        task_id = create_resp.json()["id"]
        delete_resp = await client.delete(f"/tasks/{task_id}", headers=auth_headers)
    assert delete_resp.status_code == 204


@pytest.mark.anyio
async def test_delete_task_forbidden_for_other_user(auth_headers, created_project):
    pid = created_project["id"]
    import uuid

    other_email = f"other-{uuid.uuid4().hex[:8]}@test.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create_resp = await client.post(
            f"/projects/{pid}/tasks",
            json={"title": "Protected Delete Task"},
            headers=auth_headers,
        )
        task_id = create_resp.json()["id"]

        other_reg = await client.post(
            "/auth/register",
            json={"name": "Other User", "email": other_email, "password": "password123"},
        )
        other_token = other_reg.json()["token"]
        other_headers = {"Authorization": f"Bearer {other_token}"}

        delete_resp = await client.delete(f"/tasks/{task_id}", headers=other_headers)

    assert delete_resp.status_code == 403
    assert delete_resp.json()["detail"]["error"] == "forbidden"
