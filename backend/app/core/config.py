"""
Core Configuration Module for DATAVERSE Backend.
Handles application settings, Supabase credentials, and database connections.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Application configuration settings loaded from environment variables."""

    # Application
    PROJECT_NAME: str = "DATAVERSE Simulator API"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = Field(default="development", alias="ENVIRONMENT")
    HOST: str = Field(default="0.0.0.0", alias="HOST")
    PORT: int = Field(default=8000, alias="PORT")
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Supabase & Authentication
    SUPABASE_URL: str = Field(default="https://your-project-id.supabase.co", alias="SUPABASE_URL")
    SUPABASE_JWT_ISSUER: str = Field(
        default="https://your-project-id.supabase.co/auth/v1",
        alias="SUPABASE_JWT_ISSUER",
    )
    SUPABASE_JWKS_URL: str = Field(
        default="https://your-project-id.supabase.co/auth/v1/.well-known/jwks.json",
        alias="SUPABASE_JWKS_URL",
    )

    # Database
    DATABASE_URL: str = Field(
        default="postgresql://postgres:placeholder@db.your-project-id.supabase.co:5432/postgres",
        alias="DATABASE_URL",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
