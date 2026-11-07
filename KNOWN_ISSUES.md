# DATAVERSE — Known Issues & Architectural Observations

## Status: Day 1 Baseline Tracking

## Reference: DATAVERSE PRD v2.0

This document tracks unresolved engineering discrepancies, environment constraints, and dependency notices identified during implementation.

---

## 1. Specification & Domain Discrepancies

### KI-001: Default Server RAM Capacity vs. Request Demand Mismatch

- **Description**: PRD v2.0 specifies that an incoming HTTP/TCP request allocates a nominal memory buffer of $16\text{ MB}$ to $64\text{ MB}$, while default application server nodes are provisioned with standard server memory ($16\text{ GB}$ to $64\text{ GB}$). Under standard simulation runs (e.g. 50–200 concurrent requests), total allocated server RAM reaches only $\approx 3.2\text{ GB}$ ($5\%\text{--}20\%$ utilization), preventing normal traffic scenarios from triggering realistic memory exhaustion, swap thrashing, or OOM crashes.
- **Rule**: Engineering must **not** silently alter normative PRD formulas.
- **Impact**: Server nodes appear permanently under-utilized in memory despite high CPU saturation unless explicitly addressed.
- **Mitigation / Proposed Resolution**: Recorded in [DECISIONS.md](file:///Users/vyom/Desktop/Project/DATAVERSE/DECISIONS.md#DECISION-010). Proposing configurable workload profiles (e.g. high-memory analytical queries allocating $512\text{ MB}\text{--}1024\text{ MB}$ or simulated memory-leaking microservices) or container-sized hardware profiles ($1\text{ GB}\text{--}4\text{ GB}$) pending Product Owner approval.
- **Status**: **OPEN (Awaiting Product Decision before Phase 4)**

---

## 2. Dependencies & Toolchain Notices

### KI-002: Recharts 2.x Deprecation Notice

- **Description**: `npm install` reports a deprecation warning for `recharts@2.15.x`, advising migration to Recharts v3.
- **Assessment**: Recharts 2.15.x is stable, battle-tested, and fully compatible with React 19 in our workspace. Recharts v3 introduces breaking API changes to axes and responsiveness that are not yet necessary for Day 1 telemetry charts.
- **Action**: Maintain stable 2.15.x for Day 1; evaluate Recharts v3 upgrade during Phase 6 (Monitoring & Telemetry).
- **Status**: **TRACKED / NON-BLOCKING**

### KI-003: Disk Capacity Warning on Host

- **Description**: The host machine disk storage has $14\text{ GiB}$ remaining ($93\%$ capacity).
- **Action**: Monorepo dependencies and local Python virtual environments must remain lean. Avoid caching large binary assets, uncompressed 3D GLTF models, or redundant global npm packages.
- **Status**: **MONITORED**
