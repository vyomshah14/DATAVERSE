"""
Root API router registration for DATAVERSE backend.
"""

from fastapi import APIRouter
from backend.app.schemas.health import HealthResponse
from backend.app.core.config import settings

api_router = APIRouter()


@api_router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check() -> HealthResponse:
    """Returns the operational status of the DATAVERSE simulator API."""
    return HealthResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )
