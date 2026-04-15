"""Integration tests for projects endpoints."""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.anyio
async def test_create_project(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/projects",
            json={"name": "Test Project", "description": "A test project"},
            headers=auth_headers,
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Project"
    assert "id" in data


@pytest.mark.anyio
async def test_list_projects(auth_headers, created_project):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/projects", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "projects" in data
    assert len(data["projects"]) >= 1


@pytest.mark.anyio
async def test_get_project_not_found(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/projects/00000000-0000-0000-0000-000000000999",
            headers=auth_headers,
        )
    assert resp.status_code == 404
    assert resp.json()["error"] == "not found"


@pytest.mark.anyio
async def test_update_project_forbidden(auth_headers, other_user_project):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.patch(
            f"/projects/{other_user_project['id']}",
            json={"name": "Hacked"},
            headers=auth_headers,
        )
    assert resp.status_code == 403
