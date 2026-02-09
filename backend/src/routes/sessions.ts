import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database';
import { Session, CreateSessionRequest, SessionWithOrders } from '../models/types';

const router = Router();

// POST /api/sessions - Create new session
router.post('/', (req: Request, res: Response) => {
  try {
    const { tableNumber, deviceId, customerId }: CreateSessionRequest = req.body;
    
    if (!tableNumber || !deviceId) {
      return res.status(400).json({ error: 'Table number and device ID required' });
    }

    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const insertSession = db.prepare(`
      INSERT INTO sessions (id, table_number, device_id, customer_id, created_at, last_activity, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    insertSession.run(sessionId, tableNumber, deviceId, customerId || null, now, now);

    res.status(201).json({
      sessionId,
      tableNumber,
      deviceId,
      createdAt: now
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/sessions/table/:tableNumber - Get active sessions for a table
router.get('/table/:tableNumber', (req: Request, res: Response) => {
  try {
    const { tableNumber } = req.params;

    const query = `
      SELECT 
        s.*,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_price), 0) as total_amount
      FROM sessions s
      LEFT JOIN orders o ON s.id = o.session_id
      WHERE s.table_number = ? AND s.is_active = 1
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;

    const sessions = db.prepare(query).all(tableNumber) as any[];

    const formattedSessions = sessions.map(session => ({
      id: session.id,
      tableNumber: session.table_number,
      deviceId: session.device_id,
      customerId: session.customer_id,
      createdAt: session.created_at,
      lastActivity: session.last_activity,
      isActive: session.is_active === 1,
      orderCount: session.order_count,
      totalAmount: session.total_amount
    }));

    res.json(formattedSessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/sessions/:sessionId - Get session details with orders
router.get('/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // Get session
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get orders for this session
    const ordersQuery = `
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
      WHERE o.session_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;

    const orders = db.prepare(ordersQuery).all(sessionId) as any[];

    const formattedOrders = orders.map(order => ({
      id: order.id,      orderNumber: order.order_number,      sessionId: order.session_id,
      tableNumber: order.table_number,
      status: order.status,
      totalPrice: order.total_price,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: JSON.parse(order.items).filter((item: any) => item.id !== null)
    }));

    const totalAmount = formattedOrders.reduce((sum, order) => sum + order.totalPrice, 0);

    const sessionWithOrders: SessionWithOrders = {
      id: session.id,
      tableNumber: session.table_number,
      deviceId: session.device_id,
      customerId: session.customer_id,
      createdAt: session.created_at,
      lastActivity: session.last_activity,
      isActive: session.is_active === 1,
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
router.post('/:sessionId/heartbeat', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const now = new Date().toISOString();

    const updateSession = db.prepare(`
      UPDATE sessions 
      SET last_activity = ?
      WHERE id = ?
    `);

    const result = updateSession.run(now, sessionId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true, lastActivity: now });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// DELETE /api/sessions/:sessionId - End session
router.delete('/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const updateSession = db.prepare(`
      UPDATE sessions 
      SET is_active = 0
      WHERE id = ?
    `);

    const result = updateSession.run(sessionId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// GET /api/sessions/:sessionId/orders - Get all orders for a session
router.get('/:sessionId/orders', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const query = `
      SELECT 
        o.*,
        json_group_array(
          json_object(
            'id', oi.id,
            'menuItemId', oi.menu_item_id,
            'name', mi.name,
            'quantity', oi.quantity,
            'price', oi.price
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.session_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;

    const orders = db.prepare(query).all(sessionId) as any[];

    const parsedOrders = orders.map(order => ({
      ...order,
      items: JSON.parse(order.items).filter((item: any) => item.id !== null)
    }));

    res.json(parsedOrders);
  } catch (error) {
    console.error('Error fetching session orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// POST /api/sessions/cleanup - Cleanup inactive sessions
router.post('/cleanup', (req: Request, res: Response) => {
  try {
    const inactiveMinutes = 30;
    const cutoffTime = new Date(Date.now() - inactiveMinutes * 60 * 1000).toISOString();

    const updateSessions = db.prepare(`
      UPDATE sessions 
      SET is_active = 0
      WHERE is_active = 1 
      AND last_activity < ?
    `);

    const result = updateSessions.run(cutoffTime);

    res.json({ 
      success: true, 
      deactivatedCount: result.changes 
    });
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    res.status(500).json({ error: 'Failed to cleanup sessions' });
  }
});

export default router;
