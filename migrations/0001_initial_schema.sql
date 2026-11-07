-- ==============================================================================
-- DATAVERSE Database Migration: 0001_initial_schema.sql
-- Description: Core Schema Foundation for Workspaces and Data Centers
-- Target Engine: PostgreSQL 15+ / Supabase PostgreSQL
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Trigger function to maintain updated_at timestamps automatically
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, clock_timestamp());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. Table: workspaces
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    deleted_at TIMESTAMPTZ DEFAULT NULL,

    -- Constraints
    CONSTRAINT check_workspace_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT check_workspace_name_max_length CHECK (length(name) <= 100)
);

-- Documentation comments
COMMENT ON TABLE public.workspaces IS 'Multi-tenant organization and project boundaries owned by authenticated operators.';
COMMENT ON COLUMN public.workspaces.id IS 'Primary key UUIDv4 identifying the workspace.';
COMMENT ON COLUMN public.workspaces.owner_id IS 'Identity of the owning user, referencing auth.users(id).';
COMMENT ON COLUMN public.workspaces.name IS 'Human-readable workspace title (max 100 characters).';
COMMENT ON COLUMN public.workspaces.description IS 'Optional operational purpose or environment description.';
COMMENT ON COLUMN public.workspaces.created_at IS 'UTC timestamp when the workspace record was created.';
COMMENT ON COLUMN public.workspaces.updated_at IS 'UTC timestamp when the workspace was last updated.';
COMMENT ON COLUMN public.workspaces.deleted_at IS 'UTC timestamp for soft deletion; NULL for active workspaces.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id
    ON public.workspaces (owner_id);

CREATE INDEX IF NOT EXISTS idx_workspaces_active
    ON public.workspaces (owner_id)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_owner_name_active
    ON public.workspaces (owner_id, lower(trim(name)))
    WHERE deleted_at IS NULL;

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS trigger_workspaces_set_updated_at ON public.workspaces;
CREATE TRIGGER trigger_workspaces_set_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ==============================================================================
-- 4. Table: data_centers
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.data_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    topology_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Constraints
    CONSTRAINT check_data_center_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT check_data_center_name_max_length CHECK (length(name) <= 100),
    CONSTRAINT check_topology_config_is_object CHECK (jsonb_typeof(topology_config) = 'object')
);

-- Documentation comments
COMMENT ON TABLE public.data_centers IS 'Physical data center facilities and 3D simulation environments within a workspace.';
COMMENT ON COLUMN public.data_centers.id IS 'Primary key UUIDv4 identifying the data center facility.';
COMMENT ON COLUMN public.data_centers.workspace_id IS 'Foreign key linking the facility to its parent workspace.';
COMMENT ON COLUMN public.data_centers.name IS 'Facility name (e.g., US-East Production, EU-Central Lab).';
COMMENT ON COLUMN public.data_centers.description IS 'Optional description or regional operational specifications.';
COMMENT ON COLUMN public.data_centers.topology_config IS 'JSONB document containing initial facility metadata (dimensions, rack grid, zones).';
COMMENT ON COLUMN public.data_centers.created_at IS 'UTC timestamp when the facility was created.';
COMMENT ON COLUMN public.data_centers.updated_at IS 'UTC timestamp when the facility was last updated.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_data_centers_workspace_id
    ON public.data_centers (workspace_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_centers_workspace_name
    ON public.data_centers (workspace_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_data_centers_topology_config_gin
    ON public.data_centers USING gin (topology_config);

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS trigger_data_centers_set_updated_at ON public.data_centers;
CREATE TRIGGER trigger_data_centers_set_updated_at
    BEFORE UPDATE ON public.data_centers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ==============================================================================
-- 5. Row-Level Security (RLS) Foundation
-- ==============================================================================
-- Enforce deny-all access policy for unauthenticated/direct client access via PostgREST.
-- The FastAPI backend service remains the sole authoritative data-access layer.
-- Granular RLS policies (e.g. auth.uid() = owner_id) will be added in a future task.
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_centers ENABLE ROW LEVEL SECURITY;
