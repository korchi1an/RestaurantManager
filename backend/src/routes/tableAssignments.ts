import { Router, Response } from 'express';
import db from '../db/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Get all table assignments
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const assignments = db.prepare(`
      SELECT 
        t.id,
        t.table_number,
        t.capacity,
        t.status,
        t.waiter_id,
        u.username as waiter_username,
        u.full_name as waiter_name
      FROM tables t
      LEFT JOIN users u ON t.waiter_id = u.id
      ORDER BY t.table_number
    `).all();

    res.json(assignments);
  } catch (error: any) {
    console.error('Error fetching table assignments:', error);
    res.status(500).json({ error: 'Failed to fetch table assignments' });
  }
});

// Get tables assigned to current waiter
router.get('/my-tables', (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const tables = db.prepare(`
      SELECT 
        id,
        table_number,
        capacity,
        status,
        waiter_id
      FROM tables
      WHERE waiter_id = ?
      ORDER BY table_number
    `).all(req.user.id);

    res.json(tables);
  } catch (error: any) {
    console.error('Error fetching waiter tables:', error);
    res.status(500).json({ error: 'Failed to fetch assigned tables' });
  }
});

// Assign table to waiter
router.patch('/:tableId/assign', (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;
    const { waiterId } = req.body;

    if (!waiterId) {
      return res.status(400).json({ error: 'Waiter ID is required' });
    }

    // Verify waiter exists and has correct role
    const waiter = db.prepare(`
      SELECT id, role FROM users WHERE id = ?
    `).get(waiterId) as any;

    if (!waiter) {
      return res.status(404).json({ error: 'Waiter not found' });
    }

    if (waiter.role !== 'waiter') {
      return res.status(400).json({ error: 'User is not a waiter' });
    }

    // Update table assignment
    const result = db.prepare(`
      UPDATE tables 
      SET waiter_id = ?
      WHERE id = ?
    `).run(waiterId, tableId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Get updated table info
    const updatedTable = db.prepare(`
      SELECT 
        t.id,
        t.table_number,
        t.capacity,
        t.status,
        t.waiter_id,
        u.username as waiter_username,
        u.full_name as waiter_name
      FROM tables t
      LEFT JOIN users u ON t.waiter_id = u.id
      WHERE t.id = ?
    `).get(tableId);

    res.json(updatedTable);
  } catch (error: any) {
    console.error('Error assigning table:', error);
    res.status(500).json({ error: 'Failed to assign table' });
  }
});

// Unassign table from waiter
router.patch('/:tableId/unassign', (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    const result = db.prepare(`
      UPDATE tables 
      SET waiter_id = NULL
      WHERE id = ?
    `).run(tableId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Get updated table info
    const updatedTable = db.prepare(`
      SELECT 
        id,
        table_number,
        capacity,
        status,
        waiter_id
      FROM tables
      WHERE id = ?
    `).get(tableId);

    res.json(updatedTable);
  } catch (error: any) {
    console.error('Error unassigning table:', error);
    res.status(500).json({ error: 'Failed to unassign table' });
  }
});

// Get all waiters (for assignment dropdown)
router.get('/waiters', (req: AuthRequest, res: Response) => {
  try {
    const waiters = db.prepare(`
      SELECT 
        id,
        username,
        full_name,
        role
      FROM users
      WHERE role = 'waiter'
      ORDER BY full_name
    `).all();

    res.json(waiters);
  } catch (error: any) {
    console.error('Error fetching waiters:', error);
    res.status(500).json({ error: 'Failed to fetch waiters' });
  }
});

export default router;
