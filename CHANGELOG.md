# DATAVERSE — Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
