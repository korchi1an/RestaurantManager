# Restaurant Order Management System

A full-stack web application for managing restaurant orders with real-time updates across customer, kitchen, and waiter interfaces.

## 🎯 Features

### Customer Interface
- Browse menu items organized by categories (Appetizers, Main Courses, Desserts, Beverages)
- Add/remove items to cart with quantity adjustments
- Select table number for order placement
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
- Statistics for ready and served orders

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 with TypeScript, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with pg driver
- **Real-time**: Socket.IO for WebSocket communication
- **Security**: Helmet, Compression, Rate Limiting
- **Logging**: Structured JSON logging with Winston
- **Authentication**: JWT with bcrypt
- **Styling**: Custom CSS with responsive design

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
- **18 menu items** across 4 categories
- **10 tables** with varying capacities

## 🛠️ Technology Choices

### Why PostgreSQL?
- Production-grade relational database
- ACID compliance and data integrity
- Excellent performance and scalability
- Rich feature set (JSON, arrays, full-text search)
- Strong community and ecosystem
- Perfect for production deployments

### Why Socket.IO?
- Reliable real-time bidirectional communication
- Automatic reconnection
- Fallback to HTTP long-polling
- Broad browser support

### Why TypeScript?
- Type safety reduces runtime errors
- Better IDE support with autocomplete
- Easier refactoring
- Self-documenting code

### Why Vite?
- Fast development server with HMR
- Optimized production builds
- Native ES modules support
- Better developer experience

## 🔐 Future Enhancements

- User authentication and authorization
- Order history and analytics
- Payment processing integration
- Multi-restaurant support
- Inventory management
- Customer notifications via SMS/Email
- Table reservation system
- Order modifications and cancellations
- Kitchen printer integration
- Mobile app (React Native)

## 📝 Development Notes

### Database Schema
The database uses foreign keys to maintain referential integrity. All timestamps are stored in ISO 8601 format.

### API Design
RESTful API design with clear resource naming and HTTP methods. PATCH is used for partial updates (status changes).

### Error Handling
All API endpoints include try-catch blocks with appropriate HTTP status codes and error messages.

### Code Organization
- Clear separation of concerns
- Modular component structure
- Reusable services (API, Socket)
- Type-safe interfaces throughout

## 🤝 Contributing

This is a demonstration project. Feel free to fork and enhance!

## 📄 License

MIT License - feel free to use this project for learning or as a starting point for your own restaurant management system.

---

**Built with ❤️ using React, TypeScript, Express, and Socket.IO**
