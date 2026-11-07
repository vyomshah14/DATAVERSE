# DATAVERSE — Architecture & Engineering Decision Records (ADR)

## Source of Truth: DATAVERSE PRD v2.0

## Status: Active Baseline (Day 1)

This document formalizes the engineering decisions, trade-offs, and invariants governing the DATAVERSE 3D Living Data Center Simulator. Every decision here strictly adheres to PRD v2.0. Unresolved decisions are explicitly classified with proposed solutions and require explicit product verification.

---

## 1. Locked Engineering Decisions

### DECISION-001: Network Topology Hierarchy & Physical Rack Semantics

- **Decision**: Network forwarding topology is strictly hierarchical:
  $$\text{Router} \longrightarrow \text{Core Switch} \longrightarrow 2 \times \text{Access Switches} \longrightarrow \text{Application Servers}$$
- **Rack Semantics**: Racks are strictly physical/spatial grouping objects represented through `parent_id` / spatial hierarchy relationships. Racks **never** forward, buffer, inspect, or modify network packets or frames.
- **Rationale**: Clean separation between logical network graph topology and physical/visual grouping in 3D space prevents layer-violation bugs and guarantees deterministic packet routing.
- **Status**: **LOCKED**

---

### DECISION-002: Default Link Capacities and Propagation Latency

- **Decision**: Default link bandwidth capacities and propagation delay are calibrated as follows:
  - **Router $\rightarrow$ Core Switch**: $50\text{ Mbps}$
  - **Core Switch $\rightarrow$ Access Switch**: $25\text{ Mbps}$
  - **Access Switch $\rightarrow$ Application Server**: $10\text{ Mbps}$
  - **Base Link Latency**: $1\text{ ms}$ per hop
- **Rationale**: Provides proportional oversubscription and predictable congestion points under elevated traffic scenarios, making bottlenecks visually and analytically observable.
- **Status**: **LOCKED**

---

### DECISION-003: Intra-Tick Dynamic Routing Score Calculation

- **Decision**: When the router or switch evaluates load balancing / routing scores during a simulation tick, the algorithm **must include requests already assigned within the current tick** in addition to backlogged queues from prior ticks.
- **Rationale**: If routing decisions only evaluated state at the start of the tick, a burst of simultaneous requests during a single tick would all be assigned to the single apparently least-loaded server (creating severe artificial thundering-herd oscillations). Intra-tick accounting ensures deterministic, balanced dispatching.
- **Status**: **LOCKED**

---

### DECISION-004: Strict Simulation Action Ordering `(tick, action_seq)`

- **Decision**: All discrete simulation events and external user interventions (e.g. fault injections, link cut, capacity change) are ordered strictly by the tuple:
  $$(\text{tick}, \text{action\_seq})$$
  Where `tick` is the non-negative integer simulation step, and `action_seq` is an incrementing integer sequence assigned when the action is staged for that tick.
- **Rationale**: Guarantees total ordering of concurrent actions within the exact same simulation tick, ensuring identical simulation trajectories on any machine or runtime.
- **Status**: **LOCKED**

---

### DECISION-005: Deterministic Seeded PRNG Algorithm

- **Decision**: The simulation engine shall use **SplitMix64** (v1.0) for 64-bit seed initialization and state generation, coupled with **PCG64** or **Xoshiro256\*\* / SplitMix64** for fast deterministic pseudo-random stream generation. `Math.random()` is **strictly prohibited** in all engine modules.
- **Rationale**: Platform-independent IEEE-754 / integer bitwise behavior across all V8/JavaScript runtimes and Python verification harnesses. SplitMix64 is proven, compact, passes BigCrush statistical tests, and guarantees reproducible runs from any initial seed.
- **Status**: **LOCKED**

---

### DECISION-006: 64-bit Unsigned Seed Storage Format

- **Decision**: Seed values are represented and stored as **canonical 16-character hexadecimal strings** (or BigInt in TypeScript) across all network APIs, JSON payloads, and PostgreSQL database columns (e.g., `"0x4f3a9b1c7e8d2f10"` or `VARCHAR(18)` / `NUMERIC(20, 0)` / `BIGINT` with signed bitcast).
- **Rationale**: JavaScript `Number` is an IEEE-754 double precision float with only 53 bits of integer precision ($2^{53} - 1$). Unsigned 64-bit integers ($2^{64}-1$) undergo silent truncation if parsed as standard JSON numbers. String/BigInt serialization retains complete bit-level fidelity.
- **Status**: **LOCKED**

---

### DECISION-007: State Checksum Generation Specification

- **Decision**: Checksums are computed as the **SHA-256 hash of canonicalized binary or sorted JSON bytes** (`RFC 8785 JSON Canonicalization Scheme - JCS`), **not** PostgreSQL's `JSONB` serialization or arbitrary engine memory dumps.
- **Rationale**: PostgreSQL `JSONB` does not guarantee deterministic key ordering or whitespace formatting across different PostgreSQL engine versions. JCS canonical bytes guarantee bit-exact cross-platform parity between TypeScript frontend and Python backend verification.
- **Status**: **LOCKED**

---

### DECISION-008: Distributed Runner Persistence & Lease Management

- **Decision**: Simulation session persistence is architected around a `simulation_actions` append-only log and a `simulation_runs` state lease table incorporating:
  - `runner_id`: UUID of the active executing node/tab.
  - `lease_expires_at`: UTC timestamp indicating runner lease validity.
  - `heartbeat_at`: Periodic renewal signal from active runner.
- **Rationale**: Prevents split-brain state mutations if a user opens multiple browser tabs or when headless backend workers run deterministic replay audits.
- **Status**: **LOCKED**

---

### DECISION-009: Incremental Checkpoint Save/Restore Development Phase

- **Decision**: Basic checkpoint serialization and deserialization (`exportState()` / `importState()`) will be implemented directly during the **Simulation Engine Core Phase** (Phase 4 / Days 7–10), rather than deferred exclusively to final backend database integration.
- **Rationale**: Building checkpoint serialization alongside the engine core enforces snapshot hygiene early, catches circular object graph references before they proliferate, and allows deterministic engine unit testing via snapshot diffing.
- **Status**: **LOCKED**

---

## 2. Unresolved Decisions & Proposed Resolutions

### DECISION-010: RAM Exhaustion & Request Memory Demand Calibration

- **Issue**: PRD v2.0 specifies that an incoming request consumes a nominal memory buffer (e.g., $16\text{ MB}$ to $64\text{ MB}$ per active connection), while default server memory capacity is specified at typical physical hardware tiers (e.g. $16\text{ GB}$ to $64\text{ GB}$). Under standard test traffic bursts (e.g., 50–200 concurrent requests), total allocated memory reaches only $\approx 3.2\text{ GB}$, meaning default servers would never experience realistic RAM exhaustion or swap thrashing under nominal loads unless traffic is scaled to tens of thousands of requests or server memory is tuned.
- **Mandate**: **Do not silently alter normative PRD formulas.**
- **Proposed Solution (Pending Formal Product Alignment)**:
  1. **Option A (Configurable Workload Profiles)**: Introduce explicit workload profile definitions in the scenario generator:
     - `Microservice / API Gateway`: Low RAM ($32\text{ MB}$/req), High CPU ($40\text{ ms}$).
     - `In-Memory Analytics / ML Inference`: High RAM ($512\text{ MB}$–$1024\text{ MB}$/req), High CPU.
     - `Memory-Leaking Service`: Simulates an uncollected leak of $+128\text{ MB}$ every $10$ ticks until OOM crash.
  2. **Option B (Capacity Scaling Factor)**: Allow visual laboratory scaling where server capacity can be configured down to $1\text{ GB}$–$4\text{ GB}$ containers to demonstrate low-memory crash behavior.
- **Testable Verification Plan**:
  - Implement a dedicated unit test suite (`ram_exhaustion_test.ts`) that asserts server transition to `OOM_CRASH` state once memory demand exceeds provisioned capacity under both Option A and Option B.
- **Status**: **UNRESOLVED — REQUIRES EXPLICIT PRODUCT OWNER CONFIRMATION**
