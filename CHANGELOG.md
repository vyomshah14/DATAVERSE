# DATAVERSE — Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2026-11-07 (Day 3: Database Connection, Workspace & Data Center CRUD APIs)

### Added

- **Database Connection & Request-Scoped RLS Foundation**:
  - `DatabaseManager`: High-performance `asyncpg` connection pool with automatic JSONB codecs and health validation.
  - Transaction-local claims injection (`request.jwt.claim.sub`, `request.jwt.claim.role`) using PostgreSQL `set_config(..., is_local = true)` preventing cross-request identity leaks in pooled environments.
  - Reusable transaction and repository dependencies (`get_db_transaction`, `get_workspace_repository`, `get_datacenter_repository`).
  - `docs/DATABASE_ACCESS_LAYER.md`: Architecture guide, sequence diagram, and security analysis.
- **Workspace CRUD REST APIs (`/api/v1/workspaces`)**:
  - Endpoints: `POST /`, `GET /`, `GET /{workspace_id}`, `PATCH /{workspace_id}`, `DELETE /{workspace_id}`.
  - Enforces operator tenant isolation derived solely from verified Supabase JWT `sub`.
  - Case-insensitive unique workspace name collision detection (409 Conflict).
  - Soft-delete lifecycle marking `deleted_at` timestamp while preserving relational integrity.
  - Anti-enumeration 404 responses for missing, non-owned, or soft-deleted workspaces.
- **Data Center CRUD REST APIs (`/api/v1/workspaces/{workspace_id}/datacenters`)**:
  - Endpoints: `POST /`, `GET /`, `GET /{datacenter_id}`, `PATCH /{datacenter_id}`, `DELETE /{datacenter_id}`.
  - Strict hierarchical workspace scoping: verifies parent workspace existence, caller ownership, and active status before any operation.
  - Input validation: trimmed 1-100 character names, JSON object `topology_config` validation with 422 error responses.
  - Scope-level duplicate detection: enforces per-workspace uniqueness on `(workspace_id, lower(trim(name)))` returning 409 Conflict, while permitting identical facility names across distinct workspaces.
  - Physical row deletion semantics adhering to PostgreSQL cascade foreign-key relationships.
  - Anti-enumeration 404 responses for cross-tenant or missing data centers.
- **Topology Data Model & Pure Deterministic Validation Engine (Day 3, Task 06A)**:
  - Strongly typed TypeScript models in `frontend/src/engine/topology/types.ts`: `TopologyNode`, `TopologyLink`, `Topology`, `ValidationError`, `ValidationResult`, and `TopologyErrorCode`.
  - Node hierarchy recognizing 5 discrete types (`router`, `core_switch`, `access_switch`, `rack`, `server`) with lifecycle statuses, configuration schemas, and 3D position coordinates.
  - Architectural invariant: Server racks are physical/spatial grouping containers and strictly prohibited from forwarding network traffic; network links connecting to racks are actively rejected.
  - Bidirectional link representation with canonical link keying (`getCanonicalLinkKey`) preventing duplicate reversed edges.
  - Deterministic starter topology generator `createStarterTopology()` producing exactly 20 nodes (1 Router, 1 Core Switch, 2 Access Switches, 4 Racks, 12 Servers) and 15 links (Router-Core @ 50 Mbps, Core-Access @ 25 Mbps, Access-Server @ 10 Mbps; all @ 1 ms latency; 8 vCPU / 16 GB RAM per server; exactly 3 servers mounted per rack).
  - Pure deterministic validation engine (`validateTopology`, `validateStarterTopology`, `isTopologyValid`, `isStarterTopologyValid`) returning structured diagnostic errors with stable codes without side effects.
  - 24 comprehensive Vitest unit tests in `frontend/src/tests/topology.test.ts` verifying generator counts, repeatability, canonical link keys, duplicate prevention, dangling endpoint rejection, rack link prohibitions, range bounds, and starter invariant validations.
  - Architecture documentation in `docs/TOPOLOGY_ARCHITECTURE.md`.
- **3D Data Center Topology Visualization (Day 3, Task 06B)**:
  - Functional 3D digital twin of the DATAVERSE facility rendered inside a single persistent Three.js / React Three Fiber Canvas in `frontend/src/three/scene/DataCenterViewport.tsx`.
  - Full PRD starter hardware inventory rendered with distinct, professional 3D meshes:
    - 1 Edge Gateway Router (`RouterMesh.tsx`): 100 Gbps external uplink chassis mounted on an elevated structural pedestal with glowing cyan WAN light bar.
    - 1 Core Distribution Switch (`CoreSwitchMesh.tsx`): 80 Gbps director-class chassis with pulsing violet line-card matrix (`#8b5cf6`).
    - 2 Access Switches (`AccessSwitchMesh.tsx`): 40 Gbps aggregation switches for Pod A and Pod B with sky blue SFP/RJ45 port arrays.
    - 4 Server Racks (`ServerRackMesh.tsx`): 42U steel cabinets with tinted semi-transparent doors, ventilation hoods, and unit identification nameplates serving as spatial grouping enclosures.
    - 12 Server Blades (`ServerBladeMesh.tsx`): 2U modular compute hosts mounted in rack slots with dual drive bays, green power LEDs, and cyan workload activity indicators.
  - 15 Logical Network Links (`NetworkCableMesh.tsx`): 3D geometric curved tubes (`QuadraticBezierCurve3` + `TubeGeometry`) connecting endpoints directly with hierarchical bandwidth tier color-coding (Cyan 50 Mbps, Violet 25 Mbps, Blue 10 Mbps).
  - Component Interaction: Hover highlighting, click selection with floor halo projections and cable illumination, clicking empty space clears selection via `onPointerMissed`.
  - Lightweight Cyber HUD Inspector (`NodeInspector.tsx`): Interactive overlay displaying hardware specifications, IP/MAC addressing, parent rack relationships, and connected links.
- **3D Scene Visibility & Industrial Hardware Clarity Overhaul (Day 3, Task 06B.1)**:
  - Open 42U Server Rack Architecture: Replaced occluding solid black cabinet meshes with open front bays featuring 4 corner steel posts (`#334155`), side sheet-metal walls (`#1e293b`), EIA-310 vertical mounting rails (`#475569`), top cable hoods, and edge accent highlights, ensuring all server blades inside are 100% visible and unoccluded.
  - High-Fidelity Server Blade Front Panels: Enhanced all 12 modular server blades with visible metallic chassis (`#273549`), brushed faceplate (`#1e293b`), 4 hot-swap drive caddies with silver latch handles (`#94a3b8`) and activity indicators, honeycomb ventilation grille, SFP+ NIC socket (`#0284c7`), and multi-status LED column (emerald power, cyan network activity, amber workload/alert).
  - Overhead 3D Cubic Bezier Cable Trays: Rewrote `NetworkCableMesh` with `THREE.CubicBezierCurve3` routing access-to-server cables from switch front ports, up into overhead cable trays ($y = 3.75$), and dropping into each server blade's front NIC socket without clipping rack side walls. Included endpoint connector boot plugs.
  - Multi-Source Studio Lighting Rig: Upgraded viewport illumination with ambient light ($0.92$), front key directional light ($1.75$ with crisp shadow maps), cool fill light ($0.85$), cyan rim back-light ($1.15$), and ground bounce light ($0.45$).
  - Isometric Elevation Perspective: Adjusted camera to `[0, 5.5, 11.2]` with $46^\circ$ FOV targeting `[0, 1.5, -0.5]`, giving a balanced $21^\circ$ isometric view framing all 20 nodes, cable conduits, and appliances simultaneously. Background tuned to slate navy `#080d1a` with fog pushed back to $[20, 48]$.
  - Interactive Floating Tooltips: Added HTML hover/selection labels on all nodes displaying type badges, node names, and port specs with zero DOM clutter.
  - Dashboard Synchronization: `CommandCenterView.tsx` dynamically displays selected hardware telemetry in the bottom operations grid.
  - Verified across desktop (1440x900) and mobile (375x812) viewports with zero WebGL errors or uncaught runtime exceptions.
- **Functional 2D Node List & Read-Only Topology Inspector (Day 3, Task 06B)**:
  - 2D Topology Hierarchy Component (`TopologyNodeList.tsx`): Displays all 20 starter nodes grouped logically by Edge Router, Core Switch, Access Switches, and 4 Physical Racks with exactly 3 child servers nested under each. Supports live text search, tier filter buttons (`ALL`, `NETWORK`, `RACKS`, `SERVERS`), expand/collapse all rack bays, and keyboard navigation (`Enter`, `Space`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`). Racks explicitly designated as spatial grouping units.
  - Read-Only Topology Inspector (`TopologyInspector.tsx`): Standalone 2D React component functioning completely independently of WebGL. Displays live hardware specifications, vCPU, RAM, NVMe storage, IP/MAC addressing, parent rack links, switching capacity, assigned racks, connected logical links, and link inspection (bandwidth, latency, status, source/target endpoint links).
  - Robust Empty & Error State Handling: Displays PRD network hierarchy summary on empty selection, alert banner with reset action on invalid node/link IDs, and safe fallback handling (`N/A`) for missing configuration fields.
  - Two-Way Synchronized Selection: Seamlessly synced with 3D Three.js viewport via `useSimulationStore.selectedNodeId` and `selectedLinkId`.
- **Pure Topology Editing Operations Foundation (Day 3, Task 06C)**:
  - Pure deterministic operations module `frontend/src/engine/topology/operations.ts` implementing immutable graph transformations.
  - Implemented 10 core operations: `cloneTopology`, `renameNode`, `addNode`, `removeNode`, `updateNodeConfiguration`, `updateLinkMetrics`, `updateNodeStatus`, `updateLinkStatus`, `addLink`, `removeLink`, and `reassignServerParent`.
  - Invariant protection & safety guarantees:
    - Deep immutability via `cloneTopology` guaranteeing zero shared references or accidental mutations.
    - Deterministic execution without stochastics or side effects.
    - Automatic cascade deletion: removing a compute server or network switch automatically purges attached network links.
    - Rack containment protection: removing a physical rack containing child servers is blocked with `RACK_CONTAINS_SERVERS` unless explicitly confirmed with `cascadeChildren: true`.
    - Server compute configuration bounds checking with automatic `ram_mb` synchronization.
    - Rejection of invalid network connections to spatial rack containers (`RACK_HAS_NETWORK_LINK`).
  - Added new error codes in `TopologyErrorCode`: `NODE_NOT_FOUND`, `LINK_NOT_FOUND`, `INVALID_NODE_NAME`, `RACK_CONTAINS_SERVERS`, `CANNOT_REMOVE_CONTAINED_SERVER`, `OPERATION_FAILED`.
  - Comprehensive documentation in `docs/TOPOLOGY_ARCHITECTURE.md` (Section 10).
- **Cinematic 3D Visualization Redesign (AAA-Quality Immersive Environment)**:
  - Complete Architectural Data Center Room (`DataCenterEnvironment.tsx`): Enclosing rear and side walls with modular acoustic dampening panels (`#161e2e`), CRAC return air louvers, Emergency Power Off (EPO) panels, high-voltage electrical conduits, and row signage. Structural ceiling deck at $y = 4.8\text{m}$ with transverse steel I-beams, red fire suppression main piping with brass sprinklers, continuous linear ceiling LED troffers over cold and hot aisles, and suspended overhead cable ladder raceways at $y = 3.45\text{m}$.
  - Authentic Raised Floor & Perforated Airflow Tiles: Standard 600mm $\times$ 600mm floor tiles with joint lines, perforated airflow grille tiles with hexagonal mesh inserts directly in front of cabinets for thermal containment realism, and brushed aluminum demarcation strips.
  - Rack-Mounted Network Hardware Architecture: Fully eliminated floating equipment and round pedestals. The Edge Gateway Router (`RouterMesh.tsx`) is mounted inside a 42U Network Gateway Rack; the Core Distribution Switch (`CoreSwitchMesh.tsx`) is mounted inside a 42U Core Director Rack; and Access Switches (`AccessSwitchMesh.tsx`) are mounted in Pod Distribution Racks with 1U 48-port patch panels and horizontal D-ring wire organizers.
  - Physically Believable Cable Geometry (`NetworkCableMesh.tsx`): Exits switch front ports, passes through horizontal D-ring wire managers, ascends into the overhead cable ladder at $y = 3.45\text{m}$, traverses the room, and drops into the target server cabinet's front SFP+ port without mesh clipping.
  - Seven-Preset Cinematic Camera System (`DataCenterViewport.tsx`): One-click toolbar for `FRONT`, `REAR`, `LEFT`, `RIGHT`, `TOP`, `ISOMETRIC`, and `CINEMATIC` presets with smooth lerp interpolation controller (`damping: 0.08`) and automatic manual OrbitControls takeover.
  - Professional Rendering & ACES Filmic Tone Mapping: Configured ACES Filmic tone mapping (`exposure: 1.15`), PCF soft shadow maps (`2048x2048`), balanced studio key, fill, and rim lights, and contact shadow ground occlusion.
  - Multi-Angle Verification: Verified across all 7 camera viewpoints, server selection, router selection, and responsive viewports.
- **Automated Test Coverage**:
  - 37 new comprehensive Vitest unit tests in `frontend/src/tests/topologyOperations.test.ts` covering immutability, renaming, node addition/removal, configuration updates, link metric constraints, operational statuses, link addition/removal, server reassignment, and starter topology invariants.
  - 50 total passing backend tests; 112 total passing frontend tests across 8 test suites.

## [0.2.0] - 2026-11-07 (Day 2: Authentication & Database Schema Foundation)

### Added

- **Supabase Frontend Client Integration**:
  - Centralized Supabase client in `frontend/src/services/supabase.ts` with strict configuration validation.
  - Installed `@supabase/supabase-js` (v2.119.0).
  - Secure `.env` handling preventing credential leaks in logs or git.
- **Frontend Authentication System**:
  - `authService.ts`: Centralized identity operations (`signIn`, `signUp`, `signOut`, `getSession`, `onAuthStateChange`).
  - `useAuthStore.ts`: Zustand store with listener deduplication, persistent session hydration, and initialization loading shield.
  - `LoginPage.tsx`: Console-styled authentication UI with Operator Sign In / Create Account tabs, client-side input validation, error alerts, and destination preservation.
  - `ProtectedRoute.tsx`: Route guard intercepting unauthenticated requests and preserving intended target route.
  - Dynamic user profile pill and session sign-out action integrated in `TopNavbar.tsx`.
- **Database Schema Foundation**:
  - Migration `migrations/0001_initial_schema.sql` defining `public.workspaces` and `public.data_centers`.
  - Foreign key cascades, check constraints, partial active index, unique indexes, and `set_updated_at_timestamp()` trigger function using `clock_timestamp()`.
  - Deny-by-default Row-Level Security (RLS) on both tables protecting data from unauthorized direct client manipulation.
  - Successfully applied and verified live on Tokyo Supabase PostgreSQL database.
  - `docs/DATABASE_SCHEMA.md`: Complete entity-relationship diagram, architectural invariants, and migration runbooks.
- **Backend FastAPI JWT & JWKS Validation**:
  - `backend/app/core/security.py`: `JWKSClient` providing thread-safe, async-safe key caching with dynamic single-refresh on unknown `kid`.
  - Cryptographic signature and claim verification supporting `ES256` and `RS256` asymmetric algorithms.
  - `backend/app/schemas/auth.py`: Typed `AuthenticatedUser` model derived from verified `sub` claim and JWT metadata.
  - `backend/app/api/deps.py`: Reusable `get_current_user` and `require_authenticated_user` FastAPI route dependencies.
  - Protected endpoint `GET /api/v1/auth/me` returning safe operator identity.
  - `docs/BACKEND_AUTHENTICATION.md`: Complete backend authentication architecture and sequence diagram.
  - 11 unit tests in `backend/app/tests/test_auth.py` covering missing headers, malformed tokens, bad signatures, expired tokens, invalid claims, algorithm enforcement, JWKS refresh, and 503 error handling using ephemeral EC P-256 key pairs.

## [0.1.0] - 2026-11-07 (Day 1: Foundation Setup)

### Added

- **Developer Environment Audit**: Verified macOS ARM64 (Apple Silicon M4), Node v22.23.2, npm 10.9.8, Python 3.14.8, Git 2.56.0.
- **Monorepo Architecture**: Established workspace structure separating `frontend/` (React, Vite, Three.js) and `backend/` (FastAPI, Pydantic).
- **TypeScript Strict Baseline**: Configured strict compiler options (`strict: true`, `noUnusedLocals`, `noUncheckedIndexedAccess`) and path aliases (`@/*`).
- **Tailwind CSS v4 Official Vite Integration**: Configured `@tailwindcss/vite` plugin with `@import "tailwindcss"` and custom futuristic dark-mode styling variables.
- **Quality Tooling**: Flat config ESLint 9 (`eslint.config.js`), Prettier configuration, and Vitest test runner.
- **Core 3D & UI Dependencies**: Installed `three`, `@react-three/fiber`, `@react-three/drei`, `zustand`, `recharts`, `gsap`, `lucide-react`.
- **Application Shell**:
  - Top navigation bar with system status telemetry, clock, tenant selector, and alert indicator.
  - Collapsible operations navigation sidebar (Command Center, Data Centers, Simulations, Monitoring, Incidents, Settings).
  - Main operational layout with dark theme (#070b14 navy/charcoal) and electric cyan/restrained violet accents.
  - Interactive Command Center dashboard with 3D Canvas viewport placeholder, hardware telemetry cards, quick fault injection console, and active topology overview.
- **Python Backend Scaffolding**:
  - FastAPI application entrypoint with CORS middleware.
  - Pydantic Settings configuration reading `.env` specifications.
  - System health check endpoint (`/api/v1/health`) and root status route.
  - Automated async health tests using `pytest` and `httpx`.
- **Architectural Documentation**:
  - `ROADMAP.md`: Comprehensive 21-day execution plan across 8 core tracks.
  - `DECISIONS.md`: Formal ADR covering topology hierarchy, link defaults, intra-tick routing, SplitMix64 PRNG, 64-bit seed storage, and SHA-256 state checksums.
  - `KNOWN_ISSUES.md`: Documented RAM exhaustion calibration discrepancy and upstream library audit notes.
  - `README.md`: System overview, setup guide, and verification runbooks.
  - `.env.example`: Secure environment configuration template.
