# Architecture Documentation

## System Overview

A production-ready full-stack restaurant order management system with real-time updates, role-based authentication, QR-code-driven customer sessions, and table assignment management.

---

## Technology Stack

### Frontend
- **React 18** — UI library with hooks-based state management
- **TypeScript** — End-to-end type safety
- **Vite** — Build tool and dev server with HMR and proxy config
- **React Router v6** — Client-side routing with protected route guards
- **Socket.IO Client** — Real-time event subscriptions
- **Custom CSS** — Component-scoped responsive styles

### Backend
- **Node.js** — Runtime environment
- **Express 4** — HTTP framework with middleware pipeline
- **TypeScript** — Full type coverage on server code
- **Socket.IO 4** — WebSocket server with singleton manager
- **pg** — PostgreSQL connection pool (not SQLite)
- **JWT (jsonwebtoken)** — Stateless authentication tokens
- **bcrypt** — Password hashing (10 salt rounds)
- **Helmet** — HTTP security headers
- **express-rate-limit** — Per-route rate limiting
- **compression** — Gzip response compression
- **Winston** — Structured JSON logging

### Database
- **PostgreSQL** — Production-grade relational database with ACID compliance

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                           │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Customer │  │ Kitchen  │  │  Waiter  │  │ Admin / QR /     │   │
│  │   Page   │  │   Page   │  │   Page   │  │ Assignments Page │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  App.tsx  (React Router + ProtectedRoute role guards)        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────┼─────────────────────────────────────┐
│                   SERVICE LAYER                                     │
│                                                                     │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────┐   │
│  │   api.ts     │  │   socket.ts    │  │  sessionService.ts   │   │
│  │ (REST client)│  │  (WS client)   │  │  (session/device ID) │   │
│  └──────────────┘  └────────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                 REST API + WebSocket (Socket.IO)
                               │
┌─────────────────────────────▼─────────────────────────────────────┐
│                      BACKEND SERVER (Port 5000)                     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Middleware Pipeline: Helmet → CORS → Compression →          │  │
│  │  Rate Limiter → Body Parser → Auth Middleware                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│  ┌──────┐ ┌──────┐ ┌───────┐ ┌────────┐ ┌──────────┐ ┌────────┐  │
│  │ auth │ │ menu │ │orders │ │sessions│ │  tables  │ │ table  │  │
│  │routes│ │routes│ │routes │ │ routes │ │  routes  │ │assigns │  │
│  └──────┘ └──────┘ └───────┘ └────────┘ └──────────┘ └────────┘  │
│                               │                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           Socket.IO Server (SocketManager singleton)         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────▼─────────────────────────────────────┐
│                          DATA LAYER                                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    PostgreSQL Database                        │  │
│  │                                                              │  │
│  │  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │ employees │  │ customers │  │  tables  │  │ sessions │  │  │
│  │  └───────────┘  └───────────┘  └──────────┘  └──────────┘  │  │
│  │                                                              │  │
│  │  ┌────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │ menu_items │  │   orders    │  │    order_items      │  │  │
│  │  └────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Authentication System

Two separate authentication paths exist for staff and customers.

### Staff Authentication (Kitchen / Waiter / Admin)

1. Staff logs in via `POST /api/auth/login` with **username + password**
2. Server verifies against `employees` table, returns a signed JWT
3. JWT payload: `{ id, userId, username, role, iat, exp }`
4. Token stored in **`sessionStorage`** under key `auth_token` (tab-isolated — prevents cross-tab role bleed)
5. Also stores `user_role`, `user_id`, `user_name` in sessionStorage
6. `ProtectedRoute` in `App.tsx` decodes the JWT directly to extract role (does NOT rely on `user_role` localStorage key)
7. All protected API calls include `Authorization: Bearer <token>` header

### Customer Authentication

1. Customer registers via `POST /api/auth/register-customer` (email + password + full_name)
2. Logs in via `POST /api/auth/login` with **email + password**
3. JWT payload: `{ id, userId, email, role: 'customer', username (= name), iat, exp }`
4. Token stored in **`localStorage`** under key `customer_auth_token` (separate namespace from staff)
5. Also stores `customer_user_role`, `customer_user_id`, `customer_user_name`

### Roles and Permissions

| Role | Permissions |
|------|------------|
| `admin` | Full access to all endpoints |
| `kitchen` | View all orders, update order status, manage table assignments |
| `waiter` | View assigned-table orders, mark orders served, mark paid |
| `customer` | Place orders, view own session orders |

---

## Database Schema

### `employees`
```sql
CREATE TABLE employees (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  role          VARCHAR CHECK (role IN ('kitchen', 'waiter', 'admin')) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login    TIMESTAMP
);
```

### `customers`
```sql
CREATE TABLE customers (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  name          VARCHAR NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login    TIMESTAMP
);
```

### `menu_items`
```sql
CREATE TABLE menu_items (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR NOT NULL,
  category    VARCHAR NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  description TEXT
);
```

### `tables`
```sql
CREATE TABLE tables (
  id           SERIAL PRIMARY KEY,
  table_number INTEGER UNIQUE NOT NULL,
  capacity     INTEGER NOT NULL,
  status       VARCHAR DEFAULT 'Available',
  waiter_id    INTEGER REFERENCES employees(id) ON DELETE SET NULL
);
```

### `sessions`
```sql
CREATE TABLE sessions (
  id            VARCHAR PRIMARY KEY,   -- UUID
  table_number  INTEGER REFERENCES tables(table_number) NOT NULL,
  device_id     VARCHAR NOT NULL,
  customer_id   VARCHAR,
  customer_name VARCHAR,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active     BOOLEAN DEFAULT TRUE
);
```

### `orders`
```sql
CREATE TABLE orders (
  id           SERIAL PRIMARY KEY,
  order_number INTEGER NOT NULL,
  session_id   VARCHAR REFERENCES sessions(id),
  table_number INTEGER REFERENCES tables(table_number) NOT NULL,
  status       VARCHAR DEFAULT 'Pending',   -- Pending | Preparing | Ready | Served | Paid
  total_price  DECIMAL(10,2) NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at      TIMESTAMP,
  UNIQUE(session_id, order_number)
);
```

### `order_items`
```sql
CREATE TABLE order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id),
  quantity     INTEGER NOT NULL,
  price        DECIMAL(10,2) NOT NULL
);
```

### Entity Relationship Diagram

```
┌───────────┐        ┌───────────────┐
│ employees │◄───────│    tables     │
│           │        │  (waiter_id)  │
└───────────┘        └───────┬───────┘
                             │ table_number
┌───────────┐        ┌───────▼───────┐       ┌───────────┐
│ customers │        │   sessions    │       │ menu_items│
│ (optional)│◄───────│               │       └─────┬─────┘
└───────────┘        └───────┬───────┘             │
                             │ session_id           │ menu_item_id
                      ┌──────▼────────┐    ┌───────▼───────┐
                      │    orders     │◄───│  order_items  │
                      │               │    │               │
                      └───────────────┘    └───────────────┘
```

---

## API Endpoints

### Authentication (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | None | Register new staff member |
| POST | `/auth/login` | None | Staff or customer login |
| POST | `/auth/register-customer` | None | Register new customer |
| GET | `/auth/me` | Required | Get current user info |
| GET | `/auth/users` | Required | List all employees |

### Menu (`/api/menu`) — Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/menu` | All menu items |
| GET | `/menu/categories` | Distinct category names |
| GET | `/menu/:id` | Single menu item |

### Orders (`/api/orders`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/orders` | None | Create order (customer self-service) |
| POST | `/orders/waiter` | waiter/admin | Create waiter-assisted order |
| GET | `/orders` | kitchen/waiter/admin | List orders (waiter sees assigned tables only) |
| GET | `/orders/:id` | None | Get specific order with items |
| PATCH | `/orders/:id/status` | kitchen/waiter/admin | Update single order status |
| PATCH | `/orders/table/:tableNumber/status` | kitchen/waiter/admin | Bulk update all orders for a table |
| DELETE | `/orders/:id` | None | Cancel order (Pending status only) |

### Tables (`/api/tables`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/tables` | None | All tables |
| GET | `/tables/:tableNumber` | None | Single table |
| GET | `/tables/:tableNumber/qrcode` | None | Generate QR code image |
| GET | `/tables/:tableNumber/orders` | None | Orders for a table |
| GET | `/tables/:tableNumber/unpaid-total` | None | Sum of unpaid orders |
| POST | `/tables/:tableNumber/mark-paid` | waiter/kitchen/admin | Mark served orders as Paid, end session, emit `sessionEnded` |
| POST | `/tables/:tableNumber/call-waiter` | None | Emit `waiter-called` socket event |

### Sessions (`/api/sessions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/sessions` | None | Create new customer session |
| GET | `/sessions/table/:tableNumber` | None | Active sessions for table |
| GET | `/sessions/:sessionId` | None | Session with all orders |
| POST | `/sessions/:sessionId/heartbeat` | None | Update last_activity timestamp |
| DELETE | `/sessions/:sessionId` | None | End session |
| GET | `/sessions/:sessionId/orders` | None | Orders for a session |
| POST | `/sessions/cleanup` | None | Remove inactive sessions |

### Table Assignments (`/api/table-assignments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/table-assignments` | kitchen/waiter/admin | All table assignments |
| GET | `/table-assignments/my-tables` | waiter | Tables assigned to current waiter |
| PATCH | `/table-assignments/:tableId/assign` | kitchen/admin | Assign table to waiter |
| PATCH | `/table-assignments/:tableId/unassign` | kitchen/admin | Unassign table |
| GET | `/table-assignments/waiters` | kitchen/admin | List all waiter accounts |

### Health Check

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server and database health status |

---

## Real-time Communication (Socket.IO)

### Server → Client Events

| Event | Trigger | Payload | Consumers |
|-------|---------|---------|-----------|
| `orderCreated` | New order placed | `OrderWithItems` | Kitchen, Customer |
| `orderUpdated` | Status changed | `OrderWithItems` | Kitchen, Customer, Waiter |
| `orderReady` | Status → Ready | `OrderWithItems` | Waiter, Customer |
| `orderServed` | Status → Served | `OrderWithItems` | Kitchen, Customer |
| `orderPaid` | Status → Paid | `OrderWithItems` | Customer |
| `orderCancelled` | Order deleted | `{ orderId }` | Kitchen, Waiter |
| `sessionEnded` | Payment complete or session deleted | `{ sessionId, tableNumber }` | Customer (triggers goodbye screen) |
| `waiter-called` | Customer taps "Call Waiter" | `{ tableNumber, customerName, timestamp, assignedWaiter }` | Waiter |

### Event Flow

```
Backend Server
      │
      ├─► orderCreated ──────┬─► Kitchen (new order notification)
      │                      └─► Customer (order confirmed)
      │
      ├─► orderUpdated ──────┬─► Kitchen (status refresh)
      │                      ├─► Customer (status badge update)
      │                      └─► Waiter (status refresh)
      │
      ├─► orderReady ────────┬─► Waiter (alert + sound)
      │                      └─► Customer (status update)
      │
      ├─► orderServed ───────┬─► Kitchen (remove from active)
      │                      └─► Customer (status update)
      │
      ├─► orderPaid ─────────── Customer (payment confirmation)
      │
      ├─► orderCancelled ────── Kitchen + Waiter (remove from lists)
      │
      ├─► sessionEnded ──────── Customer (navigate to goodbye screen)
      │
      └─► waiter-called ─────── Waiter (alert banner + sound)
```

### SocketManager Pattern

`utils/socketManager.ts` implements a singleton to share one Socket.IO instance across all route handlers without circular dependency issues:

```typescript
// Any route can emit without needing the server reference
const io = SocketManager.getInstance();
io.emit('orderCreated', orderData);
```

---

## Component Architecture

```
App (Router + ProtectedRoute)
├── Public Routes
│   ├── /login              → Login.tsx (staff)
│   ├── /customer-login     → CustomerLogin.tsx
│   ├── /register           → Register.tsx
│   └── /qr-codes           → QRCodes.tsx
│
└── Protected Routes
    ├── /kitchen             → Kitchen.tsx [role: kitchen/admin]
    │   ├── Statistics cards
    │   └── Orders grouped by table (merged items view)
    │
    ├── /waiter              → Waiter.tsx [role: waiter/admin]
    │   ├── Ready orders section
    │   ├── Waiter-call alert banner
    │   └── Recently served section
    │
    ├── /assignments         → TableAssignments.tsx [role: kitchen/admin]
    │   ├── Table grid with assignment status
    │   └── Waiter dropdown selector
    │
    └── /table/:tableId      → Customer.tsx [session-based, no role]
        ├── MenuDisplay.tsx (categorized grid)
        └── CartDisplay.tsx (cart + checkout)
```

---

## Order Status Flow

```
Pending ──► Preparing ──► Ready ──► Served ──► Paid
                                       │
                              (mark-paid endpoint
                               closes session,
                               emits sessionEnded)
```

| Status | Set By | Triggers |
|--------|--------|----------|
| `Pending` | Customer on order submit | `orderCreated` socket event |
| `Preparing` | Kitchen staff | `orderUpdated` socket event |
| `Ready` | Kitchen staff | `orderReady` socket event |
| `Served` | Waiter (table-level bulk action) | `orderServed` socket event |
| `Paid` | Waiter via mark-paid | `orderPaid` + `sessionEnded` socket events |

---

## Customer Session Flow

```
1. Customer scans QR code → /table/:tableId
2. sessionService creates session (POST /sessions) → UUID stored in localStorage
3. Device heartbeat every 60s (POST /sessions/:id/heartbeat)
4. Customer places orders (POST /orders) with sessionId
5. Orders tracked via Socket.IO events
6. Waiter marks table paid → session deactivated immediately
7. sessionEnded event received → Customer sees goodbye screen
8. Inactive sessions auto-cleaned by server loop (10-min interval)
```

---

## Security Implementation

| Feature | Implementation |
|---------|---------------|
| JWT Authentication | 7-day expiry tokens signed with `JWT_SECRET` |
| Password Hashing | bcrypt with 10 salt rounds |
| Role-Based Access | `authorize(...roles)` middleware on protected routes |
| Rate Limiting | `apiLimiter`, `orderLimiter`, `sessionLimiter` via `express-rate-limit` |
| Security Headers | `helmet()` middleware (CSP, HSTS, X-Frame-Options, etc.) |
| CORS | Configured for `CORS_ORIGIN` env var; blocks other origins in production |
| SQL Injection | Parameterized queries via `pg` driver throughout |
| Input Validation | Explicit checks on auth route inputs |
| Tab Isolation | Staff tokens in `sessionStorage` (not `localStorage`); separate key namespace for customers |
| Env Validation | `validateEnv.ts` fails fast at startup if required vars are missing |

---

## State Management

### Frontend State Patterns

| Pattern | Used For |
|---------|---------|
| `useState` + `useEffect` | Local component state, API fetch on mount |
| `useCart` custom hook | Cart items add/remove/quantity across Customer page |
| Socket.IO listeners | Real-time updates appended to local state arrays |
| `sessionStorage` | Staff JWT token per browser tab |
| `localStorage` | Customer JWT token, session UUID, device ID |

### Data Synchronization Strategy

- **Initial load**: REST API (`GET` endpoints) populates component state
- **Real-time delta updates**: Socket.IO events patch/replace items in state
- **Optimistic updates**: UI updates immediately; errors roll back state

---

## Performance Considerations

### Backend
- PostgreSQL connection pool (configurable pool size via `pg.Pool`)
- SQL `JOIN` queries return full order-with-items in one round trip
- `JSON_AGG` / `json_build_object` for order items aggregation
- Compression middleware reduces payload sizes
- Rate limiting protects against abuse without expensive request overhead

### Frontend
- Vite code splitting and tree-shaking for optimized bundles
- Socket.IO listeners cleaned up in `useEffect` cleanup functions
- Menu items fetched once and filtered client-side by category

---

## Deployment

### Environment Variables Required

```env
# Backend
DATABASE_URL=postgresql://...   # Required — PostgreSQL connection string
JWT_SECRET=...                  # Required — minimum 32-char secret
NODE_ENV=production
PORT=5000
CORS_ORIGIN=https://your-frontend.com
FRONTEND_URL=https://your-frontend.com

# Frontend (Vite)
VITE_API_URL=https://your-backend.com/api
VITE_WS_URL=https://your-backend.com
```

### Build Commands

```bash
# Backend
cd backend && npm run build   # Output: backend/dist/
cd backend && npm start       # Runs node dist/server.js

# Frontend
cd frontend && npm run build  # Output: frontend/dist/
```

### Render.com
- Configured via `render.yaml` at repository root
- Separate Web Service (backend) and Static Site (frontend) services
- PostgreSQL database provisioned as a Render managed database

---

## Monitoring & Logging

- **Winston** logger writes structured JSON to stdout (picked up by Render logs)
- Log levels: `error`, `warn`, `info`, `debug`
- Request logs include method, path, status code, and duration
- Health check endpoint (`GET /health`) returns database connectivity status

---

**Architecture Version:** 2.0.0
**Last Updated:** March 2026
