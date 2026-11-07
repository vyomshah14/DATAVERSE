"""
DATAVERSE Backend Service Entrypoint.
FastAPI application with CORS, route mounting, and lifecycle logging.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.core.database import db_manager
from backend.app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages application startup and graceful shutdown hooks."""
    yield
    # Graceful connection pool termination
    await db_manager.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for DATAVERSE 3D Living Data Center Simulator.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration for frontend simulation console
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API router
app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["Root"])
async def root():
    """Root status greeting endpoint."""
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/api/v1/health",
    }

