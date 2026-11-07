# DATAVERSE — Database Access & Repository Architecture

## Overview

The DATAVERSE backend implements an asynchronous, connection-pooled, repository-pattern data access architecture built on **`asyncpg`** and **PostgreSQL**.

It enforces request-scoped, transaction-local **Row Level Security (RLS)** context propagation, mapping authenticated Supabase JWT claims directly into PostgreSQL runtime parameters.

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Operator (Browser)
    participant API as FastAPI Route Handler
    participant Dep as get_db_transaction Dependency
    participant DBMgr as DatabaseManager (asyncpg Pool)
    participant Postgres as PostgreSQL Engine (RLS)
    participant Repo as WorkspaceRepository

    Operator->>API: HTTP Request + Bearer JWT
    API->>Dep: Request authenticated transaction
    Dep->>DBMgr: Acquire pooled connection
    DBMgr-->>Dep: asyncpg.Connection
    Dep->>Postgres: BEGIN TRANSACTION
    Dep->>Postgres: SELECT set_config('request.jwt.claim.sub', user_id, true)
    Dep->>Postgres: SELECT set_config('request.jwt.claim.role', user_role, true)
    Dep->>Dep: Inject connection into Repo
    API->>Repo: repo.create(workspace, owner_id)
    Repo->>Postgres: Parameterized INSERT (owner_id = user_id)
    Postgres-->>Repo: Inserted Row
    Repo-->>API: Workspace Pydantic Model
    API-->>Dep: Route execution complete
    Dep->>Postgres: COMMIT TRANSACTION (parameters automatically revert)
    Dep->>DBMgr: Release connection back to pool
    API-->>Operator: HTTP 201 Created
```

---

## 1. Connection Architecture & Pooling

- **Driver**: High-performance asynchronous PostgreSQL driver **`asyncpg`** (`>=0.30.0`).
- **Connection Manager**: Centralized singleton `DatabaseManager` located in `backend/app/core/database.py`.
- **Pooling Specifications**:
  - `min_size`: Minimum number of warm connections (default: `2`).
  - `max_size`: Maximum pool capacity (default: `10`).
  - `max_inactive_connection_lifetime`: Reclaims idle connections after `300.0` seconds.
  - `command_timeout`: Prevents runaway queries with a `30.0` second abort limit.
- **Type Codecs**: Automatic JSONB serialization and deserialization registered at connection initialization (`init_connection_codecs`).
- **Lifecycle Management**: Clean pool shutdown integrated via FastAPI's `lifespan` handler in `backend/app/main.py`.

---

## 2. JWT-to-PostgreSQL Identity Propagation & RLS Security

### The Context Leakage Problem in Connection Pools

In traditional connection pooling, naive session variables (like `SET app.user_id = '...'`) persist on the connection across multiple requests, causing catastrophic multi-tenant security leaks when connections are recycled.

### The Solution: Transaction-Local Parameters (`is_local = true`) and `SET LOCAL ROLE authenticated`

The `DatabaseManager.transaction(user=...)` context manager executes:

```sql
SELECT set_config('request.jwt.claim.sub', $1, true);
SELECT set_config('request.jwt.claim.role', $2, true);
SELECT set_config('request.jwt.claims', $3, true);
SET LOCAL ROLE authenticated;
```

1. **Transaction-Local Isolation**: Passing `true` as the third parameter to `set_config` marks settings as **strictly transaction-local**.
2. **PostgreSQL Role Transition**: Executing `SET LOCAL ROLE authenticated` drops all table-owner `BYPASSRLS` privileges for the duration of the transaction. All SQL statements are evaluated under the unprivileged `authenticated` role where `rolbypassrls = False`.
3. **Automatic Reversion**: PostgreSQL guarantees that upon `COMMIT` or `ROLLBACK`, the role immediately reverts to the session user (`postgres`), and all `request.jwt.*` settings reset to `NULL`.
4. **Zero Leakage**: When the connection returns to the `asyncpg` pool, zero user context remains.

### Defense-in-Depth Repository Scoping

In addition to PostgreSQL RLS enforcement:

- Every query in `WorkspaceRepository` explicitly specifies `WHERE owner_id = $x`.
- Every query in `DataCenterRepository` joins `public.workspaces` to enforce `WHERE w.owner_id = $x AND w.deleted_at IS NULL`.
- Client-supplied IDs in request bodies are ignored for tenancy; ownership is derived exclusively from the verified JWT `sub`.

---

## 3. Row-Level Security Policies (`0002_row_level_security.sql`)

The migration `migrations/0002_row_level_security.sql` implements the granular security policies for the multi-tenant living data center simulator:

### 3.1. `public.workspaces`

- **`workspaces_owner_select`**: `USING (auth.uid() = owner_id)` — Operators only read their own workspaces.
- **`workspaces_owner_insert`**: `WITH CHECK (auth.uid() = owner_id)` — Operators can only provision workspaces bound to their own verified identity.
- **`workspaces_owner_update`**: `USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id)` — Prevents changing the `owner_id` to transfer workspaces to another tenant.
- **`workspaces_owner_delete`**: `USING (auth.uid() = owner_id)` — Operators can only delete their own workspaces.

### 3.2. `public.data_centers`

Facility tenancy is inherited hierarchically from its parent workspace. The policy strictly checks that the parent workspace is owned by `auth.uid()` and is active:

- **`data_centers_parent_workspace_select`**:
  ```sql
  USING (
      EXISTS (
          SELECT 1 FROM public.workspaces w
          WHERE w.id = data_centers.workspace_id
            AND w.owner_id = auth.uid()
            AND w.deleted_at IS NULL
      )
  )
  ```
- **`data_centers_parent_workspace_insert`**, **`update`**, and **`delete`**:
  Use identical `EXISTS` conditions in `USING` and `WITH CHECK`. Facilities in soft-deleted workspaces (`deleted_at IS NOT NULL`) immediately become invisible and inaccessible to all CRUD operations.

### 3.3. Required Grants and Runbook for Live Deployment

To apply migration `0002` to live Supabase:

1. Open the **Supabase Dashboard** $\rightarrow$ **SQL Editor**.
2. Paste the contents of `migrations/0002_row_level_security.sql`.
3. Verify required grants are included:
   ```sql
   GRANT USAGE ON SCHEMA public TO authenticated, anon;
   GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
   GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_centers TO authenticated;
   ```
4. Execute the SQL migration.
5. Re-run live integration verification tests.

---

## 3. Repository Layer Responsibilities

Repositories are located in `backend/app/repositories/`:

### 3.1. `WorkspaceRepository` (`IWorkspaceRepository`)

- **`create(workspace_in, owner_id)`**: Inserts new workspace record with caller as `owner_id`.
- **`get_by_id(workspace_id, owner_id)`**: Retrieves active workspace if owned by caller (`deleted_at IS NULL`).
- **`list_by_owner(owner_id, include_deleted)`**: Lists workspaces owned by caller ordered by `created_at DESC`.
- **`update(workspace_id, owner_id, workspace_update)`**: Updates title or description on active owned workspace.
- **`soft_delete(workspace_id, owner_id)`**: Sets `deleted_at = clock_timestamp()` on owned workspace.

### 3.2. `DataCenterRepository` (`IDataCenterRepository`)

- **`create(workspace_id, data_center_in, owner_id)`**: Verifies workspace ownership and provisions a data center facility.
- **`get_by_id(data_center_id, workspace_id, owner_id)`**: Retrieves facility verified through parent workspace ownership.
- **`list_by_workspace(workspace_id, owner_id)`**: Lists all facilities within an owned workspace.
- **`update(data_center_id, workspace_id, data_center_update, owner_id)`**: Updates facility metadata within owned workspace.
- **`delete(data_center_id, workspace_id, owner_id)`**: Deletes facility within owned workspace.

---

## 4. Transaction Lifecycle

Transactions are injected into FastAPI route handlers via `Depends(get_db_transaction)`:

1. **Extraction**: `get_current_user` extracts and verifies the bearer JWT via JWKS.
2. **Acquisition**: `get_db_transaction` acquires a pooled connection.
3. **Context Binding**: Transaction begins; user ID and role are injected transaction-locally.
4. **Execution**: Repository executes parameterized queries.
5. **Auto-Rollback / Commit**:
   - If an unhandled exception or HTTP error occurs, the transaction automatically rolls back.
   - If the route handler completes successfully, the transaction commits.
6. **Teardown**: The connection is returned cleanly to the pool.

---

## 5. Required Environment Variables

Configured in `backend/app/core/config.py`:

| Variable               | Required | Default             | Description                                                       |
| :--------------------- | :------: | :------------------ | :---------------------------------------------------------------- |
| `DATABASE_URL`         | **Yes**  | _None (no default)_ | PostgreSQL connection URI (`postgresql://user:pass@host:5432/db`) |
| `DB_POOL_MIN_SIZE`     |    No    | `2`                 | Minimum warm pool connections                                     |
| `DB_POOL_MAX_SIZE`     |    No    | `10`                | Maximum pool connection capacity                                  |
| `DB_POOL_MAX_LIFETIME` |    No    | `300.0`             | Maximum inactive connection lifetime (seconds)                    |
| `DB_COMMAND_TIMEOUT`   |    No    | `30.0`              | Abort threshold for slow database commands (seconds)              |

---

## 6. Implementation Status (Day 3 & Day 4)

- **Day 3 Task 01 (COMPLETED)**: Database Connection & Repository Foundation (`asyncpg`, connection pooling, transaction-scoped RLS injection).
- **Day 3 Task 02 (COMPLETED)**: Workspace CRUD REST APIs (`POST /api/v1/workspaces`, `GET /api/v1/workspaces`, `GET /api/v1/workspaces/{id}`, `PATCH /api/v1/workspaces/{id}`, `DELETE /api/v1/workspaces/{id}`).
- **Day 3 Task 03 (COMPLETED)**: Data Center CRUD REST APIs (`POST /api/v1/workspaces/{id}/datacenters`, `GET /api/v1/workspaces/{id}/datacenters`, `GET /api/v1/workspaces/{id}/datacenters/{id}`, `PATCH /api/v1/workspaces/{id}/datacenters/{id}`, `DELETE /api/v1/workspaces/{id}/datacenters/{id}`).
- **Day 3 Task 04 (UPCOMING)**: Multi-tenant workspace switcher in frontend top navigation and Zustand workspace sync.
