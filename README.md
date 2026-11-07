# DATAVERSE — 3D Living Data Center Simulator

### CodeVerse Tech | Enterprise Infrastructure Simulation Engine

### Source of Truth: DATAVERSE PRD v2.0

![Status](https://img.shields.io/badge/Status-Day%201%20Foundation%20Verified-06b6d4?style=flat-square)
![Node](https://img.shields.io/badge/Node-v22.23.2-339933?style=flat-square)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square)
![Three.js](https://img.shields.io/badge/Three.js-0.187-black?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict%205.7-3178c6?style=flat-square)

---

## 1. Product Overview

**DATAVERSE** is a production-grade, browser-based 3D Living Data Center Simulator. It provides engineering teams, infrastructure architects, and site reliability engineers with an interactive, deterministic digital twin environment to:

- Model and explore physical data center workspaces in full 3D.
- Simulate deterministic network traffic flows through hierarchical routing topologies.
- Monitor real-time compute, memory, bandwidth, and latency metrics across servers and switches.
- Inject hardware and network faults (crashes, link cuts, latency jitter, packet loss) in real time.
- Observe automated recovery, failover protocols, and incident timelines.
- Save, restore, and verify deterministic simulation sessions via state checkpoints.

---

## 2. Technology Stack

### Frontend & 3D Simulation Console

- **Framework**: React 19, Vite 6, TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4 (official `@tailwindcss/vite` integration)
- **Routing**: React Router 7
- **3D Graphics**: Three.js, React Three Fiber (R3F), Drei
- **State Management**: Zustand
- **Telemetry Charts**: Recharts
- **Animation**: GSAP (UI transitions only; simulation is tick-driven)
- **Icons**: Lucide React

### Backend Foundation

- **Language & Runtime**: Python 3.12+ (tested on Python 3.14.8 ARM64)
- **API Framework**: FastAPI, Starlette
- **Validation & Settings**: Pydantic v2, Pydantic Settings
- **HTTP Engine**: Uvicorn (ASGI)
- **Authentication & Database**: Supabase Auth (JWT / JWKS) & Supabase PostgreSQL

### Testing & Quality Assurance

- **Frontend Test Runner**: Vitest, React Testing Library, jsdom
- **Backend Test Runner**: Pytest, pytest-asyncio, HTTPX
- **Code Quality**: ESLint 9 (Flat Config), Prettier, TypeScript strict typecheck

---

## 3. Repository Architecture

```
DATAVERSE/
│
├── frontend/
│   ├── src/
│   │   ├── app/                      # Main shell, layout, navigation & router
│   │   ├── features/
│   │   │   ├── auth/                 # Supabase authentication views & guards
│   │   │   ├── datacenters/          # Workspace & data center management
│   │   │   └── simulation/           # Simulation controls, telemetry & incident feeds
│   │   ├── three/
│   │   │   ├── scene/                # WebGL canvas, lights, floor & cameras
│   │   │   ├── objects/              # 3D Racks, routers, switches, blade servers
│   │   │   └── effects/              # Status shaders, glows & cable lines
│   │   ├── engine/
│   │   │   ├── core/                 # Tick clock, discrete event queue & PRNG
│   │   │   ├── models/               # Node, link & packet interfaces
│   │   │   ├── traffic/              # Workload generators (Poisson, burst)
│   │   │   ├── routing/              # Dynamic score load-balancing algorithms
│   │   │   ├── resources/            # CPU cycle & RAM memory accounting
│   │   │   └── faults/               # Deterministic fault injection pipeline
│   │   ├── services/                 # Backend API client & Supabase adapters
│   │   ├── store/                    # Zustand UI & simulation state stores
│   │   ├── hooks/                    # Reusable React & R3F hooks
│   │   ├── tests/                    # Vitest component & engine unit tests
│   │   ├── index.css                 # Tailwind v4 styles & design tokens
│   │   └── main.tsx                  # React DOM mount entrypoint
│   ├── index.html                    # HTML shell
│   ├── vite.config.ts                # Vite & Vitest configuration
│   ├── tsconfig.json                 # TypeScript solution references
│   ├── tsconfig.app.json             # App TypeScript strict configuration
│   ├── tsconfig.node.json            # Tooling TypeScript configuration
│   └── package.json                  # Frontend dependencies & scripts
│
├── backend/
│   ├── app/
│   │   ├── api/                      # REST endpoints & API route registration
│   │   ├── core/                     # Pydantic Settings & environment config
│   │   ├── schemas/                  # Pydantic request/response schemas
│   │   ├── services/                 # Business logic & simulation verification
│   │   ├── repositories/             # Database access layers
│   │   ├── tests/                    # Pytest test suite
│   │   └── main.py                   # FastAPI application initialization
│   ├── pyproject.toml                # Python project configuration
│   └── requirements.txt              # Backend dependencies
│
├── migrations/                       # PostgreSQL schema migrations
├── docs/                             # Architecture diagrams & PRD references
├── .env.example                      # Environment variables template
├── .gitignore                        # Git exclusion rules
├── .prettierrc                       # Code formatting rules
├── ROADMAP.md                        # 21-Day development roadmap
├── DECISIONS.md                      # Engineering Decision Records (ADR)
├── KNOWN_ISSUES.md                   # Tracked discrepancies & notices
├── CHANGELOG.md                      # Version change history
└── package.json                      # Monorepo root workspace configuration
```

---

## 4. Local Setup Instructions

### Prerequisites

- **Node.js**: `v20.0.0+` (Recommended: `v22.23.2+`)
- **npm**: `v10.0.0+`
- **Python**: `3.12+` (Recommended: `3.12` or `3.14`)
- **Git**: `2.30+`

### 1. Clone & Environment Configuration

```bash
# Copy environment configuration template
cp .env.example .env
```

### 2. Frontend Dependencies & Verification

```bash
# Install all monorepo dependencies
npm install

# Run TypeScript strict type verification
npm run typecheck

# Run ESLint linting
npm run lint

# Run Vitest test suite
npm test

# Build production bundle
npm run build
```

### 3. Backend Environment Setup (Python)

```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt

# Run backend tests
pytest
```

---

## 5. Development Commands

| Command                                 | Working Directory   | Description                                               |
| :-------------------------------------- | :------------------ | :-------------------------------------------------------- |
| `npm run dev`                           | Root or `frontend/` | Start Vite frontend dev server at `http://localhost:5173` |
| `npm run build`                         | Root or `frontend/` | Build production bundle to `frontend/dist/`               |
| `npm run preview`                       | Root or `frontend/` | Preview production build locally                          |
| `npm run typecheck`                     | Root or `frontend/` | Run TypeScript strict compiler check (`tsc --noEmit`)     |
| `npm run lint`                          | Root or `frontend/` | Run ESLint across TypeScript codebase                     |
| `npm run lint:fix`                      | Root or `frontend/` | Automatically fix ESLint issues                           |
| `npm run format`                        | Root                | Format all code with Prettier                             |
| `npm run format:check`                  | Root                | Verify code formatting with Prettier                      |
| `npm test`                              | Root or `frontend/` | Run Vitest unit & integration test suite                  |
| `uvicorn backend.app.main:app --reload` | Root                | Start FastAPI backend service at `http://localhost:8000`  |
| `pytest backend`                        | Root                | Run Python backend test suite                             |

---

## 6. Project Status (Day 1 Complete)

- **Foundation**: Complete monorepo tooling, strict TypeScript mode, and Tailwind CSS v4.
- **Application Shell**: Futuristic data center operations console active with responsive sidebar, live metrics cards, 3D Canvas viewport, and navigation routing.
- **Backend Scaffolding**: FastAPI running with health check API and automated test suite.
- **Next Phase**: Day 2 — Supabase Auth integration, session management, and protected routes.
