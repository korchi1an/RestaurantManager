import { Pool } from 'pg';
import * as dotenv from 'dotenv';

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
});

// Create tables
const initDb = async () => {
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

      console.log('✓ Seeded menu items');
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

      console.log('✓ Seeded tables');
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

      console.log('✓ Seeded default employees:');
      console.log('  - Chef / kitchen123 (Kitchen)');
      console.log('  - Ana / waiter123 (Waiter)');
      console.log('  - Mihai / waiter123 (Waiter)');
      console.log('  - Admin / admin123 (Administrator)');
      console.log('  ⚠️  Change these passwords in production!');
    }

    console.log('✓ Database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

initDb();

export { pool };
export default pool;

