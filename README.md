# TaskFlow

A production-ready, full-stack task management system with JWT authentication, projects, and tasks — built as an engineering take-home assignment.

---

## Overview

TaskFlow allows users to:

- Register and authenticate securely  
- Create and manage projects  
- Add and organize tasks with status, priority, and assignees  
- Receive real-time updates via Server-Sent Events (SSE)  

The system is designed with performance, scalability, and developer experience in mind, using a fully asynchronous backend and a reactive frontend with optimistic UI updates.

---

## Tech Stack

| Layer      | Technology |
|-----------|-----------|
| Backend   | Python 3.12 + FastAPI (async) |
| Database  | PostgreSQL 16 |
| ORM       | SQLAlchemy 2 (async) |
| Migrations| Alembic |
| Auth      | bcrypt (cost=12) + JWT (python-jose) |
| Logging   | structlog (JSON in production) |
| Frontend  | React 18 + TypeScript + Vite |
| UI        | Tailwind CSS + Radix UI primitives |
| State     | Zustand (auth) + TanStack Query |
| Routing   | React Router v6 |

> FastAPI was chosen over Go based on familiarity, as allowed by the assignment.

---

## Key Highlights

- ⚡ Fully async backend (no blocking I/O)  
- 🔄 Real-time task updates via SSE  
- ⚡ Optimistic UI for instant interactions  
- 🧪 Integration-tested auth, project, and task flows  
- 🐳 One-command Docker setup (migrations + seed + services)  

---

## Architecture Decisions

### Backend

- Async-first design using `asyncpg` and SQLAlchemy async sessions  
- Alembic migrations (not `create_all`) for full schema control and rollback support  
- Pydantic v2 models as a single source of truth  
- Structured error responses (`{ error, fields }`)  
- Clear separation of `401` (unauthenticated) vs `403` (forbidden)  
- Structured logging with `structlog` (JSON in production)  
- Graceful shutdown via uvicorn  

### Frontend

- TanStack Query for server state (caching, background refetching)  
- Zustand with persistence for auth state  
- Optimistic updates for task status changes  
- Dark mode persisted via `localStorage`  
- Accessible components using Tailwind + Radix primitives  

---

## Bonus Features

- Real-time updates using SSE on project pages  
- Drag-and-drop task status transitions  
- Loading and error states across all task interactions  
- Integration tests for core flows  

---

## Running Locally

**Prerequisites:** Docker + Docker Compose  

```bash
git clone https://github.com/ArchitJ6/taskflow-archit-jain
cd taskflow-archit-jain
cp .env.example .env

# Set a secure JWT secret
# JWT_SECRET_KEY=your-32-char-secret

docker compose up --build
```

### Services

- Frontend → http://localhost:3000  
- Backend → http://localhost:8000  
- API Docs → http://localhost:8000/docs  

Runs migrations, seeds data, and starts all services.

---

## Running Migrations

### Automatic (on startup)

```bash
alembic upgrade head
```

### Manual

```bash
cd backend
pip install -r requirements.txt

DATABASE_URL=postgresql+asyncpg://taskflow:taskflow@localhost:5432/taskflow \
alembic upgrade head
```

### Rollback

```bash
alembic downgrade -1
```

---

## Test Credentials

```
Email:    test@example.com
Password: password123
```

Seeded project: **Website Redesign** with tasks across `todo`, `in_progress`, and `done`.

---

## API Reference

**Base URL:** `http://localhost:8000`  

All endpoints except `/auth/*` require:

```
Authorization: Bearer <token>
```

### Auth

| Method | Endpoint |
|--------|---------|
| POST   | `/auth/register` |
| POST   | `/auth/login` |

### Projects

| Method | Endpoint | Description |
|--------|---------|------------|
| GET    | `/projects` | List projects (paginated) |
| POST   | `/projects` | Create project |
| GET    | `/projects/:id` | Get project with tasks |
| PATCH  | `/projects/:id` | Update project (owner only) |
| DELETE | `/projects/:id` | Delete project |
| GET    | `/projects/:id/stats` | Task statistics |

### Tasks

| Method | Endpoint |
|--------|---------|
| GET    | `/projects/:id/tasks` |
| POST   | `/projects/:id/tasks` |
| PATCH  | `/tasks/:id` |
| DELETE | `/tasks/:id` |

---

## Error Format

```json
{ "error": "validation failed", "fields": { "email": "is required" } }
```

### HTTP Codes

- `400` — Validation  
- `401` — Unauthorized  
- `403` — Forbidden  
- `404` — Not found  

---

## What’s Intentionally Out of Scope

- Email verification and password reset flows  
- Advanced role-based permissions  
- API versioning and rate limiting  

---

## Future Improvements

### Data Consistency
- Replace `updated_at` logic with a DB trigger or `onupdate`

### Scalability
- API versioning (`/v1`)  
- Rate limiting  

### Reliability
- More integration tests (especially permission edge cases)  

### UX
- Drag-and-drop ordering within columns  

---

## Final Notes

This project prioritizes correctness, performance, and developer experience, while remaining simple and extensible toward production use.
