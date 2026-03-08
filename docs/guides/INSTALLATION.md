# Installation & Development Setup

## Prerequisites

Before starting, ensure you have:

- **Node.js v18+** — [Download](https://nodejs.org/)
- **npm** — Comes with Node.js
- **PostgreSQL** — [Download](https://www.postgresql.org/download/) or use a hosted instance
- **VS Code** — Recommended editor

Verify:
```bash
node --version     # Should show v18.x.x or higher
npm --version      # Should show 9.x.x or higher
psql --version     # Should show 14.x or higher
```

---

## Installation Steps

### Step 1: Clone or Open the Project

If starting fresh:
```bash
git clone <repo-url> restaurant2
cd restaurant2
```

### Step 2: Create the Database

Using psql or your preferred PostgreSQL client:
```sql
CREATE DATABASE restaurant;
```

### Step 3: Configure Backend Environment

Create `backend/.env` from the example:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/restaurant
JWT_SECRET=replace-with-a-secure-random-string-at-least-32-chars
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

> **JWT_SECRET**: Generate a secure value with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### Step 4: Install Backend Dependencies

```bash
cd backend
npm install
```

### Step 5: Install Frontend Dependencies

```bash
cd frontend
npm install
```

---

## Running the Application

### Start Backend (Terminal 1)

```bash
cd backend
npm run dev
```

Expected output:
```
[INFO] Validating environment variables...
[INFO] Connecting to database...
[INFO] Database initialized
[INFO] Seeded menu items
[INFO] Seeded tables
[INFO] Seeded staff accounts
=== SERVER READY ===
[INFO] Server running on http://localhost:5000
[INFO] Socket.IO server ready
```

> The database schema and seed data are created automatically on first run.

### Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### Access the Application

Open `http://localhost:3000` in your browser.

---

## Application Routes

### Public Routes

| URL | Description |
|-----|-------------|
| `/table/:tableId` | Customer ordering page (e.g., `/table/1`) |
| `/login` | Staff login (username + password) |
| `/customer-login` | Customer account login (email + password) |
| `/register` | Customer account registration |
| `/qr-codes` | QR code display for all tables |

### Protected Staff Routes

| URL | Required Role | Description |
|-----|--------------|-------------|
| `/kitchen` | kitchen / admin | Kitchen order dashboard |
| `/waiter` | waiter / admin | Waiter order dashboard |
| `/assignments` | kitchen / admin | Table-to-waiter assignments |

---

## Default Credentials (Development Only)

| Username | Password | Role |
|----------|----------|------|
| `chef` | `kitchen123` | kitchen |
| `ana` | `waiter123` | waiter |
| `mihai` | `waiter123` | waiter |
| `admin` | `admin123` | admin |

> Change all passwords before any public deployment.

---

## Testing the Application

### Quick Test Flow

1. **Customer** — Open `http://localhost:3000/table/3`
   - Browse the menu, add items to cart
   - Click "Submit Order"

2. **Kitchen** — Log in at `/login` as `chef` / `kitchen123`
   - Go to `/kitchen`
   - See the new order in real-time
   - Click "Mark Preparing" then "Mark Ready"

3. **Waiter** — Log in at `/login` as `ana` / `waiter123`
   - Go to `/waiter`
   - See the ready notification
   - Click "Mark Served" then "Mark Paid"

4. **Customer tab** — Watch the order status update live and see the goodbye screen after payment

---

## Troubleshooting

### Problem: Server fails to start with "Missing required environment variable"

The startup validator (`validateEnv.ts`) requires `DATABASE_URL` and `JWT_SECRET`.

**Solution:** Verify `backend/.env` exists and contains both variables.

### Problem: `DATABASE_URL` connection refused

**Solution:**
1. Ensure PostgreSQL service is running
2. Verify the connection string format: `postgresql://user:pass@host:port/dbname`
3. Confirm the database exists: `psql -l | grep restaurant`

### Problem: Port 5000 already in use

**Solution:** Add `PORT=5001` to `backend/.env` and update the frontend proxy target in `frontend/vite.config.ts`:
```typescript
proxy: {
  '/api': { target: 'http://localhost:5001' },
  '/socket.io': { target: 'http://localhost:5001' }
}
```

### Problem: Port 3000 already in use

**Solution:** Edit `frontend/vite.config.ts`:
```typescript
server: {
  port: 3001,
}
```

### Problem: Socket.IO not connecting

1. Confirm backend is running (Terminal 1)
2. Open browser DevTools → Network → WS filter — look for a Socket.IO connection
3. Check that `CORS_ORIGIN` in `.env` matches the exact frontend URL (including port)

### Problem: Orders created but kitchen doesn't update in real-time

1. Check the WS connection in browser DevTools
2. Reload both tabs to re-establish Socket.IO listeners
3. Verify Socket.IO handshake succeeds in backend logs

### Problem: Staff login returns 403 Forbidden

Staff tokens are stored in `sessionStorage` (tab-specific). If you navigated away or opened a new tab, you need to log in again in that tab.

### Problem: Database tables missing after restart

The schema initializes only once (on first run). If the `restaurant` DB was dropped and recreated:
```bash
cd backend
npm run dev   # Re-runs schema init and seed data
```

### Problem: Module not found errors

```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## Stopping the Application

- Terminal 1 (Backend): `Ctrl + C`
- Terminal 2 (Frontend): `Ctrl + C`

---

## Building for Production

### Build Backend
```bash
cd backend
npm run build    # Output: backend/dist/
npm start        # Runs compiled JS
```

### Build Frontend
```bash
cd frontend
npm run build    # Output: frontend/dist/
npm run preview  # Preview production build locally
```

### Run Full Production Stack Locally
```bash
# Terminal 1 — Backend
cd backend && npm run build && NODE_ENV=production npm start

# Terminal 2 — Serve frontend dist
cd frontend && npm run build
npx serve -s dist -p 3000
```

---

## Project Structure at a Glance

```
restaurant2/
├── backend/
│   ├── .env              ← Create this file (not committed)
│   ├── src/
│   │   ├── server.ts
│   │   ├── config/       ← env validation
│   │   ├── db/           ← PostgreSQL + seed data
│   │   ├── middleware/   ← auth, rate limiting, error handler
│   │   ├── routes/       ← auth, menu, orders, sessions, tables, assignments
│   │   └── utils/        ← logger, socketManager
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.tsx        ← Router + ProtectedRoute
    │   ├── components/    ← MenuDisplay, CartDisplay
    │   ├── hooks/         ← useCart
    │   ├── pages/         ← Customer, Kitchen, Waiter, Login, Register, etc.
    │   ├── services/      ← api, socket, sessionService
    │   └── types/
    └── package.json
```

---

## Success Checklist

- [ ] Node.js v18+ installed
- [ ] PostgreSQL running and `restaurant` database created
- [ ] `backend/.env` configured with `DATABASE_URL` and `JWT_SECRET`
- [ ] Backend dependencies installed (`backend/node_modules/` exists)
- [ ] Frontend dependencies installed (`frontend/node_modules/` exists)
- [ ] Backend starts without errors (`=== SERVER READY ===` in Terminal 1)
- [ ] Frontend Vite dev server running (`http://localhost:3000`)
- [ ] Can access `/table/1` as a customer
- [ ] Can log in as staff at `/login`
- [ ] Real-time order updates visible across browser tabs

---

## Next Steps

1. Read the full [README.md](../../README.md)
2. Review [Architecture Details](../architecture/ARCHITECTURE.md)
3. Check [Session Management](SESSION_MANAGEMENT.md)
4. Deploy using the [Render.com Guide](../deployment/QUICKSTART.md)
