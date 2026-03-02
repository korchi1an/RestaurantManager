import request from 'supertest';
import app from '../server';
import { pool } from '../db/database';

describe('Table Management API', () => {
  let waiterToken: string;
  let customerToken: string;
  const testTableNumber = 4;

  beforeAll(async () => {
    // Login as waiter
    const waiterResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'Ana',
        password: 'waiter123'
      });
    waiterToken = waiterResponse.body.token;

    // Register customer
    const customerResponse = await request(app)
      .post('/api/auth/register-customer')
      .send({
        email: 'tablecustomer@test.com',
        password: 'password123',
        fullName: 'Table Test Customer'
      });
    customerToken = customerResponse.body.token;
  });

  describe('GET /api/tables - Get All Tables', () => {
    test('should retrieve all tables', async () => {
      const response = await request(app).get('/api/tables');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should return tables ordered by table number', async () => {
      const response = await request(app).get('/api/tables');

      expect(response.status).toBe(200);
      
      for (let i = 0; i < response.body.length - 1; i++) {
        expect(response.body[i].table_number).toBeLessThanOrEqual(
          response.body[i + 1].table_number
        );
      }
    });

    test('should return tables with correct structure', async () => {
      const response = await request(app).get('/api/tables');

      expect(response.status).toBe(200);
      
      const table = response.body[0];
      expect(table).toHaveProperty('id');
      expect(table).toHaveProperty('table_number');
      expect(table).toHaveProperty('capacity');
      expect(table).toHaveProperty('status');
    });
  });

  describe('GET /api/tables/:tableNumber - Get Specific Table', () => {
    test('should retrieve a specific table by number', async () => {
      const response = await request(app).get('/api/tables/1');

      expect(response.status).toBe(200);
      expect(response.body.table_number).toBe(1);
      expect(response.body).toHaveProperty('capacity');
      expect(response.body).toHaveProperty('status');
    });

    test('should return 404 for non-existent table', async () => {
      const response = await request(app).get('/api/tables/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/tables/:tableNumber/qrcode - QR Code Generation', () => {
    test('should generate QR code for a table', async () => {
      const response = await request(app).get('/api/tables/1/qrcode');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tableNumber');
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('qrCode');
      expect(response.body.tableNumber).toBe(1);
    });

    test('QR code URL should contain table number', async () => {
      const response = await request(app).get('/api/tables/1/qrcode');

      expect(response.status).toBe(200);
      expect(response.body.url).toContain('/table/1');
    });

    test('QR code should be base64 data URL', async () => {
      const response = await request(app).get('/api/tables/1/qrcode');

      expect(response.status).toBe(200);
      expect(response.body.qrCode).toMatch(/^data:image\/png;base64,/);
    });

    test('should return 404 for non-existent table QR code', async () => {
      const response = await request(app).get('/api/tables/999/qrcode');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should generate different QR codes for different tables', async () => {
      const response1 = await request(app).get('/api/tables/1/qrcode');
      const response2 = await request(app).get('/api/tables/2/qrcode');

      expect(response1.body.qrCode).not.toBe(response2.body.qrCode);
      expect(response1.body.url).not.toBe(response2.body.url);
    });
  });

  describe('GET /api/tables/:tableNumber/orders - Table Orders', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create a session and order for the test table
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-table-orders'
        });
      sessionId = sessionResponse.body.sessionId;

      await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 1, quantity: 1 }]
        });
    });

    test('should retrieve all orders for a table', async () => {
      const response = await request(app)
        .get(`/api/tables/${testTableNumber}/orders`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      response.body.forEach((order: any) => {
        expect(order.tableNumber).toBe(testTableNumber);
      });
    });

    test('should order results by creation date descending', async () => {
      // Create another order
      await new Promise(resolve => setTimeout(resolve, 100));
      await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 2, quantity: 1 }]
        });

      const response = await request(app)
        .get(`/api/tables/${testTableNumber}/orders`);

      expect(response.status).toBe(200);
      
      for (let i = 0; i < response.body.length - 1; i++) {
        const current = new Date(response.body[i].createdAt).getTime();
        const next = new Date(response.body[i + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    test('should include order items in response', async () => {
      const response = await request(app)
        .get(`/api/tables/${testTableNumber}/orders`);

      expect(response.status).toBe(200);
      
      response.body.forEach((order: any) => {
        expect(order).toHaveProperty('items');
        expect(Array.isArray(order.items)).toBe(true);
      });
    });

    test('should return empty array for table with no orders', async () => {
      const response = await request(app)
        .get('/api/tables/999/orders');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('GET /api/tables/:tableNumber/unpaid-total - Unpaid Total', () => {
    let sessionId: string;

    beforeEach(async () => {
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-unpaid'
        });
      sessionId = sessionResponse.body.sessionId;
    });

    test('should calculate unpaid total for table', async () => {
      // Create order
      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 1, quantity: 2 }]
        });

      const response = await request(app)
        .get(`/api/tables/${testTableNumber}/unpaid-total`);

      expect(response.status).toBe(200);
      expect(response.body.tableNumber).toBe(testTableNumber);
      expect(response.body.unpaidTotal).toBeGreaterThan(0);
      expect(response.body.unpaidTotal).toBeCloseTo(orderResponse.body.totalPrice, 2);
    });

    test('should sum multiple unpaid orders', async () => {
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
        .get(`/api/tables/${testTableNumber}/unpaid-total`);

      expect(response.status).toBe(200);
      expect(response.body.unpaidTotal).toBeCloseTo(expectedTotal, 2);
    });

    test('should return zero for table with no orders', async () => {
      const response = await request(app)
        .get('/api/tables/999/unpaid-total');

      expect(response.status).toBe(200);
      expect(response.body.unpaidTotal).toBe(0);
    });

    test('should exclude paid orders from total', async () => {
      // Create and mark order as paid
      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: testTableNumber,
          items: [{ menuItemId: 1, quantity: 1 }]
        });

      await request(app)
        .patch(`/api/orders/${orderResponse.body.id}/status`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ status: 'Paid' });

      const response = await request(app)
        .get(`/api/tables/${testTableNumber}/unpaid-total`);

      expect(response.status).toBe(200);
      expect(response.body.unpaidTotal).toBe(0);
    });
  });

  describe('POST /api/tables/:tableNumber/mark-paid - Mark Table as Paid', () => {
    let sessionId: string;

    beforeEach(async () => {
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: testTableNumber,
          deviceId: 'test-device-payment'
        });
      sessionId = sessionResponse.body.sessionId;

      // Create unpaid orders
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
    });

    test('waiter should be able to mark table as paid', async () => {
      const response = await request(app)
        .post(`/api/tables/${testTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.ordersPaid).toBeGreaterThan(0);
    });

    test('should mark all unpaid orders as paid', async () => {
      const response = await request(app)
        .post(`/api/tables/${testTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);

      expect(response.status).toBe(200);
      expect(response.body.ordersPaid).toBe(2);

      // Verify unpaid total is now zero
      const unpaidResponse = await request(app)
        .get(`/api/tables/${testTableNumber}/unpaid-total`);

      expect(unpaidResponse.body.unpaidTotal).toBe(0);
    });

    test('should set paid_at timestamp', async () => {
      const response = await request(app)
        .post(`/api/tables/${testTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);

      const orderId = response.body.orderIds[0];

      // Check database for paid_at
      const orderResult = await pool.query(
        'SELECT paid_at FROM orders WHERE id = $1',
        [orderId]
      );

      expect(orderResult.rows[0].paid_at).toBeTruthy();
    });

    test('should not mark already paid orders again', async () => {
      // Mark as paid first time
      const firstResponse = await request(app)
        .post(`/api/tables/${testTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);

      const firstCount = firstResponse.body.ordersPaid;
      expect(firstCount).toBeGreaterThan(0);

      // Try to mark as paid again
      const secondResponse = await request(app)
        .post(`/api/tables/${testTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);

      expect(secondResponse.body.ordersPaid).toBe(0);
    });

    test('customer should not be able to mark table as paid', async () => {
      const response = await request(app)
        .post(`/api/tables/${testTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(403);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/tables/${testTableNumber}/mark-paid`);

      expect(response.status).toBe(401);
    });

    test('should return order IDs that were marked paid', async () => {
      const response = await request(app)
        .post(`/api/tables/${testTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orderIds');
      expect(Array.isArray(response.body.orderIds)).toBe(true);
      expect(response.body.orderIds.length).toBe(response.body.ordersPaid);
    });
  });

  describe('Table Assignment API', () => {
    let waiterId: number;
    let tableId: number;

    beforeAll(async () => {
      // Get waiter ID
      const waiterInfo = await pool.query(
        "SELECT id FROM employees WHERE username = 'Ana'"
      );
      waiterId = waiterInfo.rows[0].id;

      // Get a test table ID
      const tableInfo = await pool.query(
        'SELECT id FROM tables WHERE table_number = 1'
      );
      tableId = tableInfo.rows[0].id;
    });

    afterEach(async () => {
      // Unassign test tables
      await pool.query('UPDATE tables SET waiter_id = NULL WHERE table_number = 1');
    });

    describe('GET /api/table-assignments - Get All Assignments', () => {
      test('should retrieve all table assignments', async () => {
        const response = await request(app)
          .get('/api/table-assignments')
          .set('Authorization', `Bearer ${waiterToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .get('/api/table-assignments');

        expect(response.status).toBe(401);
      });

      test('customer should not access assignments', async () => {
        const response = await request(app)
          .get('/api/table-assignments')
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(403);
      });
    });

    describe('PATCH /api/table-assignments/:tableId/assign - Assign Table', () => {
      test('should assign table to waiter', async () => {
        const response = await request(app)
          .patch(`/api/table-assignments/${tableId}/assign`)
          .set('Authorization', `Bearer ${waiterToken}`)
          .send({ waiterId });

        expect(response.status).toBe(200);
        expect(response.body.waiter_id).toBe(waiterId);
      });

      test('should reject assignment without waiter ID', async () => {
        const response = await request(app)
          .patch(`/api/table-assignments/${tableId}/assign`)
          .set('Authorization', `Bearer ${waiterToken}`)
          .send({});

        expect(response.status).toBe(400);
      });

      test('should reject assignment to non-existent waiter', async () => {
        const response = await request(app)
          .patch(`/api/table-assignments/${tableId}/assign`)
          .set('Authorization', `Bearer ${waiterToken}`)
          .send({ waiterId: 99999 });

        expect(response.status).toBe(404);
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .patch(`/api/table-assignments/${tableId}/assign`)
          .send({ waiterId });

        expect(response.status).toBe(401);
      });
    });

    describe('PATCH /api/table-assignments/:tableId/unassign - Unassign Table', () => {
      beforeEach(async () => {
        // Assign table first
        await pool.query(
          'UPDATE tables SET waiter_id = $1 WHERE id = $2',
          [waiterId, tableId]
        );
      });

      test('should unassign table from waiter', async () => {
        const response = await request(app)
          .patch(`/api/table-assignments/${tableId}/unassign`)
          .set('Authorization', `Bearer ${waiterToken}`);

        expect(response.status).toBe(200);
        expect(response.body.waiter_id).toBeNull();
      });

      test('should return 404 for non-existent table', async () => {
        const response = await request(app)
          .patch('/api/table-assignments/99999/unassign')
          .set('Authorization', `Bearer ${waiterToken}`);

        expect(response.status).toBe(404);
      });
    });

    describe('GET /api/table-assignments/waiters - Get All Waiters', () => {
      test('should retrieve all waiters for assignment', async () => {
        const response = await request(app)
          .get('/api/table-assignments/waiters')
          .set('Authorization', `Bearer ${waiterToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        response.body.forEach((waiter: any) => {
          expect(waiter.role).toBe('waiter');
          expect(waiter).toHaveProperty('id');
          expect(waiter).toHaveProperty('username');
        });
      });
    });
  });
});
