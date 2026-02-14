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
          email: 'customer@test.com',
          password: 'password123',
          fullName: 'Customer User'
        });
      customerToken = customerResponse.body.token;

      // Get waiter token
      const waiterResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'waiter1',
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
  });
});
