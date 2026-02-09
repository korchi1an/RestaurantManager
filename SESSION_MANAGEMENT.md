# Session Management Documentation

## Overview

The restaurant order management system now includes **session-based tracking** to handle multiple customers ordering from the same table using different devices.

## Problem Solved

**Before (Issue):**
```
Table 5 - Device A: Orders burger
Table 5 - Device B: Orders pizza
-----------------------------------
Result: Both orders attributed to "Table 5"
        No way to distinguish which customer ordered what
        Difficult to split bills
```

**After (Solution):**
```
Table 5 - Session abc-123 (Device A): Orders burger
Table 5 - Session xyz-789 (Device B): Orders pizza
---------------------------------------------------
Result: Each session tracks its own orders
        Kitchen sees orders grouped by session
        Waiter can serve/bill each customer separately
```

## How It Works

### 1. Device Fingerprinting

Each browser/device gets a unique ID stored in `localStorage`:

```typescript
deviceId: "550e8400-e29b-41d4-a716-446655440000"
```

- **Persists across browser sessions**
- **Unique per device**
- Auto-generated on first visit

### 2. Session Creation

When a customer selects a table, a session is created:

```typescript
POST /api/sessions
{
  "tableNumber": 5,
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}

Response:
{
  "sessionId": "abc-123",
  "tableNumber": 5,
  "createdAt": "2026-02-06T10:30:00Z"
}
```

Session stored in `sessionStorage` (cleared when browser tab closes).

### 3. Order Placement

Orders are now linked to sessions:

```typescript
POST /api/orders
{
  "sessionId": "abc-123",
  "tableNumber": 5,
  "items": [...]
}
```

### 4. Session Tracking

**Database Schema:**

```sql
sessions
├── id (UUID)
├── table_number
├── device_id
├── customer_id (optional)
├── created_at
├── last_activity
└── is_active

orders
├── id
├── session_id (FK → sessions.id)  ← NEW!
├── table_number
├── status
├── total_price
├── created_at
└── updated_at
```

## API Endpoints

### Create Session
```http
POST /api/sessions
Body: { tableNumber, deviceId, customerId? }
Response: { sessionId, tableNumber, createdAt }
```

### Get Sessions for Table
```http
GET /api/sessions/table/:tableNumber
Response: [{
  id, tableNumber, deviceId,
  orderCount, totalAmount,
  createdAt, lastActivity, isActive
}]
```

### Get Session Details
```http
GET /api/sessions/:sessionId
Response: {
  ...session,
  orders: [...],
  orderCount,
  totalAmount
}
```

### Update Session Activity (Heartbeat)
```http
POST /api/sessions/:sessionId/heartbeat
Response: { success: true, lastActivity }
```

### End Session
```http
DELETE /api/sessions/:sessionId
Response: { success: true }
```

### Cleanup Inactive Sessions
```http
POST /api/sessions/cleanup
Response: { success: true, deactivatedCount }
```

## User Flows

### Scenario: Two Friends at Same Table

**Friend 1 (Phone):**
1. Opens app → Selects Table 5
2. System creates Session A
3. Orders burger and fries → Linked to Session A
4. Sees "Session Active ✓" indicator

**Friend 2 (Tablet):**
1. Opens app → Selects Table 5
2. System creates Session B (different device)
3. Orders pizza and salad → Linked to Session B
4. Sees "Session Active ✓" indicator

**Kitchen View:**
```
Table 5
├── Session A (Friend 1)
│   └── Order #123: Burger, Fries
└── Session B (Friend 2)
    └── Order #124: Pizza, Salad
```

**Waiter View:**
```
Table 5 - Ready Orders
├── Customer 1 (Session A): $15.50
└── Customer 2 (Session B): $22.00
```

## Session Lifecycle

```
1. SELECT TABLE
   ↓
2. CREATE SESSION
   ├─ Generate UUID
   ├─ Link to device ID
   ├─ Store in sessionStorage
   └─ Mark as active
   ↓
3. PLACE ORDERS
   └─ All orders linked to session
   ↓
4. HEARTBEAT (every 30s)
   └─ Keep session alive
   ↓
5. END SESSION
   ├─ Tab closed: Auto cleanup
   ├─ Switch table: Explicit end
   └─ Inactive 30min: Auto cleanup
```

## Frontend Implementation

### Session Service
```typescript
// services/sessionService.ts
class SessionService {
  - getOrCreateDeviceId()     // Persistent device ID
  - createSession(table)       // Start new session
  - endSession(sessionId)      // End session
  - heartbeat(sessionId)       // Keep alive
  - getStoredSession()         // Retrieve from storage
}
```

### Customer Component
```typescript
const [sessionId, setSessionId] = useState<string | null>(null);

// On table change
const handleTableChange = async (tableNum) => {
  if (sessionId) {
    await sessionService.endSession(sessionId);
  }
  const session = await sessionService.createSession(tableNum);
  setSessionId(session.sessionId);
};

// On order submit
const submitOrder = async () => {
  const orderData = {
    sessionId,  // ← Link order to session
    tableNumber,
    items: [...]
  };
  await api.createOrder(orderData);
};

// Heartbeat interval
useEffect(() => {
  const interval = setInterval(() => {
    if (sessionId) {
      sessionService.heartbeat(sessionId);
    }
  }, 30000);
  return () => clearInterval(interval);
}, [sessionId]);
```

## Kitchen Dashboard Updates

Orders are now grouped by session:

```typescript
interface GroupedOrders {
  tableNumber: number;
  sessions: {
    sessionId: string;
    orders: Order[];
    totalAmount: number;
  }[];
}
```

**Display:**
```
Table 5
├─ Customer 1 (Session abc-123)
│  ├─ Order #123: Burger, Fries
│  └─ Total: $15.50
└─ Customer 2 (Session xyz-789)
   ├─ Order #124: Pizza, Salad
   └─ Total: $22.00
```

## Session Cleanup

### Automatic Cleanup

Sessions are marked inactive if:
- **No activity for 30 minutes** (heartbeat timeout)
- Can be cleaned up with `/api/sessions/cleanup`

### Manual Cleanup

- User switches table → Previous session ended
- Browser tab closed → Session expires naturally
- Explicit end → DELETE /api/sessions/:id

## Benefits

✅ **Multi-device support** - Multiple customers at same table  
✅ **Separate bills** - Each session has own order total  
✅ **Better tracking** - Kitchen knows which customer ordered what  
✅ **Order history** - Link orders to specific customers  
✅ **Scalable** - Supports any number of devices per table  

## Migration from Old System

**Backward Compatible:**
- Orders can still be created without sessionId
- Old orders continue to work
- sessionId is optional in database

**To fully migrate:**
1. ✅ Backend updated to handle sessions
2. ✅ Database schema includes sessions table
3. ✅ Frontend creates sessions on table selection
4. ✅ Orders linked to sessions

## Testing Session Management

### Test Scenario 1: Same Table, Different Devices

1. Open app in Browser A → Select Table 3
2. Open app in Browser B → Select Table 3
3. Browser A: Order pizza
4. Browser B: Order burger
5. Check Kitchen view → See 2 separate sessions

### Test Scenario 2: Switch Tables

1. Select Table 5 → Order pizza
2. Switch to Table 7 → Old session ends
3. Order burger → New session created
4. Check database → 2 sessions (first inactive)

### Test Scenario 3: Session Heartbeat

1. Create session → Note sessionId
2. Wait 29 seconds → Session still active
3. Heartbeat sent automatically
4. Session remains active

### Test Scenario 4: Inactive Cleanup

1. Create session → Close browser
2. Wait 30+ minutes
3. Run cleanup: POST /api/sessions/cleanup
4. Session marked as inactive

## Database Queries

### Get all sessions for a table
```sql
SELECT * FROM sessions 
WHERE table_number = 5 
AND is_active = 1;
```

### Get orders grouped by session
```sql
SELECT 
  s.id as session_id,
  s.table_number,
  o.id as order_id,
  o.total_price
FROM sessions s
LEFT JOIN orders o ON s.id = o.session_id
WHERE s.table_number = 5
GROUP BY s.id;
```

### Find inactive sessions
```sql
SELECT * FROM sessions
WHERE is_active = 1
AND datetime(last_activity) < datetime('now', '-30 minutes');
```

## Security Considerations

1. **Device ID** - Stored locally, not transmitted unnecessarily
2. **Session Timeout** - Auto cleanup after 30 min inactivity
3. **No PII** - customerID optional, deviceID is anonymous UUID
4. **Session Hijacking** - Low risk (same-origin policy)

## Future Enhancements

- [ ] Customer accounts (login-based sessions)
- [ ] Session history and analytics
- [ ] Bill splitting within sessions
- [ ] QR code session initiation
- [ ] Waiter-initiated sessions
- [ ] Session transfer between devices
- [ ] Payment integration per session

## Troubleshooting

**Issue: Orders not linked to session**
- Check sessionId is passed in order creation
- Verify session exists in database

**Issue: Multiple sessions for same device**
- Check deviceId consistency
- Verify sessionStorage not cleared

**Issue: Sessions not expiring**
- Run cleanup endpoint manually
- Check last_activity timestamps

**Issue: Session indicator not showing**
- Check sessionStorage has currentSession
- Verify sessionId state is set

---

## Summary

Session management enables **multi-customer ordering** at the same table by:
1. Creating unique sessions per device
2. Linking all orders to sessions
3. Tracking session activity
4. Grouping orders by session in UI
5. Auto-cleanup of inactive sessions

This provides a **restaurant-grade ordering experience** supporting real-world scenarios! 🎉
