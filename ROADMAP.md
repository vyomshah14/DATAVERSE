# DATAVERSE — 21-Day Architectural & Development Roadmap

## Project: DATAVERSE | CodeVerse Tech

## Reference: DATAVERSE PRD v2.0

## Status: Active Baseline

---

```
                       DATAVERSE 21-DAY EXECUTION TIMELINE
┌────────────────────────┬──────────────────────────┬─────────────────────────┐
│     DAYS 01 - 05       │       DAYS 06 - 12       │      DAYS 13 - 21       │
│  Foundation & 3D Core  │  Topology & Simulation   │  Faults, Telemetry & QA │
└────────────────────────┴──────────────────────────┴─────────────────────────┘
```

---

## Phase 1: Foundation, Application Shell & Authentication (Days 1 – 3)

### Day 1: Foundation & Toolchain Initialization (CURRENT)

- [x] Comprehensive developer environment and toolchain audit (macOS M4, Node 22, Python 3.14).
- [x] Monorepo workspace initialization with Vite, React 19, TypeScript strict mode.
- [x] Modern Tailwind CSS v4 setup via `@tailwindcss/vite`.
- [x] Code quality baseline: ESLint 9, Prettier, Vitest, Git tracking.
- [x] Application shell with futuristic operations console design system.
- [x] Python FastAPI backend scaffolding and health endpoint testing.
- [x] Foundational documentation: `ROADMAP.md`, `DECISIONS.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`.

### Day 2: Authentication & Identity Management

- [ ] Supabase Auth client integration (JWT session management, local storage tokens).
- [ ] User authentication UI: Sign-in, Sign-up, Password Reset modals within console styling.
- [ ] Protected route guards in React Router.
- [ ] Backend FastAPI JWT validation middleware using Supabase JWKS.
- [ ] User profile schema and session state store in Zustand.

### Day 3: Workspace & Tenancy Management

- [ ] Workspace data model and CRUD APIs.
- [ ] Multi-tenant workspace switcher in top navigation.
- [ ] PostgreSQL migration scripts for `workspaces`, `datacenter_configurations`, and `user_roles`.
- [ ] Mock session fallback for offline development mode.

---

## Phase 2: 3D Living Environment & Scene Architecture (Days 4 – 6)

### Day 4: Three.js / React Three Fiber Scene Setup

- [ ] High-performance WebGL Canvas with anti-aliasing and tone mapping.
- [ ] OrbitControls with restricted pitch, zoom boundaries, and smooth damping.
- [ ] Atmospheric lighting: soft ambient, directional key lights, and cyan/violet server accent lights.
- [ ] Procedural floor grid with subtle reflective tile shaders.
- [ ] Viewport responsiveness and canvas resize observers.

### Day 5: 3D Hardware Objects & Physical Hierarchy

- [ ] Standard 42U Data Center Server Rack mesh with perforated panels and glowing status LEDs.
- [ ] Modular network hardware meshes: Edge Router, Core Switch, Access Switches.
- [ ] Modular rack-mounted server blades (1U/2U form factors) with activity indicators.
- [ ] Physical coordinate layout engine: automatic row, aisle, and rack slot positioning.

### Day 6: Visual Telemetry & Shaders

- [ ] Interactive object raycasting and selection hover highlights.
- [ ] Cable management rendering: Cat6/Fiber curves connecting switches and servers.
- [ ] Dynamic LED status shaders indicating CPU load, link saturation, and hardware faults.
- [ ] Camera framing presets (Birds-eye overview, aisle view, rack focus).

---

## Phase 3: Topology Graph & Configuration API (Days 7 – 9)

### Day 7: Network Topology Graph Model

- [ ] Formal TypeScript graph definition: Nodes (Router, Core Switch, Access Switch, Server) & Directed Edges.
- [ ] Strict topological validation rules:
      $$\text{Router} \rightarrow \text{Core} \rightarrow \text{Access} \rightarrow \text{Server}$$
- [ ] Graph serialization and deserialization routines.
- [ ] Topology editor state store in Zustand.

### Day 8: Backend Infrastructure Schemas & REST APIs

- [ ] Pydantic models for hardware specifications, interfaces, and network graph constraints.
- [ ] FastAPI endpoints:
  - `POST /api/v1/topologies` — Create topology configuration
  - `GET /api/v1/topologies/{id}` — Fetch topology graph
  - `PUT /api/v1/topologies/{id}` — Update hardware/link specs
- [ ] PostgreSQL schema migrations for topologies and node specifications.

### Day 9: Visual Topology Overlay & Inspector Panel

- [ ] 2D HUD overlay displaying live network graph connections in 3D scene.
- [ ] Hardware Inspector drawer: Click any rack/node in 3D to inspect IP, MAC, utilization, and links.
- [ ] Link editing and capacity configuration sliders in the UI.

---

## Phase 4: Deterministic Simulation Engine Core (Days 10 – 12)

### Day 10: Clock, Ticks & Deterministic PRNG

- [ ] Discrete simulation loop decoupled completely from WebGL render framerate.
- [ ] SplitMix64 deterministic PRNG implementation.
- [ ] Seed initialization and unsigned 64-bit seed string parser.
- [ ] Tick scheduler with play, pause, single-step, and variable speed (1x, 2x, 5x, 10x).

### Day 11: Network Traffic & Routing Simulation

- [ ] Traffic packet generation engine: Poisson and burst request distributions.
- [ ] Link capacity bandwidth constraint modeling ($50\text{ Mbps}$, $25\text{ Mbps}$, $10\text{ Mbps}$).
- [ ] Propagation latency ($1\text{ ms}$/hop) and queue buffering simulation.
- [ ] Deterministic intra-tick dynamic score routing algorithm.

### Day 12: Server Resource Consumption & Checkpoint Baseline

- [ ] Server CPU queuing and execution cycles.
- [ ] Memory buffer allocation and RAM consumption accounting.
- [ ] Early checkpoint export/import baseline (`exportState()` / `importState()`).
- [ ] SHA-256 state checksum calculation over RFC 8785 canonical bytes.

---

## Phase 5: Fault Injection & Incident Management (Days 13 – 15)

### Day 13: Fault Injection Engine

- [ ] Discrete fault event pipeline ordered by `(tick, action_seq)`.
- [ ] Supported fault primitives:
  - `SERVER_CRASH`: Immediate server offline, dropped connections.
  - `LINK_SEVER`: Cut network path, triggering packet drop or reroute.
  - `PACKET_LOSS_SPIKE`: Deterministic drop probability injection.
  - `LATENCY_INJECTION`: Degraded link propagation delay.
  - `HIGH_CPU_LOAD`: Artificial processing bottleneck.

### Day 14: Automated Failover & Recovery

- [ ] Access switch link failover and backup routing paths.
- [ ] Server reboot and warm-up sequence simulation.
- [ ] Incident lifecycle state machine: Detected $\rightarrow$ Investigating $\rightarrow$ Mitigating $\rightarrow$ Resolved.
- [ ] Active Incidents HUD in Command Center.

### Day 15: Incident Timeline & Post-Mortem Logs

- [ ] Structured event log recording all state transitions and packet drops.
- [ ] Interactive time-scrubbing slider to replay incidents backward and forward.
- [ ] Export incident report as JSON/CSV.

---

## Phase 6: Telemetry, Metrics & Monitoring Dashboard (Days 16 – 17)

### Day 16: Telemetry Aggregation & Ring Buffers

- [ ] In-memory ring buffer for historical metric storage (CPU, RAM, Bandwidth, Latency).
- [ ] Percentile calculations: p50, p95, p99 latency metrics.
- [ ] Error rate and packet drop counters per switch and server.

### Day 17: Operations Monitoring UI

- [ ] Recharts-powered real-time telemetry graphs in Monitoring view.
- [ ] Heatmap overlay in 3D view showing hot racks/nodes under heavy load.
- [ ] Configurable threshold alert triggers (e.g., CPU > 90%, Latency > 100ms).

---

## Phase 7: Session Persistence & Backend Synchronization (Days 18 – 19)

### Day 18: Simulation Persistence & Action Logs

- [ ] PostgreSQL tables: `simulations`, `simulation_actions`, `simulation_checkpoints`.
- [ ] Append-only action log synchronization with backend API.
- [ ] Runner lease management with `runner_id` and heartbeat renewal to prevent split-brain tabs.

### Day 19: Checkpoint Save, Restore & State Verification

- [ ] Cloud checkpoint save/load REST endpoints.
- [ ] Backend deterministic replay verification worker (Python engine mirror).
- [ ] Checksum parity test asserting identical SHA-256 hashes between JS and Python runs.

---

## Phase 8: End-to-End Hardening, Testing & Deployment (Days 20 – 21)

### Day 20: Comprehensive Testing & Benchmarking

- [ ] Unit test coverage across all engine formulas (>90% coverage).
- [ ] Determinism regression test suite (10,000 tick replay reproducibility check).
- [ ] 3D WebGL performance optimization: InstancedMesh rendering for server racks.
- [ ] Memory leak audit and canvas cleanup on unmount.

### Day 21: Production Build & Deployment Pipeline

- [ ] Production Vite build optimization and bundle analysis.
- [ ] Dockerfile for FastAPI backend service.
- [ ] CI/CD GitHub Actions workflow: Lint, Typecheck, Test, Build.
- [ ] Final user documentation, interactive onboarding tour, and release v1.0 tag.
