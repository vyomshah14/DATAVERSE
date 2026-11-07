"""
Root API router registration for DATAVERSE backend.
"""

from fastapi import APIRouter, Depends
from backend.app.schemas.health import HealthResponse
from backend.app.schemas.auth import AuthenticatedUser, CurrentUserResponse
from backend.app.api.deps import get_current_user
from backend.app.api.endpoints.workspaces import router as workspaces_router
from backend.app.api.endpoints.datacenters import router as datacenters_router
from backend.app.core.config import settings

api_router = APIRouter()

# Mount feature routers
api_router.include_router(workspaces_router, prefix="/workspaces", tags=["Workspaces"])
api_router.include_router(datacenters_router, tags=["Data Centers"])


@api_router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check() -> HealthResponse:
    """Returns the operational status of the DATAVERSE simulator API."""
    return HealthResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )


@api_router.get(
    "/auth/me",
    response_model=CurrentUserResponse,
    tags=["Authentication"],
    summary="Get current authenticated operator identity",
)
async def get_my_identity(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> CurrentUserResponse:
    """Returns safe identity information of the authenticated operator."""
    return CurrentUserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        user_metadata=current_user.user_metadata,
        authenticated=True,
    )

