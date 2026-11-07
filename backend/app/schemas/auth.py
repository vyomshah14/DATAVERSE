"""
Authentication and Identity Schemas for DATAVERSE Backend.
Represents verified operator identities derived from Supabase JWT claims.
"""

from uuid import UUID
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class AuthenticatedUser(BaseModel):
    """
    Validated operator identity derived from verified Supabase JWT claims.
    Used internally by FastAPI dependencies and route handlers.
    """

    id: UUID = Field(..., description="Unique Supabase user identifier (sub)")
    email: Optional[str] = Field(None, description="Operator email address")
    role: Optional[str] = Field(None, description="Supabase user role (e.g. 'authenticated')")
    app_metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Application metadata claims from JWT"
    )
    user_metadata: Dict[str, Any] = Field(
        default_factory=dict, description="User-specific profile metadata from JWT"
    )


class CurrentUserResponse(BaseModel):
    """
    Safe public representation of authenticated operator identity for /auth/me endpoint.
    Omits sensitive internal claims.
    """

    id: UUID = Field(..., description="Unique operator identity")
    email: Optional[str] = Field(None, description="Operator email address")
    role: Optional[str] = Field(None, description="Operator role assignment")
    user_metadata: Dict[str, Any] = Field(
        default_factory=dict, description="User profile metadata"
    )
    authenticated: bool = Field(True, description="Authentication confirmation status")

