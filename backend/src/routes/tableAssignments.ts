import { Router, Response } from 'express';
import { pool } from '../db/database';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Get all table assignments
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.id,
        t.table_number,
        t.capacity,
        t.status,
        t.waiter_username,
        e.username as waiter_name
      FROM tables t
      LEFT JOIN employees e ON t.waiter_username = e.username
      ORDER BY t.table_number
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching table assignments:', error);
    res.status(500).json({ error: 'Failed to fetch table assignments' });
  }
});

// Get tables assigned to current waiter
router.get('/my-tables', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await pool.query(`
      SELECT 
        id,
        table_number,
        capacity,
        status,
        waiter_username
      FROM tables
      WHERE waiter_username = $1
      ORDER BY table_number
    `, [req.user.id]); // req.user.id contains username for employees

    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching waiter tables:', error);
    res.status(500).json({ error: 'Failed to fetch assigned tables' });
  }
});

// Assign table to waiter
router.patch('/:tableId/assign', async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;
    const { waiterId } = req.body; // waiterId is actually username

    if (!waiterId) {
      return res.status(400).json({ error: 'Waiter username is required' });
    }

    // Verify waiter exists and has correct role
    const waiterResult = await pool.query(`
      SELECT username, role FROM employees WHERE username = $1
    `, [waiterId]);

    if (waiterResult.rows.length === 0) {
      return res.status(404).json({ error: 'Waiter not found' });
    }

    const waiter = waiterResult.rows[0];

    if (waiter.role !== 'waiter') {
      return res.status(400).json({ error: 'User is not a waiter' });
    }

    // Update table assignment
    const updateResult = await pool.query(`
      UPDATE tables 
      SET waiter_username = $1
      WHERE id = $2
    `, [waiterId, tableId]);

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Get updated table info
    const tableResult = await pool.query(`
      SELECT 
        t.id,
        t.table_number,
        t.capacity,
        t.status,
        t.waiter_username,
        e.username as waiter_name
      FROM tables t
      LEFT JOIN employees e ON t.waiter_username = e.username
      WHERE t.id = $1
    `, [tableId]);

    res.json(tableResult.rows[0]);
  } catch (error: any) {
    console.error('Error assigning table:', error);
    res.status(500).json({ error: 'Failed to assign table' });
  }
});

// Unassign table from waiter
router.patch('/:tableId/unassign', async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    const result = await pool.query(`
      UPDATE tables 
      SET waiter_username = NULL
      WHERE id = $1
    `, [tableId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Get updated table info
    const tableResult = await pool.query(`
      SELECT 
        id,
        table_number,
        capacity,
        status,
        waiter_username
      FROM tables
      WHERE id = $1
    `, [tableId]);

    res.json(tableResult.rows[0]);
  } catch (error: any) {
    console.error('Error unassigning table:', error);
    res.status(500).json({ error: 'Failed to unassign table' });
  }
});

// Get all waiters (for assignment dropdown)
router.get('/waiters', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        username as id,
        username,
        username as full_name,
        role
      FROM employees
      WHERE role = 'waiter'
      ORDER BY username
    `);

    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching waiters:', error);
    res.status(500).json({ error: 'Failed to fetch waiters' });
  }
});

export default router;
