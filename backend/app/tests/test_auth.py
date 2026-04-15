"""Integration tests for auth endpoints."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
import uuid

from app.main import app


@pytest.mark.anyio
async def test_register_success():
    email = f"alice-{uuid.uuid4().hex[:8]}@test.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/auth/register",
            json={"name": "Alice", "email": email, "password": "password123"},
        )
    assert resp.status_code == 201
    data = resp.json()
    assert "token" in data
    assert data["user"]["email"] == email


@pytest.mark.anyio
async def test_register_duplicate_email(registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/auth/register",
            json={"name": "Bob", "email": registered_user["email"], "password": "password123"},
        )
    assert resp.status_code == 400
    assert resp.json()["error"] == "validation failed"


@pytest.mark.anyio
async def test_login_success(registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/auth/login",
            json={"email": registered_user["email"], "password": "password123"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["user"]["email"] == registered_user["email"]


@pytest.mark.anyio
async def test_login_wrong_password(registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/auth/login",
            json={"email": registered_user["email"], "password": "wrongpassword"},
        )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_protected_route_without_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/projects")
    assert resp.status_code == 401
