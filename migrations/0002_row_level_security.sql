-- ==============================================================================
-- DATAVERSE Database Migration: 0002_row_level_security.sql
-- Description: Granular Row-Level Security (RLS) Policies for Multi-Tenant Isolation
-- Target Engine: PostgreSQL 15+ / Supabase PostgreSQL
-- Reference: DATAVERSE PRD v2.0 (Phase 1: Tenancy Security)
-- ==============================================================================

-- 1. Ensure required roles exist (idempotent for local test environments)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
END $$;

-- 2. Schema and Table Privileges
-- Grant authenticated role permissions required to perform scoped CRUD operations
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_centers TO authenticated;

-- Ensure default privileges apply to future tables created in public
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- ==============================================================================
-- 3. Enable and Force Row-Level Security
-- ==============================================================================
-- FORCE ROW LEVEL SECURITY ensures that RLS policies are strictly evaluated
-- even if queries execute under table owner credentials.
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;

ALTER TABLE public.data_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_centers FORCE ROW LEVEL SECURITY;

-- ==============================================================================
-- 4. Clean up existing policies for idempotency
-- ==============================================================================
DROP POLICY IF EXISTS workspaces_owner_select ON public.workspaces;
DROP POLICY IF EXISTS workspaces_owner_insert ON public.workspaces;
DROP POLICY IF EXISTS workspaces_owner_update ON public.workspaces;
DROP POLICY IF EXISTS workspaces_owner_delete ON public.workspaces;

DROP POLICY IF EXISTS data_centers_parent_workspace_select ON public.data_centers;
DROP POLICY IF EXISTS data_centers_parent_workspace_insert ON public.data_centers;
DROP POLICY IF EXISTS data_centers_parent_workspace_update ON public.data_centers;
DROP POLICY IF EXISTS data_centers_parent_workspace_delete ON public.data_centers;

-- ==============================================================================
-- 5. Row-Level Security Policies: public.workspaces
-- ==============================================================================
-- Rule 1: SELECT - An operator can only read workspaces where owner_id = auth.uid()
CREATE POLICY workspaces_owner_select ON public.workspaces
    FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_id);

-- Rule 2: INSERT - An operator can only create a workspace if owner_id = auth.uid()
-- Prevents cross-tenant impersonation on insert.
CREATE POLICY workspaces_owner_insert ON public.workspaces
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_id);

-- Rule 3: UPDATE - An operator can only update their own workspaces
-- WITH CHECK ensures that owner_id cannot be reassigned to a different operator.
CREATE POLICY workspaces_owner_update ON public.workspaces
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Rule 4: DELETE - An operator can only delete their own workspaces
CREATE POLICY workspaces_owner_delete ON public.workspaces
    FOR DELETE
    TO authenticated
    USING (auth.uid() = owner_id);

-- Documentation
COMMENT ON POLICY workspaces_owner_select ON public.workspaces IS 'Allows authenticated operators to read only their own workspaces.';
COMMENT ON POLICY workspaces_owner_insert ON public.workspaces IS 'Enforces that newly inserted workspaces are bound to the caller auth.uid().';
COMMENT ON POLICY workspaces_owner_update ON public.workspaces IS 'Allows updating owned workspaces and prevents owner_id reassignment.';
COMMENT ON POLICY workspaces_owner_delete ON public.workspaces IS 'Restricts workspace deletion to the authenticated owner.';

-- ==============================================================================
-- 6. Row-Level Security Policies: public.data_centers
-- ==============================================================================
-- Facility ownership is inherited hierarchically from its parent workspace.
-- Facilities in soft-deleted parent workspaces (deleted_at IS NOT NULL) are inaccessible.

-- Rule 1: SELECT - Read facilities only if parent workspace is owned and active
CREATE POLICY data_centers_parent_workspace_select ON public.data_centers
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = data_centers.workspace_id
              AND w.owner_id = auth.uid()
              AND w.deleted_at IS NULL
        )
    );

-- Rule 2: INSERT - Create facilities only within an owned, active parent workspace
CREATE POLICY data_centers_parent_workspace_insert ON public.data_centers
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = data_centers.workspace_id
              AND w.owner_id = auth.uid()
              AND w.deleted_at IS NULL
        )
    );

-- Rule 3: UPDATE - Modify facilities only within an owned, active parent workspace
-- WITH CHECK ensures facilities cannot be moved to a foreign or deleted workspace.
CREATE POLICY data_centers_parent_workspace_update ON public.data_centers
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = data_centers.workspace_id
              AND w.owner_id = auth.uid()
              AND w.deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = data_centers.workspace_id
              AND w.owner_id = auth.uid()
              AND w.deleted_at IS NULL
        )
    );

-- Rule 4: DELETE - Remove facilities only within an owned, active parent workspace
CREATE POLICY data_centers_parent_workspace_delete ON public.data_centers
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = data_centers.workspace_id
              AND w.owner_id = auth.uid()
              AND w.deleted_at IS NULL
        )
    );

-- Documentation
COMMENT ON POLICY data_centers_parent_workspace_select ON public.data_centers IS 'Restricts facility reads to the owner of the active parent workspace.';
COMMENT ON POLICY data_centers_parent_workspace_insert ON public.data_centers IS 'Prevents provisioning facilities into foreign or soft-deleted workspaces.';
COMMENT ON POLICY data_centers_parent_workspace_update ON public.data_centers IS 'Allows facility updates only within owned active parent workspaces.';
COMMENT ON POLICY data_centers_parent_workspace_delete ON public.data_centers IS 'Restricts facility deletion to the active parent workspace owner.';

