import { Router, Request, Response } from 'express';
import db from '../db/database';
import { MenuItem } from '../models/types';

const router = Router();

// GET /api/menu - Get all menu items
router.get('/', (req: Request, res: Response) => {
  try {
    const menuItems = db.prepare('SELECT * FROM menu_items ORDER BY category, name').all() as MenuItem[];
    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

// GET /api/menu/categories - Get all categories
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = db.prepare('SELECT DISTINCT category FROM menu_items ORDER BY category').all() as { category: string }[];
    res.json(categories.map(c => c.category));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/menu/:id - Get a specific menu item
router.get('/:id', (req: Request, res: Response) => {
  try {
    const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id) as MenuItem;
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
});

export default router;
