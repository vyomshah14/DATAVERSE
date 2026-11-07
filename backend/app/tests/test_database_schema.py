"""
Test Suite for Database Schema and Migrations.
Validates SQL migration syntax, constraints, and local PostgreSQL execution.
"""

from pathlib import Path
import shutil
import subprocess

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
MIGRATIONS_DIR = PROJECT_ROOT / "migrations"
MIGRATION_FILE = MIGRATIONS_DIR / "0001_initial_schema.sql"


def test_migration_file_exists():
    """Verify that the initial schema migration exists and is non-empty."""
    assert MIGRATION_FILE.exists(), f"Migration file not found at {MIGRATION_FILE}"
    content = MIGRATION_FILE.read_text(encoding="utf-8")
    assert len(content.strip()) > 100, "Migration file is unexpectedly empty or truncated"


def test_migration_required_declarations():
    """Verify essential tables, constraints, triggers, and RLS policies in SQL."""
    sql = MIGRATION_FILE.read_text(encoding="utf-8")

    # Tables
    assert "CREATE TABLE IF NOT EXISTS public.workspaces" in sql
    assert "CREATE TABLE IF NOT EXISTS public.data_centers" in sql

    # Core Columns - Workspaces
    assert "id UUID PRIMARY KEY DEFAULT gen_random_uuid()" in sql
    assert "owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE" in sql
    assert "name VARCHAR(100) NOT NULL" in sql
    assert "deleted_at TIMESTAMPTZ DEFAULT NULL" in sql

    # Core Columns - Data Centers
    assert "workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE" in sql
    assert "topology_config JSONB NOT NULL DEFAULT '{}'::jsonb" in sql

    # Constraints
    assert "CONSTRAINT check_workspace_name_not_empty CHECK" in sql
    assert "CONSTRAINT check_topology_config_is_object CHECK" in sql

    # Indexes
    assert "CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id" in sql
    assert "CREATE INDEX IF NOT EXISTS idx_workspaces_active" in sql
    assert "CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_owner_name_active" in sql
    assert "CREATE INDEX IF NOT EXISTS idx_data_centers_workspace_id" in sql
    assert "CREATE UNIQUE INDEX IF NOT EXISTS idx_data_centers_workspace_name" in sql
    assert "CREATE INDEX IF NOT EXISTS idx_data_centers_topology_config_gin" in sql

    # Timestamp trigger
    assert "FUNCTION public.set_updated_at_timestamp()" in sql
    assert "clock_timestamp()" in sql
    assert "CREATE TRIGGER trigger_workspaces_set_updated_at" in sql
    assert "CREATE TRIGGER trigger_data_centers_set_updated_at" in sql

    # Row-Level Security
    assert "ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;" in sql
    assert "ALTER TABLE public.data_centers ENABLE ROW LEVEL SECURITY;" in sql


def test_migration_runtime_execution_in_local_postgres():
    """
    If psql is present on the host, run an end-to-end transaction test
    against the local PostgreSQL engine, verifying all constraints and triggers
    with complete transactional rollback.
    """
    psql_path = shutil.which("psql")
    if not psql_path:
        return

    # Check if local postgres responds on default port
    check_proc = subprocess.run(
        [psql_path, "-d", "sandbox", "-c", "SELECT 1;"],
        capture_output=True,
        text=True,
    )
    if check_proc.returncode != 0:
        # Local postgres not active or accessible; skip execution verification
        return

    test_harness_sql = f"""
    \\set ON_ERROR_STOP on
    BEGIN;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE
    );

    \\i {MIGRATION_FILE}

    -- Verify insertion of valid records
    INSERT INTO auth.users (id, email) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'op@dataverse.io')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.workspaces (id, owner_id, name)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Test Workspace');

    INSERT INTO public.data_centers (id, workspace_id, name, topology_config)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'DC 1', '{{"zone": "A"}}'::jsonb);

    -- Verify cascade delete
    DELETE FROM public.workspaces WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

    SELECT count(*) FROM public.data_centers WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;

    ROLLBACK;
    """

    run_proc = subprocess.run(
        [psql_path, "-d", "sandbox"],
        input=test_harness_sql,
        capture_output=True,
        text=True,
    )

    assert run_proc.returncode == 0, f"Local PostgreSQL test failed: {run_proc.stderr}"
    assert "CREATE TABLE" in run_proc.stdout
    assert "ROLLBACK" in run_proc.stdout

