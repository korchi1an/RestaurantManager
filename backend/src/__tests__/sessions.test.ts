import request from 'supertest';
import app from '../server';
import { pool } from '../db/database';

describe('Session Management API', () => {
  const testTableNumber = 3;
  const testDeviceId = 'test-device-sessions';

  describe('POST /api/sessions - Create Session', () => {
    test('should create a new session successfully', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: testDeviceId
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body.tableNumber).toBe(testTableNumber);
      expect(response.body.deviceId).toBe(testDeviceId);
      expect(response.body).toHaveProperty('createdAt');
    });

    test('should create session with customer information', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-with-customer',
          customerId: '123',
          customerName: 'Test Customer'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('sessionId');
      
      // Verify session was stored with customer info
      const sessionResult = await pool.query(
        'SELECT * FROM sessions WHERE id = $1',
        [response.body.sessionId]
      );
      
      expect(sessionResult.rows[0].customer_id).toBe('123');
      expect(sessionResult.rows[0].customer_name).toBe('Test Customer');
    });

    test('should reject session without table number', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          deviceId: testDeviceId
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject session without device ID', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should generate unique session IDs', async () => {
      const response1 = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-1'
        });

      const response2 = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-2'
        });

      expect(response1.body.sessionId).not.toBe(response2.body.sessionId);
    });

    test('should allow multiple sessions for same table', async () => {
      const response1 = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-multi-1'
        });

      const response2 = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-multi-2'
        });

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.sessionId).not.toBe(response2.body.sessionId);
    });
  });

  describe('GET /api/sessions/table/:tableNumber - Get Sessions by Table', () => {
    let sessionId1: string;
    let sessionId2: string;

    beforeEach(async () => {
      // Create two sessions for the same table
      const response1 = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-lookup-1'
        });
      sessionId1 = response1.body.sessionId;

      const response2 = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-lookup-2'
        });
      sessionId2 = response2.body.sessionId;
    });

    test('should retrieve all active sessions for a table', async () => {
      const response = await request(app)
        .get(`/api/sessions/table/${testTableNumber}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      
      const sessionIds = response.body.map((s: any) => s.id);
      expect(sessionIds).toContain(sessionId1);
      expect(sessionIds).toContain(sessionId2);
    });

    test('should include order count and total amount', async () => {
      const response = await request(app)
        .get(`/api/sessions/table/${testTableNumber}`);

      expect(response.status).toBe(200);
      
      response.body.forEach((session: any) => {
        expect(session).toHaveProperty('orderCount');
        expect(session).toHaveProperty('totalAmount');
        expect(typeof session.orderCount).toBe('number');
        expect(typeof session.totalAmount).toBe('number');
      });
    });

    test('should only return active sessions', async () => {
      // End one session
      await request(app).delete(`/api/sessions/${sessionId1}`);

      const response = await request(app)
        .get(`/api/sessions/table/${testTableNumber}`);

      expect(response.status).toBe(200);
      
      const sessionIds = response.body.map((s: any) => s.id);
      expect(sessionIds).not.toContain(sessionId1);
      expect(sessionIds).toContain(sessionId2);
    });

    test('should return empty array for table with no sessions', async () => {
      const response = await request(app)
        .get('/api/sessions/table/999');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('GET /api/sessions/:sessionId - Get Session Details', () => {
    let sessionId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-details'
        });
      sessionId = response.body.sessionId;
    });

    test('should retrieve session details', async () => {
      const response = await request(app)
        .get(`/api/sessions/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(sessionId);
      expect(response.body.tableNumber).toBe(testTableNumber);
      expect(response.body.isActive).toBe(true);
      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('orderCount');
      expect(response.body).toHaveProperty('totalAmount');
    });

    test('should include orders in session details', async () => {
      // Create an order for the session
      await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 1, quantity: 2 }]
        });

      const response = await request(app)
        .get(`/api/sessions/${sessionId}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.orders)).toBe(true);
      expect(response.body.orders.length).toBeGreaterThan(0);
      expect(response.body.orderCount).toBe(response.body.orders.length);
    });

    test('should calculate total amount correctly', async () => {
      // Create multiple orders
      const order1 = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 1, quantity: 1 }]
        });

      const order2 = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 2, quantity: 1 }]
        });

      const expectedTotal = order1.body.totalPrice + order2.body.totalPrice;

      const response = await request(app)
        .get(`/api/sessions/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body.totalAmount).toBeCloseTo(expectedTotal, 2);
    });

    test('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/non-existent-session-id');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/sessions/:sessionId/heartbeat - Session Activity', () => {
    let sessionId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-heartbeat'
        });
      sessionId = response.body.sessionId;
    });

    test('should update session activity timestamp', async () => {
      // Get initial last activity
      const initialSession = await pool.query(
        'SELECT last_activity FROM sessions WHERE id = $1',
        [sessionId]
      );
      const initialActivity = initialSession.rows[0].last_activity;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send heartbeat
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/heartbeat`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('lastActivity');

      // Check that last activity was updated
      const updatedSession = await pool.query(
        'SELECT last_activity FROM sessions WHERE id = $1',
        [sessionId]
      );
      const updatedActivity = updatedSession.rows[0].last_activity;

      expect(new Date(updatedActivity).getTime()).toBeGreaterThan(
        new Date(initialActivity).getTime()
      );
    });

    test('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .post('/api/sessions/non-existent-session/heartbeat');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/sessions/:sessionId - End Session', () => {
    let sessionId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-delete'
        });
      sessionId = response.body.sessionId;
    });

    test('should end session successfully', async () => {
      const response = await request(app)
        .delete(`/api/sessions/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify session is marked inactive
      const sessionResult = await pool.query(
        'SELECT is_active FROM sessions WHERE id = $1',
        [sessionId]
      );

      expect(sessionResult.rows[0].is_active).toBe(false);
    });

    test('ended session should not appear in active sessions', async () => {
      await request(app).delete(`/api/sessions/${sessionId}`);

      const response = await request(app)
        .get(`/api/sessions/table/${testTableNumber}`);

      const sessionIds = response.body.map((s: any) => s.id);
      expect(sessionIds).not.toContain(sessionId);
    });

    test('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .delete('/api/sessions/non-existent-session');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should not delete orders when session ends', async () => {
      // Create an order
      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 1, quantity: 1 }]
        });
      const orderId = orderResponse.body.id;

      // End session
      await request(app).delete(`/api/sessions/${sessionId}`);

      // Order should still exist
      const orderCheck = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
      expect(orderCheck.rows.length).toBe(1);
    });
  });

  describe('GET /api/sessions/:sessionId/orders - Session Orders', () => {
    let sessionId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-orders'
        });
      sessionId = response.body.sessionId;
    });

    test('should retrieve all orders for a session', async () => {
      // Create multiple orders
      await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 1, quantity: 1 }]
        });

      await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 2, quantity: 1 }]
        });

      const response = await request(app)
        .get(`/api/sessions/${sessionId}/orders`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      
      response.body.forEach((order: any) => {
        expect(order.sessionId).toBe(sessionId);
      });
    });

    test('should include order numbers', async () => {
      await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 1, quantity: 1 }]
        });

      const response = await request(app)
        .get(`/api/sessions/${sessionId}/orders`);

      expect(response.status).toBe(200);
      
      response.body.forEach((order: any) => {
        expect(order).toHaveProperty('orderNumber');
        expect(typeof order.orderNumber).toBe('number');
      });
    });

    test('should return empty array for session with no orders', async () => {
      const response = await request(app)
        .get(`/api/sessions/${sessionId}/orders`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('Session Lifecycle', () => {
    test('complete session lifecycle: create, use, and end', async () => {
      // Create session
      const createResponse = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-lifecycle'
        });
      
      expect(createResponse.status).toBe(201);
      const sessionId = createResponse.body.sessionId;

      // Create orders
      const order1 = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 1, quantity: 2 }]
        });
      expect(order1.status).toBe(201);

      // Update heartbeat
      const heartbeatResponse = await request(app)
        .post(`/api/sessions/${sessionId}/heartbeat`);
      expect(heartbeatResponse.status).toBe(200);

      // Get session details
      const detailsResponse = await request(app)
        .get(`/api/sessions/${sessionId}`);
      expect(detailsResponse.status).toBe(200);
      expect(detailsResponse.body.orderCount).toBe(1);

      // End session
      const endResponse = await request(app)
        .delete(`/api/sessions/${sessionId}`);
      expect(endResponse.status).toBe(200);

      // Verify session is inactive
      const sessionResult = await pool.query(
        'SELECT is_active FROM sessions WHERE id = $1',
        [sessionId]
      );
      expect(sessionResult.rows[0].is_active).toBe(false);
    });
  });
});
