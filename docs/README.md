# Documentation Guide

## Quick Navigation

### New to the Project?
Start here: [README.md](../README.md) → [Installation Guide](guides/INSTALLATION.md) → [Quick Start](guides/QUICKSTART.md)

### Deploying to Production?
Read: [Deployment Quickstart](deployment/QUICKSTART.md) → [Readiness Audit](deployment/READINESS_AUDIT.md)

### Need Technical Details?
See: [Architecture](architecture/ARCHITECTURE.md) → [Project Structure](architecture/PROJECT_STRUCTURE.md)

---

## Documentation Structure

### `/deployment` — Production Deployment
- **[QUICKSTART.md](deployment/QUICKSTART.md)** — Step-by-step deployment guide for Render.com
- **[CHECKLIST.md](deployment/CHECKLIST.md)** — Pre-deployment verification checklist
- **[READINESS_AUDIT.md](deployment/READINESS_AUDIT.md)** — Comprehensive deployment audit & fixes applied
- **[FIX_SUMMARY.md](deployment/FIX_SUMMARY.md)** — Summary of critical fixes made
- **[DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md)** — Extended deployment documentation

**Start here if:** You're ready to deploy to Render.com

---

### `/guides` — Development Guides
- **[INSTALLATION.md](guides/INSTALLATION.md)** — Full local development setup (PostgreSQL, env config, troubleshooting)
- **[QUICKSTART.md](guides/QUICKSTART.md)** — Quick start with credentials, routes, and test workflow
- **[SESSION_MANAGEMENT.md](guides/SESSION_MANAGEMENT.md)** — Customer session lifecycle documentation
- **[SESSION_QUICKSTART.md](guides/SESSION_QUICKSTART.md)** — Session feature quick reference
- **[SESSION_IMPLEMENTATION.md](guides/SESSION_IMPLEMENTATION.md)** — Session implementation technical details

**Start here if:** You're setting up for local development

---

### `/architecture` — Technical Documentation
- **[ARCHITECTURE.md](architecture/ARCHITECTURE.md)** — System architecture, auth system, DB schema, API table, Socket.IO events, security
- **[PROJECT_STRUCTURE.md](architecture/PROJECT_STRUCTURE.md)** — Complete file tree with descriptions for every source file
- **[DIAGRAMS.md](architecture/DIAGRAMS.md)** — System diagrams and data flows

**Start here if:** You need to understand how the system works internally

---

### Root Documentation
- **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** — Feature summary, API list, metrics, technology choices
- **[README.md](../README.md)** — Main project README (start here)
- **[render.yaml](../render.yaml)** — Render.com deployment configuration

---

## Common Tasks

### I want to...

#### Run the app locally
1. [Installation Guide](guides/INSTALLATION.md)
2. [Quick Start](guides/QUICKSTART.md)

#### Understand authentication
1. See [Architecture — Auth System](architecture/ARCHITECTURE.md#authentication-system)
2. `backend/src/middleware/auth.ts` — `authenticate`, `authorize`, `optionalAuth`
3. `frontend/src/App.tsx` — `ProtectedRoute` reads role from JWT payload

#### Understand customer sessions
1. [Session Management](guides/SESSION_MANAGEMENT.md)
2. [Session Implementation](guides/SESSION_IMPLEMENTATION.md)
3. `frontend/src/services/sessionService.ts`
4. `backend/src/routes/sessions.ts`

#### Deploy to production
1. [Deployment Quickstart](deployment/QUICKSTART.md)
2. Check [Pre-Deployment Checklist](deployment/CHECKLIST.md)
3. Review [Readiness Audit](deployment/READINESS_AUDIT.md) if issues arise

#### Understand the codebase
1. [Project Overview](PROJECT_OVERVIEW.md)
2. [Architecture](architecture/ARCHITECTURE.md)
3. [Project Structure](architecture/PROJECT_STRUCTURE.md)

#### Add new API endpoints
1. Review route patterns in `backend/src/routes/`
2. Add `authenticate`/`authorize` middleware where needed
3. Emit Socket.IO events via `SocketManager.getInstance()` for real-time updates
4. Update [Architecture](architecture/ARCHITECTURE.md) API table and this docs index

#### Add new frontend pages
1. Create page in `frontend/src/pages/`
2. Register route in `frontend/src/App.tsx`
3. Wrap with `ProtectedRoute` if staff-only

#### Troubleshoot issues
1. [Installation Guide — Troubleshooting](guides/INSTALLATION.md#troubleshooting)
2. [Fix Summary](deployment/FIX_SUMMARY.md) — Recent fixes log
3. [Readiness Audit](deployment/READINESS_AUDIT.md) — Deployment troubleshooting

---

## Documentation Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| README.md | Up-to-date | March 2026 |
| Architecture docs | Up-to-date | March 2026 |
| Development guides | Up-to-date | March 2026 |
| Project Overview | Up-to-date | March 2026 |
| Deployment docs | Current | Feb 2026 |

---

## Recent Changes

### March 2026
- Updated all documentation to reflect current codebase state
- Architecture doc now covers full auth system (JWT dual-path, sessionStorage isolation)
- PROJECT_STRUCTURE.md updated to include all new files (Login, Register, CustomerLogin, QRCodes, TableAssignments, MenuDisplay, CartDisplay, useCart, sessionService, auth routes, sessions routes, tableAssignments routes, middleware, utils, config, tests)
- README.md updated with complete API endpoint table, real-time event table, and order status flow including Paid status
- QUICKSTART.md and INSTALLATION.md updated with auth flow, multi-tab testing notes, and PostgreSQL setup
- PROJECT_OVERVIEW.md updated with accurate metrics (34 endpoints, 8 socket events, 7 DB tables)

### February 20, 2026
- Fixed critical deployment blockers (see [FIX_SUMMARY.md](deployment/FIX_SUMMARY.md))
- Created comprehensive deployment documentation for Render.com
- Reorganized all documentation into `/deployment`, `/guides`, `/architecture` folders

---

## Contributing to Documentation

When making changes to the codebase, update the relevant docs:

| Change Type | Update These Files |
|-------------|-------------------|
| New API endpoint | `ARCHITECTURE.md` (API table), `README.md`, `PROJECT_OVERVIEW.md` |
| New database table | `ARCHITECTURE.md` (schema section) |
| New frontend page/component | `PROJECT_STRUCTURE.md`, `ARCHITECTURE.md` (component tree) |
| New Socket.IO event | `ARCHITECTURE.md` (events table), `README.md` |
| New environment variable | `ARCHITECTURE.md`, `INSTALLATION.md`, `QUICKSTART.md` |
| Auth/security change | `ARCHITECTURE.md` (auth + security sections) |
| New feature | `PROJECT_OVERVIEW.md`, `README.md` features section |

Keep documentation:
- Clear and concise
- Accurate to the actual code (not aspirational)
- Cross-referenced with related docs
- Updated within the same PR as the code change

---

**Need help?** Start with [README.md](../README.md) in the project root.
