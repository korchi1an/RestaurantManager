# 🏗️ Architecture Documentation

## System Overview

This is a full-stack restaurant order management system with real-time updates using a clean, layered architecture.

## Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Socket.IO Client** - Real-time communication
- **CSS Modules** - Component styling

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **TypeScript** - Type safety
- **Socket.IO** - WebSocket server
- **better-sqlite3** - Database driver

### Database
- **SQLite** - Lightweight SQL database

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Customer │  │ Kitchen  │  │  Waiter  │                  │
│  │   View   │  │   View   │  │   View   │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│         │              │              │                      │
│         └──────────────┴──────────────┘                      │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │   App   │
                    │Component│
                    └────┬────┘
                         │
┌────────────────────────┼─────────────────────────────────────┐
│                  SERVICE LAYER                               │
│         ┌────────────────┬────────────────┐                  │
│    ┌────▼────┐     ┌─────▼─────┐                            │
│    │   API   │     │  Socket   │                            │
│    │ Service │     │  Service  │                            │
│    └────┬────┘     └─────┬─────┘                            │
└─────────┼──────────────────┼──────────────────────────────────┘
          │                  │
          │ REST API         │ WebSocket
          │                  │
┌─────────▼──────────────────▼──────────────────────────────────┐
│                    BACKEND SERVER                             │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 Express Server                        │   │
│  │                   (Port 5000)                         │   │
│  └───────────────────┬──────────────────────────────────┘   │
│                      │                                        │
│         ┌────────────┼────────────┐                          │
│         │            │            │                          │
│    ┌────▼───┐   ┌───▼────┐  ┌───▼────┐                     │
│    │  Menu  │   │ Orders │  │ Tables │                     │
│    │ Routes │   │ Routes │  │ Routes │                     │
│    └────┬───┘   └───┬────┘  └───┬────┘                     │
│         │           │           │                            │
│         └───────────┴───────────┘                            │
│                     │                                        │
│  ┌──────────────────▼──────────────────────────────────┐   │
│  │             Socket.IO Server                         │   │
│  │      (Real-time event broadcasting)                  │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬────────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────────┐
│                      DATA LAYER                                │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                 SQLite Database                       │    │
│  │               (restaurant.db)                         │    │
│  │                                                       │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │    │
│  │  │ menu_items │  │   orders   │  │   tables   │    │    │
│  │  └────────────┘  └────────────┘  └────────────┘    │    │
│  │                      │                               │    │
│  │                 ┌────▼────┐                          │    │
│  │                 │  order_ │                          │    │
│  │                 │  items  │                          │    │
│  │                 └─────────┘                          │    │
│  └──────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Order Creation Flow

```
Customer UI → API Service → POST /api/orders
                                    ↓
                            Express Routes
                                    ↓
                          Database Insert
                                    ↓
                            Return Order
                                    ↓
                        Socket.IO Broadcast
                                    ↓
                           orderCreated event
                                    ↓
                ┌───────────────────┴───────────────────┐
                ↓                                       ↓
         Kitchen Dashboard                      Customer UI
       (receives notification)              (order confirmed)
```

### 2. Status Update Flow

```
Kitchen UI → API Service → PATCH /api/orders/:id/status
                                    ↓
                            Express Routes
                                    ↓
                          Database Update
                                    ↓
                            Return Order
                                    ↓
                        Socket.IO Broadcast
                                    ↓
                           orderUpdated event
                                    ↓
        ┌───────────────────────────┴───────────────────────┐
        ↓                           ↓                        ↓
  Customer UI                 Kitchen UI              Waiter UI
(status update)            (status update)      (ready notification)
```

## Component Architecture

### Frontend Components

```
App
├── Navigation (Role Selector)
└── Main Content
    ├── Customer Page
    │   ├── Header (Table Selector)
    │   ├── Menu Section
    │   │   ├── Category Tabs
    │   │   └── Menu Grid
    │   │       └── Menu Item Cards
    │   └── Cart Section
    │       ├── Cart Items
    │       ├── Cart Total
    │       └── Current Order Status
    │
    ├── Kitchen Page
    │   ├── Header (Refresh Button)
    │   ├── Statistics Cards
    │   └── Orders Grid
    │       └── Table Orders
    │           └── Order Cards
    │
    └── Waiter Page
        ├── Header (Refresh Button)
        ├── Notification Banner
        ├── Statistics Cards
        └── Orders Sections
            ├── Ready Orders Grid
            └── Served Orders List
```

## Database Schema

### ERD (Entity Relationship Diagram)

```
┌──────────────────┐
│   menu_items     │
├──────────────────┤
│ id (PK)          │
│ name             │
│ category         │
│ price            │
│ description      │
└──────────────────┘
         △
         │
         │ (FK)
         │
┌────────┴─────────┐         ┌──────────────────┐
│   order_items    │         │     orders       │
├──────────────────┤         ├──────────────────┤
│ id (PK)          │◄────────│ id (PK)          │
│ order_id (FK)    │         │ table_number (FK)│
│ menu_item_id (FK)│         │ status           │
│ quantity         │         │ total_price      │
│ price            │         │ created_at       │
└──────────────────┘         │ updated_at       │
                             └──────────────────┘
                                      △
                                      │
                                      │ (FK)
                                      │
                             ┌────────┴─────────┐
                             │     tables       │
                             ├──────────────────┤
                             │ id (PK)          │
                             │ table_number     │
                             │ capacity         │
                             │ status           │
                             └──────────────────┘
```

### Relationships
- **menu_items** → **order_items** (One-to-Many)
- **orders** → **order_items** (One-to-Many)
- **tables** → **orders** (One-to-Many via table_number)

## API Design

### RESTful Principles
- Resource-based URLs
- HTTP methods represent actions
- JSON request/response bodies
- Proper status codes

### Endpoints Structure

```
/api
├── /menu
│   ├── GET    /              (List all menu items)
│   ├── GET    /categories    (List categories)
│   └── GET    /:id           (Get menu item)
│
├── /orders
│   ├── GET    /              (List orders, ?status=...)
│   ├── GET    /:id           (Get order details)
│   ├── POST   /              (Create new order)
│   └── PATCH  /:id/status    (Update order status)
│
└── /tables
    ├── GET    /              (List all tables)
    └── GET    /:tableNumber  (Get table)
```

## Real-time Communication

### Socket.IO Events

#### Server → Client Events

| Event | Description | Payload |
|-------|-------------|---------|
| `orderCreated` | New order placed | OrderWithItems |
| `orderUpdated` | Order status changed | OrderWithItems |
| `orderReady` | Order marked as ready | OrderWithItems |
| `orderServed` | Order marked as served | OrderWithItems |

### Event Flow

```
Backend Server
      │
      ├─► orderCreated ──┬─► Kitchen Dashboard
      │                  └─► Customer UI
      │
      ├─► orderUpdated ──┬─► Kitchen Dashboard
      │                  ├─► Customer UI
      │                  └─► Waiter Dashboard
      │
      ├─► orderReady ────┬─► Waiter Dashboard
      │                  └─► Customer UI
      │
      └─► orderServed ───┬─► Kitchen Dashboard
                         └─► Customer UI
```

## State Management

### Frontend State
- **Local Component State** (useState)
  - Form inputs
  - UI toggles
  - Loading states

- **Derived State**
  - Filtered menu items
  - Calculated totals
  - Grouped orders

### Data Synchronization
- REST API for initial data load
- Socket.IO for real-time updates
- Optimistic UI updates with rollback on error

## Security Considerations

### Current Implementation
- CORS enabled for localhost
- Input validation on API endpoints
- SQL injection prevention (parameterized queries)
- TypeScript for type safety

### Production Recommendations
- Add authentication & authorization
- Implement rate limiting
- Use HTTPS
- Add request validation middleware
- Sanitize user inputs
- Add CSRF protection
- Environment-based configuration

## Performance Optimization

### Backend
- Database prepared statements (caching)
- Efficient SQL queries with JOINs
- JSON aggregation for order items

### Frontend
- Component-level code splitting
- Lazy loading for routes
- Memoization for expensive calculations
- Optimized re-renders with React.memo

### Real-time
- WebSocket connection pooling
- Event debouncing
- Selective subscriptions

## Scalability Considerations

### Current Limitations
- Single server instance
- File-based SQLite database
- No load balancing

### Scaling Path
1. **Horizontal Scaling**
   - Move to PostgreSQL/MySQL
   - Redis for Socket.IO adapter
   - Load balancer (nginx)

2. **Vertical Scaling**
   - Increase server resources
   - Database connection pooling
   - Query optimization

3. **Microservices**
   - Separate order service
   - Separate menu service
   - Message queue (RabbitMQ/Kafka)

## Testing Strategy

### Recommended Tests

**Backend:**
- Unit tests for routes
- Integration tests for database
- API endpoint tests
- Socket.IO event tests

**Frontend:**
- Component unit tests
- Integration tests for user flows
- E2E tests (Cypress/Playwright)
- Socket connection tests

## Deployment

### Backend Deployment
```bash
npm run build
node dist/server.js
```

### Frontend Deployment
```bash
npm run build
# Serve dist/ folder with nginx or static host
```

### Environment Variables
```
# Backend
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-domain.com

# Frontend
VITE_API_URL=https://api.your-domain.com
```

## Monitoring & Logging

### Recommended Tools
- **Application Monitoring**: PM2, New Relic
- **Error Tracking**: Sentry
- **Logging**: Winston, Morgan
- **Analytics**: Google Analytics

## Code Quality

### TypeScript
- Strict mode enabled
- No implicit any
- Full type coverage

### Code Organization
- Feature-based folders
- Clear naming conventions
- Separation of concerns
- DRY principles

---

**Architecture Version:** 1.0.0  
**Last Updated:** February 6, 2026
