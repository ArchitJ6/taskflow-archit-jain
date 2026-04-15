"""Pytest fixtures for integration tests."""
import asyncio
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Set test environment before importing app
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://taskflow:taskflow@localhost:5432/taskflow_test"
)

from app.main import app


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def registered_user():
    """Register a fresh user and return user data."""
    import uuid
    email = f"user-{uuid.uuid4().hex[:8]}@test.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/auth/register",
            json={"name": "Test User", "email": email, "password": "password123"},
        )
    assert resp.status_code == 201
    return resp.json()["user"] | {"password": "password123"}


@pytest_asyncio.fixture
async def auth_headers(registered_user):
    """Return auth headers for a registered user."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/auth/login",
            json={"email": registered_user["email"], "password": "password123"},
        )
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def created_project(auth_headers):
    """Create a project and return its data."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/projects",
            json={"name": "Fixture Project", "description": "Created by fixture"},
            headers=auth_headers,
        )
    return resp.json()


@pytest_asyncio.fixture
async def other_user_project():
    """Create a project owned by a different user. Return project data."""
    import uuid
    email = f"other-{uuid.uuid4().hex[:8]}@test.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        reg = await client.post(
            "/auth/register",
            json={"name": "Other", "email": email, "password": "password123"},
        )
        token = reg.json()["token"]
        proj = await client.post(
            "/projects",
            json={"name": "Other's Project"},
            headers={"Authorization": f"Bearer {token}"},
        )
    return proj.json()
