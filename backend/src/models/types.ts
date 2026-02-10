// Data models and types
export type OrderStatus = 'Pending' | 'Preparing' | 'Ready' | 'Served';

export interface Session {
  id: string;
  tableNumber: number;
  deviceId: string;
  customerId?: string;
  customerName?: string;
  createdAt: string;
  lastActivity: string;
  isActive: boolean;
}

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  description?: string;
}

export interface Table {
  id: number;
  tableNumber: number;
  capacity: number;
  status: 'Available' | 'Occupied';
}

export interface Order {
  id: number;
  orderNumber: number;
  sessionId: string;
  tableNumber: number;
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  menuItemId: number;
  quantity: number;
  price: number;
}

// DTOs for API requests/responses
export interface CreateOrderRequest {
  sessionId?: string;
  tableNumber: number;
  items: {
    menuItemId: number;
    quantity: number;
  }[];
}

export interface CreateSessionRequest {
  tableNumber: number;
  deviceId: string;
  customerId?: string;
  customerName?: string;
}

export interface SessionWithOrders extends Session {
  orders: OrderWithItems[];
  totalAmount: number;
  orderCount: number;
}

export interface OrderWithItems extends Order {
  items: (OrderItem & { name: string; category: string })[];
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}
