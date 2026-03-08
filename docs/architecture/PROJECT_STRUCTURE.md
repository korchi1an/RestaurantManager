# Restaurant Order Management System - Project Structure

```
restaurant2/
│
├── README.md                           # Main project documentation
├── render.yaml                         # Render.com deployment configuration
│
├── docs/                               # All project documentation
│   ├── README.md                       # Documentation index & navigation guide
│   ├── PROJECT_OVERVIEW.md             # High-level feature summary
│   │
│   ├── architecture/
│   │   ├── ARCHITECTURE.md             # System architecture & design decisions
│   │   ├── DIAGRAMS.md                 # System diagrams & data flows
│   │   └── PROJECT_STRUCTURE.md        # This file
│   │
│   ├── guides/
│   │   ├── INSTALLATION.md             # Local development setup
│   │   ├── QUICKSTART.md               # Quick start reference
│   │   ├── SESSION_MANAGEMENT.md       # Session feature documentation
│   │   ├── SESSION_QUICKSTART.md       # Session quick reference
│   │   └── SESSION_IMPLEMENTATION.md   # Session implementation details
│   │
│   └── deployment/
│       ├── QUICKSTART.md               # Render.com deployment guide
│       ├── CHECKLIST.md                # Pre-deployment verification
│       ├── READINESS_AUDIT.md          # Deployment audit & fixes
│       ├── FIX_SUMMARY.md              # Summary of deployment fixes
│       └── DEPLOYMENT_GUIDE.md         # Full deployment documentation
│
├── backend/                            # Node.js + Express Backend
│   ├── package.json
│   ├── tsconfig.json
│   │
│   └── src/
│       ├── server.ts                   # Express + Socket.IO server, graceful shutdown
│       │
│       ├── config/
│       │   └── validateEnv.ts          # Startup environment variable validation
│       │
│       ├── db/
│       │   └── database.ts             # PostgreSQL connection pool, schema init, seed data
│       │
│       ├── middleware/
│       │   ├── auth.ts                 # JWT authentication (authenticate, authorize, optionalAuth)
│       │   ├── errorHandler.ts         # Global error handling middleware
│       │   └── rateLimiter.ts          # Rate limiting configs (api, order, session limiters)
│       │
│       ├── models/
│       │   └── types.ts                # TypeScript interfaces and DTOs
│       │
│       ├── routes/
│       │   ├── auth.ts                 # Auth endpoints (register, login, me, users)
│       │   ├── menu.ts                 # Menu endpoints (GET items, categories)
│       │   ├── orders.ts               # Order CRUD + bulk table status update
│       │   ├── sessions.ts             # Customer session lifecycle management
│       │   ├── tableAssignments.ts     # Assign/unassign tables to waiters
│       │   └── tables.ts               # Table info, QR codes, mark-paid, call-waiter
│       │
│       ├── utils/
│       │   ├── logger.ts               # Winston structured logging utility
│       │   └── socketManager.ts        # Singleton Socket.IO instance manager
│       │
│       └── __tests__/                  # Backend test suite
│           ├── auth.test.ts
│           ├── menu.test.ts
│           ├── orders.test.ts
│           ├── sessions.test.ts
│           ├── tables.test.ts
│           └── workflow.test.ts
│
└── frontend/                           # React + TypeScript Frontend
    ├── index.html                      # HTML entry point
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts                  # Vite build configuration + proxy
    │
    └── src/
        ├── main.tsx                    # React entry point
        ├── App.tsx                     # Router, ProtectedRoute, role-based navigation
        │
        ├── components/
        │   ├── MenuDisplay.tsx         # Menu items by category with add-to-cart
        │   └── CartDisplay.tsx         # Cart items, quantity controls, checkout
        │
        ├── hooks/
        │   └── useCart.ts              # Custom hook for cart state management
        │
        ├── pages/
        │   ├── Customer.tsx            # Customer ordering interface (session-based)
        │   ├── CustomerLogin.tsx       # Customer email/password login
        │   ├── Kitchen.tsx             # Kitchen dashboard (active orders by table)
        │   ├── Login.tsx               # Staff login (username/password)
        │   ├── QRCodes.tsx             # QR code display for all tables
        │   ├── Register.tsx            # Customer registration
        │   ├── TableAssignments.tsx    # Admin/kitchen: assign tables to waiters
        │   └── Waiter.tsx              # Waiter dashboard (ready orders, call alerts)
        │
        ├── services/
        │   ├── api.ts                  # HTTP REST client with retry & error handling
        │   ├── sessionService.ts       # Customer session store, heartbeat, device ID
        │   └── socket.ts               # Socket.IO client & event subscription helpers
        │
        ├── styles/
        │   ├── App.css                 # Global styles and navigation bar
        │   ├── Customer.css            # Customer page styles
        │   ├── Kitchen.css             # Kitchen dashboard styles
        │   └── Waiter.css              # Waiter dashboard styles
        │
        └── types/
            └── index.ts                # Shared TypeScript interfaces (Order, Session, etc.)
```

---

## Backend Files Overview

| File | Purpose |
|------|---------|
| `server.ts` | Express server with Socket.IO, CORS, Helmet, compression, graceful shutdown |
| `config/validateEnv.ts` | Validates required environment variables at startup (fail-fast) |
| `db/database.ts` | PostgreSQL connection pool, schema creation, seed data (menu items, tables, employees) |
| `middleware/auth.ts` | JWT `authenticate`, role-based `authorize`, and `optionalAuth` middleware |
| `middleware/errorHandler.ts` | Centralized error handler with structured error responses |
| `middleware/rateLimiter.ts` | Rate limiters: `apiLimiter`, `orderLimiter`, `sessionLimiter` |
| `models/types.ts` | TypeScript interfaces: `Employee`, `Customer`, `MenuItem`, `Table`, `Order`, `Session`, etc. |
| `routes/auth.ts` | Register/login for staff and customers; `GET /me`; `GET /users` |
| `routes/menu.ts` | `GET /menu`, `GET /menu/categories`, `GET /menu/:id` |
| `routes/orders.ts` | Full order CRUD + `POST /orders/waiter` + `PATCH /orders/table/:tableNumber/status` |
| `routes/sessions.ts` | Create, heartbeat, end, and query customer sessions |
| `routes/tables.ts` | Table info, QR code generation, unpaid totals, mark-paid, call-waiter |
| `routes/tableAssignments.ts` | Assign/unassign tables to waiters; list assigned tables per waiter |
| `utils/logger.ts` | Winston-based structured JSON logger |
| `utils/socketManager.ts` | Singleton pattern for sharing Socket.IO instance across routes |

---

## Frontend Files Overview

| File | Purpose |
|------|---------|
| `App.tsx` | React Router config, `ProtectedRoute` (JWT-based role check), nav bar |
| `main.tsx` | React 18 `createRoot` entry point |
| `components/MenuDisplay.tsx` | Categorized menu grid with add-to-cart callbacks |
| `components/CartDisplay.tsx` | Cart item list, +/- quantity controls, submit order button |
| `hooks/useCart.ts` | `addItem`, `removeItem`, `updateQty`, `clearCart` cart state hook |
| `pages/Customer.tsx` | Session creation, menu browsing, order placement, real-time status tracking |
| `pages/CustomerLogin.tsx` | Customer email + password login form |
| `pages/Kitchen.tsx` | Active orders grouped by table; status actions; Socket.IO listeners |
| `pages/Login.tsx` | Staff username + password login (stores token in `sessionStorage`) |
| `pages/QRCodes.tsx` | Grid of QR code images for all tables (public page) |
| `pages/Register.tsx` | Customer self-registration (email, password, full name) |
| `pages/TableAssignments.tsx` | Admin/kitchen UI to assign/unassign tables to waiter accounts |
| `pages/Waiter.tsx` | Ready orders, waiter-call alerts, mark-served, call-waiter sound alerts |
| `services/api.ts` | Axios/fetch wrapper with retry logic, auth header injection, timeout handling |
| `services/sessionService.ts` | Create/end sessions, device ID generation, heartbeat, localStorage persistence |
| `services/socket.ts` | Socket.IO connect/disconnect, typed event subscription helpers |
| `types/index.ts` | `OrderStatus`, `Session`, `MenuItem`, `Table`, `Order`, `OrderWithItems`, etc. |

---

## Database Tables (PostgreSQL)

| Table | Description |
|-------|-------------|
| `employees` | Staff accounts (kitchen, waiter, admin) with bcrypt passwords |
| `customers` | Customer accounts (email-based) with bcrypt passwords |
| `menu_items` | Menu catalogue with name, category, price, description |
| `tables` | Restaurant tables with capacity, status, and assigned waiter FK |
| `sessions` | Customer device sessions tied to a table (UUID primary key) |
| `orders` | Orders with status, total, session/table FK, paid timestamp |
| `order_items` | Line items linking orders to menu items with quantity and price |

---

## Key Runtime Artifacts

```
backend/
├── restaurant.db          # Not used — PostgreSQL is the database (see DATABASE_URL)
└── dist/                  # Compiled JavaScript output (after npm run build)

frontend/
└── dist/                  # Production static build (after npm run build)
```

---

## Environment Variables

### Backend (`.env`)
```
DATABASE_URL=postgresql://user:password@host:port/dbname
JWT_SECRET=your-secure-secret-key
NODE_ENV=development | production | test
PORT=5000
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=http://localhost:5000
```

---

## Source File Count

| Layer | Files |
|-------|-------|
| Backend source | 14 core files |
| Backend tests | 6 test files |
| Frontend source | 17 core files |
| Documentation | 14 markdown files |
| **Total** | **51 files** |

**Languages**: TypeScript, CSS, HTML
**Frameworks**: React 18, Express 4, Socket.IO 4
**Database**: PostgreSQL (production), pg driver
**Last Updated**: March 2026
