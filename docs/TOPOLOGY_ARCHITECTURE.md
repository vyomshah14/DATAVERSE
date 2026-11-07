# DATAVERSE — Topology Architecture & Validation Engine Specification

## Reference: DATAVERSE PRD v2.0

## Component: Foundational Network & Physical Topology Engine

## Status: Verified & Tested

---

## 1. Overview

The DATAVERSE Topology Engine defines the foundational TypeScript data models, deterministic starter topology generator, and pure deterministic validation engine for all data center network and physical hardware graphs.

This subsystem enforces strict architectural invariants adhering to PRD v2.0, DECISION-001 (Monorepo and Engine Separation), and DECISION-002 (Immutable Simulation Model):

1. **Network Hardware vs. Spatial Grouping**: Physical Racks are spatial grouping containers and never route or forward network packets.
2. **Deterministic Reproducibility**: Given identical parameters or seeds, topology generation and validation yield bit-for-bit identical outputs without side effects or stochastic drift.
3. **Pure Function Validation**: Validation functions never mutate inputs, make network/database calls, or throw uncaught runtime exceptions; they return structured results with stable error codes and human-readable diagnostics.

---

## 2. Topology Data Models

All models are defined in [types.ts](file:///Users/vyom/Desktop/Project/DATAVERSE/frontend/src/engine/topology/types.ts) and exported via [index.ts](file:///Users/vyom/Desktop/Project/DATAVERSE/frontend/src/engine/topology/index.ts).

### 2.1 Node Hierarchy & Schema

DATAVERSE recognizes five discrete node types:

- `router`: Edge gateway router connecting external traffic to the data center network.
- `core_switch`: Central distribution switch routing traffic across access layers.
- `access_switch`: Top-of-rack or aggregation switch connecting physical server blades.
- `rack`: Physical server cabinet providing spatial grouping and power distribution. **Not a network forwarding device.**
- `server`: Compute host executing simulated workloads and hosting application services.

```typescript
export interface TopologyNode {
  id: string;
  type: TopologyNodeType; // 'router' | 'core_switch' | 'access_switch' | 'rack' | 'server'
  name: string;
  parent_id?: string | null; // e.g. server -> rack
  parentId?: string | null; // camelCase alias for ergonomic developer ergonomics
  status: TopologyNodeStatus; // 'online' | 'degraded' | 'offline' | 'maintenance'
  configuration: Record<string, unknown> | ServerConfiguration | RackConfiguration;
  position?: Position3D; // [x, y, z] coordinates for 3D spatial alignment
}
```

#### Node Invariant Rules

- **Parent Relationships**: Only `server` nodes may declare a `parent_id`, and that parent MUST be a valid `rack` node.
- **Racks are Pure Containers**: A `rack` cannot have a `parent_id`. Network switches and routers cannot have a `parent_id`.
- **Status Domain**: Only `'online'`, `'degraded'`, `'offline'`, and `'maintenance'` are permitted.

### 2.2 Link Hierarchy & Bidirectional Canonicalization

Network links represent bidirectional network connectivity between network-forwarding devices.

```typescript
export interface TopologyLink {
  id: string;
  source_id: string;
  target_id: string;
  sourceId?: string; // camelCase alias
  targetId?: string; // camelCase alias
  bandwidth_mbps: number;
  bandwidthMbps?: number; // camelCase alias
  latency_ms: number;
  latencyMs?: number; // camelCase alias
  status: TopologyLinkStatus; // 'online' | 'congested' | 'failed' | 'maintenance'
}
```

#### Link Invariant Rules

- **Bidirectional Representation**: Each physical/logical network link is declared exactly once. `source_id: 'A', target_id: 'B'` is topologically identical to `source_id: 'B', target_id: 'A'`.
- **Duplicate Prevention**: The validation engine calculates `getCanonicalLinkKey(source, target)` using lexicographical ordering:
  $$\text{key} = \min(u, v) + \text{"<->" } + \max(u, v)$$
  Duplicate connections between the same pair of nodes (whether reversed or identical) are rejected with `DUPLICATE_LINK_CONNECTION`.
- **No Self-Referencing Links**: `source_id` cannot equal `target_id` (`SELF_REFERENCING_LINK`).
- **Endpoints Must Exist**: `source_id` and `target_id` must reference valid nodes (`MISSING_LINK_ENDPOINT`).
- **No Network Links to Racks**: Network links must connect switches, routers, or servers. Connecting a network link to a `rack` is rejected with `RACK_HAS_NETWORK_LINK`.
- **Valid Metric Ranges**:
  - `bandwidth_mbps`: Must be a positive finite number $> 0$ (`INVALID_BANDWIDTH`).
  - `latency_ms`: Must be a non-negative finite number $\ge 0$ (`INVALID_LATENCY`).

---

## 3. PRD v2.0 Deterministic Starter Topology

The starter topology generator [createStarterTopology()](file:///Users/vyom/Desktop/Project/DATAVERSE/frontend/src/engine/topology/starter.ts) produces the standard DATAVERSE evaluation facility.

### 3.1 Node Inventory (20 Nodes Total)

| Node Type         | ID(s)                                  | Count | Role & Configuration                            |
| :---------------- | :------------------------------------- | :---- | :---------------------------------------------- |
| **Edge Router**   | `router-01`                            | 1     | 100 Gbps external uplink, gateway IP `10.0.0.1` |
| **Core Switch**   | `core-switch-01`                       | 1     | 80 Gbps fabric, IP `10.0.1.1`                   |
| **Access Switch** | `access-switch-01`, `access-switch-02` | 2     | 40 Gbps switching capacity each                 |
| **Server Rack**   | `rack-01` through `rack-04`            | 4     | 42U physical cabinets, 32A power capacity       |
| **Server**        | `server-01` through `server-12`        | 12    | 8 vCPU, 16 GB RAM (16,384 MB), 256 GB NVMe      |

### 3.2 Rack Distribution & Physical Layout

- Racks 1 & 2 (`rack-01`, `rack-02`) are serviced by Access Switch 1 (`access-switch-01`).
- Racks 3 & 4 (`rack-03`, `rack-04`) are serviced by Access Switch 2 (`access-switch-02`).
- Exactly **3 application servers** are mounted per rack:
  - `rack-01`: `server-01`, `server-02`, `server-03`
  - `rack-02`: `server-04`, `server-05`, `server-06`
  - `rack-03`: `server-07`, `server-08`, `server-09`
  - `rack-04`: `server-10`, `server-11`, `server-12`

### 3.3 Network Link Hierarchy (15 Links Total)

```
          [ Edge Router (router-01) ]
                       │
             50 Mbps   │   1 ms latency
                       ▼
        [ Core Switch (core-switch-01) ]
                 /            \
       25 Mbps  /              \  25 Mbps
        1 ms   /                \  1 ms
              ▼                  ▼
    [ Access Switch 01 ]    [ Access Switch 02 ]
         /          \            /          \
     10 Mbps      10 Mbps    10 Mbps      10 Mbps
      1 ms         1 ms       1 ms         1 ms
       │            │          │            │
    Rack 01      Rack 02    Rack 03      Rack 04
    (3 servers)  (3 servers)(3 servers)  (3 servers)
```

1. **Router ↔ Core Switch**: 1 link (`link-router-core-01`) @ **50 Mbps**, **1 ms** latency.
2. **Core Switch ↔ Access Switches**: 2 links (`link-core-access-01`, `link-core-access-02`) @ **25 Mbps**, **1 ms** latency.
3. **Access Switches ↔ Servers**: 12 links (`link-access-server-01` through `12`) @ **10 Mbps**, **1 ms** latency.

---

## 4. Pure Deterministic Validation Engine

Implemented in [validator.ts](file:///Users/vyom/Desktop/Project/DATAVERSE/frontend/src/engine/topology/validator.ts).

### 4.1 General Topology Validation (`validateTopology`)

Evaluates any graph representation for structural integrity:

1. Detects duplicate node IDs (`DUPLICATE_NODE_ID`).
2. Detects duplicate link IDs (`DUPLICATE_LINK_ID`).
3. Enforces canonical bidirectional link uniqueness (`DUPLICATE_LINK_CONNECTION`).
4. Rejects self-referencing links (`SELF_REFERENCING_LINK`).
5. Rejects links connecting to non-existent nodes (`MISSING_LINK_ENDPOINT`).
6. Enforces valid node types (`INVALID_NODE_TYPE`).
7. Enforces valid node lifecycle statuses (`INVALID_NODE_STATUS`).
8. Enforces valid link lifecycle statuses (`INVALID_LINK_STATUS`).
9. Enforces parent references point to existing nodes (`INVALID_PARENT_REFERENCE`).
10. Enforces parent-child hierarchy rules (`INVALID_PARENT_RELATIONSHIP`):
    - Non-server nodes must not have a parent.
    - Server parent must be a node of type `rack`.
11. Disallows network links connecting to rack nodes (`RACK_HAS_NETWORK_LINK`).
12. Enforces positive finite bandwidth (`INVALID_BANDWIDTH`).
13. Enforces non-negative finite latency (`INVALID_LATENCY`).
14. Validates server hardware configurations (`INVALID_SERVER_CONFIG`).

### 4.2 Starter Topology Validation (`validateStarterTopology`)

Inherits all general topology checks and additionally verifies full PRD v2.0 starter compliance:

1. Exact node count: 20 nodes total (`STARTER_NODE_COUNT_MISMATCH`).
2. Exact node type counts:
   - 1 Edge Router (`STARTER_ROUTER_COUNT_MISMATCH`).
   - 1 Core Switch (`STARTER_CORE_SWITCH_COUNT_MISMATCH`).
   - 2 Access Switches (`STARTER_ACCESS_SWITCH_COUNT_MISMATCH`).
   - 4 Server Racks (`STARTER_RACK_COUNT_MISMATCH`).
   - 12 Application Servers (`STARTER_SERVER_COUNT_MISMATCH`).
3. Exact server-rack distribution: Exactly 3 servers per rack (`STARTER_SERVER_DISTRIBUTION_MISMATCH`).
4. Exact link count: 15 links total (`STARTER_LINK_COUNT_MISMATCH`).
5. Required hierarchical connections:
   - Router ↔ Core Switch exists (`STARTER_MISSING_CONNECTION`).
   - Core Switch ↔ each Access Switch exists (`STARTER_MISSING_CONNECTION`).
   - Assigned Access Switch ↔ each Server exists (`STARTER_MISSING_CONNECTION`).
6. Exact starter bandwidth allocations:
   - Router ↔ Core: 50 Mbps (`STARTER_LINK_BANDWIDTH_MISMATCH`).
   - Core ↔ Access: 25 Mbps (`STARTER_LINK_BANDWIDTH_MISMATCH`).
   - Access ↔ Server: 10 Mbps (`STARTER_LINK_BANDWIDTH_MISMATCH`).
7. Exact server hardware specs: 8 vCPUs, 16 GB RAM (`STARTER_SERVER_CONFIG_MISMATCH`).

### 4.3 Stable Error Codes (`TopologyErrorCode`)

All validation errors return structured objects:

```typescript
export interface ValidationError {
  code: TopologyValidationErrorCode;
  message: string;
  nodeId?: string;
  linkId?: string;
  field?: string;
  details?: Record<string, unknown>;
}
```

---

## 5. Usage Examples

### 5.1 Generating and Validating Starter Topology

```typescript
import {
  createStarterTopology,
  validateStarterTopology,
  isStarterTopologyValid,
} from './engine/topology';

const topology = createStarterTopology();

if (isStarterTopologyValid(topology)) {
  console.log('Topology is 100% compliant with PRD v2.0.');
} else {
  const result = validateStarterTopology(topology);
  console.error('Validation failed:', result.errors);
}
```

### 5.2 Validating Custom or Dynamically Mutated Topologies

```typescript
import { validateTopology, TopologyErrorCode } from './engine/topology';

const result = validateTopology(customGraph);
if (!result.valid) {
  for (const err of result.errors) {
    switch (err.code) {
      case TopologyErrorCode.DUPLICATE_LINK_CONNECTION:
        console.warn(`Duplicate link between nodes: ${err.message}`);
        break;
      case TopologyErrorCode.RACK_HAS_NETWORK_LINK:
        console.error(`Invalid rack link: ${err.message}`);
        break;
      default:
        console.error(`Error [${err.code}]: ${err.message}`);
    }
  }
}
```

---

## 6. Verification and Test Suite

The engine is covered by 24 unit tests in [topology.test.ts](file:///Users/vyom/Desktop/Project/DATAVERSE/frontend/src/tests/topology.test.ts):

- Generator counts, types, IDs, and link bandwidth verification.
- Deterministic repeatability: multiple consecutive invocations produce deeply equal outputs.
- Canonical link key symmetry: `getCanonicalLinkKey(A, B) === getCanonicalLinkKey(B, A)`.
- Rejection of duplicate node IDs and duplicate link IDs.
- Rejection of duplicate logical connections (both forward and reversed).
- Rejection of self-referencing links.
- Rejection of links pointing to non-existent source or target nodes.
- Rejection of invalid node types and lifecycle statuses.
- Rejection of orphan parent references and invalid parent-child relationships (e.g. non-rack parents).
- Rejection of network links connecting directly to racks.
- Rejection of negative/infinite/zero bandwidth and negative latency.
- Starter topology validation: node count mismatches, server distribution imbalances (e.g. 4 servers in rack 1 and 2 in rack 2), missing required connections, bandwidth mismatches, and hardware specification discrepancies.
- Full type safety verified with `tsc -b` (`noUncheckedIndexedAccess: true`), ESLint strict rules, and Prettier formatting.

---

## 7. 3D Data Center Topology Visualization Architecture (Day 3, Task 06B)

The 3D visualization layer provides an interactive, spatial digital twin of the DATAVERSE facility rendered inside a single persistent Three.js / React Three Fiber Canvas.

### 7.1 Component Composition

```
[ DataCenterViewport ] (Single Canvas, OrbitControls, Lighting Rig, Ground Grid)
  ├── [ RouterMesh ]             Edge Gateway Router (100 Gbps, Cyan WAN Uplink Bar)
  ├── [ CoreSwitchMesh ]         Core Distribution Switch (80 Gbps, Violet Line Card Matrix)
  ├── [ AccessSwitchMesh x2 ]    Access Switches Pod A & B (40 Gbps, Sky Blue Port Arrays)
  ├── [ ServerRackMesh x4 ]      42U Steel Spatial Cabinets with tinted doors & nameplates
  │     └── [ ServerBladeMesh x3 ] Modular 2U Blades mounted in rack slots (8 vCPU, 16 GB RAM)
  ├── [ NetworkCableMesh x15 ]   3D Curved Tubes (QuadraticBezierCurve3 + TubeGeometry)
  └── [ NodeInspector ]          Lightweight Cyber HUD Overlay & Hardware Spec Inspector
```

### 7.2 Hardware Aesthetic & Material Standards

- **Dark Titanium & Matte Obsidian**: Chassis structures (`#030712`, `#090d16`, `#0e1726`) with `metalness: 0.8` and `roughness: 0.35`.
- **Accent Hierarchy**:
  - Edge Router & Core Uplink: Electric Cyan (`#06b6d4`, emissive `#06b6d4`)
  - Core Switch Line Cards: Vivid Violet / Purple (`#8b5cf6`, `#a855f7`)
  - Access Distribution: Sky Blue (`#0ea5e9`, `#38bdf8`)
  - Compute Server Blades: Emerald Status LEDs (`#10b981`) & Workload Indicators (`#06b6d4`)
  - Physical Server Racks: Matte steel frame with cyan unit edge accents
- **Cable Conduits**: 3D geometric tubes generated from `THREE.QuadraticBezierCurve3` with catenary sag/arc. Coded by bandwidth tier:
  - Router ↔ Core (50 Mbps): 0.038m radius, Cyan
  - Core ↔ Access (25 Mbps): 0.030m radius, Violet
  - Access ↔ Server (10 Mbps): 0.022m radius, Sky Blue
  - Selected Link / Endpoint: Emissive glow boost (`emissiveIntensity: 0.9`) with `#38bdf8` highlight.

### 7.3 Interaction & State Management

- **Selection Synchronization**: State is driven centrally by `useSimulationStore.selectedNodeId`.
- **Spatial Hover**: Pointer enter/leave events dynamically update local mesh materials without triggering global re-renders.
- **Node Selection**: Clicking any 3D node (`router`, `core_switch`, `access_switch`, `rack`, or `server`) stops propagation and sets `selectedNodeId`.
- **Deselection**: Clicking empty background or ground plane fires `onPointerMissed` on `<Canvas>` to clear `selectedNodeId`.
- **Inspector HUD**: Displays node name, type, operational status, parent container, hardware configurations (vCPU, RAM, capacity, IP/MAC), and connected links.
- **Synchronized Dashboard Grid**: Below the 3D viewport, `CommandCenterView` dynamically swaps the static hierarchy card for live hardware telemetry when a node is selected.
- **Navigation Bounds**: OrbitControls damped at `0.06`, distance constrained between `3.5` and `25`, polar angle clamped at `Math.PI / 2.05` to prevent underfloor clipping.

---

## 8. 3D Scene Visibility & Industrial Clarity Improvements (Day 3, Task 06B.1)

To resolve scene visibility issues identified in initial rendering audits, the 3D topology visualization was overhauled with industrial data center equipment aesthetics, open rack bays, and realistic cable trays.

### 8.1 Rack Visibility & Structural Frame

- **Open 42U Cabinet Architecture**: Replaced solid, occluding inner box meshes with open front bays featuring 4 vertical structural corner posts (`#334155`), side sheet-metal exterior panels (`#1e293b`), top roof cowl, and EIA-310 vertical mounting rails (`#475569`).
- **Metallic Slate Materials**: Transitioned from pitch-black (`#030712`) to visible metallic dark-grey and slate palettes (`#1e293b`, `#273549`, `#334155`) with `roughness: 0.35` and `metalness: 0.75-0.85`.
- **Structural Accents**: Exterior edges highlighted with fine line segments (`#475569` idle, `#38bdf8` hover, `#06b6d4` active selection).
- **Zero Compute Occlusion**: The open cabinet design guarantees all server blades inside are completely visible from standard camera angles.

### 8.2 Server Blade Fidelity & Front Panels

- **Complete Inventory Visibility**: All 12 server blades (exactly 3 per rack) are visibly positioned in distinct vertical slots ($y = 1.0, 1.7, 2.4$).
- **Faceplate Micro-Details**:
  - 4 $\times$ Hot-swap 2.5-inch drive caddies with silver latch handles (`#94a3b8`) and green activity dots.
  - Honeycomb ventilation grille and model badge on right faceplate.
  - SFP+ / 10GbE front NIC socket (`#0284c7` / `#06b6d4`) receiving network cables.
  - Multi-status LED column: Emerald green power LED, pulsing electric cyan network activity LED, and amber workload/alert LED.
- **Interactive Selectability**: Each individual server blade responds to pointer hover with highlight colors and renders an interactive `<Html>` tooltip with node name and badge.

### 8.3 Network Appliances & Port Alignment

- **Edge Router (`router-01`)**: Metallic chassis with heavy floor riser pedestal, top ventilation louvers, dual external transceiver masts with cyan beacons, glowing WAN light bar, and core downlink socket.
- **Core Distribution Switch (`core-switch-01`)**: Large 4U director switch chassis with central glowing violet optical line card matrix, rear core uplink socket facing router, and dual distribution downlink sockets facing access switches.
- **Access Switches (`access-switch-01`, `access-switch-02`)**: 2U aggregation switches with 48-port front panel arrays, active sky-blue port indicator bars, rear core uplinks, and 6 dedicated downlink port sockets.

### 8.4 Network Cable Routing & Trays

- **Realistic Overhead Cable Pathways**: Access Switch to Server cables use `THREE.CubicBezierCurve3` to exit the front switch ports, ascend into overhead cable trays ($y = 3.75$), route across the aisle, and drop cleanly into each server blade's front NIC socket ($z = 2.025$).
- **No Mesh Penetration**: Cables never pass through solid rack side panels or clip equipment chassis.
- **Connector Boot Plugs**: Endpoint spherical boot plugs (`#1e293b`) securely anchor cables into physical device ports.

### 8.5 Multi-Source Studio Lighting Rig & Camera Perspective

- **Ambient Illumination**: Increased ambient light to $0.92$ (`#f8fafc`) to lift deep shadows and highlight metallic surfaces.
- **Key & Fill Lights**: Front key directional light ($1.75$ intensity, white, casting shadows) at `[8, 16, 14]`, paired with cool fill light ($0.85$ intensity) at `[-12, 10, 10]`.
- **Rim & Floor Bounce Lights**: High-angle cyan rim light ($1.15$ intensity) at `[0, 12, -10]` providing edge separation from the dark background; upward bounce light ($0.45$ intensity) illuminating lower rack slots.
- **Isometric Camera Elevation**: Camera positioned at `[0, 5.5, 11.2]` with $46^\circ$ FOV targeting `[0, 1.5, -0.5]`, delivering a balanced $21^\circ$ isometric view that reveals all 20 nodes, cable trays, and backline network appliances simultaneously.
- **Clean Slate Navy Atmosphere**: Background set to `#080d1a` with fog pushed back to $[20, 48]$, preventing distance wash-out of edge network appliances.

---

## 9. Functional 2D Node List & Read-Only Topology Inspector (Day 3, Task 06B)

The 2D Topology Hierarchy and Read-Only Inspector provide an accessible, non-WebGL control panel that guarantees 100% feature parity and synchronized two-way state reflection with the 3D digital twin.

### 9.1 2D Topology Hierarchy (`TopologyNodeList.tsx`)

- **Complete Hardware Inventory**: Displays all 20 nodes grouped logically into 4 hardware tiers: Edge Gateway Router (1), Core Distribution Switch (1), Access Switches (2), and Physical Server Cabinets (4 Racks with exactly 3 child servers nested under each).
- **Physical Racks as Spatial Containers**: Explicitly designated as spatial grouping units with no network packet forwarding capabilities.
- **Collapsible Rack Bays**: Expand/collapse toggle per rack, plus global 'Expand All' and 'Collapse All' controls.
- **Search & Tier Filtering**: Live search by name, ID, or status, alongside tier filter buttons (`ALL`, `NETWORK`, `RACKS`, `SERVERS`).
- **Full WAI-ARIA Accessibility**: Standard `role="tree"` and `role="treeitem"` with `aria-selected` and `aria-expanded` attributes, navigable via `Enter`, `Space`, `ArrowUp`, and `ArrowDown` keys.

### 9.2 Read-Only Topology Inspector (`TopologyInspector.tsx`)

- **Zero WebGL Dependency**: Pure 2D React component functioning independently in headless, server-side, or non-accelerated environments.
- **Comprehensive Hardware Inspection**:
  - **Server Blades**: vCPU count, RAM, local NVMe storage, IP address, MAC address, parent rack with direct navigation button, and connected uplink to access switch.
  - **Network Appliances**: Switching capacity (100 Gbps WAN, 80 Gbps Core, 40 Gbps Access), IP/MAC, assigned rack IDs, and connected logical links list with peer device links and latency/bandwidth metrics.
  - **Physical Racks**: 42U total height, capacity, mounted blade count, and clickable child server list.
  - **Network Links**: Source, target, bandwidth tier, latency, and status with navigation buttons to both endpoints.
- **Empty & Error State Safety**:
  - Unselected state displays the PRD network hierarchy summary and invariant metrics.
  - Missing/invalid node or link IDs display an alert banner with a reset action.
  - Missing configuration fields display fallback `N/A` values without runtime exceptions.
  - Empty topology displays an accessible message.

### 9.3 Two-Way Synchronized Selection Architecture

- Both the 3D Three.js canvas and the 2D DOM tree read from and dispatch to `useSimulationStore`:
  - `selectedNodeId`: Active selected hardware node.
  - `selectedLinkId`: Active selected logical network cable.
- Selecting any component in 3D immediately focuses and highlights the corresponding node in the 2D tree and inspector HUD.
- Selecting any item in the 2D tree or clicking an endpoint in the inspector immediately highlights the mesh and cable in the 3D viewport.

---

## 10. Topology Editing Operations Foundation (Day 3, Task 06C)

The Topology Editing Engine ([operations.ts](file:///Users/vyom/Desktop/Project/DATAVERSE/frontend/src/engine/topology/operations.ts)) provides pure, deterministic TypeScript primitives for mutating network and physical infrastructure topologies.

Adhering strictly to PRD v2.0, DECISION-001 (Monorepo & Engine Separation), and DECISION-002 (Immutable Simulation Model), every operation preserves functional purity and guarantees that invalid topology states cannot enter the application state.

### 10.1 Architectural Invariants & Guarantees

1. **Strict Immutability**: Operations NEVER mutate input topology objects in place. Every operation deep-clones nodes, links, and nested configuration records via `cloneTopology()`, returning a fresh reference. Mutating a returned topology or an input topology has zero side-effects on other references.
2. **Deterministic Execution**: Zero stochastic behavior. Operations do not invoke `Math.random()`, access ambient system timestamps (`Date.now()`), or generate auto-incrementing nonces. All node and link identifiers must be explicitly and deterministically supplied by the caller.
3. **Structured Result Pattern**: All operations return `TopologyOperationResult<T>`:
   ```typescript
   export type TopologyOperationResult<T = Topology> =
     | {
         success: true;
         topology: T;
         affectedNodeIds: string[];
         affectedLinkIds: string[];
       }
     | {
         success: false;
         error: ValidationError;
         errors: ValidationError[];
         topology: Topology; // Returns untouched input topology reference
       };
   ```
4. **Validation Pipeline Integration**: Operations that alter the topology graph or configuration structure pass through the validation engine (`validateTopology`) prior to returning. If any invariant is violated, the operation fails atomically with detailed diagnostic errors.
5. **Physical Hardware vs. Logical Network Separation**: Racks remain strictly spatial containers. Any operation attempting to link a rack into a network connection is rejected immediately with `RACK_HAS_NETWORK_LINK`.

### 10.2 Implemented Pure Operations

| Operation                 | Signature                           | Primary Behavior & Validation Guards                                                                                                                                                                                                                                                                    |
| :------------------------ | :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cloneTopology`           | `(topology: Topology): Topology`    | Deep-clones nodes, links, positions, and configurations without shared references.                                                                                                                                                                                                                      |
| `renameNode`              | `(topology, nodeId, newName)`       | Validates name length (1–100 chars), non-empty, and trims whitespace. Rejects missing nodes with `NODE_NOT_FOUND`.                                                                                                                                                                                      |
| `addNode`                 | `(topology, params: AddNodeParams)` | Enforces supported node types (`router`, `core_switch`, `access_switch`, `rack`, `server`), unique `id` (`DUPLICATE_NODE_ID`), non-empty name, and verifies server parent is a valid existing rack (`PARENT_RACK_NOT_FOUND`).                                                                           |
| `removeNode`              | `(topology, nodeId, options?)`      | Automatically cascade-removes all connected network links (`affectedLinkIds`). For racks containing servers: rejects with `RACK_CONTAINS_SERVERS` unless `options.cascadeChildren === true`. When `cascadeChildren: true`, child servers and their links are recursively purged.                        |
| `updateNodeConfiguration` | `(topology, nodeId, configUpdate)`  | For servers: validates vCPU $> 0$, RAM $> 0$, storage $> 0$, and automatically recalculates `ram_mb = ram_gb * 1024`. For network appliances: validates switching capacity $> 0$. Rejects invalid configs with `INVALID_SERVER_CONFIG`.                                                                 |
| `updateLinkMetrics`       | `(topology, linkId, updates)`       | Validates bandwidth $> 0$ (`INVALID_BANDWIDTH`) and latency $\ge 0$ (`INVALID_LATENCY`). Leaves unmentioned metrics intact.                                                                                                                                                                             |
| `updateNodeStatus`        | `(topology, nodeId, newStatus)`     | Validates status against allowable domain (`online`, `degraded`, `offline`, `maintenance`). Rejects invalid statuses with `INVALID_NODE_STATUS`.                                                                                                                                                        |
| `updateLinkStatus`        | `(topology, linkId, newStatus)`     | Validates status against allowable domain (`online`, `congested`, `failed`, `maintenance`, `severed`). Rejects invalid statuses with `INVALID_LINK_STATUS`.                                                                                                                                             |
| `addLink`                 | `(topology, params: AddLinkParams)` | Validates link ID uniqueness, verifies source and target exist, rejects self-loops (`SELF_REFERENCING_LINK`), prevents rack network links (`RACK_HAS_NETWORK_LINK`), rejects duplicate links between same pair of devices (`DUPLICATE_LINK_CONNECTION`), and enforces bandwidth $> 0$, latency $\ge 0$. |
| `removeLink`              | `(topology, linkId)`                | Removes link by ID. Rejects missing links with `LINK_NOT_FOUND`. Nodes and remaining links are preserved intact.                                                                                                                                                                                        |
| `reassignServerParent`    | `(topology, serverId, newRackId)`   | Reassigns a server blade to a new physical rack cabinet. Validates server node existence, confirms node is of type `server`, and verifies target node exists and is of type `rack`. Updates both `parent_id` and `parentId`.                                                                            |

### 10.3 Explicitly Unsupported Operations & Invariant Boundaries

To prevent unauthorized scope creep and preserve engine determinism, the following operations are explicitly unsupported and actively rejected:

1. **In-Place Mutation**: Direct modification of `topology.nodes` or `topology.links` arrays is unsupported; operations clone the graph before modifying.
2. **Implicit / Random Identifier Generation**: The engine does not generate UUIDs or pseudo-random strings internally; callers must provide deterministic, semantic identifiers (e.g., `server-13`, `link-core-access-03`).
3. **Connecting Network Links to Racks**: Racks cannot terminate network connections. Any attempt to add a link with a rack endpoint is rejected with `RACK_HAS_NETWORK_LINK`.
4. **Nested Rack Hierarchy**: Racks cannot be nested inside other racks (`parent_id` on a rack is prohibited).
5. **Non-Server Nodes with Parents**: Network switches and routers cannot have parent containers.
6. **Negative or Zero Hardware Metrics**: Setting $\le 0$ vCPU, RAM, storage, or network switching capacity is rejected.
7. **Negative Bandwidth or Negative Latency**: Network bandwidth must be $> 0$; link latency must be $\ge 0$.
8. **Orphan Servers in Isolation**: Servers must declare an existing parent rack upon creation; unparented servers are rejected with `SERVER_WITHOUT_PARENT`.
9. **Accidental Rack Deletion**: Deleting a populated rack without `cascadeChildren: true` is blocked to prevent dangling orphan server blades.

### 10.4 Automated Unit Test Verification

The editing operations engine is validated by 37 dedicated Vitest unit tests in [topologyOperations.test.ts](file:///Users/vyom/Desktop/Project/DATAVERSE/frontend/src/tests/topologyOperations.test.ts):

- **Cloning & Immutability**: Verifies deep cloning of nodes, links, and positions without reference sharing.
- **Node Renaming**: Verifies successful renaming, whitespace trimming, and rejection of blank/whitespace-only names or non-existent node IDs.
- **Node Addition**: Verifies adding servers with valid parent racks, adding switches/racks, rejection of duplicate IDs, unsupported types, and missing parent racks.
- **Node Removal & Cascades**: Verifies safe removal of servers with automatic cascade removal of access switch links; verifies rack deletion rejection when containing servers, and clean cascading deletion of child servers and links when `cascadeChildren: true`.
- **Configuration Updates**: Verifies compute server vCPU/RAM updates, automatic `ram_mb` synchronization, switching capacity updates, and rejection of negative/zero values.
- **Link Metric Updates**: Verifies bandwidth/latency updates, validation bounds, and immutability.
- **Status Updates**: Verifies node and link operational state transitions and rejection of invalid enum values.
- **Link Addition & Removal**: Verifies link creation, endpoint existence validation, rack link prohibition, canonical duplicate prevention, self-loop prevention, and safe link removal.
- **Server Parent Reassignment**: Verifies moving server blades between racks, rejection of non-rack targets, and rejection of non-server nodes.
- **Purity & Starter Invariants**: Confirms operations preserve starter topology validity when executing valid edits.

---

## 11. Cinematic 3D Data Center Visualization Environment (AAA Quality Overhaul)

The DATAVERSE 3D digital twin features a cinematic, AAA-grade architectural data center room. The primitive floating boxes, arbitrary pedestals, and neon lines have been completely eliminated. All 20 starter nodes are physically mounted inside authentic enterprise equipment racks within a fully realized data center facility.

### 11.1 Architectural Facility Environment (`DataCenterEnvironment.tsx`)

The visualization constructs a complete, physically believable enterprise facility room:

- **Architectural Acoustic Walls**:
  - Enclosing rear facility wall ($z = -8.5$) and side walls ($x = \pm 9.0$) constructed from sound-dampening modular acoustic panels in dark industrial slate (`#161e2e`).
  - Wall-mounted Computer Room Air Conditioning (CRAC) return air louvers with realistic stamped grille slits and equipment plates.
  - Wall-mounted Emergency Power Off (EPO) switch boxes (`#dc2626`), high-voltage electrical conduits, and pod row identification signage ("ROW 01 - HIGH DENSITY COMPUTE").
- **Structural Ceiling Deck & Infrastructure**:
  - Industrial ceiling deck at $y = 4.8\text{m}$.
  - Structural transverse steel I-beams running across the ceiling at regular bay intervals.
  - High-pressure fire suppression main piping (safety red `#b91c1c`) with brass sprinkler nozzle heads.
  - Overhead cable ladder trays ($y = 3.45\text{m}$) suspended from ceiling drop rods, providing physical channels for network cable routing.
- **Architectural Linear LED Troffers**:
  - Ceiling-mounted continuous linear LED luminaire diffusers positioned directly above the cold server aisle ($z = 1.5$) and network tiers ($z = -2.5, -5.8$), casting soft downward illumination without harsh glare.
- **Raised Access Floor Plane & Perforated Airflow Tiles**:
  - Standard 600mm $\times$ 600mm raised floor tiles with dark joint grooves.
  - Perforated airflow floor tiles in the cold aisle directly in front of the server cabinets, complete with hexagonal airflow mesh insets for hot/cold aisle thermal containment realism.
  - Brushed aluminum cold aisle boundary demarcation strips and grounded contact shadow plane.

### 11.2 Enterprise 42U Server Cabinets (`ServerRackMesh.tsx`)

Each of the four racks is an authentic 42U enterprise server cabinet (APC NetShelter SX standard):

- **Accurate 42U Proportions**: $1.08\text{m}$ width $\times 2.92\text{m}$ height $\times 1.24\text{m}$ depth ($2.7 : 1$ vertical ratio).
- **Grounded Base Structure**: Welded bottom frame with 4 dual-wheel swivel casters, 4 threaded leveling feet with hex nuts and rubber floor isolation pads resting on the floor at $y = 0$, and stamped kickplate vents.
- **Structural Corner Columns**: 4 roll-formed steel posts with beveled chamfers (`#1e2634`, `#334155`).
- **Roof Canopy & Fans**: Welded top header at $y = 2.82\text{m}$ with dual high-CFM exhaust fan cowls, metal finger-guard rings, and brush cable entry pass-through glands.
- **EIA-310-D Internal Rails**: Visible unit markings from 1U to 42U (major ticks highlighted every 5U) and horizontal depth tie braces.
- **Front Door & Hardware**: Outer beveled frame, heavy industrial hinge blocks, and recessed swing-handle lever latch with key lock cylinder.
- **Airflow Blanking Panels**: Precision slotted blanking plates filling unpopulated bays above, between, and below compute blades.
- **Removable Side Panels**: Removable side panels with recessed quarter-turn latches and upper/lower ventilation louvers.

### 11.3 High-Detail Server Blades (`ServerBladeMesh.tsx`)

All 12 starter application servers are mounted inside the 4 cabinets (3 per cabinet at slots $y = 1.1\text{m}, 1.7\text{m}, 2.3\text{m}$):

- **2U Compute Enclosure**: Deep sheet metal chassis ($0.82\text{m} \times 0.30\text{m} \times 0.96\text{m}$) in brushed dark graphite PBR (`#273447`).
- **Front Faceplate**: Brushed anodized aluminum faceplate with die-cast pull handles and knurled EIA thumbscrews.
- **2x2 Hot-Swap Drive Caddies**: 4 hot-swap 2.5" drive bays with brushed silver aluminum ejector levers, push-buttons, and emerald green drive activity LEDs.
- **Ventilation & Optics**: Honeycomb intake ventilation grille and SFP+ 10GbE optical transceiver cages.
- **Operator Telemetry Cluster**: Recessed power microswitch with LED halo, steady green power LED (`#10b981`), pulsing cyan NIC activity LED (`#06b6d4`), and amber disk activity LED (`#f59e0b`).

### 11.4 Rack-Mounted Network Appliance Hardware

Network devices are physically mounted inside authentic enterprise equipment racks rather than floating on pedestals:

- **Edge Gateway Router (`RouterMesh.tsx`)**:
  - Housed in an authentic 42U Network Gateway Rack grounded to the floor with structural corner posts and leveling feet.
  - 4U carrier-grade chassis ($1.44\text{m} \times 0.58\text{m} \times 1.05\text{m}$) with dual Routing Processors, OLED diagnostic screen, glowing Cyan WAN light bar (`#06b6d4`), 8 QSFP28 100G cages, dual front exhaust fan modules, and 1U horizontal D-ring wire organizers.
- **Core Distribution Switch (`CoreSwitchMesh.tsx`)**:
  - Housed in a 42U Core Director Rack grounded to the floor.
  - 6U director chassis ($1.4\text{m} \times 0.68\text{m} \times 1.05\text{m}$) with glowing violet optical fabric card matrix (`#8b5cf6`), 4 horizontal fiber line-card blades with SFP+ arrays, and horizontal wire management trays.
- **Access Switches (`AccessSwitchMesh.tsx`)**:
  - Housed in Pod Distribution Racks for Pod A ($x = -3.0$) and Pod B ($x = 3.0$).
  - Top 1U 48-port RJ45 patch panel, 2U aggregation switch with 48 RJ45 ports + 4 SFP+ cages (sky blue glow `#38bdf8`), and 1U bottom D-ring cable manager.

### 11.5 Physically Believable Cable Routing (`NetworkCableMesh.tsx`)

- **Realistic Overhead Routing**: Cables exit switch ports, pass through horizontal wire management D-rings, ascend into the overhead cable ladder tray at $y = 3.45\text{m}$, traverse forward across the facility, and drop into the destination rack's front SFP+ port.
- **Bandwidth Tier Color Palette**: Electric Cyan (50 Mbps Router-Core), Vivid Violet (25 Mbps Core-Access), Steel Sky Blue (10 Mbps Access-Server).
- **Connector Boot Plugs**: Realistic strain relief boots anchoring cable ends into device port sockets with zero mesh penetration.

### 11.6 Camera Presets & Smooth Interpolation Controller (`DataCenterViewport.tsx`)

- **Seven Cinematic Presets**:
  1. `FRONT`: Eye-level cold aisle view (`pos: [0, 1.8, 6.2]`, `target: [0, 1.45, 1.5]`).
  2. `REAR`: Hot aisle view facing rear doors (`pos: [0, 2.0, -0.6]`, `target: [0, 1.45, 1.5]`).
  3. `LEFT`: Down-aisle view from left maintenance zone (`pos: [-7.2, 1.9, 1.5]`, `target: [0, 1.45, 1.5]`).
  4. `RIGHT`: Down-aisle view from right maintenance zone (`pos: [7.2, 1.9, 1.5]`, `target: [0, 1.45, 1.5]`).
  5. `TOP`: Direct architectural plan view (`pos: [0, 9.6, 0]`, `target: [0, 0, 0]`).
  6. `ISOMETRIC`: Standard 3/4 axonometric perspective (`pos: [5.4, 4.6, 7.8]`, `target: [0, 1.45, 1.5]`).
  7. `CINEMATIC`: Wide-angle establishing room view (`pos: [0.8, 4.0, 8.6]`, `target: [0, 1.5, 0.5]`).
- **Smooth Lerp Transitions**: Custom `CameraController` inside the R3F Canvas smoothly interpolates position and look-at target using damping factor $0.08$. Automatically disengages when the operator initiates manual OrbitControls interaction.
- **Camera Preset Toolbar**: Integrated sleek button bar in the viewport header with active state illumination.
- **Anti-Collision Tooltips & Collapsible Inspector HUD**: Docks neatly with custom glassmorphic styling, collapsible toggle, and zero WebGL interference.
