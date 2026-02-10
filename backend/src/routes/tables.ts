import { Router, Request, Response } from 'express';
import { pool } from '../db/database';
import { Table } from '../models/types';
import QRCode from 'qrcode';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// GET /api/tables - Get all tables
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM tables ORDER BY table_number');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// GET /api/tables/:tableNumber - Get a specific table
router.get('/:tableNumber', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM tables WHERE table_number = $1', [req.params.tableNumber]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch table' });
  }
});

// GET /api/tables/:tableNumber/qrcode - Get QR code for a table
router.get('/:tableNumber/qrcode', async (req: Request, res: Response) => {
  try {
    const tableNumber = req.params.tableNumber;
    
    // Verify table exists
    const result = await pool.query('SELECT * FROM tables WHERE table_number = $1', [tableNumber]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const table = result.rows[0];

    // Generate QR code URL - points to customer page with table parameter
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrCodeUrl = `${baseUrl}/table/${tableNumber}`;

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.json({
      tableNumber: table.table_number,
      url: qrCodeUrl,
      qrCode: qrCodeDataUrl
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// GET /api/tables/:tableNumber/orders - Get all orders for a table
router.get('/:tableNumber/orders', async (req: Request, res: Response) => {
  try {
    const { tableNumber } = req.params;

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
      WHERE o.table_number = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [tableNumber]);

    const formattedOrders = result.rows.map((order: any) => ({
      id: order.id,
      sessionId: order.session_id,
      tableNumber: order.table_number,
      status: order.status,
      totalPrice: parseFloat(order.total_price),
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      paidAt: order.paid_at,
      items: order.items || []
    }));

    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching table orders:', error);
    res.status(500).json({ error: 'Failed to fetch table orders' });
  }
});

// GET /api/tables/:tableNumber/unpaid-total - Get unpaid total for a table
router.get('/:tableNumber/unpaid-total', async (req: Request, res: Response) => {
  try {
    const { tableNumber } = req.params;

    const result = await pool.query(`
      SELECT COALESCE(SUM(total_price), 0) as unpaid_total
      FROM orders
      WHERE table_number = $1 AND paid_at IS NULL
    `, [tableNumber]);

    res.json({ 
      tableNumber: parseInt(tableNumber), 
      unpaidTotal: parseFloat(result.rows[0].unpaid_total) 
    });
  } catch (error) {
    console.error('Error calculating unpaid total:', error);
    res.status(500).json({ error: 'Failed to calculate unpaid total' });
  }
});

// POST /api/tables/:tableNumber/mark-paid - Mark all unpaid orders as paid (waiter only)
router.post('/:tableNumber/mark-paid', authenticate, authorize('waiter', 'kitchen', 'admin'), async (req: Request, res: Response) => {
  try {
    const { tableNumber } = req.params;

    const result = await pool.query(`
      UPDATE orders
      SET paid_at = NOW()
      WHERE table_number = $1 AND paid_at IS NULL
    `, [tableNumber]);

    res.json({ 
      success: true, 
      ordersPaid: result.rowCount,
      message: `Marcate ${result.rowCount} comenzi ca plătite` 
    });
  } catch (error) {
    console.error('Error marking orders as paid:', error);
    res.status(500).json({ error: 'Failed to mark orders as paid' });
  }
});

export default router;
