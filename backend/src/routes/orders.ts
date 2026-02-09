import { Router, Request, Response } from 'express';
import db from '../db/database';
import { CreateOrderRequest, Order, OrderWithItems, UpdateOrderStatusRequest } from '../models/types';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/orders - Get all orders (Kitchen and Waiter only)
router.get('/', authenticate, authorize('kitchen', 'waiter', 'admin'), (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    
    let query = `
      SELECT o.*, 
        json_group_array(
          json_object(
            'id', oi.id,
            'orderId', oi.order_id,
            'menuItemId', oi.menu_item_id,
            'quantity', oi.quantity,
            'price', oi.price,
            'name', mi.name,
            'category', mi.category
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
    `;
    
    const conditions: string[] = [];
    const params: any[] = [];
    
    // If waiter, only show orders from their assigned tables
    if (userRole === 'waiter') {
      conditions.push(`o.table_number IN (SELECT table_number FROM tables WHERE waiter_id = ?)`);
      params.push(userId);
    }
    
    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY o.id ORDER BY o.created_at DESC';
    
    const stmt = db.prepare(query);
    const orders = stmt.all(...params) as any[];
    
    const formattedOrders: OrderWithItems[] = orders.map(order => ({
      id: order.id,
      orderNumber: order.order_number,
      sessionId: order.session_id,
      tableNumber: order.table_number,
      status: order.status,
      totalPrice: order.total_price,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: JSON.parse(order.items).filter((item: any) => item.id !== null)
    }));
    
    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Get a specific order
router.get('/:id', (req: Request, res: Response) => {
  try {
    const query = `
      SELECT o.*, 
        json_group_array(
          json_object(
            'id', oi.id,
            'orderId', oi.order_id,
            'menuItemId', oi.menu_item_id,
            'quantity', oi.quantity,
            'price', oi.price,
            'name', mi.name,
            'category', mi.category
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.id = ?
      GROUP BY o.id
    `;
    
    const order = db.prepare(query).get(req.params.id) as any;
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const formattedOrder: OrderWithItems = {
      id: order.id,
      orderNumber: order.order_number,
      sessionId: order.session_id,
      tableNumber: order.table_number,
      status: order.status,
      totalPrice: order.total_price,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: JSON.parse(order.items).filter((item: any) => item.id !== null)
    };
    
    res.json(formattedOrder);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// POST /api/orders - Create a new order
router.post('/', (req: Request, res: Response) => {
  try {
    const orderData: CreateOrderRequest = req.body;
    
    if (!orderData.tableNumber || !orderData.items || orderData.items.length === 0) {
      return res.status(400).json({ error: 'Invalid order data' });
    }
    
    // Calculate total price
    let totalPrice = 0;
    const itemsWithPrices = [];
    
    for (const item of orderData.items) {
      const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.menuItemId) as any;
      if (!menuItem) {
        return res.status(400).json({ error: `Menu item ${item.menuItemId} not found` });
      }
      const itemTotal = menuItem.price * item.quantity;
      totalPrice += itemTotal;
      itemsWithPrices.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.price
      });
    }
    
    const now = new Date().toISOString();
    
    // Use provided sessionId or null if not provided
    const sessionId = orderData.sessionId || null;
    console.log('Creating order with sessionId:', sessionId, 'tableNumber:', orderData.tableNumber);
    
    // Calculate order number for this session
    let orderNumber = 1;
    if (sessionId) {
      const lastOrder = db.prepare(`
        SELECT MAX(order_number) as max_number 
        FROM orders 
        WHERE session_id = ?
      `).get(sessionId) as any;
      orderNumber = (lastOrder?.max_number || 0) + 1;
    }
    
    // Insert order
    const insertOrder = db.prepare(`
      INSERT INTO orders (order_number, session_id, table_number, status, total_price, created_at, updated_at)
      VALUES (?, ?, ?, 'Pending', ?, ?, ?)
    `);
    
    const result = insertOrder.run(orderNumber, sessionId, orderData.tableNumber, totalPrice, now, now);
    const orderId = result.lastInsertRowid;
    
    // Insert order items
    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, quantity, price)
      VALUES (?, ?, ?, ?)
    `);
    
    for (const item of itemsWithPrices) {
      insertOrderItem.run(orderId, item.menuItemId, item.quantity, item.price);
    }
    
    // Fetch the created order
    const query = `
      SELECT o.*, 
        json_group_array(
          json_object(
            'id', oi.id,
            'orderId', oi.order_id,
            'menuItemId', oi.menu_item_id,
            'quantity', oi.quantity,
            'price', oi.price,
            'name', mi.name,
            'category', mi.category
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.id = ?
      GROUP BY o.id
    `;
    
    const order = db.prepare(query).get(orderId) as any;
    
    const formattedOrder: OrderWithItems = {
      id: order.id,
      orderNumber: order.order_number,
      sessionId: order.session_id,
      tableNumber: order.table_number,
      status: order.status,
      totalPrice: order.total_price,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: JSON.parse(order.items).filter((item: any) => item.id !== null)
    };
    
    res.status(201).json(formattedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PATCH /api/orders/:id/status - Update order status (Kitchen and Waiter only)
router.patch('/:id/status', authenticate, authorize('kitchen', 'waiter', 'admin'), (req: Request, res: Response) => {
  try {
    const { status }: UpdateOrderStatusRequest = req.body;
    const validStatuses = ['Pending', 'Preparing', 'Ready', 'Served'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const now = new Date().toISOString();
    
    const updateOrder = db.prepare(`
      UPDATE orders 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `);
    
    const result = updateOrder.run(status, now, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Fetch the updated order
    const query = `
      SELECT o.*, 
        json_group_array(
          json_object(
            'id', oi.id,
            'orderId', oi.order_id,
            'menuItemId', oi.menu_item_id,
            'quantity', oi.quantity,
            'price', oi.price,
            'name', mi.name,
            'category', mi.category
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.id = ?
      GROUP BY o.id
    `;
    
    const order = db.prepare(query).get(req.params.id) as any;
    
    const formattedOrder: OrderWithItems = {
      id: order.id,
      orderNumber: order.order_number,
      sessionId: order.session_id,
      tableNumber: order.table_number,
      status: order.status,
      totalPrice: order.total_price,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: JSON.parse(order.items).filter((item: any) => item.id !== null)
    };
    
    res.json(formattedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

export default router;
