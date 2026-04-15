import logging
import signal
from contextlib import asynccontextmanager

import structlog
import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.config import settings
from app.routers import auth, events, projects, tasks, users

# Configure structlog
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer() if settings.APP_ENV == "development" else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("taskflow.startup", env=settings.APP_ENV)
    yield
    log.info("taskflow.shutdown")


app = FastAPI(
    title="TaskFlow API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(events.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(users.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    fields = {}
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err["loc"])
        fields[field] = err["msg"]
    return JSONResponse(
        status_code=400,
        content={"error": "validation failed", "fields": fields},
    )


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
    fields = {}
    for err in exc.errors():
        loc = [str(loc) for loc in err.get("loc", []) if str(loc) not in {"body", "query", "path"}]
        field = ".".join(loc) if loc else "request"
        fields[field] = err.get("msg", "invalid value")

    return JSONResponse(
        status_code=400,
        content={"error": "validation failed", "fields": fields},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    log.error("unhandled_error", path=request.url.path, error=str(exc))
    return JSONResponse(status_code=500, content={"error": "internal server error"})
