"""
Workspace Schemas for DATAVERSE.
Pydantic data models for multi-tenant workspace management.
"""

from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


class WorkspaceBase(BaseModel):
    """Base workspace attributes shared across operations."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Human-readable title for the workspace (1-100 characters)",
    )
    description: Optional[str] = Field(
        None,
        description="Optional context or operational purpose of the workspace",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Workspace name cannot be empty or whitespace.")
        if len(stripped) > 100:
            raise ValueError("Workspace name cannot exceed 100 characters.")
        return stripped


class WorkspaceCreate(WorkspaceBase):
    """Schema for workspace creation requests."""

    pass


class WorkspaceUpdate(BaseModel):
    """Schema for workspace updates; all fields optional."""

    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Updated human-readable title",
    )
    description: Optional[str] = Field(
        None,
        description="Updated operational purpose or description",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            stripped = v.strip()
            if not stripped:
                raise ValueError("Workspace name cannot be empty or whitespace.")
            if len(stripped) > 100:
                raise ValueError("Workspace name cannot exceed 100 characters.")
            return stripped
        return v


class Workspace(WorkspaceBase):
    """Full workspace entity model representing a database row."""

    id: UUID = Field(..., description="Unique workspace identifier")
    owner_id: UUID = Field(..., description="Supabase user identity of the owner")
    created_at: datetime = Field(..., description="UTC creation timestamp")
    updated_at: datetime = Field(..., description="UTC update timestamp")
    deleted_at: Optional[datetime] = Field(
        None, description="Soft deletion timestamp; NULL for active workspaces"
    )

    model_config = ConfigDict(from_attributes=True)

