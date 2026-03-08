# Quick Start Guide

## Prerequisites

- Node.js v18+
- PostgreSQL database (local or remote)

---

## Step 1: Install Dependencies

Open two terminal windows:

**Terminal 1 — Backend:**
```bash
cd backend
npm install
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
```

---

## Step 2: Configure Environment

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/restaurant
JWT_SECRET=your-secret-key-at-least-32-chars
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

---

## Step 3: Start the Application

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
Expected: `=== SERVER READY ===` on port 5000 with database connected.

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
Expected: Vite dev server on `http://localhost:3000`

---

## Step 4: Access the Application

Open `http://localhost:3000` in your browser.

### Available Routes

| URL | Description | Auth |
|-----|-------------|------|
| `/table/1` | Customer ordering (Table 1) | None |
| `/login` | Staff login (kitchen/waiter/admin) | — |
| `/customer-login` | Customer account login | — |
| `/register` | Customer account registration | — |
| `/kitchen` | Kitchen dashboard | Staff login required |
| `/waiter` | Waiter dashboard | Staff login required |
| `/assignments` | Table assignment management | kitchen/admin |
| `/qr-codes` | QR code display for all tables | None |

---

## Default Staff Credentials

| Username | Password | Role | Dashboard |
|----------|----------|------|-----------|
| `chef` | `kitchen123` | kitchen | `/kitchen` |
| `ana` | `waiter123` | waiter | `/waiter` |
| `mihai` | `waiter123` | waiter | `/waiter` |
| `admin` | `admin123` | admin | All |

> Change all passwords before production deployment.

---

## Testing Workflow

### Full Order Cycle

**1. As Customer** — Open `http://localhost:3000/table/1`
- Browse the menu by category
- Add items to cart
- Click "Submit Order"
- Note the order number displayed

**2. As Kitchen Staff** — Log in at `/login` (chef / kitchen123), navigate to `/kitchen`
- See the new order appear in real-time
- Click "Mark Preparing" then "Mark Ready"

**3. As Waiter** — Log in at `/login` (ana / waiter123), navigate to `/waiter`
- See the "Ready" notification
- Click "Mark as Served" (table-level action)
- Process payment via "Mark Paid" to close the session

**4. Back to Customer tab**
- Observe order status updating in real-time
- After payment, see the session-ended goodbye screen

### Multi-Tab Testing

Because staff tokens are stored in `sessionStorage`, you can test multiple roles simultaneously:
- Tab 1: Kitchen (`/kitchen`)
- Tab 2: Waiter (`/waiter`)
- Tab 3: Customer (`/table/2`)

Each tab maintains its own isolated authentication state.

---

## Troubleshooting

**Port 5000 already in use:**
```bash
# Set a different port
PORT=5001 npm run dev
# Also update VITE_API_URL in frontend/.env or vite.config.ts proxy target
```

**Database connection error:**
1. Verify PostgreSQL is running
2. Check `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
3. Create the database if it doesn't exist:
   ```sql
   CREATE DATABASE restaurant;
   ```

**Missing JWT_SECRET error:**
The server validates `JWT_SECRET` at startup. Add it to `backend/.env`.

**Real-time updates not working:**
1. Confirm backend is running (check Terminal 1)
2. Open browser devtools → Network → WS tab to see Socket.IO connection
3. Check `CORS_ORIGIN` matches the frontend URL exactly

**Database tables not created:**
The schema and seed data initialize automatically on first run. If the DB exists but is empty, delete it and restart:
```bash
# PostgreSQL
dropdb restaurant && createdb restaurant
cd backend && npm run dev
```

---

## Architecture Overview

```
┌─────────────────┐
│   Frontend      │   React 18 + TypeScript
│   Port 3000     │   Vite dev server
└────────┬────────┘
         │  HTTP REST API  +  WebSocket (Socket.IO)
┌────────▼────────┐
│   Backend       │   Express + TypeScript
│   Port 5000     │   JWT Auth + Rate Limiting
└────────┬────────┘
         │
┌────────▼────────┐
│   PostgreSQL    │   7 tables, auto-seeded
│   DATABASE_URL  │   Connection pool (pg)
└─────────────────┘
```

---

## Key Files for Customization

| File | What to Change |
|------|---------------|
| `backend/src/db/database.ts` | Menu items, table count, seed employees |
| `frontend/src/styles/App.css` | Global navigation and brand colors |
| `backend/src/routes/auth.ts` | Auth policies, registration rules |
| `backend/src/middleware/rateLimiter.ts` | Rate limit thresholds |

---

## Next Steps

- Read the full [README.md](../../README.md)
- See [Architecture Details](../architecture/ARCHITECTURE.md)
- Review [Session Management](SESSION_MANAGEMENT.md)
- Follow the [Deployment Guide](../deployment/QUICKSTART.md) to publish to Render
