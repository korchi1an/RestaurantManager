import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/database';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production-PLEASE';

// Register new employee (for kitchen/waiter/admin staff only)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, role } = req.body;
    
    // Validation
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role are required' });
    }

    if (!['kitchen', 'waiter', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be kitchen, waiter, or admin' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username exists
    const existingUserResult = await pool.query('SELECT id FROM employees WHERE username = $1', [username]);
    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert employee
    const result = await pool.query(`
      INSERT INTO employees (username, password_hash, role, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id
    `, [username, hashedPassword, role]);

    const userId = result.rows[0].id;

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, userId, username, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ 
      token, 
      user: { 
        id: userId,
        username, 
        role
      } 
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Register customer (public endpoint - no auth required)
router.post('/register-customer', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name } = req.body;
    
    // Validation
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check if email exists
    const existingUserResult = await pool.query('SELECT id FROM customers WHERE email = $1', [email]);
    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert customer
    const result = await pool.query(`
      INSERT INTO customers (email, password_hash, name, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id
    `, [email, hashedPassword, full_name]);

    const userId = result.rows[0].id;

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, userId, email, role: 'customer', username: full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ 
      token, 
      user: { 
        id: userId, 
        email, 
        username: full_name,
        role: 'customer'
      } 
    });
  } catch (error: any) {
    console.error('Customer registration error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    let user: any = null;
    let isEmployee = false;

    // Try employee login (using username)
    if (username) {
      const result = await pool.query(`
        SELECT * FROM employees WHERE username = $1
      `, [username]);
      
      if (result.rows.length > 0) {
        user = result.rows[0];
        isEmployee = true;
      }
    }

    // Try customer login (using email)
    if (!user && email) {
      const result = await pool.query(`
        SELECT * FROM customers WHERE email = $1
      `, [email]);
      
      if (result.rows.length > 0) {
        user = result.rows[0];
        user.role = 'customer'; // Customers table doesn't have role column
        user.username = user.name; // Use name as username for frontend
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    if (isEmployee) {
      await pool.query(`
        UPDATE employees SET last_login = NOW() WHERE id = $1
      `, [user.id]);
    } else {
      await pool.query(`
        UPDATE customers SET last_login = NOW() WHERE id = $1
      `, [user.id]);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, userId: user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username,
        email: user.email,
        role: user.role
      } 
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user info (requires auth)
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    let user: any = null;
    
    // Check if customer or employee
    if (req.user.role === 'customer') {
      const result = await pool.query(`
        SELECT id, email, name as username, created_at, last_login
        FROM customers WHERE id = $1
      `, [req.user.id]);
      if (result.rows.length > 0) {
        user = { ...result.rows[0], role: 'customer' };
      }
    } else {
      const result = await pool.query(`
        SELECT id, username, role, created_at, last_login
        FROM employees WHERE id = $1
      `, [req.user.id]);
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// List all employees (admin only - for now just return all)
router.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, username, role, created_at, last_login
      FROM employees
      ORDER BY created_at DESC
    `);

    res.json({ users: result.rows });
  } catch (error) {
    console.error('List employees error:', error);
    res.status(500).json({ error: 'Failed to list employees' });
  }
});

export default router;
