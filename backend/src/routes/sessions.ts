import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/database';
import { Session, CreateSessionRequest, SessionWithOrders } from '../models/types';

const router = Router();

// POST /api/sessions - Create new session
router.post('/', async (req: Request, res: Response) => {
  try {
    const { tableNumber, deviceId, customerId, customerName }: CreateSessionRequest = req.body;
    
    if (!tableNumber || !deviceId) {
      return res.status(400).json({ error: 'Table number and device ID required' });
    }

    const sessionId = uuidv4();

    await pool.query(`
      INSERT INTO sessions (id, table_number, device_id, customer_id, customer_name, created_at, last_activity, is_active)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), true)
    `, [sessionId, tableNumber, deviceId, customerId || null, customerName || null]);

    res.status(201).json({
      sessionId,
      tableNumber,
      deviceId,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/sessions/table/:tableNumber - Get active sessions for a table
router.get('/table/:tableNumber', async (req: Request, res: Response) => {
  try {
    const { tableNumber } = req.params;

    const result = await pool.query(`
      SELECT 
        s.*,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_price), 0) as total_amount
      FROM sessions s
      LEFT JOIN orders o ON s.id = o.session_id
      WHERE s.table_number = $1 AND s.is_active = true
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `, [tableNumber]);

    const formattedSessions = result.rows.map((session: any) => ({
      id: session.id,
      tableNumber: session.table_number,
      deviceId: session.device_id,
      customerId: session.customer_id,
      customerName: session.customer_name,
      createdAt: session.created_at,
      lastActivity: session.last_activity,
      isActive: session.is_active,
      orderCount: parseInt(session.order_count),
      totalAmount: parseFloat(session.total_amount)
    }));

    res.json(formattedSessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/sessions/:sessionId - Get session details with orders
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // Get session
    const sessionResult = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get orders for this session
    const ordersResult = await pool.query(`
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
      WHERE o.session_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [sessionId]);

    const formattedOrders = ordersResult.rows.map((order: any) => ({
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

    const totalAmount = formattedOrders.reduce((sum: number, order: any) => sum + order.totalPrice, 0);

    const sessionWithOrders: SessionWithOrders = {
      id: session.id,
      tableNumber: session.table_number,
      deviceId: session.device_id,
      customerId: session.customer_id,
      customerName: session.customer_name,
      createdAt: session.created_at,
      lastActivity: session.last_activity,
      isActive: session.is_active,
      orders: formattedOrders,
      orderCount: formattedOrders.length,
      totalAmount
    };

    res.json(sessionWithOrders);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// POST /api/sessions/:sessionId/heartbeat - Update session activity
router.post('/:sessionId/heartbeat', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const result = await pool.query(`
      UPDATE sessions 
      SET last_activity = NOW()
      WHERE id = $1
    `, [sessionId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true, lastActivity: new Date().toISOString() });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// DELETE /api/sessions/:sessionId - End session
router.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const result = await pool.query(`
      UPDATE sessions 
      SET is_active = false
      WHERE id = $1
    `, [sessionId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// GET /api/sessions/:sessionId/orders - Get all orders for a session
router.get('/:sessionId/orders', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const result = await pool.query(`
      SELECT 
        o.*,
        json_agg(
          json_build_object(
            'id', oi.id,
            'menuItemId', oi.menu_item_id,
            'name', mi.name,
            'quantity', oi.quantity,
            'price', oi.price
          )
        ) FILTER (WHERE oi.id IS NOT NULL) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.session_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [sessionId]);

    const parsedOrders = result.rows.map((order: any) => ({
      ...order,
      total_price: parseFloat(order.total_price),
      items: order.items || []
    }));

    res.json(parsedOrders);
  } catch (error) {
    console.error('Error fetching session orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// POST /api/sessions/cleanup - Cleanup inactive sessions
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const inactiveMinutes = 30;
    const cutoffTime = new Date(Date.now() - inactiveMinutes * 60 * 1000);

    const result = await pool.query(`
      UPDATE sessions 
      SET is_active = false
      WHERE is_active = true 
      AND last_activity < $1
    `, [cutoffTime]);

    res.json({ 
      success: true, 
      deactivatedCount: result.rowCount 
    });
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    res.status(500).json({ error: 'Failed to cleanup sessions' });
  }
});

export default router;
