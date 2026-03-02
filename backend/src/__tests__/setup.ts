import { pool } from '../db/database';

// Helper function to clean all test data
export async function cleanupTestData() {
  try {
    // Clean in reverse order of dependencies
    await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE session_id IN (SELECT id FROM sessions WHERE device_id LIKE '%test%'))");
    await pool.query("DELETE FROM orders WHERE session_id IN (SELECT id FROM sessions WHERE device_id LIKE '%test%')");
    await pool.query("DELETE FROM sessions WHERE device_id LIKE '%test%'");
    await pool.query("DELETE FROM customers WHERE email LIKE '%test%'");
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}

// Helper function to create test customer
export async function createTestCustomer(email: string, password: string, fullName: string) {
  const bcrypt = require('bcrypt');
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const result = await pool.query(`
    INSERT INTO customers (email, password_hash, full_name, created_at)
    VALUES ($1, $2, $3, NOW())
    RETURNING id, email, full_name as "fullName", 'customer' as role
  `, [email, hashedPassword, fullName]);
  
  return result.rows[0];
}

// Helper function to get test data counts for verification
export async function getTestDataCounts() {
  const sessions = await pool.query("SELECT COUNT(*) FROM sessions WHERE device_id LIKE '%test%'");
  const orders = await pool.query("SELECT COUNT(*) FROM orders WHERE session_id IN (SELECT id FROM sessions WHERE device_id LIKE '%test%')");
  const orderItems = await pool.query("SELECT COUNT(*) FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE session_id IN (SELECT id FROM sessions WHERE device_id LIKE '%test%'))");
  const customers = await pool.query("SELECT COUNT(*) FROM customers WHERE email LIKE '%test%'");
  
  return {
    sessions: parseInt(sessions.rows[0].count),
    orders: parseInt(orders.rows[0].count),
    orderItems: parseInt(orderItems.rows[0].count),
    customers: parseInt(customers.rows[0].count)
  };
}

// Setup runs before all tests
beforeAll(() => {
  console.log('Setting up test environment...');
});

// Cleanup after all tests
afterAll(async () => {
  console.log('Cleaning up test environment...');
  await cleanupTestData();
  await pool.end();
});

// Clean up test data before each test
beforeEach(async () => {
  await cleanupTestData();
});
