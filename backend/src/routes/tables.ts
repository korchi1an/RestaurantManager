import { Router, Request, Response } from 'express';
import db from '../db/database';
import { Table } from '../models/types';
import QRCode from 'qrcode';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// GET /api/tables - Get all tables
router.get('/', (req: Request, res: Response) => {
  try {
    const tables = db.prepare('SELECT * FROM tables ORDER BY table_number').all() as Table[];
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// GET /api/tables/:tableNumber - Get a specific table
router.get('/:tableNumber', (req: Request, res: Response) => {
  try {
    const table = db.prepare('SELECT * FROM tables WHERE table_number = ?').get(req.params.tableNumber) as Table;
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    res.json(table);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch table' });
  }
});

// GET /api/tables/:tableNumber/qrcode - Get QR code for a table
router.get('/:tableNumber/qrcode', async (req: Request, res: Response) => {
  try {
    const tableNumber = req.params.tableNumber;
    
    // Verify table exists
    const table = db.prepare('SELECT * FROM tables WHERE table_number = ?').get(tableNumber) as Table;
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

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
      tableNumber: table.tableNumber,
      url: qrCodeUrl,
      qrCode: qrCodeDataUrl
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// GET /api/tables/:tableNumber/orders - Get all orders for a table
router.get('/:tableNumber/orders', (req: Request, res: Response) => {
  try {
    const { tableNumber } = req.params;

    const orders = db.prepare(`
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
      WHERE o.table_number = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).all(tableNumber) as any[];

    const formattedOrders = orders.map(order => ({
      id: order.id,
      sessionId: order.session_id,
      tableNumber: order.table_number,
      status: order.status,
      totalPrice: order.total_price,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      paidAt: order.paid_at,
      items: JSON.parse(order.items).filter((item: any) => item.id !== null)
    }));

    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching table orders:', error);
    res.status(500).json({ error: 'Failed to fetch table orders' });
  }
});

// GET /api/tables/:tableNumber/unpaid-total - Get unpaid total for a table
router.get('/:tableNumber/unpaid-total', (req: Request, res: Response) => {
  try {
    const { tableNumber } = req.params;

    const result = db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as unpaid_total
      FROM orders
      WHERE table_number = ? AND paid_at IS NULL
    `).get(tableNumber) as any;

    res.json({ 
      tableNumber: parseInt(tableNumber), 
      unpaidTotal: result.unpaid_total 
    });
  } catch (error) {
    console.error('Error calculating unpaid total:', error);
    res.status(500).json({ error: 'Failed to calculate unpaid total' });
  }
});

// POST /api/tables/:tableNumber/mark-paid - Mark all unpaid orders as paid (waiter only)
router.post('/:tableNumber/mark-paid', authenticate, authorize('waiter', 'kitchen', 'admin'), (req: Request, res: Response) => {
  try {
    const { tableNumber } = req.params;

    const result = db.prepare(`
      UPDATE orders
      SET paid_at = datetime('now')
      WHERE table_number = ? AND paid_at IS NULL
    `).run(tableNumber);

    res.json({ 
      success: true, 
      ordersPaid: result.changes,
      message: `Marcate ${result.changes} comenzi ca plătite` 
    });
  } catch (error) {
    console.error('Error marking orders as paid:', error);
    res.status(500).json({ error: 'Failed to mark orders as paid' });
  }
});

export default router;
