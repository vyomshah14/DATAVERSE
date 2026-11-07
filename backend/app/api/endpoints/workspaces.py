"""
Workspace REST API Endpoints for DATAVERSE.
Implements authenticated CRUD operations with strict tenant isolation.
"""

from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status, Response

from backend.app.schemas.auth import AuthenticatedUser
from backend.app.schemas.workspace import Workspace, WorkspaceCreate, WorkspaceUpdate
from backend.app.repositories.workspace import (
    WorkspaceRepository,
    DuplicateWorkspaceNameError,
)
from backend.app.api.deps import get_current_user, get_workspace_repository

router = APIRouter()


@router.post(
    "",
    response_model=Workspace,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new workspace",
    description="Provisions a new multi-tenant workspace owned exclusively by the authenticated operator.",
    responses={
        201: {"description": "Workspace provisioned successfully"},
        400: {"description": "Invalid payload or name format"},
        401: {"description": "Authentication missing or invalid"},
        409: {"description": "Active workspace with this name already exists for operator"},
    },
)
async def create_workspace(
    workspace_in: WorkspaceCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repository),
) -> Workspace:
    try:
        return await workspace_repo.create(workspace_in, owner_id=current_user.id)
    except DuplicateWorkspaceNameError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get(
    "",
    response_model=List[Workspace],
    status_code=status.HTTP_200_OK,
    summary="List operator workspaces",
    description="Lists all workspaces owned by the authenticated operator. Soft-deleted workspaces are excluded by default.",
    responses={
        200: {"description": "List of active workspaces owned by caller"},
        401: {"description": "Authentication missing or invalid"},
    },
)
async def list_workspaces(
    include_deleted: bool = Query(
        False, description="Whether to include soft-deleted workspaces in the response"
    ),
    current_user: AuthenticatedUser = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repository),
) -> List[Workspace]:
    return await workspace_repo.list_by_owner(
        owner_id=current_user.id,
        include_deleted=include_deleted,
    )


@router.get(
    "/{workspace_id}",
    response_model=Workspace,
    status_code=status.HTTP_200_OK,
    summary="Retrieve workspace by ID",
    description="Retrieves an active workspace by ID. Returns 404 if the workspace is missing, soft-deleted, or owned by another user.",
    responses={
        200: {"description": "Workspace retrieved successfully"},
        401: {"description": "Authentication missing or invalid"},
        404: {"description": "Workspace not found"},
    },
)
async def get_workspace(
    workspace_id: UUID = Path(..., description="Unique workspace identifier"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repository),
) -> Workspace:
    workspace = await workspace_repo.get_by_id(workspace_id, owner_id=current_user.id)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    return workspace


@router.patch(
    "/{workspace_id}",
    response_model=Workspace,
    status_code=status.HTTP_200_OK,
    summary="Update workspace",
    description="Updates metadata for an active workspace. Changing ownership, ID, or creation timestamp is strictly disallowed.",
    responses={
        200: {"description": "Workspace updated successfully"},
        401: {"description": "Authentication missing or invalid"},
        404: {"description": "Workspace not found"},
        409: {"description": "New name conflicts with another active workspace"},
    },
)
async def update_workspace(
    workspace_update: WorkspaceUpdate,
    workspace_id: UUID = Path(..., description="Unique workspace identifier"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repository),
) -> Workspace:
    try:
        updated = await workspace_repo.update(
            workspace_id,
            owner_id=current_user.id,
            workspace_update=workspace_update,
        )
    except DuplicateWorkspaceNameError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    return updated


@router.delete(
    "/{workspace_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete workspace",
    description="Marks a workspace as soft-deleted by setting deleted_at. Preserves data integrity without physical row removal.",
    responses={
        204: {"description": "Workspace soft-deleted successfully"},
        401: {"description": "Authentication missing or invalid"},
        404: {"description": "Workspace not found or already deleted"},
    },
)
async def delete_workspace(
    workspace_id: UUID = Path(..., description="Unique workspace identifier"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repository),
) -> Response:
    success = await workspace_repo.soft_delete(workspace_id, owner_id=current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

