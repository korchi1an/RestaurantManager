# 🚀 Quick Start Guide

## Step 1: Install Dependencies

Open two terminal windows in VS Code:

### Terminal 1 - Backend
```bash
cd backend
npm install
```

### Terminal 2 - Frontend
```bash
cd frontend
npm install
```

## Step 2: Start the Application

### Terminal 1 - Start Backend
```bash
cd backend
npm run dev
```
✓ Backend server will start on http://localhost:5000
✓ Database will be automatically created with seed data

### Terminal 2 - Start Frontend
```bash
cd frontend
npm run dev
```
✓ Frontend will start on http://localhost:3000
✓ Browser should automatically open

## Step 3: Test the Application

1. **Open http://localhost:3000** in your browser
2. Switch between the three views using the top navigation:
   - 👥 **Customer** - Place an order
   - 👨‍🍳 **Kitchen** - Manage order preparation
   - 🍽️ **Waiter** - Serve completed orders

## Testing Workflow

1. **As Customer:**
   - Select a table number (1-10)
   - Browse menu items by category
   - Add items to cart
   - Adjust quantities
   - Submit the order

2. **As Kitchen Staff:**
   - See the new order appear in real-time
   - Click "Start Preparing" to update status
   - Click "Mark as Ready" when order is complete

3. **As Waiter:**
   - Receive notification when order is ready
   - View the ready order
   - Click "Mark as Served" to complete the order

## Troubleshooting

**Port already in use:**
- Backend: Change port in `backend/src/server.ts` (line with `PORT`)
- Frontend: Change port in `frontend/vite.config.ts`

**Database issues:**
- Delete `backend/restaurant.db` file and restart backend

**Real-time updates not working:**
- Check browser console for Socket.IO connection errors
- Ensure both backend and frontend are running

## Architecture Overview

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
│   Port 3000     │
└────────┬────────┘
         │
         │ HTTP REST API
         │ WebSocket (Socket.IO)
         │
┌────────▼────────┐
│   Backend       │
│   (Express)     │
│   Port 5000     │
└────────┬────────┘
         │
         │
┌────────▼────────┐
│   SQLite DB     │
│  (restaurant.db)│
└─────────────────┘
```

## Key Files

**Backend:**
- `backend/src/server.ts` - Main server file
- `backend/src/routes/` - API endpoints
- `backend/src/db/database.ts` - Database setup

**Frontend:**
- `frontend/src/App.tsx` - Main app component
- `frontend/src/pages/` - Customer, Kitchen, Waiter views
- `frontend/src/services/` - API and Socket.IO clients

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Explore the codebase to understand the architecture
- Customize menu items in `backend/src/db/database.ts`
- Modify styling in `frontend/src/styles/`

---

**Need help?** Check the [README.md](README.md) for more detailed information!
