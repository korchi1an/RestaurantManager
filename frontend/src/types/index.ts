// Frontend types (matching backend models)
export type OrderStatus = 'Pending' | 'Preparing' | 'Ready' | 'Served' | 'Paid';

export interface Session {
  id: string;
  tableNumber: number;
  deviceId: string;
  customerId?: string;
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
  table_number: number;
  capacity: number;
  status: 'Available' | 'Occupied';
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface Order {
  id: number;
  orderNumber: number;
  sessionId?: string;
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
  name: string;
  category: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface CreateOrderRequest {
  sessionId?: string;
  tableNumber: number;
  items: {
    menuItemId: number;
    quantity: number;
  }[];
}
