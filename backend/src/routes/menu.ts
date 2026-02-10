import { Router, Request, Response } from 'express';
import pool from '../db/database';
import { MenuItem } from '../models/types';

const router = Router();

// GET /api/menu - Get all menu items
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM menu_items ORDER BY category, name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

// GET /api/menu/categories - Get all categories
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT DISTINCT category FROM menu_items ORDER BY category');
    res.json(result.rows.map(row => row.category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/menu/:id - Get a specific menu item
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM menu_items WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
});

export default router;

