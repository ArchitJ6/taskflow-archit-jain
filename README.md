# TaskFlow

A minimal but complete task management system with JWT auth, projects, and tasks — built as a full-stack engineering take-home assignment.

## 1. Overview

**TaskFlow** lets users register, log in, create projects, add tasks to those projects, and manage task status/priority/assignees.

| Layer | Technology |
|---|---|
| Backend | Python 3.12 + FastAPI (async) |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2 (async) |
| Migrations | Alembic |
| Auth | bcrypt (cost=12) + JWT (python-jose) |
| Logging | structlog (JSON in prod) |
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + Radix UI primitives |
| State | Zustand (auth) + TanStack Query (server state) |
| Routing | React Router v6 |

> **Language note:** Python FastAPI was used instead of Go per the engineer's preference and the assignment's allowance to "use a language you know well."

---

## 2. Architecture Decisions

### Backend

- **Async all the way:** `asyncpg` + `async_sessionmaker` means the server never blocks on DB I/O. Every route handler is `async def`.
- **Alembic migrations** (not `create_all`) for full schema control and down migrations for each change.
- **Pydantic v2** models for both request validation and response serialization — single source of truth.
- **Structured error responses** following the spec: `400` with `{ error, fields }`, distinct `401` vs `403`.
- **structlog** writes key=value pairs in dev and JSON in production for easy log parsing.
- **Graceful shutdown** via uvicorn's `--timeout-graceful-shutdown 10` flag.

### Frontend

- **TanStack Query** handles all server state (caching, loading states, background refetch). No manual loading booleans.
- **Zustand + localStorage** (via `persist` middleware) keeps auth state across page refreshes.
- **Optimistic UI** on task status toggle — updates the cache immediately, rolls back on error.
- **Dark mode** saved to `localStorage` under `taskflow-theme`, applied on mount before first paint.
- **shadcn/ui design pattern** without the CLI — Tailwind CSS with Radix primitives for accessible components.

### Bonus features implemented

- **Real-time task updates** via SSE on the project detail page.
- **Status drag/drop interactions** on the project board for moving tasks between columns.
- **Task CRUD feedback** with visible loading and error states throughout the task modal and project page.
- **Integration tests** covering auth, project, and task flows.

### Intentionally left out (with justification)

- No email verification or password reset flows.
- No role-based permissions beyond the assignment requirements for project edits and task deletion.
- No API versioning or production rate limiting.

---

## 3. Running Locally

> Prerequisites: Docker and Docker Compose only.

```bash
git clone https://github.com/your-name/taskflow
cd taskflow
cp .env.example .env
# Edit .env and set a real JWT_SECRET_KEY:
# JWT_SECRET_KEY=your-32-char-random-secret-here

docker compose up --build
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API docs (Swagger):** http://localhost:8000/docs

One `docker compose up` runs migrations, seeds the database, and starts all services.

---

## 4. Running Migrations

Migrations run **automatically** on API container start via `scripts/entrypoint.sh`:

```bash
alembic upgrade head
```

To run manually (requires Python env and a running Postgres):

```bash
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql+asyncpg://taskflow:taskflow@localhost:5432/taskflow alembic upgrade head
```

Down migrations:

```bash
alembic downgrade -1
```

---

## 5. Test Credentials

The seed script creates one test user automatically:

```
Email:    test@example.com
Password: password123
```

Project: **Website Redesign** with 3 tasks (done, in_progress, todo).

---

## 6. API Reference

Base URL: `http://localhost:8000`

All endpoints except `/auth/*` require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | `{ name, email, password }` → `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects?page=1&limit=20` | List user's projects (paginated) |
| POST | `/projects` | Create project `{ name, description? }` |
| GET | `/projects/:id` | Get project + tasks |
| PATCH | `/projects/:id` | Update `{ name?, description? }` (owner only) |
| DELETE | `/projects/:id` | Delete project + tasks (owner only) |
| GET | `/projects/:id/stats` | Task counts by status and assignee |

### Tasks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects/:id/tasks?status=&assignee=&page=&limit=` | Filtered, paginated task list |
| POST | `/projects/:id/tasks` | Create task |
| PATCH | `/tasks/:id` | Update any task field |
| DELETE | `/tasks/:id` | Delete task (project owner only) |

### Error format

```json
{ "error": "validation failed", "fields": { "email": "is required" } }
```

HTTP codes: `400` validation · `401` unauthenticated · `403` forbidden · `404` not found

Full interactive docs: **http://localhost:8000/docs**

---

## 7. What I'd Do With More Time

**Immediate improvements:**

- Fix the `updated_at` column — currently uses Python `datetime.now()` on update instead of a proper DB trigger or SQLAlchemy `onupdate` with server_default. A migration adding `CREATE TRIGGER` would handle this atomically.
- Expand drag-and-drop interactions beyond status transitions (for example: ordering within a column).

**What I intentionally cut:**

- Email verification and password reset flows.
- Role-based permissions beyond "owner only" for project edits.

**Quality / production readiness:**

- More integration tests, especially for 403 boundary cases.
- Rate limiting on auth endpoints.
- Proper database connection pool tuning (max_overflow, pool_size).
- API versioning (`/v1/`).
- HTTPS termination and CORS locked down to specific origins.

---

## Final Submission Status

- Full-stack implementation is complete.
- Backend tests pass locally.
- Frontend production build passes locally.
- `docker compose up` starts the stack with PostgreSQL, API, and frontend.

---

## Appendix A. Mock API Spec

This appendix is included for reference from the take-home brief. It applies to frontend-only candidates who build against a mock API instead of the real backend.

### Base URL

`http://localhost:4000`

### Auth endpoints

#### POST `/auth/register`

Request:

```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "secret123" }
```

Response `201`:

```json
{ "token": "<jwt>", "user": { "id": "uuid", "name": "Jane Doe", "email": "jane@example.com" } }
```

#### POST `/auth/login`

Request:

```json
{ "email": "jane@example.com", "password": "secret123" }
```

Response `200`:

```json
{ "token": "<jwt>", "user": { "id": "uuid", "name": "Jane Doe", "email": "jane@example.com" } }
```

### Projects endpoints

#### GET `/projects`

Requires `Authorization: Bearer <token>`.

Response `200`:

```json
{
	"projects": [
		{ "id": "uuid", "name": "Website Redesign", "description": "Q2 project", "owner_id": "uuid", "created_at": "2026-04-01T10:00:00Z" }
	]
}
```

#### POST `/projects`

Request:

```json
{ "name": "New Project", "description": "Optional description" }
```

Response `201`:

```json
{ "id": "uuid", "name": "New Project", "description": "Optional description", "owner_id": "uuid", "created_at": "2026-04-09T10:00:00Z" }
```

#### GET `/projects/:id`

Response `200`:

```json
{
	"id": "uuid", "name": "Website Redesign", "description": "Q2 project", "owner_id": "uuid",
	"tasks": [
		{ "id": "uuid", "title": "Design homepage", "status": "in_progress", "priority": "high", "assignee_id": "uuid", "due_date": "2026-04-15", "created_at": "...", "updated_at": "..." }
	]
}
```

#### PATCH `/projects/:id`

Request:

```json
{ "name": "Updated Name", "description": "Updated description" }
```

Response `200`: returns the updated project object.

#### DELETE `/projects/:id`

Response `204 No Content`.

### Tasks endpoints

#### GET `/projects/:id/tasks?status=todo&assignee=uuid`

Response `200`:

```json
{ "tasks": [ /* task objects */ ] }
```

#### POST `/projects/:id/tasks`

Request:

```json
{ "title": "Design homepage", "description": "...", "priority": "high", "assignee_id": "uuid", "due_date": "2026-04-15" }
```

Response `201`: returns the created task object.

#### PATCH `/tasks/:id`

Request:

```json
{ "title": "Updated title", "status": "done", "priority": "low", "assignee_id": "uuid", "due_date": "2026-04-20" }
```

Response `200`: returns the updated task object.

#### DELETE `/tasks/:id`

Response `204 No Content`.

### Error responses

```json
{ "error": "validation failed", "fields": { "email": "is required" } }
```

```json
{ "error": "unauthorized" }
```

```json
{ "error": "forbidden" }
```

```json
{ "error": "not found" }
```

---

## Submission Notes

### Automatic Disqualifiers

The following would result in immediate rejection, regardless of other quality:

- App does not run with `docker compose up`
- No database migrations
- Passwords stored in plaintext
- JWT secret hardcoded in source code instead of `.env`
- No README
- Submission after the 72-hour deadline without prior notice

### Submission Instructions

- Create a public GitHub repository named `taskflow-[your-name]`.
- Use a monorepo with `/backend` and `/frontend`, or two linked repos with `docker-compose.yml` at the root.
- Commit `.env.example` and never commit `.env`.
- If secrets are ever committed accidentally, rotate them before submission.
- Send the GitHub URL back before the deadline.
- Be prepared to walk through the code on a review call.
