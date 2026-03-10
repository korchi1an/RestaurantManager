import { Router, Request, Response } from 'express';
import { pool } from '../db/database';
import { CreateOrderRequest, Order, OrderWithItems, UpdateOrderStatusRequest } from '../models/types';
import { authenticate, authorize, optionalAuth, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import SocketManager from '../utils/socketManager';

const router = Router();

// POST /api/orders/waiter - Create order by waiter (Waiter only)
router.post('/waiter', authenticate, authorize('waiter', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const orderData: CreateOrderRequest = req.body;
    const waiterId = req.user?.id;
    const waiterName = req.user?.username;
    
    logger.info('WAITER ORDER - Waiter-assisted order received', { 
      waiterId, 
      waiterName,
      tableNumber: orderData.tableNumber, 
      itemsCount: orderData.items?.length 
    });
    
    if (!orderData.tableNumber || !orderData.items || orderData.items.length === 0) {
      logger.warn('WAITER ORDER - Invalid order data, missing required fields');
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
    
    logger.info('WAITER ORDER - Creating waiter-assisted order', { 
      waiterId,
      waiterName,
      tableNumber: orderData.tableNumber, 
      totalPrice, 
      itemsCount: itemsWithPrices.length 
    });
    
    // For waiter orders, store waiter ID in session_id field with 'waiter-' prefix
    const waiterSessionId = `waiter-${waiterId}`;

    const client = await pool.connect();
    let orderId: number;
    let formattedOrder: OrderWithItems;

    try {
      await client.query('BEGIN');

      // Calculate next order_number atomically within the transaction
      const numResult = await client.query(
        `SELECT COALESCE(MAX(order_number), 0) + 1 AS next_num FROM orders WHERE session_id = $1`,
        [waiterSessionId]
      );
      const orderNumber = numResult.rows[0].next_num;

      const orderResult = await client.query(`
        INSERT INTO orders (order_number, session_id, table_number, status, total_price, created_at, updated_at)
        VALUES ($1, $2, $3, 'Pending', $4, NOW(), NOW())
        RETURNING id
      `, [orderNumber, waiterSessionId, orderData.tableNumber, totalPrice]);

      orderId = orderResult.rows[0].id;
      logger.info('WAITER ORDER - Order inserted', {
        orderId,
        orderNumber,
        tableNumber: orderData.tableNumber,
        createdByWaiter: waiterId,
        waiterName
      });

      // Insert order items
      for (const item of itemsWithPrices) {
        await client.query(`
          INSERT INTO order_items (order_id, menu_item_id, quantity, price)
          VALUES ($1, $2, $3, $4)
        `, [orderId, item.menuItemId, item.quantity, item.price]);
      }

      await client.query('COMMIT');

      // Fetch the created order (outside transaction is fine for a read)
      const fetchResult = await client.query(`
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

      formattedOrder = {
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
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    logger.info('WAITER ORDER - Created successfully', {
      orderId,
      tableNumber: formattedOrder.tableNumber,
      status: formattedOrder.status,
      createdByWaiter: waiterId,
      waiterName
    });

    // Emit socket event
    if (SocketManager.isInitialized()) {
      const io = SocketManager.getIO();
      io.emit('orderCreated', formattedOrder);
    }

    res.status(201).json(formattedOrder);
  } catch (error) {
    logger.error('WAITER ORDER - Error creating waiter-assisted order', { error, waiterId: req.user?.id });
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /api/orders - Get all orders (Kitchen and Waiter only)
router.get('/', authenticate, authorize('kitchen', 'waiter', 'admin'), async (req: AuthRequest, res: Response) => {
  const userRole = req.user?.role;
  const userId = req.user?.id;
  
  try {
    const { status } = req.query;
    logger.info('ORDER FETCH - User fetching orders', { userId, userRole, statusFilter: status });
    
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
    
    logger.info('ORDER FETCH - Orders found', { count: formattedOrders.length, userRole, userId });
    res.json(formattedOrders);
  } catch (error) {
    logger.error('ORDER FETCH - Error fetching orders', { error, userId, userRole });
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Get a specific order (staff only)
router.get('/:id', authenticate, authorize('kitchen', 'waiter', 'admin'), async (req: Request, res: Response) => {
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
    logger.error('ORDER FETCH - Error fetching single order', { error, orderId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// POST /api/orders - Create a new order
router.post('/', async (req: Request, res: Response) => {
  try {
    const orderData: CreateOrderRequest = req.body;
    logger.info('ORDER CREATE - Received order request', { tableNumber: orderData.tableNumber, itemsCount: orderData.items?.length });
    
    if (!orderData.tableNumber || !orderData.items || orderData.items.length === 0) {
      logger.warn('ORDER CREATE - Invalid order data, missing required fields');
      return res.status(400).json({ error: 'Invalid order data' });
    }

    if (!orderData.sessionId) {
      logger.warn('ORDER CREATE - Missing sessionId');
      return res.status(400).json({ error: 'sessionId is required' });
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
    
    const sessionId = orderData.sessionId;
    const clientRef = orderData.clientRef || null;
    logger.info('ORDER CREATE - Creating order', { sessionId, tableNumber: orderData.tableNumber, totalPrice, itemsCount: itemsWithPrices.length, clientRef });

    const client = await pool.connect();
    let formattedOrder: OrderWithItems;

    try {
      await client.query('BEGIN');

      // Idempotency check: if clientRef already exists, return the existing order
      if (clientRef) {
        const existingResult = await client.query(
          `SELECT o.*,
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
          WHERE o.client_ref = $1
          GROUP BY o.id`,
          [clientRef]
        );
        if (existingResult.rows.length > 0) {
          await client.query('ROLLBACK');
          const dup = existingResult.rows[0];
          logger.info('ORDER CREATE - Duplicate clientRef, returning existing order', { clientRef, orderId: dup.id });
          return res.status(201).json({
            id: dup.id,
            orderNumber: dup.order_number,
            sessionId: dup.session_id,
            tableNumber: dup.table_number,
            status: dup.status,
            totalPrice: parseFloat(dup.total_price),
            createdAt: dup.created_at,
            updatedAt: dup.updated_at,
            items: dup.items || []
          });
        }
      }

      // Calculate next order_number atomically within the transaction
      const numResult = await client.query(
        `SELECT COALESCE(MAX(order_number), 0) + 1 AS next_num FROM orders WHERE session_id = $1`,
        [sessionId]
      );
      const orderNumber = numResult.rows[0].next_num;

      const orderResult = await client.query(`
        INSERT INTO orders (order_number, session_id, table_number, status, total_price, created_at, updated_at, client_ref)
        VALUES ($1, $2, $3, 'Pending', $4, NOW(), NOW(), $5)
        RETURNING id
      `, [orderNumber, sessionId, orderData.tableNumber, totalPrice, clientRef]);

      const orderId = orderResult.rows[0].id;
      logger.info('ORDER CREATE - Order inserted', { orderId, orderNumber, tableNumber: orderData.tableNumber });

      // Insert order items
      for (const item of itemsWithPrices) {
        await client.query(`
          INSERT INTO order_items (order_id, menu_item_id, quantity, price)
          VALUES ($1, $2, $3, $4)
        `, [orderId, item.menuItemId, item.quantity, item.price]);
      }

      await client.query('COMMIT');

      // Fetch the created order
      const fetchResult = await client.query(`
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

      formattedOrder = {
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
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    logger.info('ORDER CREATE - Order created successfully', { orderId: formattedOrder.id, tableNumber: formattedOrder.tableNumber, status: formattedOrder.status, orderNumber: formattedOrder.orderNumber });
    res.status(201).json(formattedOrder);
  } catch (error) {
    logger.error('ORDER CREATE - Error creating order', { error });
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PATCH /api/orders/table/:tableNumber/status - Bulk update all orders for a table
router.patch('/table/:tableNumber/status', authenticate, authorize('kitchen', 'waiter', 'admin'), async (req: Request, res: Response) => {
  try {
    const tableNumber = parseInt(req.params.tableNumber);
    const { status } = req.body;
    const validStatuses = ['Preparing', 'Ready', 'Served'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Preparing, Ready, or Served.' });
    }

    // Determine which current statuses to update from
    const fromStatuses = status === 'Preparing' ? ['Pending'] : status === 'Ready' ? ['Pending', 'Preparing'] : ['Ready'];
    const placeholders = fromStatuses.map((_, i) => `$${i + 2}`).join(', ');

    const updateResult = await pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW()
       WHERE table_number = $${fromStatuses.length + 2} AND status IN (${placeholders})
       RETURNING id`,
      [status, ...fromStatuses, tableNumber]
    );

    if (updateResult.rowCount === 0) {
      return res.json({ success: true, updated: [] });
    }

    const updatedIds: number[] = updateResult.rows.map((r: any) => r.id);

    // Fetch each updated order with items and emit socket events
    const updatedOrders: OrderWithItems[] = [];
    for (const orderId of updatedIds) {
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

      updatedOrders.push(formattedOrder);

      if (SocketManager.isInitialized()) {
        const io = SocketManager.getIO();
        io.emit('orderUpdated', formattedOrder);
        if (status === 'Ready') {
          io.emit('orderReady', formattedOrder);
        }
        if (status === 'Served') {
          io.emit('orderServed', formattedOrder);
        }
      }
    }

    logger.info('ORDER STATUS BULK - Table orders updated', { tableNumber, status, count: updatedOrders.length });
    res.json({ success: true, updated: updatedOrders });
  } catch (error) {
    logger.error('ORDER STATUS BULK - Error updating table orders', { error, tableNumber: req.params.tableNumber });
    res.status(500).json({ error: 'Failed to update table orders' });
  }
});

// PATCH /api/orders/:id/status - Update order status (Kitchen and Waiter only)
router.patch('/:id/status', authenticate, authorize('kitchen', 'waiter', 'admin'), async (req: Request, res: Response) => {
  try {
    const { status }: UpdateOrderStatusRequest = req.body;
    const validStatuses = ['Pending', 'Preparing', 'Ready', 'Served', 'Paid'];
    logger.info('ORDER STATUS - Updating order status', { orderId: req.params.id, newStatus: status });
    
    if (!status || !validStatuses.includes(status)) {
      logger.warn('ORDER STATUS - Invalid status provided', { status, orderId: req.params.id });
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Set paid_at timestamp when marking as Paid
    const updateQuery = status === 'Paid'
      ? `UPDATE orders SET status = $1, updated_at = NOW(), paid_at = NOW() WHERE id = $2`
      : `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`;
    
    const updateResult = await pool.query(updateQuery, [status, req.params.id]);
    
    if (updateResult.rowCount === 0) {
      logger.warn('ORDER STATUS - Order not found', { orderId: req.params.id });
      return res.status(404).json({ error: 'Order not found' });
    }
    
    logger.info('ORDER STATUS - Order updated successfully', { orderId: req.params.id, newStatus: status });
    
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
    
    // Socket events for PATCH /orders/:id/status are emitted by the
    // server.ts res.json middleware — no need to emit here too.
    res.json(formattedOrder);
  } catch (error) {
    logger.error('ORDER STATUS - Error updating order status', { error, orderId: req.params.id });
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// DELETE /api/orders/:id - Cancel an order (only if Pending status)
// Staff (kitchen/waiter/admin) can cancel any pending order.
// Customers (unauthenticated) must supply the matching sessionId in the request body.
router.delete('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const orderId = req.params.id;
    logger.info('ORDER CANCEL - Attempting to cancel order', { orderId });

    await client.query('BEGIN');

    // Lock the row exclusively so a concurrent kitchen status update blocks until we finish
    const lockResult = await client.query(
      'SELECT status, table_number, session_id FROM orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );

    if (lockResult.rows.length === 0) {
      await client.query('ROLLBACK');
      logger.warn('ORDER CANCEL - Order not found', { orderId });
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = lockResult.rows[0];

    // Authorization: staff can cancel any order; customers must own the session
    const isStaff = req.user && ['kitchen', 'waiter', 'admin'].includes(req.user.role);
    if (!isStaff) {
      const { sessionId } = req.body;
      if (!sessionId || sessionId !== order.session_id) {
        await client.query('ROLLBACK');
        logger.warn('ORDER CANCEL - Unauthorized cancel attempt', { orderId, providedSession: sessionId });
        return res.status(403).json({ error: 'Not authorized to cancel this order' });
      }
    }

    if (order.status !== 'Pending') {
      await client.query('ROLLBACK');
      logger.warn('ORDER CANCEL - Cannot cancel non-pending order', { orderId, status: order.status });
      return res.status(400).json({ error: 'Can only cancel orders with Pending status' });
    }

    await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
    await client.query('DELETE FROM orders WHERE id = $1', [orderId]);
    await client.query('COMMIT');

    logger.info('ORDER CANCEL - Order cancelled successfully', { orderId, tableNumber: order.table_number });
    res.json({ success: true, message: 'Order cancelled successfully', orderId: parseInt(orderId) });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('ORDER CANCEL - Error cancelling order', { error, orderId: req.params.id });
    res.status(500).json({ error: 'Failed to cancel order' });
  } finally {
    client.release();
  }
});

export default router;
