# 🔄 Session Management Quick Reference

## What Changed

✅ Added UUID dependency to backend and frontend  
✅ Created `sessions` table in database  
✅ Added `session_id` column to `orders` table  
✅ New API endpoints for session management  
✅ Session service in frontend  
✅ Updated Customer page to create/use sessions  
✅ Visual "Session Active" indicator  

## Installation

Since we added new dependencies, you need to reinstall:

```bash
# Terminal 1 - Backend
cd backend
rm -rf node_modules package-lock.json  # or: del /F /S /Q node_modules package-lock.json
npm install
npm run dev

# Terminal 2 - Frontend
cd frontend
rm -rf node_modules package-lock.json  # or: del /F /S /Q node_modules package-lock.json
npm install
npm run dev
```

## Quick Test

1. **Open two browsers** (e.g., Chrome and Firefox)
2. **Browser 1**: Select Table 5, order pizza
3. **Browser 2**: Select Table 5, order burger
4. **Kitchen view**: You'll see TWO separate sections for Table 5

Expected result:
```
Table 5
├─ Session 1: Pizza order
└─ Session 2: Burger order
```

## Key Files Modified

### Backend
- ✅ `backend/package.json` - Added uuid
- ✅ `backend/src/models/types.ts` - Added Session types
- ✅ `backend/src/db/database.ts` - Added sessions table
- ✅ `backend/src/routes/sessions.ts` - NEW FILE
- ✅ `backend/src/routes/orders.ts` - Added session_id
- ✅ `backend/src/server.ts` - Added sessions route

### Frontend
- ✅ `frontend/package.json` - Added uuid
- ✅ `frontend/src/types/index.ts` - Added Session types
- ✅ `frontend/src/services/sessionService.ts` - NEW FILE
- ✅ `frontend/src/pages/Customer.tsx` - Session integration
- ✅ `frontend/src/styles/Customer.css` - Session indicator style

## New API Endpoints

```
POST   /api/sessions                    Create session
GET    /api/sessions/table/:tableNumber Get sessions for table
GET    /api/sessions/:sessionId         Get session details
POST   /api/sessions/:sessionId/heartbeat  Keep session alive
DELETE /api/sessions/:sessionId         End session
POST   /api/sessions/cleanup             Clean inactive sessions
```

## How to Use

### As a Customer
1. Open the app
2. Select a table number
3. **NEW**: Session is automatically created
4. You'll see "✓ Session Active" indicator
5. Place your order - it's linked to YOUR session
6. Multiple people at same table? Each gets their own session!

### As Kitchen Staff
- Orders now show which session they belong to
- Multiple orders from same table are grouped by session
- Each session represents a different customer/device

### As a Waiter
- See orders grouped by session
- Can serve/bill each customer separately

## Database Changes

### New Table: `sessions`
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- UUID
  table_number INTEGER NOT NULL,
  device_id TEXT NOT NULL,       -- Browser fingerprint
  customer_id TEXT,              -- Optional
  created_at TEXT NOT NULL,
  last_activity TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);
```

### Modified Table: `orders`
```sql
ALTER TABLE orders ADD COLUMN session_id TEXT;
```

## Session Lifecycle

```
User opens app
    ↓
Selects table
    ↓
Session created automatically
    ↓
Places orders (linked to session)
    ↓
Heartbeat every 30 seconds
    ↓
Closes tab / switches table
    ↓
Session ends
```

## Troubleshooting

**Issue: Database errors on startup**
```bash
# Delete old database and restart
cd backend
rm restaurant.db  # or: del restaurant.db
npm run dev
```

**Issue: Module 'uuid' not found**
```bash
# Reinstall dependencies
npm install
```

**Issue: TypeScript errors**
```bash
# Clear and rebuild
npm run build
```

## Backward Compatibility

✅ Old orders without sessionId still work  
✅ sessionId is optional in order creation  
✅ Existing functionality unchanged  

## Testing Checklist

- [ ] Can select table and see "Session Active" indicator
- [ ] Can place order successfully
- [ ] Can open app in 2 browsers at same table
- [ ] Orders appear separately in kitchen view
- [ ] Switching tables creates new session
- [ ] Session persists on page refresh (same tab)
- [ ] Session cleared when tab closed

---

**Ready!** Your restaurant system now handles multiple customers per table! 🎉

**For detailed explanation, see**: [SESSION_MANAGEMENT.md](SESSION_MANAGEMENT.md)
