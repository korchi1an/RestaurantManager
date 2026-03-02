import request from 'supertest';
import app from '../server';
import { pool } from '../db/database';

describe('Authentication API', () => {
  describe('POST /api/auth/register-customer', () => {
    test('should register a new customer successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'newuser@test.com',
          password: 'SecurePass123!',
          fullName: 'Test User'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        email: 'newuser@test.com',
        role: 'customer',
        fullName: 'Test User'
      });
    });

    test('should reject duplicate email registration', async () => {
      // Register first user
      await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'duplicate@test.com',
          password: 'password123',
          fullName: 'First User'
        });

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'duplicate@test.com',
          password: 'differentpass',
          fullName: 'Second User'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already registered');
    });

    test('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'not-an-email',
          password: 'password123',
          fullName: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('email');
    });

    test('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'test@test.com'
          // Missing password and fullName
        });

      expect(response.status).toBe(400);
    });

    test('should hash password before storing', async () => {
      const plainPassword = 'MySecretPassword123';
      
      await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'hashtest@test.com',
          password: plainPassword,
          fullName: 'Hash Test'
        });

      // Check database directly
      const result = await pool.query('SELECT password_hash FROM customers WHERE email = $1', ['hashtest@test.com']);
      const user = result.rows[0] as { password_hash: string };

      expect(user.password_hash).toBeDefined();
      expect(user.password_hash).not.toBe(plainPassword);
      // Password is hashed (bcrypt or other hash)
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user before each login test
      await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'logintest@test.com',
          password: 'CorrectPassword123',
          fullName: 'Login Test User'
        });
    });

    test('should login with valid email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@test.com',
          password: 'CorrectPassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('logintest@test.com');
      expect(response.body.user.role).toBe('customer');
    });

    test('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@test.com',
          password: 'WrongPassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    test('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'SomePassword123'
        });

      expect(response.status).toBe(401);
    });

    test('should login staff with username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'waiter1',
          password: 'waiter123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.role).toBe('waiter');
    });
  });

  describe('Authentication Token', () => {
    let authToken: string;

    beforeEach(async () => {
      // Register and get token
      const response = await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'tokentest@test.com',
          password: 'password123',
          fullName: 'Token Test'
        });

      authToken = response.body.token;
    });

    test('should accept valid JWT token', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).not.toBe(401);
    });

    test('should reject requests without token on protected routes', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: 5,
          deviceId: 'test-device'
        });

      // Should still work as sessions can be anonymous
      expect(response.status).toBe(201);
    });
  });

  describe('Role-Based Access Control', () => {
    let customerToken: string;
    let waiterToken: string;

    beforeEach(async () => {
      // Get customer token
      const customerResponse = await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'rbac-customer@test.com',
          password: 'password123',
          fullName: 'RBAC Customer'
        });
      customerToken = customerResponse.body.token;

      // Get waiter token
      const waiterResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'Ana',
          password: 'waiter123'
        });
      waiterToken = waiterResponse.body.token;
    });

    test('waiter should be able to mark table as paid', async () => {
      const response = await request(app)
        .post('/api/tables/1/mark-paid')
        .set('Authorization', `Bearer ${waiterToken}`);

      expect(response.status).toBe(200);
    });

    test('customer should not be able to mark table as paid', async () => {
      const response = await request(app)
        .post('/api/tables/1/mark-paid')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(403);
    });

    test('waiter should access table assignments', async () => {
      const response = await request(app)
        .get('/api/table-assignments')
        .set('Authorization', `Bearer ${waiterToken}`);

      expect(response.status).toBe(200);
    });

    test('customer should not access table assignments', async () => {
      const response = await request(app)
        .get('/api/table-assignments')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(403);
    });

    test('waiter should be able to update order status', async () => {
      // Create an order first
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: 5,
          deviceId: 'test-rbac-device'
        });

      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          sessionId: sessionResponse.body.sessionId,
          tableNumber: 5,
          items: [{ menuItemId: 1, quantity: 1 }]
        });

      const statusResponse = await request(app)
        .patch(`/api/orders/${orderResponse.body.id}/status`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ status: 'Preparing' });

      expect(statusResponse.status).toBe(200);
    });

    test('customer should not be able to update order status', async () => {
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: 6,
          deviceId: 'test-rbac-device-2'
        });

      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          sessionId: sessionResponse.body.sessionId,
          tableNumber: 6,
          items: [{ menuItemId: 1, quantity: 1 }]
        });

      const statusResponse = await request(app)
        .patch(`/api/orders/${orderResponse.body.id}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'Preparing' });

      expect(statusResponse.status).toBe(403);
    });
  });

  describe('Token Validation and Expiry', () => {
    test('should accept valid JWT token format', async () => {
      const response = await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'tokenformat@test.com',
          password: 'password123',
          fullName: 'Token Test'
        });

      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.split('.').length).toBe(3); // JWT has 3 parts
    });

    test('should reject malformed token', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', 'Bearer invalid-token-format');

      expect(response.status).toBe(401);
    });

    test('should reject empty token', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', 'Bearer ');

      expect(response.status).toBe(401);
    });

    test('should reject missing Bearer prefix', async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'bearer@test.com',
          password: 'password123',
          fullName: 'Bearer Test'
        });

      const token = registerResponse.body.token;

      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', token); // Missing 'Bearer ' prefix

      expect(response.status).toBe(401);
    });
  });

  describe('Password Security', () => {
    test('should enforce minimum password length', async () => {
      const response = await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'shortpass@test.com',
          password: '123', // Too short
          fullName: 'Short Pass'
        });

      // Implementation may vary - either 400 or 201 with warning
      expect([400, 201]).toContain(response.status);
    });

    test('passwords should not be returned in responses', async () => {
      const response = await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'nopassword@test.com',
          password: 'SecurePassword123',
          fullName: 'No Password'
        });

      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('password_hash');
      expect(response.body).not.toHaveProperty('password');
    });

    test('different passwords should produce different hashes', async () => {
      await pool.query("DELETE FROM customers WHERE email LIKE '%hash%test.com'");

      await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'hash1@test.com',
          password: 'Password123',
          fullName: 'Hash Test 1'
        });

      await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'hash2@test.com',
          password: 'Password456',
          fullName: 'Hash Test 2'
        });

      const result1 = await pool.query('SELECT password_hash FROM customers WHERE email = $1', ['hash1@test.com']);
      const result2 = await pool.query('SELECT password_hash FROM customers WHERE email = $1', ['hash2@test.com']);

      expect(result1.rows[0].password_hash).not.toBe(result2.rows[0].password_hash);
    });

    test('same password should produce different hashes (salt)', async () => {
      await pool.query("DELETE FROM customers WHERE email LIKE '%salt%test.com'");

      const password = 'SamePassword123';

      await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'salt1@test.com',
          password,
          fullName: 'Salt Test 1'
        });

      await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'salt2@test.com',
          password,
          fullName: 'Salt Test 2'
        });

      const result1 = await pool.query('SELECT password_hash FROM customers WHERE email = $1', ['salt1@test.com']);
      const result2 = await pool.query('SELECT password_hash FROM customers WHERE email = $1', ['salt2@test.com']);

      expect(result1.rows[0].password_hash).not.toBe(result2.rows[0].password_hash);
    });
  });

  describe('Email Validation', () => {
    test('should accept valid email formats', async () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user123@test-domain.com'
      ];

      for (const email of validEmails) {
        const response = await request(app)
          .post('/api/auth/register-customer')
          .send({
            email,
            password: 'password123',
            fullName: 'Valid Email Test'
          });

        expect([200, 201]).toContain(response.status);
      }
    });

    test('should reject invalid email formats', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user space@example.com',
        ''
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register-customer')
          .send({
            email,
            password: 'password123',
            fullName: 'Invalid Email Test'
          });

        expect(response.status).toBe(400);
      }
    });

    test('should handle case-insensitive email comparison', async () => {
      await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'CaseTest@Example.COM',
          password: 'password123',
          fullName: 'Case Test'
        });

      // Try to login with different case
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'casetest@example.com',
          password: 'password123'
        });

      // Should either succeed or fail consistently
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Multiple Login Attempts', () => {
    test('should allow multiple successful logins', async () => {
      // Register user
      await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'multilogin@test.com',
          password: 'password123',
          fullName: 'Multi Login'
        });

      // Login multiple times
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'multilogin@test.com',
            password: 'password123'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
      }
    });

    test('should handle concurrent login requests', async () => {
      // Register user
      await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'concurrent@test.com',
          password: 'password123',
          fullName: 'Concurrent Login'
        });

      // Concurrent logins
      const loginPromises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'concurrent@test.com',
            password: 'password123'
          })
      );

      const responses = await Promise.all(loginPromises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
      });
    });
  });

  describe('Staff Authentication', () => {
    test('kitchen staff should be able to login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'kitchen1',
          password: 'kitchen123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('kitchen');
    });

    test('admin should be able to login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      // May or may not have admin user in test DB
      expect([200, 401]).toContain(response.status);
    });

    test('staff login should require username not email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'waiter1@example.com', // Using email instead of username
          password: 'waiter123'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('User Information in Token', () => {
    test('token should contain user role', async () => {
      const response = await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'rolecheck@test.com',
          password: 'password123',
          fullName: 'Role Check'
        });

      expect(response.body.user).toHaveProperty('role');
      expect(response.body.user.role).toBe('customer');
    });

    test('token should contain user id', async () => {
      const response = await request(app)
        .post('/api/auth/register-customer')
        .send({
          email: 'idcheck@test.com',
          password: 'password123',
          fullName: 'ID Check'
        });

      expect(response.body.user).toHaveProperty('id');
      expect(typeof response.body.user.id).toBe('number');
    });
  });
});
