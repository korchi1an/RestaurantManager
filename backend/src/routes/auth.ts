import { Router, Request, Response } from 'express';
// TODO: Uncomment after npm install
// import bcrypt from 'bcrypt';
// import jwt from 'jsonwebtoken';
import { pool } from '../db/database';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production-PLEASE';

// Temporary implementations until bcrypt and jwt are installed
const bcrypt = {
  hash: async (password: string, rounds: number) => {
    // Temporary: just prefix with "hashed_" - NOT SECURE, only for testing
    return 'temp_hashed_' + password;
  },
  compare: async (password: string, hash: string) => {
    // Temporary: check if hash matches the temp format
    return hash === 'temp_hashed_' + password;
  }
};

const jwt = {
  sign: (payload: any, secret: string, options: any) => {
    // Temporary: create a simple token - NOT SECURE, only for testing
    return 'temp_token_' + JSON.stringify(payload);
  },
  verify: (token: string, secret: string) => {
    // Temporary: parse the simple token
    if (token.startsWith('temp_token_')) {
      return JSON.parse(token.replace('temp_token_', ''));
    }
    throw new Error('Invalid token');
  }
};

// Register new user (for kitchen/waiter staff only)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, role, full_name } = req.body;
    
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
    const existingUserResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(`
      INSERT INTO users (username, password_hash, role, full_name, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `, [username, hashedPassword, role, full_name || username]);

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
        role,
        full_name: full_name || username
      } 
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Register customer (public endpoint - no auth required)
router.post('/register-customer', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
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
    const existingUserResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user with customer role
    const result = await pool.query(`
      INSERT INTO users (email, password_hash, role, full_name, created_at)
      VALUES ($1, $2, 'customer', $3, NOW())
      RETURNING id
    `, [email, hashedPassword, full_name || email]);

    const userId = result.rows[0].id;

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, userId, email, role: 'customer' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ 
      token, 
      user: { 
        id: userId, 
        email, 
        role: 'customer',
        full_name: full_name || email
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
    const loginIdentifier = email || username;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Email/username and password are required' });
    }

    // Get user from database - try both email and username
    const result = await pool.query(`
      SELECT * FROM users WHERE email = $1 OR username = $1
    `, [loginIdentifier]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query(`
      UPDATE users SET last_login = NOW() WHERE id = $1
    `, [user.id]);

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
        role: user.role,
        full_name: user.full_name
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
    const result = await pool.query(`
      SELECT id, username, role, full_name, created_at, last_login
      FROM users WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// List all users (admin only - for now just return all)
router.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, username, role, full_name, created_at, last_login
      FROM users
      ORDER BY created_at DESC
    `);

    res.json({ users: result.rows });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

export default router;
