# 🍽️ Restaurant Order Management System

A production-ready full-stack web application for managing restaurant orders with real-time updates across customer, kitchen, and waiter interfaces.

## 📚 Quick Links

- **🚀 [Deploy to Production](docs/deployment/QUICKSTART.md)** - Step-by-step deployment guide
- **💻 [Development Setup](docs/guides/INSTALLATION.md)** - Local development installation
- **📖 [Full Documentation](docs/README.md)** - All documentation organized by topic
- **🏗️ [Architecture](docs/architecture/ARCHITECTURE.md)** - Technical architecture details
- **✅ [Deployment Checklist](docs/deployment/CHECKLIST.md)** - Pre-deployment verification

## 🎯 Features

### Customer Interface
- Browse menu items organized by categories (Appetizers, Main Courses, Desserts, Beverages)
- Session-based order tracking (multiple devices per table)
- Add/remove items to cart with quantity adjustments
- Submit orders and track status in real-time
- View order status updates (Pending → Preparing → Ready → Served)

### Kitchen Dashboard
- View all active orders grouped by table number
- Real-time notifications for new orders
- Mark orders as "Preparing" or "Ready"
- Statistics dashboard showing pending, preparing, and ready orders
- Timestamp tracking for all orders

### Waiter Dashboard
- View all orders marked as "Ready" to serve
- Real-time notifications when orders become ready
- Mark orders as "Served"
- View recently served orders
- Call waiter functionality for customer assistance
- Statistics for ready and served orders

### Staff Interface
- Employee authentication (Kitchen, Waiter, Admin roles)
- Customer authentication and registration
- QR code generation for tables
- Table-waiter assignments

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 with TypeScript, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with pg driver
- **Real-time**: Socket.IO for WebSocket communication
- **Security**: Helmet, JWT Authentication, Rate Limiting, bcrypt
- **Logging**: Winston (structured JSON logging)
- **Styling**: Custom CSS with responsive design

### Deployment Status
- ✅ Production-ready with environment validation
- ✅ Health check endpoint configured
- ✅ Graceful startup and shutdown
- ✅ Database initialization with retry logic
- ✅ Render.com deployment configured ([render.yaml](render.yaml))
- ✅ Security hardening (JWT validation, CORS, rate limiting)

See [Deployment Readiness Audit](docs/deployment/READINESS_AUDIT.md) for full details.

### Project Structure

```
restaurant2/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   └── database.ts          # PostgreSQL connection pool & lifecycle
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT authentication
│   │   │   ├── errorHandler.ts      # Global error handling
│   │   │   └── rateLimiter.ts       # Rate limiting configs
│   │   ├── models/
│   │   │   └── types.ts              # TypeScript interfaces
│   │   ├── routes/
│   │   │   ├── auth.ts               # Authentication endpoints
│   │   │   ├── menu.ts               # Menu endpoints
│   │   │   ├── orders.ts             # Order endpoints
│   │   │   ├── sessions.ts           # Session management
│   │   │   ├── tableAssignments.ts   # Table assignments
│   │   │   └── tables.ts             # Table endpoints
│   │   ├── utils/
│   │   │   └── logger.ts             # Structured logging utility
│   │   └── server.ts                 # Express server with Socket.IO
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Customer.tsx          # Customer ordering interface
│   │   │   ├── Kitchen.tsx           # Kitchen dashboard
│   │   │   └── Waiter.tsx            # Waiter dashboard
│   │   ├── services/
│   │   │   ├── api.ts                # API client
│   │   │   └── socket.ts             # Socket.IO client
│   │   ├── styles/
│   │   │   ├── App.css
│   │   │   ├── Customer.css
│   │   │   ├── Kitchen.css
│   │   │   └── Waiter.css
│   │   ├── types/
│   │   │   └── index.ts              # Frontend types
│   │   ├── App.tsx                   # Main app component
│   │   └── main.tsx                  # Entry point
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## 📊 Data Models

### MenuItem
```typescript
{
  id: number;
  name: string;
  category: string;
  price: number;
  description?: string;
}
```

### Order
```typescript
{
  id: number;
  tableNumber: number;
  status: 'Pending' | 'Preparing' | 'Ready' | 'Served';
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
}
```

### OrderItem
```typescript
{
  id: number;
  orderId: number;
  menuItemId: number;
  quantity: number;
  price: number;
  name: string;
  category: string;
}
```

## 🔌 API Endpoints

### Menu
- `GET /api/menu` - Get all menu items
- `GET /api/menu/categories` - Get all categories
- `GET /api/menu/:id` - Get specific menu item

### Orders
- `GET /api/orders` - Get all orders (optional `?status=` query parameter)
- `GET /api/orders/:id` - Get specific order
- `POST /api/orders` - Create new order
- `PATCH /api/orders/:id/status` - Update order status

### Tables
- `GET /api/tables` - Get all tables
- `GET /api/tables/:tableNumber` - Get specific table

## 🔄 Order State Flow

```
Pending → Preparing → Ready → Served
```

1. **Pending**: Order submitted by customer
2. **Preparing**: Kitchen has started working on the order
3. **Ready**: Order is complete and ready to be served
4. **Served**: Waiter has delivered the order to the table

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Install Backend Dependencies**
```bash
cd backend
npm install
```

2. **Install Frontend Dependencies**
```bash
cd frontend
npm install
```

### Running the Application

1. **Start the Backend Server**
```bash
cd backend
npm run dev
```
The server will start on `http://localhost:5000`

2. **Start the Frontend Development Server**
```bash
cd frontend
npm run dev
```
The frontend will start on `http://localhost:3000`

3. **Access the Application**
Open your browser and navigate to `http://localhost:3000`

### Building for Production

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

## 🎨 User Interface

### Navigation
The app features a top navigation bar with three role-based views:
- 👥 Customer - For placing orders
- 👨‍🍳 Kitchen - For managing order preparation
- 🍽️ Waiter - For serving completed orders

### Responsive Design
The application is fully responsive and works on:
- Desktop (1400px+)
- Tablet (768px - 1399px)
- Mobile (< 768px)

## 🔔 Real-time Features

The application uses Socket.IO for real-time updates:

- **orderCreated**: Notifies kitchen when a new order is placed
- **orderUpdated**: Updates all dashboards when order status changes
- **orderReady**: Notifies waiters when an order is ready
- **orderServed**: Updates all dashboards when order is served

## 📦 Seed Data

The database is automatically seeded with:
- **18 menu items** across 4 categories (Appetizers, Main Courses, Desserts, Beverages)
- **10 tables** with varying capacities
- **4 default employees** (Chef, Ana, Mihai, Admin) - ⚠️ Change passwords in production!

## 📚 Documentation

- **[Full Documentation Index](docs/README.md)** - Navigate all documentation
- **[Deployment Guide](docs/deployment/QUICKSTART.md)** - Deploy to Render.com
- **[Development Setup](docs/guides/INSTALLATION.md)** - Local development
- **[Architecture Details](docs/architecture/ARCHITECTURE.md)** - System design
- **[Project Overview](docs/PROJECT_OVERVIEW.md)** - Feature summary
- **[Session Management](docs/guides/SESSION_MANAGEMENT.md)** - Session-based ordering

## 🚀 Quick Start

### Development (Local)

1. **Install dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend  
   cd frontend && npm run dev
   ```

3. **Access the app**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

For detailed instructions, see [Installation Guide](docs/guides/INSTALLATION.md).

### Production (Render.com)

1. **Commit and push** to GitHub
2. **Create Render Blueprint** from [render.yaml](render.yaml)
3. **Set environment variables** (DATABASE_URL, JWT_SECRET, CORS_ORIGIN)
4. **Monitor deployment** logs for "=== SERVER READY ==="

For detailed instructions, see [Deployment Quickstart](docs/deployment/QUICKSTART.md).

## 🔐 Security Features

- ✅ Environment variable validation on startup (fail-fast)
- ✅ JWT authentication with secure secret validation
- ✅ Password hashing with bcrypt
- ✅ Rate limiting on all API endpoints
- ✅ Helmet.js security headers
- ✅ CORS configuration for production
- ✅ Input validation and sanitization
- ✅ SQL injection prevention (parameterized queries)

## 🔄 Real-time Features

Socket.IO events for instant updates:
- `orderCreated` - Notifies kitchen of new orders
- `orderUpdated` - Updates all dashboards on status change
- `orderReady` - Notifies waiters when order is complete
- `orderServed` - Updates all views when order delivered
- `waiter-called` - Alerts waiters when customer needs assistance

## 🛠️ Technology Choices

### Why PostgreSQL?
Production-grade relational database with ACID compliance, excellent performance, and rich feature set. Perfect for Render deployments with automatic backups.

### Why Socket.IO?
Reliable real-time bidirectional communication with automatic reconnection and fallback to HTTP long-polling.

### Why TypeScript?
Type safety reduces runtime errors, provides better IDE support, and makes refactoring safer.

### Why Vite?
Lightning-fast development server with HMR, optimized production builds, and excellent developer experience.

## 📊 API Documentation

See [Project Overview](docs/PROJECT_OVERVIEW.md) for complete API endpoint documentation.

**Quick Reference:**
- `GET /api/menu` - All menu items
- `POST /api/orders` - Create order
- `PATCH /api/orders/:id/status` - Update order status
- `GET /health` - Health check (includes DB status)

## 🤝 Contributing

This is a demonstration project showcasing modern full-stack development practices. Feel free to fork and enhance!

**Areas for enhancement:**
- Payment processing integration
- Order history and analytics
- Multi-restaurant support
- Mobile app (React Native)
- Kitchen printer integration
- SMS/Email notifications

## 📄 License

MIT License - Free to use for learning or as a starting point for your restaurant management system.

---

**🎯 Production Status**: ✅ Ready for deployment  
**📦 Last Updated**: February 20, 2026  
**🔗 Documentation**: [docs/README.md](docs/README.md)

**Built with ❤️ using React, TypeScript, Express, PostgreSQL, and Socket.IO**
