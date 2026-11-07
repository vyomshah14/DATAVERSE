"""
Health check schema models.
"""

from typing import Literal
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: Literal["healthy", "degraded", "down"] = Field(
        ..., description="Current operational status of backend services"
    )
    service: str = Field(..., description="Service identifier")
    version: str = Field(..., description="Application version")
    environment: str = Field(..., description="Current operational environment")

