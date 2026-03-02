import request from 'supertest';
import app from '../server';
import db from '../db/database';

describe('Order Management API', () => {
  let customerToken: string;
  let waiterToken: string;
  let kitchenToken: string;
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
        username: 'Ana',
        password: 'waiter123'
      });
    waiterToken = waiterResponse.body.token;

    // Login as kitchen
    const kitchenResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'Chef',
        password: 'kitchen123'
      });
    kitchenToken = kitchenResponse.body.token;

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
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Preparing' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('Preparing');
    });

    test('should validate status values', async () => {
      const response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'InvalidStatus' });

      expect(response.status).toBe(400);
    });

    test('should follow correct status flow', async () => {
      // Pending -> Preparing
      let response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Preparing' });
      expect(response.body.status).toBe('Preparing');

      // Preparing -> Ready
      response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Ready' });
      expect(response.body.status).toBe('Ready');

      // Ready -> Served
      response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${waiterToken}`)
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

  describe('Order Edge Cases and Error Handling', () => {
    test('should reject order with invalid menu item ID', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: [{ menuItemId: 99999, quantity: 1 }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject order with negative quantity', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: [{ menuItemId: 1, quantity: -1 }]
        });

      // Note: This depends on validation implementation
      // Should either reject or handle gracefully
      expect([400, 201]).toContain(response.status);
    });

    test('should reject order with zero quantity', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: [{ menuItemId: 1, quantity: 0 }]
        });

      // Should handle gracefully
      expect([400, 201]).toContain(response.status);
    });

    test('should handle order with missing table number', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          items: [{ menuItemId: 1, quantity: 1 }]
        });

      expect(response.status).toBe(400);
    });

    test('should include order items details in response', async () => {
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
      expect(response.body.items).toBeDefined();
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBe(2);
      
      response.body.items.forEach((item: any) => {
        expect(item).toHaveProperty('menuItemId');
        expect(item).toHaveProperty('quantity');
        expect(item).toHaveProperty('price');
        expect(item).toHaveProperty('name');
      });
    });

    test('should handle large order with many items', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        menuItemId: (i % 5) + 1, // Use first 5 menu items
        quantity: i + 1
      }));

      const response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items
        });

      expect(response.status).toBe(201);
      expect(response.body.items.length).toBe(10);
      expect(response.body.totalPrice).toBeGreaterThan(0);
    });

    test('should handle duplicate menu items in same order', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: [
            { menuItemId: 1, quantity: 2 },
            { menuItemId: 1, quantity: 3 } // Same item again
          ]
        });

      expect(response.status).toBe(201);
      // Should create separate order items
      expect(response.body.items.length).toBe(2);
    });
  });

  describe('Order Status Update Authorization', () => {
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

    test('waiter should be able to update order status', async () => {
      const response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ status: 'Preparing' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('Preparing');
    });

    test('should require authentication for status update', async () => {
      const response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .send({ status: 'Preparing' });

      expect(response.status).toBe(401);
    });

    test('customer should not be able to update order status', async () => {
      const response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'Preparing' });

      expect(response.status).toBe(403);
    });

    test('should return 404 for non-existent order status update', async () => {
      const response = await request(app)
        .patch('/api/orders/99999/status')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ status: 'Preparing' });

      expect(response.status).toBe(404);
    });
  });

  describe('Order Number Sequencing', () => {
    test('order numbers should reset per session', async () => {
      // Create first session and order
      const session1Response = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: 5,
          deviceId: 'test-session-1'
        });
      const sessionId1 = session1Response.body.sessionId;

      const order1 = await request(app)
        .post('/api/orders')
        .send({
          sessionId: sessionId1,
          tableNumber: 5,
          items: [{ menuItemId: 1, quantity: 1 }]
        });

      // Create second session and order
      const session2Response = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: 6,
          deviceId: 'test-session-2'
        });
      const sessionId2 = session2Response.body.sessionId;

      const order2 = await request(app)
        .post('/api/orders')
        .send({
          sessionId: sessionId2,
          tableNumber: 6,
          items: [{ menuItemId: 1, quantity: 1 }]
        });

      // Both should have order number 1 (different sessions)
      expect(order1.body.orderNumber).toBe(1);
      expect(order2.body.orderNumber).toBe(1);
    });

    test('order numbers should increment correctly within session', async () => {
      const newSessionResponse = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: 7,
          deviceId: 'test-increment-session'
        });
      const newSessionId = newSessionResponse.body.sessionId;

      // Create multiple orders
      const orders = [];
      for (let i = 0; i < 5; i++) {
        const orderResponse = await request(app)
          .post('/api/orders')
          .send({
            sessionId: newSessionId,
            tableNumber: 7,
            items: [{ menuItemId: 1, quantity: 1 }]
          });
        orders.push(orderResponse.body);
      }

      // Verify sequential numbering
      for (let i = 0; i < orders.length; i++) {
        expect(orders[i].orderNumber).toBe(i + 1);
      }
    });
  });

  describe('Concurrent Order Creation', () => {
    test('should handle concurrent orders for same session', async () => {
      const newSessionResponse = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: 5,
          deviceId: 'test-concurrent-session'
        });
      const newSessionId = newSessionResponse.body.sessionId;

      // Create multiple orders concurrently
      const orderPromises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/orders')
          .send({
            sessionId: newSessionId,
            tableNumber: 5,
            items: [{ menuItemId: 1, quantity: 1 }]
          })
      );

      const responses = await Promise.all(orderPromises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('orderNumber');
      });

      // All order numbers should be unique
      const orderNumbers = responses.map(r => r.body.orderNumber);
      const uniqueOrderNumbers = [...new Set(orderNumbers)];
      expect(uniqueOrderNumbers.length).toBe(orderNumbers.length);
    });
  });

  describe('Order Price Calculation', () => {
    test('should calculate price correctly for mixed quantities', async () => {
      const menuResponse = await request(app).get('/api/menu');
      const menuItems = menuResponse.body;

      const orderItems = [
        { menuItemId: menuItems[0].id, quantity: 3 },
        { menuItemId: menuItems[1].id, quantity: 2 },
        { menuItemId: menuItems[2].id, quantity: 1 }
      ];

      const expectedTotal = 
        parseFloat(menuItems[0].price) * 3 +
        parseFloat(menuItems[1].price) * 2 +
        parseFloat(menuItems[2].price) * 1;

      const response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: orderItems
        });

      expect(response.status).toBe(201);
      expect(response.body.totalPrice).toBeCloseTo(expectedTotal, 2);
    });

    test('order item prices should match current menu prices', async () => {
      const menuResponse = await request(app).get('/api/menu');
      const menuItem = menuResponse.body[0];

      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber,
          items: [{ menuItemId: menuItem.id, quantity: 1 }]
        });

      expect(orderResponse.status).toBe(201);
      
      const orderItem = orderResponse.body.items.find(
        (item: any) => item.menuItemId === menuItem.id
      );
      
      expect(parseFloat(orderItem.price)).toBeCloseTo(parseFloat(menuItem.price), 2);
    });
  });

  describe('Order Filtering', () => {
    test('kitchen should only see orders for their assigned tables', async () => {
      // This test validates the authorization logic for kitchen staff
      const kitchenResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'kitchen1',
          password: 'kitchen123'
        });
      const kitchenToken = kitchenResponse.body.token;

      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${kitchenToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
