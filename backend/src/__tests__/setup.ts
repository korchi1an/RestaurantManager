import db from '../db/database';

// Setup runs before all tests
beforeAll(() => {
  console.log('Setting up test environment...');
});

// Cleanup after all tests
afterAll(() => {
  console.log('Cleaning up test environment...');
  db.close();
});

// Clean up test data before each test
beforeEach(() => {
  // Clean up any test users
  db.prepare('DELETE FROM users WHERE email LIKE ?').run('%test%');
});
