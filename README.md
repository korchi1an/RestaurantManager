# Restaurant Order Management System

A production-ready full-stack web application for managing restaurant orders with real-time updates across customer, kitchen, and waiter interfaces.

## Quick Links

- **[Deploy to Production](docs/deployment/QUICKSTART.md)** — Step-by-step Render.com deployment guide
- **[Development Setup](docs/guides/INSTALLATION.md)** — Local development installation
- **[Full Documentation](docs/README.md)** — All documentation organized by topic
- **[Architecture](docs/architecture/ARCHITECTURE.md)** — Technical architecture details
- **[Deployment Checklist](docs/deployment/CHECKLIST.md)** — Pre-deployment verification

---

## Features

### Customer Interface
- QR-code-driven table sessions — customers scan a code to start ordering
- Browse menu by category (Appetizers, Main Courses, Desserts, Beverages)
- Add/remove items with live cart totals
- Submit orders and track status in real-time (Pending → Preparing → Ready → Served → Paid)
- Optional customer account registration and login
- Call-waiter button for in-seat assistance

### Kitchen Dashboard
- Protected login (username + password, tab-isolated via sessionStorage)
- Active orders grouped by table number with merged item view
- Real-time notifications for new orders via Socket.IO
- Mark orders Preparing or Ready; table-level bulk "Mark All Served" action
- Statistics cards for pending, preparing, and ready counts

### Waiter Dashboard
- Protected login (username + password, tab-isolated via sessionStorage)
- View orders on assigned tables only
- Real-time alerts with sound when orders are ready
- Visual waiter-call alert banner when customers request assistance
- Mark table as served (bulk action); process payment via mark-paid
- Recently served orders list with timestamps

### Admin / Management
- Table assignments — assign or unassign tables to waiter accounts
- QR code page displaying printable QR codes for all tables
- Full order visibility across all tables

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, React Router v6 |
| Backend | Node.js, Express 4, TypeScript |
| Database | PostgreSQL (via pg connection pool) |
| Real-time | Socket.IO 4 (WebSocket + HTTP fallback) |
| Auth | JWT tokens, bcrypt password hashing |
| Security | Helmet, express-rate-limit, CORS, parameterized SQL |
| Logging | Winston structured JSON logs |
| Deployment | Render.com (render.yaml blueprint) |

---

## Project Structure

```
restaurant2/
├── README.md
├── render.yaml                          # Render.com deployment config
│
├── docs/
│   ├── README.md                        # Documentation index
│   ├── PROJECT_OVERVIEW.md
│   ├── architecture/
│   │   ├── ARCHITECTURE.md              # Full system architecture
│   │   ├── PROJECT_STRUCTURE.md         # File tree & descriptions
│   │   └── DIAGRAMS.md
│   ├── guides/
│   │   ├── INSTALLATION.md
│   │   ├── QUICKSTART.md
│   │   └── SESSION_MANAGEMENT.md
│   └── deployment/
│       ├── QUICKSTART.md
│       ├── CHECKLIST.md
│       └── READINESS_AUDIT.md
│
├── backend/
│   └── src/
│       ├── server.ts                    # Express + Socket.IO server
│       ├── config/validateEnv.ts        # Env var validation (fail-fast)
│       ├── db/database.ts               # PostgreSQL pool, schema, seed data
│       ├── middleware/
│       │   ├── auth.ts                  # JWT authenticate/authorize
│       │   ├── errorHandler.ts
│       │   └── rateLimiter.ts
│       ├── routes/
│       │   ├── auth.ts                  # Login, register, /me
│       │   ├── menu.ts
│       │   ├── orders.ts                # CRUD + bulk table-level status
│       │   ├── sessions.ts              # Customer session lifecycle
│       │   ├── tableAssignments.ts      # Assign tables to waiters
│       │   └── tables.ts                # QR codes, mark-paid, call-waiter
│       └── utils/
│           ├── logger.ts
│           └── socketManager.ts         # Singleton Socket.IO instance
│
└── frontend/
    └── src/
        ├── App.tsx                      # Router + ProtectedRoute
        ├── components/
        │   ├── MenuDisplay.tsx
        │   └── CartDisplay.tsx
        ├── hooks/useCart.ts
        ├── pages/
        │   ├── Customer.tsx
        │   ├── CustomerLogin.tsx
        │   ├── Kitchen.tsx
        │   ├── Login.tsx                # Staff login
        │   ├── QRCodes.tsx
        │   ├── Register.tsx
        │   ├── TableAssignments.tsx
        │   └── Waiter.tsx
        ├── services/
        │   ├── api.ts
        │   ├── sessionService.ts
        │   └── socket.ts
        └── types/index.ts
```

---

## Data Models

### MenuItem
```typescript
interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  description?: string;
}
```

### Order
```typescript
interface Order {
  id: number;
  orderNumber: number;
  sessionId: string;
  tableNumber: number;
  status: 'Pending' | 'Preparing' | 'Ready' | 'Served' | 'Paid';
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}
```

### Session
```typescript
interface Session {
  id: string;          // UUID
  tableNumber: number;
  deviceId: string;
  customerId?: string;
  customerName?: string;
  isActive: boolean;
  createdAt: string;
  lastActivity: string;
}
```

---

## API Endpoints

### Authentication
```
POST   /api/auth/register              Register staff account
POST   /api/auth/register-customer     Register customer account
POST   /api/auth/login                 Login (staff or customer)
GET    /api/auth/me                    Current user info  [auth required]
GET    /api/auth/users                 List employees     [auth required]
```

### Menu (Public)
```
GET    /api/menu                       All menu items
GET    /api/menu/categories            Category list
GET    /api/menu/:id                   Single item
```

### Orders
```
POST   /api/orders                     Create order (customer)
POST   /api/orders/waiter              Create waiter-assisted order  [waiter/admin]
GET    /api/orders                     List orders                   [kitchen/waiter/admin]
GET    /api/orders/:id                 Get order with items
PATCH  /api/orders/:id/status          Update single order status    [kitchen/waiter/admin]
PATCH  /api/orders/table/:num/status   Bulk update all table orders  [kitchen/waiter/admin]
DELETE /api/orders/:id                 Cancel pending order
```

### Tables
```
GET    /api/tables                     All tables
GET    /api/tables/:num                Single table
GET    /api/tables/:num/qrcode         QR code image
GET    /api/tables/:num/orders         Orders for table
GET    /api/tables/:num/unpaid-total   Unpaid order total
POST   /api/tables/:num/mark-paid      Mark paid + end session       [waiter/kitchen/admin]
POST   /api/tables/:num/call-waiter    Emit waiter-called event
```

### Sessions
```
POST   /api/sessions                   Create session
GET    /api/sessions/table/:num        Active sessions for table
GET    /api/sessions/:id               Session with orders
POST   /api/sessions/:id/heartbeat     Update activity timestamp
DELETE /api/sessions/:id               End session
GET    /api/sessions/:id/orders        Session orders
POST   /api/sessions/cleanup           Remove inactive sessions
```

### Table Assignments
```
GET    /api/table-assignments           All assignments               [kitchen/waiter/admin]
GET    /api/table-assignments/my-tables Current waiter's tables       [waiter]
PATCH  /api/table-assignments/:id/assign    Assign table to waiter    [kitchen/admin]
PATCH  /api/table-assignments/:id/unassign  Unassign table            [kitchen/admin]
GET    /api/table-assignments/waiters   List all waiters              [kitchen/admin]
```

### Utility
```
GET    /health                         Server + database health check
```

---

## Order Status Flow

```
Pending ──► Preparing ──► Ready ──► Served ──► Paid
```

| Status | Who Sets It | Socket Event |
|--------|------------|-------------|
| `Pending` | Customer (order submit) | `orderCreated` |
| `Preparing` | Kitchen staff | `orderUpdated` |
| `Ready` | Kitchen staff | `orderReady` |
| `Served` | Waiter (table-level bulk action) | `orderServed` |
| `Paid` | Waiter via mark-paid | `orderPaid` + `sessionEnded` |

---

## Real-time Events (Socket.IO)

| Event | Direction | Description |
|-------|-----------|-------------|
| `orderCreated` | Server → Client | New order placed |
| `orderUpdated` | Server → Client | Order status changed |
| `orderReady` | Server → Client | Order ready for pickup |
| `orderServed` | Server → Client | Order delivered to table |
| `orderPaid` | Server → Client | Payment received |
| `orderCancelled` | Server → Client | Order cancelled |
| `sessionEnded` | Server → Client | Session closed (after payment) |
| `waiter-called` | Server → Client | Customer requested waiter |

---

## Seed Data

The database auto-populates on first run with:
- **18 menu items** across 4 categories (Appetizers, Main Courses, Desserts, Beverages)
- **10 tables** with varying capacities
- **4 default staff accounts**:

| Username | Password | Role |
|----------|----------|------|
| `chef` | `kitchen123` | kitchen |
| `ana` | `waiter123` | waiter |
| `mihai` | `waiter123` | waiter |
| `admin` | `admin123` | admin |

> **Warning**: Change all passwords before deploying to production.

---

## Getting Started

### Prerequisites
- Node.js v18+
- PostgreSQL database (or Render managed DB)

### Installation

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with DATABASE_URL, JWT_SECRET, etc.

# 3. Start development servers (two terminals)
cd backend && npm run dev      # http://localhost:5000
cd frontend && npm run dev     # http://localhost:3000
```

### Default Workflow to Test

1. Open `http://localhost:3000/qr-codes` to see table QR codes
2. Open `http://localhost:3000/table/1` to simulate a customer at Table 1
3. Log in to `/login` as `chef` / `kitchen123` to access the Kitchen dashboard
4. Log in to `/login` as `ana` / `waiter123` to access the Waiter dashboard
5. Place an order as the customer and watch real-time updates across all views

---

## Security Features

- JWT authentication with 7-day expiry
- bcrypt password hashing (10 salt rounds)
- Role-based access control on all protected endpoints
- Rate limiting (`express-rate-limit`) on API, order, and session endpoints
- `helmet()` for HTTP security headers (CSP, HSTS, X-Frame-Options)
- CORS restricted to `CORS_ORIGIN` environment variable
- Parameterized SQL queries throughout (no string concatenation)
- `sessionStorage` for staff tokens (tab-isolated, cleared on tab close)
- Environment variable validation at startup (server refuses to start with missing config)

---

## Production Deployment (Render.com)

1. Push code to GitHub
2. Create a new **Blueprint** on Render from `render.yaml`
3. Set environment variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `FRONTEND_URL`
4. Monitor deployment logs for `=== SERVER READY ===`
5. Verify health check at `https://your-api.render.com/health`

See [Deployment Guide](docs/deployment/QUICKSTART.md) for full instructions.

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Documentation navigation index |
| [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | Full system architecture |
| [docs/architecture/PROJECT_STRUCTURE.md](docs/architecture/PROJECT_STRUCTURE.md) | File tree with descriptions |
| [docs/guides/INSTALLATION.md](docs/guides/INSTALLATION.md) | Local development setup |
| [docs/guides/QUICKSTART.md](docs/guides/QUICKSTART.md) | Quick reference |
| [docs/guides/SESSION_MANAGEMENT.md](docs/guides/SESSION_MANAGEMENT.md) | Session system details |
| [docs/deployment/QUICKSTART.md](docs/deployment/QUICKSTART.md) | Deploy to Render.com |
| [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) | Feature and metrics summary |

---

## License

MIT License — Free to use for learning or as a starting point for your own restaurant management system.

---

**Production Status**: Ready for deployment
**Last Updated**: March 2026
**Stack**: React · TypeScript · Express · PostgreSQL · Socket.IO
