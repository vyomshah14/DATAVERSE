"""
Data Center Schemas for DATAVERSE.
Pydantic data models for physical facilities and 3D simulation spaces.
"""

from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator


class DataCenterBase(BaseModel):
    """Base data center attributes shared across operations."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Facility label (e.g., US-East Production)",
    )
    description: Optional[str] = Field(
        None,
        description="Optional operational description or region info",
    )
    topology_config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Initial topology metadata (dimensions, rack grid, zones)",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Data center name cannot be empty or whitespace.")
        if len(stripped) > 100:
            raise ValueError("Data center name cannot exceed 100 characters.")
        return stripped

    @field_validator("topology_config")
    @classmethod
    def validate_topology_config(cls, v: Any) -> Dict[str, Any]:
        if not isinstance(v, dict):
            raise ValueError("topology_config must be a valid JSON object.")
        return v


class DataCenterCreate(DataCenterBase):
    """Schema for facility creation requests."""

    pass


class DataCenterUpdate(BaseModel):
    """Schema for updating facility metadata."""

    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Updated facility label",
    )
    description: Optional[str] = Field(
        None,
        description="Updated operational description",
    )
    topology_config: Optional[Dict[str, Any]] = Field(
        None,
        description="Updated topology metadata",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            stripped = v.strip()
            if not stripped:
                raise ValueError("Data center name cannot be empty or whitespace.")
            if len(stripped) > 100:
                raise ValueError("Data center name cannot exceed 100 characters.")
            return stripped
        return v

    @field_validator("topology_config")
    @classmethod
    def validate_topology_config(
        cls, v: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        if v is not None and not isinstance(v, dict):
            raise ValueError("topology_config must be a valid JSON object.")
        return v


class DataCenter(DataCenterBase):
    """Full data center entity representing a database row."""

    id: UUID = Field(..., description="Unique facility identifier")
    workspace_id: UUID = Field(..., description="Foreign key linking to parent workspace")
    created_at: datetime = Field(..., description="UTC creation timestamp")
    updated_at: datetime = Field(..., description="UTC update timestamp")

    model_config = ConfigDict(from_attributes=True)

