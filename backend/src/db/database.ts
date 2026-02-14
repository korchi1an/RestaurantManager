import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import logger from '../utils/logger';

// Load environment variables from .env file
dotenv.config();

// Use DATABASE_URL environment variable for PostgreSQL connection
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
});

// Handle pool errors
pool.on('error', (err, client) => {
  logger.error('DATABASE - Unexpected error on idle client', { error: err });
});

// Handle pool connection events
pool.on('connect', (client) => {
  logger.info('DATABASE - New client connected to pool');
});

pool.on('acquire', (client) => {
  logger.debug('DATABASE - Client acquired from pool');
});

pool.on('remove', (client) => {
  logger.info('DATABASE - Client removed from pool');
});

// Test connection on startup
const testConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('DATABASE - Connection test successful');
    return true;
  } catch (error) {
    logger.error('DATABASE - Connection test failed', { error });
    return false;
  }
};

// Create tables
const initDb = async () => {
  // Test connection first
  const connectionOk = await testConnection();
  if (!connectionOk) {
    throw new Error('Failed to connect to database');
  }

  const client = await pool.connect();
  
  try {
    // Employees Table for Kitchen, Waiter, and Admin authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK(role IN ('kitchen', 'waiter', 'admin')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    // Customers Table for customer authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    // Drop old users table if it exists (migration from old schema)
    await client.query(`DROP TABLE IF EXISTS users CASCADE`);

    // Create users table as an alias/view of employees for backward compatibility
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        role VARCHAR(50) NOT NULL CHECK(role IN ('kitchen', 'waiter', 'admin', 'customer')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    // Table Assignments - which waiters are assigned to which tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS table_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        table_number INTEGER NOT NULL,
        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (table_number) REFERENCES tables(table_number) ON DELETE CASCADE,
        UNIQUE(user_id, table_number)
      )
    `);

    // Waiter Assignments - another name for table assignments (for compatibility)
    await client.query(`
      CREATE TABLE IF NOT EXISTS waiter_assignments (
        id SERIAL PRIMARY KEY,
        waiter_id INTEGER NOT NULL,
        table_number INTEGER NOT NULL,
        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (waiter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (table_number) REFERENCES tables(table_number) ON DELETE CASCADE,
        UNIQUE(waiter_id, table_number)
      )
    `);

    // Menu Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        description TEXT
      )
    `);

    // Tables Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tables (
        id SERIAL PRIMARY KEY,
        table_number INTEGER NOT NULL UNIQUE,
        capacity INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Available',
        waiter_id INTEGER,
        FOREIGN KEY (waiter_id) REFERENCES employees(id) ON DELETE SET NULL
      )
    `);

    // Sessions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        table_number INTEGER NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        customer_id VARCHAR(255),
        customer_name VARCHAR(255),
        created_at TIMESTAMP NOT NULL,
        last_activity TIMESTAMP NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        FOREIGN KEY (table_number) REFERENCES tables(table_number)
      )
    `);

    // Add customer_name column if it doesn't exist (migration for existing databases)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'sessions' AND column_name = 'customer_name'
        ) THEN
          ALTER TABLE sessions ADD COLUMN customer_name VARCHAR(255);
        END IF;
      END $$;
    `);

    // Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number INTEGER NOT NULL,
        session_id VARCHAR(255),
        table_number INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        total_price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        paid_at TIMESTAMP,
        FOREIGN KEY (table_number) REFERENCES tables(table_number)
      )
    `);

    // Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        menu_item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
      )
    `);

    // Insert seed data for menu items if empty
    const menuCountResult = await client.query('SELECT COUNT(*) as count FROM menu_items');
    const menuCount = parseInt(menuCountResult.rows[0].count);
    
    if (menuCount === 0) {
      const menuItems = [
        // Appetizers
        ['Bruschetta', 'Appetizers', 8.99, 'Toasted bread with tomatoes, garlic, and basil'],
        ['Calamari', 'Appetizers', 12.99, 'Crispy fried squid with marinara sauce'],
        ['Mozzarella Sticks', 'Appetizers', 9.99, 'Golden fried mozzarella with marinara'],
        ['Caesar Salad', 'Appetizers', 10.99, 'Fresh romaine with Caesar dressing and croutons'],
        
        // Main Courses
        ['Margherita Pizza', 'Main Courses', 14.99, 'Classic tomato, mozzarella, and basil'],
        ['Pepperoni Pizza', 'Main Courses', 16.99, 'Loaded with pepperoni and cheese'],
        ['Spaghetti Carbonara', 'Main Courses', 15.99, 'Pasta with bacon, egg, and parmesan'],
        ['Grilled Salmon', 'Main Courses', 22.99, 'Atlantic salmon with vegetables'],
        ['Ribeye Steak', 'Main Courses', 28.99, 'Prime ribeye with garlic butter'],
        ['Chicken Parmesan', 'Main Courses', 18.99, 'Breaded chicken with marinara and cheese'],
        
        // Desserts
        ['Tiramisu', 'Desserts', 7.99, 'Classic Italian coffee-flavored dessert'],
        ['Chocolate Lava Cake', 'Desserts', 8.99, 'Warm chocolate cake with molten center'],
        ['Cheesecake', 'Desserts', 7.99, 'New York style cheesecake'],
        
        // Beverages
        ['Coca Cola', 'Beverages', 2.99, 'Classic soft drink'],
        ['Iced Tea', 'Beverages', 2.99, 'Freshly brewed iced tea'],
        ['Coffee', 'Beverages', 3.49, 'Freshly brewed coffee'],
        ['Red Wine', 'Beverages', 8.99, 'House red wine'],
        ['White Wine', 'Beverages', 8.99, 'House white wine']
      ];

      for (const item of menuItems) {
        await client.query(
          `INSERT INTO menu_items (name, category, price, description) VALUES ($1, $2, $3, $4)`,
          item
        );
      }

      logger.info('DATABASE - Seeded menu items');
    }

    // Insert seed data for tables if empty
    const tableCountResult = await client.query('SELECT COUNT(*) as count FROM tables');
    const tableCount = parseInt(tableCountResult.rows[0].count);
    
    if (tableCount === 0) {
      for (let i = 1; i <= 10; i++) {
        await client.query(
          `INSERT INTO tables (table_number, capacity, status) VALUES ($1, $2, $3)`,
          [i, i <= 6 ? 4 : 6, 'Available']
        );
      }

      logger.info('DATABASE - Seeded tables');
    }

    // Insert default employees if empty (for testing)
    const employeeCountResult = await client.query('SELECT COUNT(*) as count FROM employees');
    const employeeCount = parseInt(employeeCountResult.rows[0].count);
    
    if (employeeCount === 0) {
      // Import bcrypt for real password hashing
      const bcrypt = require('bcrypt');
      
      // Hash passwords properly
      const kitchenHash = await bcrypt.hash('kitchen123', 10);
      const waiterHash = await bcrypt.hash('waiter123', 10);
      const adminHash = await bcrypt.hash('admin123', 10);
      
      const employees = [
        ['Chef', kitchenHash, 'kitchen'],
        ['Ana', waiterHash, 'waiter'],
        ['Mihai', waiterHash, 'waiter'],
        ['Admin', adminHash, 'admin']
      ];

      for (const employee of employees) {
        await client.query(
          `INSERT INTO employees (username, password_hash, role, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          employee
        );
      }

      logger.info('DATABASE - Seeded default employees', { 
        employees: ['Chef (kitchen)', 'Ana (waiter)', 'Mihai (waiter)', 'Admin (admin)'] 
      });
      logger.warn('DATABASE - Default passwords in use - change in production!');
    }

    // Copy employees to users table for backward compatibility
    const userCountResult = await client.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(userCountResult.rows[0].count);
    
    if (userCount === 0) {
      await client.query(`
        INSERT INTO users (id, name, role, created_at, last_login)
        SELECT id, username, role, created_at, last_login
        FROM employees
      `);
      
      logger.info('DATABASE - Copied employees to users table');
    }

    // Assign waiters to tables (each waiter gets 5 tables)
    const assignmentCountResult = await client.query('SELECT COUNT(*) as count FROM table_assignments');
    const assignmentCount = parseInt(assignmentCountResult.rows[0].count);
    
    if (assignmentCount === 0) {
      // Get waiter IDs
      const waitersResult = await client.query(`SELECT id, name FROM users WHERE role = 'waiter' ORDER BY id`);
      const waiters = waitersResult.rows;
      
      if (waiters.length > 0) {
        // Assign tables to waiters (Ana gets tables 1-5, Mihai gets tables 6-10)
        for (let i = 1; i <= 10; i++) {
          const waiter = waiters[(i - 1) % waiters.length]; // Round-robin assignment
          await client.query(
            `INSERT INTO table_assignments (user_id, table_number, assigned_at) VALUES ($1, $2, CURRENT_TIMESTAMP)`,
            [waiter.id, i]
          );
          await client.query(
            `INSERT INTO waiter_assignments (waiter_id, table_number, assigned_at) VALUES ($1, $2, CURRENT_TIMESTAMP)`,
            [waiter.id, i]
          );
        }
        
        logger.info('DATABASE - Assigned tables to waiters');
      }
    }

    logger.info('DATABASE - Database initialized successfully');
  } catch (error) {
    logger.error('DATABASE - Error initializing database', { error });
    throw error;
  } finally {
    client.release();
  }
};

initDb();

export { pool };
export default pool;

