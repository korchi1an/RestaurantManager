import { Router, Request, Response } from 'express';
import { pool } from '../db/database';
import { CreateOrderRequest, Order, OrderWithItems, UpdateOrderStatusRequest } from '../models/types';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/orders - Get all orders (Kitchen and Waiter only)
router.get('/', authenticate, authorize('kitchen', 'waiter', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    
    let query = `
      SELECT o.*, 
        json_agg(
          json_build_object(
            'id', oi.id,
            'orderId', oi.order_id,
            'menuItemId', oi.menu_item_id,
            'quantity', oi.quantity,
            'price', oi.price,
            'name', mi.name,
            'category', mi.category
          )
        ) FILTER (WHERE oi.id IS NOT NULL) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
    `;
    
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 1;
    
    // If waiter, only show orders from their assigned tables
    if (userRole === 'waiter') {
      conditions.push(`o.table_number IN (SELECT table_number FROM tables WHERE waiter_id = $${paramCount})`);
      params.push(userId);
      paramCount++;
    }
    
    if (status) {
      conditions.push(`o.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY o.id ORDER BY o.created_at DESC';
    
    const result = await pool.query(query, params);
    
    const formattedOrders: OrderWithItems[] = result.rows.map((order: any) => ({
      id: order.id,
      orderNumber: order.order_number,
      sessionId: order.session_id,
      tableNumber: order.table_number,
      status: order.status,
      totalPrice: parseFloat(order.total_price),
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: order.items || []
    }));
    
    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Get a specific order
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT o.*, 
        json_agg(
          json_build_object(
            'id', oi.id,
            'orderId', oi.order_id,
            'menuItemId', oi.menu_item_id,
            'quantity', oi.quantity,
            'price', oi.price,
            'name', mi.name,
            'category', mi.category
          )
        ) FILTER (WHERE oi.id IS NOT NULL) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.id = $1
      GROUP BY o.id
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = result.rows[0];
    const formattedOrder: OrderWithItems = {
      id: order.id,
      orderNumber: order.order_number,
      sessionId: order.session_id,
      tableNumber: order.table_number,
      status: order.status,
      totalPrice: parseFloat(order.total_price),
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: order.items || []
    };
    
    res.json(formattedOrder);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// POST /api/orders - Create a new order
router.post('/', async (req: Request, res: Response) => {
  try {
    const orderData: CreateOrderRequest = req.body;
    
    if (!orderData.tableNumber || !orderData.items || orderData.items.length === 0) {
      return res.status(400).json({ error: 'Invalid order data' });
    }
    
    // Calculate total price
    let totalPrice = 0;
    const itemsWithPrices = [];
    
    for (const item of orderData.items) {
      const menuItemResult = await pool.query('SELECT * FROM menu_items WHERE id = $1', [item.menuItemId]);
      if (menuItemResult.rows.length === 0) {
        return res.status(400).json({ error: `Menu item ${item.menuItemId} not found` });
      }
      const menuItem = menuItemResult.rows[0];
      const itemTotal = parseFloat(menuItem.price) * item.quantity;
      totalPrice += itemTotal;
      itemsWithPrices.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.price
      });
    }
    
    // Use provided sessionId or null if not provided
    const sessionId = orderData.sessionId || null;
    console.log('Creating order with sessionId:', sessionId, 'tableNumber:', orderData.tableNumber);
    
    // Calculate order number for this session
    let orderNumber = 1;
    if (sessionId) {
      const lastOrderResult = await pool.query(`
        SELECT MAX(order_number) as max_number 
        FROM orders 
        WHERE session_id = $1
      `, [sessionId]);
      orderNumber = (lastOrderResult.rows[0]?.max_number || 0) + 1;
    }
    
    // Insert order
    const orderResult = await pool.query(`
      INSERT INTO orders (order_number, session_id, table_number, status, total_price, created_at, updated_at)
      VALUES ($1, $2, $3, 'Pending', $4, NOW(), NOW())
      RETURNING id
    `, [orderNumber, sessionId, orderData.tableNumber, totalPrice]);
    
    const orderId = orderResult.rows[0].id;
    
    // Insert order items
    for (const item of itemsWithPrices) {
      await pool.query(`
        INSERT INTO order_items (order_id, menu_item_id, quantity, price)
        VALUES ($1, $2, $3, $4)
      `, [orderId, item.menuItemId, item.quantity, item.price]);
    }
    
    // Fetch the created order
    const fetchResult = await pool.query(`
      SELECT o.*, 
        json_agg(
          json_build_object(
            'id', oi.id,
            'orderId', oi.order_id,
            'menuItemId', oi.menu_item_id,
            'quantity', oi.quantity,
            'price', oi.price,
            'name', mi.name,
            'category', mi.category
          )
        ) FILTER (WHERE oi.id IS NOT NULL) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.id = $1
      GROUP BY o.id
    `, [orderId]);
    
    const order = fetchResult.rows[0];
    
    const formattedOrder: OrderWithItems = {
      id: order.id,
      orderNumber: order.order_number,
      sessionId: order.session_id,
      tableNumber: order.table_number,
      status: order.status,
      totalPrice: parseFloat(order.total_price),
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: order.items || []
    };
    
    res.status(201).json(formattedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PATCH /api/orders/:id/status - Update order status (Kitchen and Waiter only)
router.patch('/:id/status', authenticate, authorize('kitchen', 'waiter', 'admin'), async (req: Request, res: Response) => {
  try {
    const { status }: UpdateOrderStatusRequest = req.body;
    const validStatuses = ['Pending', 'Preparing', 'Ready', 'Served'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const updateResult = await pool.query(`
      UPDATE orders 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [status, req.params.id]);
    
    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Fetch the updated order
    const fetchResult = await pool.query(`
      SELECT o.*, 
        json_agg(
          json_build_object(
            'id', oi.id,
            'orderId', oi.order_id,
            'menuItemId', oi.menu_item_id,
            'quantity', oi.quantity,
            'price', oi.price,
            'name', mi.name,
            'category', mi.category
          )
        ) FILTER (WHERE oi.id IS NOT NULL) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.id = $1
      GROUP BY o.id
    `, [req.params.id]);
    
    const order = fetchResult.rows[0];
    
    const formattedOrder: OrderWithItems = {
      id: order.id,
      orderNumber: order.order_number,
      sessionId: order.session_id,
      tableNumber: order.table_number,
      status: order.status,
      totalPrice: parseFloat(order.total_price),
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: order.items || []
    };
    
    res.json(formattedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// DELETE /api/orders/:id - Cancel an order (only if Pending status)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    
    // Check if order exists and is in Pending status
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = orderResult.rows[0];
    
    if (order.status !== 'Pending') {
      return res.status(400).json({ error: 'Can only cancel orders with Pending status' });
    }
    
    // Delete order items first
    await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
    
    // Delete order
    await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
    
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

export default router;
