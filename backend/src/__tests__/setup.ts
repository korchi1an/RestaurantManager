import { pool } from '../db/database';

// Setup runs before all tests
beforeAll(() => {
  console.log('Setting up test environment...');
});

// Cleanup after all tests
afterAll(async () => {
  console.log('Cleaning up test environment...');
  await pool.end();
});

// Clean up test data before each test
beforeEach(async () => {
  // Clean up any test users
  await pool.query("DELETE FROM users WHERE email LIKE '%test%'");
});
