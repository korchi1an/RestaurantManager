import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use environment variable for database path (for production persistent disk)
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../restaurant.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
const initDb = () => {
  // Menu Items Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT
    )
  `);

  // Tables Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number INTEGER NOT NULL UNIQUE,
      capacity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Available',
      waiter_id INTEGER,
      FOREIGN KEY (waiter_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Sessions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      table_number INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      customer_id TEXT,
      created_at TEXT NOT NULL,
      last_activity TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (table_number) REFERENCES tables(table_number)
    )
  `);

  // Orders Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number INTEGER NOT NULL,
      session_id TEXT,
      table_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      total_price REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      paid_at TEXT,
      FOREIGN KEY (table_number) REFERENCES tables(table_number)
    )
  `);

  // Order Items Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    )
  `);

  // Users Table for Kitchen and Waiter authentication
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('kitchen', 'waiter', 'admin', 'customer')),
      full_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT
    )
  `);

  // Insert seed data for menu items if empty
  const menuCount = db.prepare('SELECT COUNT(*) as count FROM menu_items').get() as { count: number };
  
  if (menuCount.count === 0) {
    const insertMenuItem = db.prepare(`
      INSERT INTO menu_items (name, category, price, description)
      VALUES (?, ?, ?, ?)
    `);

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

    menuItems.forEach(item => {
      insertMenuItem.run(item[0], item[1], item[2], item[3]);
    });

    console.log('✓ Seeded menu items');
  }

  // Insert seed data for tables if empty
  const tableCount = db.prepare('SELECT COUNT(*) as count FROM tables').get() as { count: number };
  
  if (tableCount.count === 0) {
    const insertTable = db.prepare(`
      INSERT INTO tables (table_number, capacity, status)
      VALUES (?, ?, ?)
    `);

    for (let i = 1; i <= 10; i++) {
      insertTable.run(i, i <= 6 ? 4 : 6, 'Available');
    }

    console.log('✓ Seeded tables');
  }

  // Insert default users if empty (for testing)
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  
  if (userCount.count === 0) {
    // Create default test accounts with temporary hashing (matching auth.ts temporary implementation)
    // Note: In production, use real bcrypt after npm install!
    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, role, full_name, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);

    // Default kitchen account (username: kitchen, password: kitchen123)
    insertUser.run('kitchen', 'temp_hashed_kitchen123', 'kitchen', 'Kitchen Staff');
    
    // Default waiter accounts (username: waiter1/waiter2, password: waiter123)
    insertUser.run('waiter1', 'temp_hashed_waiter123', 'waiter', 'Waiter One');
    insertUser.run('waiter2', 'temp_hashed_waiter123', 'waiter', 'Waiter Two');
    
    // Default admin account (username: admin, password: admin123)
    insertUser.run('admin', 'temp_hashed_admin123', 'admin', 'Administrator');

    console.log('✓ Seeded default users:');
    console.log('  - kitchen / kitchen123 (Kitchen Staff)');
    console.log('  - waiter1 / waiter123 (Waiter One)');
    console.log('  - waiter2 / waiter123 (Waiter Two)');
    console.log('  - admin / admin123 (Administrator)');
    console.log('  ⚠️  Change these passwords in production!');
  }

  console.log('✓ Database initialized');
};

initDb();

export default db;
