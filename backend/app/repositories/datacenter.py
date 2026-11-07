"""
Data Center Repository Interface and Implementation for DATAVERSE.
Handles database access for facility hardware configurations scoped through owning workspaces.
"""

from abc import ABC, abstractmethod
from uuid import UUID
from typing import Optional, List
import asyncpg

from backend.app.schemas.datacenter import DataCenter, DataCenterCreate, DataCenterUpdate


class DuplicateDataCenterNameError(Exception):
    """Raised when a facility with the same name already exists in the target workspace."""

    pass


class IDataCenterRepository(ABC):
    """Abstract interface defining data center facility database operations."""

    @abstractmethod
    async def workspace_exists(
        self,
        workspace_id: UUID,
        owner_id: UUID,
    ) -> bool:
        """Checks whether the parent workspace exists, is active, and is owned by the user."""
        pass

    @abstractmethod
    async def create(
        self,
        workspace_id: UUID,
        data_center_in: DataCenterCreate,
        owner_id: UUID,
    ) -> Optional[DataCenter]:
        """Provisions a new facility inside a workspace owned by the authenticated operator."""
        pass

    @abstractmethod
    async def get_by_id(
        self,
        data_center_id: UUID,
        workspace_id: UUID,
        owner_id: UUID,
    ) -> Optional[DataCenter]:
        """Retrieves a facility by ID scoped to its parent workspace and owner."""
        pass

    @abstractmethod
    async def list_by_workspace(
        self,
        workspace_id: UUID,
        owner_id: UUID,
    ) -> List[DataCenter]:
        """Lists all facilities belonging to a workspace owned by the user."""
        pass

    @abstractmethod
    async def update(
        self,
        data_center_id: UUID,
        workspace_id: UUID,
        data_center_update: DataCenterUpdate,
        owner_id: UUID,
    ) -> Optional[DataCenter]:
        """Updates facility configuration scoped to owning workspace."""
        pass

    @abstractmethod
    async def delete(
        self,
        data_center_id: UUID,
        workspace_id: UUID,
        owner_id: UUID,
    ) -> bool:
        """Removes a facility from an active workspace owned by the user."""
        pass


class DataCenterRepository(IDataCenterRepository):
    """
    Concrete asyncpg implementation of IDataCenterRepository.
    Enforces multi-level ownership scoping via workspaces join queries.
    """

    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn

    async def workspace_exists(self, workspace_id: UUID, owner_id: UUID) -> bool:
        """Helper checking that the parent workspace exists, is active, and owned by user."""
        check_query = """
            SELECT 1 FROM public.workspaces
            WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL;
        """
        row = await self.conn.fetchrow(check_query, workspace_id, owner_id)
        return row is not None

    async def _workspace_exists_for_owner(self, workspace_id: UUID, owner_id: UUID) -> bool:
        """Legacy alias for workspace_exists."""
        return await self.workspace_exists(workspace_id, owner_id)

    async def create(
        self,
        workspace_id: UUID,
        data_center_in: DataCenterCreate,
        owner_id: UUID,
    ) -> Optional[DataCenter]:
        # Validate parent workspace tenancy first
        if not await self.workspace_exists(workspace_id, owner_id):
            return None

        query = """
            INSERT INTO public.data_centers (workspace_id, name, description, topology_config)
            VALUES ($1, $2, $3, $4)
            RETURNING id, workspace_id, name, description, topology_config, created_at, updated_at;
        """
        try:
            row = await self.conn.fetchrow(
                query,
                workspace_id,
                data_center_in.name.strip(),
                data_center_in.description,
                data_center_in.topology_config,
            )
        except asyncpg.UniqueViolationError as exc:
            raise DuplicateDataCenterNameError(
                "A facility with this name already exists in this workspace."
            ) from exc

        return DataCenter.model_validate(dict(row))

    async def get_by_id(
        self,
        data_center_id: UUID,
        workspace_id: UUID,
        owner_id: UUID,
    ) -> Optional[DataCenter]:
        query = """
            SELECT dc.id, dc.workspace_id, dc.name, dc.description, dc.topology_config, dc.created_at, dc.updated_at
            FROM public.data_centers dc
            JOIN public.workspaces w ON dc.workspace_id = w.id
            WHERE dc.id = $1 AND dc.workspace_id = $2 AND w.owner_id = $3 AND w.deleted_at IS NULL;
        """
        row = await self.conn.fetchrow(query, data_center_id, workspace_id, owner_id)
        if row is None:
            return None
        return DataCenter.model_validate(dict(row))

    async def list_by_workspace(
        self,
        workspace_id: UUID,
        owner_id: UUID,
    ) -> List[DataCenter]:
        query = """
            SELECT dc.id, dc.workspace_id, dc.name, dc.description, dc.topology_config, dc.created_at, dc.updated_at
            FROM public.data_centers dc
            JOIN public.workspaces w ON dc.workspace_id = w.id
            WHERE dc.workspace_id = $1 AND w.owner_id = $2 AND w.deleted_at IS NULL
            ORDER BY dc.created_at ASC;
        """
        rows = await self.conn.fetch(query, workspace_id, owner_id)
        return [DataCenter.model_validate(dict(r)) for r in rows]

    async def update(
        self,
        data_center_id: UUID,
        workspace_id: UUID,
        data_center_update: DataCenterUpdate,
        owner_id: UUID,
    ) -> Optional[DataCenter]:
        current = await self.get_by_id(data_center_id, workspace_id, owner_id)
        if current is None:
            return None

        new_name = (
            data_center_update.name.strip()
            if data_center_update.name is not None
            else current.name
        )
        new_desc = (
            data_center_update.description
            if data_center_update.description is not None
            else current.description
        )
        new_config = (
            data_center_update.topology_config
            if data_center_update.topology_config is not None
            else current.topology_config
        )

        query = """
            UPDATE public.data_centers
            SET name = $3,
                description = $4,
                topology_config = $5
            WHERE id = $1 AND workspace_id = $2
              AND EXISTS (
                  SELECT 1 FROM public.workspaces
                  WHERE id = $2 AND owner_id = $6 AND deleted_at IS NULL
              )
            RETURNING id, workspace_id, name, description, topology_config, created_at, updated_at;
        """
        try:
            row = await self.conn.fetchrow(
                query,
                data_center_id,
                workspace_id,
                new_name,
                new_desc,
                new_config,
                owner_id,
            )
        except asyncpg.UniqueViolationError as exc:
            raise DuplicateDataCenterNameError(
                "A facility with this name already exists in this workspace."
            ) from exc

        if row is None:
            return None
        return DataCenter.model_validate(dict(row))

    async def delete(
        self,
        data_center_id: UUID,
        workspace_id: UUID,
        owner_id: UUID,
    ) -> bool:
        query = """
            DELETE FROM public.data_centers
            WHERE id = $1 AND workspace_id = $2
              AND EXISTS (
                  SELECT 1 FROM public.workspaces
                  WHERE id = $2 AND owner_id = $3 AND deleted_at IS NULL
              );
        """
        result = await self.conn.execute(query, data_center_id, workspace_id, owner_id)
        return result == "DELETE 1"

