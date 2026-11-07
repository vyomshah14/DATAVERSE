"""
Data Center REST API Endpoints for DATAVERSE.
Implements multi-tenant CRUD operations for physical facilities scoped through parent workspaces.
"""

from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Path, status, Response

from backend.app.schemas.auth import AuthenticatedUser
from backend.app.schemas.datacenter import (
    DataCenter,
    DataCenterCreate,
    DataCenterUpdate,
)
from backend.app.repositories.datacenter import (
    DataCenterRepository,
    DuplicateDataCenterNameError,
)
from backend.app.api.deps import get_current_user, get_datacenter_repository

router = APIRouter()


@router.post(
    "/workspaces/{workspace_id}/datacenters",
    response_model=DataCenter,
    status_code=status.HTTP_201_CREATED,
    summary="Create data center facility",
    description="Provisions a physical data center simulation facility within a user-owned workspace.",
    responses={
        201: {"description": "Data center facility created successfully"},
        401: {"description": "Authentication missing or invalid"},
        404: {"description": "Workspace not found or not owned by caller"},
        409: {"description": "Facility with this name already exists in workspace"},
    },
)
async def create_datacenter(
    datacenter_in: DataCenterCreate,
    workspace_id: UUID = Path(..., description="Unique parent workspace identifier"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    datacenter_repo: DataCenterRepository = Depends(get_datacenter_repository),
) -> DataCenter:
    try:
        datacenter = await datacenter_repo.create(
            workspace_id=workspace_id,
            data_center_in=datacenter_in,
            owner_id=current_user.id,
        )
    except DuplicateDataCenterNameError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    if datacenter is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    return datacenter


@router.get(
    "/workspaces/{workspace_id}/datacenters",
    response_model=List[DataCenter],
    status_code=status.HTTP_200_OK,
    summary="List data centers in workspace",
    description="Lists all data center facilities inside a user-owned workspace.",
    responses={
        200: {"description": "List of data center facilities in the workspace"},
        401: {"description": "Authentication missing or invalid"},
        404: {"description": "Workspace not found or not owned by caller"},
    },
)
async def list_datacenters(
    workspace_id: UUID = Path(..., description="Unique parent workspace identifier"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    datacenter_repo: DataCenterRepository = Depends(get_datacenter_repository),
) -> List[DataCenter]:
    # Verify parent workspace tenancy first
    if not await datacenter_repo.workspace_exists(workspace_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    return await datacenter_repo.list_by_workspace(
        workspace_id=workspace_id,
        owner_id=current_user.id,
    )


@router.get(
    "/workspaces/{workspace_id}/datacenters/{datacenter_id}",
    response_model=DataCenter,
    status_code=status.HTTP_200_OK,
    summary="Retrieve data center facility by ID",
    description="Retrieves a single data center facility by ID within a user-owned workspace.",
    responses={
        200: {"description": "Data center facility retrieved successfully"},
        401: {"description": "Authentication missing or invalid"},
        404: {"description": "Data center or workspace not found"},
    },
)
async def get_datacenter(
    workspace_id: UUID = Path(..., description="Unique parent workspace identifier"),
    datacenter_id: UUID = Path(..., description="Unique data center facility identifier"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    datacenter_repo: DataCenterRepository = Depends(get_datacenter_repository),
) -> DataCenter:
    datacenter = await datacenter_repo.get_by_id(
        data_center_id=datacenter_id,
        workspace_id=workspace_id,
        owner_id=current_user.id,
    )
    if datacenter is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data center not found.",
        )
    return datacenter


@router.patch(
    "/workspaces/{workspace_id}/datacenters/{datacenter_id}",
    response_model=DataCenter,
    status_code=status.HTTP_200_OK,
    summary="Update data center facility",
    description="Updates metadata or topology configuration for a facility in a user-owned workspace.",
    responses={
        200: {"description": "Data center updated successfully"},
        401: {"description": "Authentication missing or invalid"},
        404: {"description": "Data center or workspace not found"},
        409: {"description": "New name conflicts with another facility in the workspace"},
    },
)
async def update_datacenter(
    datacenter_update: DataCenterUpdate,
    workspace_id: UUID = Path(..., description="Unique parent workspace identifier"),
    datacenter_id: UUID = Path(..., description="Unique data center facility identifier"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    datacenter_repo: DataCenterRepository = Depends(get_datacenter_repository),
) -> DataCenter:
    try:
        updated = await datacenter_repo.update(
            data_center_id=datacenter_id,
            workspace_id=workspace_id,
            data_center_update=datacenter_update,
            owner_id=current_user.id,
        )
    except DuplicateDataCenterNameError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data center not found.",
        )
    return updated


@router.delete(
    "/workspaces/{workspace_id}/datacenters/{datacenter_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete data center facility",
    description="Removes a data center facility from a user-owned workspace.",
    responses={
        204: {"description": "Data center deleted successfully"},
        401: {"description": "Authentication missing or invalid"},
        404: {"description": "Data center or workspace not found"},
    },
)
async def delete_datacenter(
    workspace_id: UUID = Path(..., description="Unique parent workspace identifier"),
    datacenter_id: UUID = Path(..., description="Unique data center facility identifier"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    datacenter_repo: DataCenterRepository = Depends(get_datacenter_repository),
) -> Response:
    deleted = await datacenter_repo.delete(
        data_center_id=datacenter_id,
        workspace_id=workspace_id,
        owner_id=current_user.id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data center not found.",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

