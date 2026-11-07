"""
Workspace Repository Interface and Implementation for DATAVERSE.
Handles database access for multi-tenant workspaces with strict ownership filtering.
"""

from abc import ABC, abstractmethod
from uuid import UUID
from typing import Optional, List
import asyncpg

from backend.app.schemas.workspace import Workspace, WorkspaceCreate, WorkspaceUpdate


class DuplicateWorkspaceNameError(Exception):
    """Raised when an active workspace with the same name already exists for the owner."""

    pass


class IWorkspaceRepository(ABC):
    """Abstract interface defining workspace database operations."""

    @abstractmethod
    async def create(self, workspace_in: WorkspaceCreate, owner_id: UUID) -> Workspace:
        """Provisions a new workspace strictly bound to the authenticated owner."""
        pass

    @abstractmethod
    async def get_by_id(self, workspace_id: UUID, owner_id: UUID) -> Optional[Workspace]:
        """Retrieves an active workspace by ID enforcing owner tenancy."""
        pass

    @abstractmethod
    async def list_by_owner(
        self, owner_id: UUID, include_deleted: bool = False
    ) -> List[Workspace]:
        """Lists all workspaces belonging to the authenticated owner."""
        pass

    @abstractmethod
    async def update(
        self,
        workspace_id: UUID,
        owner_id: UUID,
        workspace_update: WorkspaceUpdate,
    ) -> Optional[Workspace]:
        """Updates workspace metadata for an active workspace owned by the user."""
        pass

    @abstractmethod
    async def soft_delete(self, workspace_id: UUID, owner_id: UUID) -> bool:
        """Marks a workspace as soft-deleted (deleted_at = now)."""
        pass


class WorkspaceRepository(IWorkspaceRepository):
    """
    Concrete asyncpg implementation of IWorkspaceRepository.
    Enforces owner scoping at the SQL parameter level as defense-in-depth with RLS.
    """

    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn

    async def create(self, workspace_in: WorkspaceCreate, owner_id: UUID) -> Workspace:
        query = """
            INSERT INTO public.workspaces (owner_id, name, description)
            VALUES ($1, $2, $3)
            RETURNING id, owner_id, name, description, created_at, updated_at, deleted_at;
        """
        try:
            row = await self.conn.fetchrow(
                query,
                owner_id,
                workspace_in.name.strip(),
                workspace_in.description,
            )
        except asyncpg.UniqueViolationError as exc:
            raise DuplicateWorkspaceNameError(
                "An active workspace with this name already exists."
            ) from exc

        return Workspace.model_validate(dict(row))

    async def get_by_id(self, workspace_id: UUID, owner_id: UUID) -> Optional[Workspace]:
        query = """
            SELECT id, owner_id, name, description, created_at, updated_at, deleted_at
            FROM public.workspaces
            WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL;
        """
        row = await self.conn.fetchrow(query, workspace_id, owner_id)
        if row is None:
            return None
        return Workspace.model_validate(dict(row))

    async def list_by_owner(
        self, owner_id: UUID, include_deleted: bool = False
    ) -> List[Workspace]:
        query = """
            SELECT id, owner_id, name, description, created_at, updated_at, deleted_at
            FROM public.workspaces
            WHERE owner_id = $1 AND ($2 = true OR deleted_at IS NULL)
            ORDER BY created_at DESC;
        """
        rows = await self.conn.fetch(query, owner_id, include_deleted)
        return [Workspace.model_validate(dict(r)) for r in rows]

    async def update(
        self,
        workspace_id: UUID,
        owner_id: UUID,
        workspace_update: WorkspaceUpdate,
    ) -> Optional[Workspace]:
        # Fetch current record first to ensure it exists and belongs to owner
        current = await self.get_by_id(workspace_id, owner_id)
        if current is None:
            return None

        new_name = (
            workspace_update.name.strip()
            if workspace_update.name is not None
            else current.name
        )
        new_desc = (
            workspace_update.description
            if workspace_update.description is not None
            else current.description
        )

        query = """
            UPDATE public.workspaces
            SET name = $3,
                description = $4
            WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
            RETURNING id, owner_id, name, description, created_at, updated_at, deleted_at;
        """
        try:
            row = await self.conn.fetchrow(query, workspace_id, owner_id, new_name, new_desc)
        except asyncpg.UniqueViolationError as exc:
            raise DuplicateWorkspaceNameError(
                "An active workspace with this name already exists."
            ) from exc

        if row is None:
            return None
        return Workspace.model_validate(dict(row))

    async def soft_delete(self, workspace_id: UUID, owner_id: UUID) -> bool:
        query = """
            UPDATE public.workspaces
            SET deleted_at = timezone('utc'::text, clock_timestamp())
            WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL;
        """
        result = await self.conn.execute(query, workspace_id, owner_id)
        # result is e.g. "UPDATE 1" or "UPDATE 0"
        return result == "UPDATE 1"

