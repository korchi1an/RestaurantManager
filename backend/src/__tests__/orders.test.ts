import request from 'supertest';
import app from '../server';
import db from '../db/database';

describe('Order Management API', () => {
  let customerToken: string;
  let waiterToken: string;
  let sessionId: string;
  const tableNumber = 7;

  beforeAll(async () => {
    // Register customer and get token
    const customerResponse = await request(app)
      .post('/api/auth/register-customer')
      .send({
        email: 'ordercustomer@test.com',
        password: 'password123',
        fullName: 'Order Test Customer'
      });
    customerToken = customerResponse.body.token;

    // Login as waiter
    const waiterResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'waiter1',
        password: 'waiter123'
      });
    waiterToken = waiterResponse.body.token;

    // Create a session
    const sessionResponse = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        tableNumber,
        deviceId: 'test-device-orders'
      });
    sessionId = sessionResponse.body.sessionId;
  });

  describe('POST /api/orders', () => {
    test('should create an order successfully', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: [
            { menuItemId: 1, quantity: 2 },
            { menuItemId: 2, quantity: 1 }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('orderNumber');
      expect(response.body.orderNumber).toBe(1); // First order in session
      expect(response.body.tableNumber).toBe(tableNumber);
      expect(response.body.status).toBe('Pending');
      expect(response.body.totalPrice).toBeGreaterThan(0);
    });

    test('should increment order number for multiple orders in same session', async () => {
      // Create first order
      const order1 = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: [{ menuItemId: 1, quantity: 1 }]
        });

      // Create second order
      const order2 = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: [{ menuItemId: 2, quantity: 1 }]
        });

      expect(order2.body.orderNumber).toBe(order1.body.orderNumber + 1);
    });

    test('should reject order without session', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          tableNumber,
          items: [{ menuItemId: 1, quantity: 1 }]
        });

      expect(response.status).toBe(400);
    });

    test('should reject order with empty items', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: []
        });

      expect(response.status).toBe(400);
    });

    test('should calculate total price correctly', async () => {
      // Get menu item prices
      const menuResponse = await request(app).get('/api/menu');
      const menuItem1 = menuResponse.body.find((item: any) => item.id === 1);
      const menuItem2 = menuResponse.body.find((item: any) => item.id === 2);

      const quantity1 = 2;
      const quantity2 = 3;
      const expectedTotal = (menuItem1.price * quantity1) + (menuItem2.price * quantity2);

      const response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: [
            { menuItemId: 1, quantity: quantity1 },
            { menuItemId: 2, quantity: quantity2 }
          ]
        });

      expect(response.body.totalPrice).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe('GET /api/orders', () => {
    test('should retrieve all orders', async () => {
      const response = await request(app)
        .get('/api/orders');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should filter orders by table', async () => {
      const response = await request(app)
        .get(`/api/orders?tableNumber=${tableNumber}`);

      expect(response.status).toBe(200);
      response.body.forEach((order: any) => {
        expect(order.tableNumber).toBe(tableNumber);
      });
    });
  });

  describe('GET /api/orders/:id', () => {
    let orderId: number;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: [{ menuItemId: 1, quantity: 1 }]
        });
      orderId = response.body.id;
    });

    test('should retrieve single order by id', async () => {
      const response = await request(app)
        .get(`/api/orders/${orderId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(orderId);
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    test('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .get('/api/orders/99999');

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/orders/:id/status', () => {
    let orderId: number;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: [{ menuItemId: 1, quantity: 1 }]
        });
      orderId = response.body.id;
    });

    test('should update order status', async () => {
      const response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .send({ status: 'Preparing' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('Preparing');
    });

    test('should validate status values', async () => {
      const response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .send({ status: 'InvalidStatus' });

      expect(response.status).toBe(400);
    });

    test('should follow correct status flow', async () => {
      // Pending -> Preparing
      let response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .send({ status: 'Preparing' });
      expect(response.body.status).toBe('Preparing');

      // Preparing -> Ready
      response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .send({ status: 'Ready' });
      expect(response.body.status).toBe('Ready');

      // Ready -> Served
      response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .send({ status: 'Served' });
      expect(response.body.status).toBe('Served');
    });
  });

  describe('Payment Flow', () => {
    let testTableNumber: number;

    beforeEach(async () => {
      testTableNumber = Math.floor(Math.random() * 1000) + 100; // Random table for isolation
      
      // Create a new session for payment tests
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          tableNumber: testTableNumber,
          deviceId: 'payment-test-device'
        });

      const newSessionId = sessionResponse.body.sessionId;

      // Create some unpaid orders
      await request(app)
        .post('/api/orders')
        .send({
          sessionId: newSessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 1, quantity: 2 }]
        });

      await request(app)
        .post('/api/orders')
        .send({
          sessionId: newSessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 2, quantity: 1 }]
        });
    });

    test('should get unpaid total for table', async () => {
      const response = await request(app)
        .get(`/api/tables/${testTableNumber}/unpaid-total`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('unpaidTotal');
      expect(response.body.unpaidTotal).toBeGreaterThan(0);
    });

    test('waiter should be able to mark table as paid', async () => {
      const response = await request(app)
        .post(`/api/tables/${testTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('success');
      expect(response.body.ordersMarkedPaid).toBeGreaterThan(0);
    });

    test('unpaid total should be zero after payment', async () => {
      // Mark as paid
      await request(app)
        .post(`/api/tables/${testTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);

      // Check unpaid total
      const response = await request(app)
        .get(`/api/tables/${testTableNumber}/unpaid-total`);

      expect(response.body.unpaidTotal).toBe(0);
    });

    test('should not mark already paid orders', async () => {
      // Mark as paid first time
      const firstResponse = await request(app)
        .post(`/api/tables/${testTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);

      const firstCount = firstResponse.body.ordersMarkedPaid;

      // Try to mark as paid again
      const secondResponse = await request(app)
        .post(`/api/tables/${testTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);

      expect(secondResponse.body.ordersMarkedPaid).toBe(0);
      expect(firstCount).toBeGreaterThan(0);
    });
  });

  describe('Session Order History', () => {
    test('should retrieve all orders for a session', async () => {
      const response = await request(app)
        .get(`/api/sessions/${sessionId}/orders`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // All orders should have the same session ID
      response.body.forEach((order: any) => {
        expect(order.sessionId).toBe(sessionId);
      });
    });

    test('should return orders with order numbers', async () => {
      const response = await request(app)
        .get(`/api/sessions/${sessionId}/orders`);

      response.body.forEach((order: any) => {
        expect(order).toHaveProperty('orderNumber');
        expect(typeof order.orderNumber).toBe('number');
      });
    });
  });
});
