import request from 'supertest';
import app from '../server';
import { getTestDataCounts } from './setup';

describe('Complete Order Processing Workflows', () => {
  let customerToken: string;
  let waiterToken: string;
  let kitchenToken: string;

  beforeAll(async () => {
    // Register customer
    const customerResponse = await request(app)
      .post('/api/auth/register-customer')
      .send({
        email: 'workflow-customer@test.com',
        password: 'password123',
        fullName: 'Workflow Test Customer'
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
  });

  describe('Customer Self-Ordering Workflow', () => {
    const customerTableNumber = 5;
    const customerDeviceId = 'test-customer-device';

    test('complete customer self-ordering flow with cleanup verification', async () => {
      // Get initial data counts
      const initialCounts = await getTestDataCounts();

      // Step 1: Customer scans QR code and gets table info
      const tableResponse = await request(app).get(`/api/tables/${customerTableNumber}`);
      expect(tableResponse.status).toBe(200);

      // Step 2: Customer views menu
      const menuResponse = await request(app).get('/api/menu');
      expect(menuResponse.status).toBe(200);
      expect(menuResponse.body.length).toBeGreaterThan(0);
      const menuItem1 = menuResponse.body[0];
      const menuItem2 = menuResponse.body[1];

      // Step 3: Customer creates session
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          tableNumber: customerTableNumber,
          deviceId: customerDeviceId,
          customerName: 'Workflow Test Customer'
        });
      expect(sessionResponse.status).toBe(201);
      const sessionId = sessionResponse.body.sessionId;

      // Verify session was created
      const sessionCountAfterCreate = await getTestDataCounts();
      expect(sessionCountAfterCreate.sessions).toBe(initialCounts.sessions + 1);

      // Step 4: Customer places first order
      const order1Response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: customerTableNumber,
          items: [
            { menuItemId: menuItem1.id, quantity: 2 },
            { menuItemId: menuItem2.id, quantity: 1 }
          ]
        });
      expect(order1Response.status).toBe(201);
      expect(order1Response.body.orderNumber).toBe(1);
      expect(order1Response.body.status).toBe('Pending');
      const order1Id = order1Response.body.id;

      // Step 5: Customer places second order (after reviewing menu again)
      const order2Response = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: customerTableNumber,
          items: [
            { menuItemId: menuItem1.id, quantity: 1 }
          ]
        });
      expect(order2Response.status).toBe(201);
      expect(order2Response.body.orderNumber).toBe(2); // Order number increments
      const order2Id = order2Response.body.id;

      // Verify orders were created
      const orderCountAfterCreate = await getTestDataCounts();
      expect(orderCountAfterCreate.orders).toBe(initialCounts.orders + 2);

      // Step 6: Kitchen receives orders and starts preparing
      const kitchenOrdersResponse = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${kitchenToken}`);
      expect(kitchenOrdersResponse.status).toBe(200);
      const customerOrders = kitchenOrdersResponse.body.filter(
        (o: any) => o.tableNumber === customerTableNumber
      );
      expect(customerOrders.length).toBeGreaterThanOrEqual(2);

      // Step 7: Kitchen updates order status: Pending -> Preparing
      await request(app)
        .patch(`/api/orders/${order1Id}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Preparing' });

      await request(app)
        .patch(`/api/orders/${order2Id}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Preparing' });

      // Step 8: Kitchen marks orders as ready
      await request(app)
        .patch(`/api/orders/${order1Id}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Ready' });

      const order2ReadyResponse = await request(app)
        .patch(`/api/orders/${order2Id}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Ready' });
      expect(order2ReadyResponse.body.status).toBe('Ready');

      // Step 9: Waiter serves the orders
      await request(app)
        .patch(`/api/orders/${order1Id}/status`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ status: 'Served' });

      await request(app)
        .patch(`/api/orders/${order2Id}/status`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ status: 'Served' });

      // Step 10: Customer checks unpaid total
      const unpaidResponse = await request(app)
        .get(`/api/tables/${customerTableNumber}/unpaid-total`);
      expect(unpaidResponse.status).toBe(200);
      const expectedTotal = order1Response.body.totalPrice + order2Response.body.totalPrice;
      expect(unpaidResponse.body.unpaidTotal).toBeCloseTo(expectedTotal, 2);

      // Step 11: Waiter marks table as paid
      const paymentResponse = await request(app)
        .post(`/api/tables/${customerTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);
      expect(paymentResponse.status).toBe(200);
      expect(paymentResponse.body.ordersPaid).toBe(2);

      // Step 12: Verify all orders are paid
      const unpaidAfterPayment = await request(app)
        .get(`/api/tables/${customerTableNumber}/unpaid-total`);
      expect(unpaidAfterPayment.body.unpaidTotal).toBe(0);

      // Step 13: End session
      const endSessionResponse = await request(app)
        .delete(`/api/sessions/${sessionId}`);
      expect(endSessionResponse.status).toBe(200);

      // Step 14: Verify data was tracked correctly
      const finalCounts = await getTestDataCounts();
      expect(finalCounts.sessions).toBeGreaterThanOrEqual(initialCounts.sessions + 1);
      expect(finalCounts.orders).toBeGreaterThanOrEqual(initialCounts.orders + 2);
      
      // Verify cleanup would remove this data
      // (actual cleanup happens in afterEach/afterAll hooks)
    });

    test('customer can view order history within session', async () => {
      // Create session
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: customerTableNumber,
          deviceId: 'test-history-device',
          customerName: 'History Test'
        });
      const sessionId = sessionResponse.body.sessionId;

      // Place multiple orders
      await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: customerTableNumber,
          items: [{ menuItemId: 1, quantity: 1 }]
        });

      await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: customerTableNumber,
          items: [{ menuItemId: 2, quantity: 1 }]
        });

      // View session orders
      const ordersResponse = await request(app)
        .get(`/api/sessions/${sessionId}/orders`);
      
      expect(ordersResponse.status).toBe(200);
      expect(ordersResponse.body.length).toBe(2);
      expect(ordersResponse.body[0].orderNumber).toBe(1);
      expect(ordersResponse.body[1].orderNumber).toBe(2);

      // View full session details
      const sessionDetailsResponse = await request(app)
        .get(`/api/sessions/${sessionId}`);
      
      expect(sessionDetailsResponse.status).toBe(200);
      expect(sessionDetailsResponse.body.orderCount).toBe(2);
      expect(sessionDetailsResponse.body.totalAmount).toBeGreaterThan(0);
    });

    test('customer handles concurrent orders from multiple devices at same table', async () => {
      const device1 = 'test-concurrent-device-1';
      const device2 = 'test-concurrent-device-2';

      // Create two sessions for same table (different devices)
      const session1Response = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: customerTableNumber,
          deviceId: device1
        });
      const sessionId1 = session1Response.body.sessionId;

      const session2Response = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: customerTableNumber,
          deviceId: device2
        });
      const sessionId2 = session2Response.body.sessionId;

      // Place orders from both devices simultaneously
      const [order1, order2] = await Promise.all([
        request(app)
          .post('/api/orders')
          .send({
            sessionId: sessionId1,
            tableNumber: customerTableNumber,
            items: [{ menuItemId: 1, quantity: 1 }]
          }),
        request(app)
          .post('/api/orders')
          .send({
            sessionId: sessionId2,
            tableNumber: customerTableNumber,
            items: [{ menuItemId: 2, quantity: 1 }]
          })
      ]);

      expect(order1.status).toBe(201);
      expect(order2.status).toBe(201);

      // Verify both orders are for the same table
      expect(order1.body.tableNumber).toBe(customerTableNumber);
      expect(order2.body.tableNumber).toBe(customerTableNumber);

      // Verify separate order numbering per session
      expect(order1.body.orderNumber).toBe(1);
      expect(order2.body.orderNumber).toBe(1);

      // Verify table sees both orders
      const tableOrdersResponse = await request(app)
        .get(`/api/tables/${customerTableNumber}/orders`);
      
      const recentOrders = tableOrdersResponse.body.filter((o: any) => 
        o.id === order1.body.id || o.id === order2.body.id
      );
      expect(recentOrders.length).toBe(2);
    });
  });

  describe('Waiter-Assisted Ordering Workflow', () => {
    const waiterTableNumber = 6;

    test('complete waiter-assisted ordering flow', async () => {
      // Step 1: Waiter checks menu to help customer
      const menuResponse = await request(app).get('/api/menu');
      expect(menuResponse.status).toBe(200);
      const menuItem1 = menuResponse.body[0];
      const menuItem2 = menuResponse.body[1];

      // Step 2: Waiter creates session for the table (optional in waiter flow)
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          tableNumber: waiterTableNumber,
          deviceId: 'test-waiter-assisted-device',
          customerName: 'Walk-in Customer'
        });
      expect(sessionResponse.status).toBe(201);
      const sessionId = sessionResponse.body.sessionId;

      // Step 3: Waiter places order on behalf of customer
      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: waiterTableNumber,
          items: [
            { menuItemId: menuItem1.id, quantity: 3 },
            { menuItemId: menuItem2.id, quantity: 2 }
          ]
        });
      expect(orderResponse.status).toBe(201);
      expect(orderResponse.body.orderNumber).toBe(1);
      const orderId = orderResponse.body.id;

      // Step 4: Kitchen processes the order
      await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Preparing' });

      await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Ready' });

      // Step 5: Waiter serves the order
      const servedResponse = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ status: 'Served' });
      expect(servedResponse.status).toBe(200);
      expect(servedResponse.body.status).toBe('Served');

      // Step 6: Customer adds more items (waiter takes additional order)
      const additionalOrderResponse = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: waiterTableNumber,
          items: [{ menuItemId: menuItem1.id, quantity: 1 }]
        });
      expect(additionalOrderResponse.status).toBe(201);
      expect(additionalOrderResponse.body.orderNumber).toBe(2);

      // Step 7: Process additional order
      const additionalOrderId = additionalOrderResponse.body.id;
      await request(app)
        .patch(`/api/orders/${additionalOrderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Preparing' });

      await request(app)
        .patch(`/api/orders/${additionalOrderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Ready' });

      await request(app)
        .patch(`/api/orders/${additionalOrderId}/status`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ status: 'Served' });

      // Step 8: Customer requests bill, waiter checks total
      const unpaidResponse = await request(app)
        .get(`/api/tables/${waiterTableNumber}/unpaid-total`);
      expect(unpaidResponse.status).toBe(200);
      const expectedTotal = orderResponse.body.totalPrice + additionalOrderResponse.body.totalPrice;
      expect(unpaidResponse.body.unpaidTotal).toBeCloseTo(expectedTotal, 2);

      // Step 9: Customer pays, waiter marks table as paid
      const paymentResponse = await request(app)
        .post(`/api/tables/${waiterTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);
      expect(paymentResponse.status).toBe(200);
      expect(paymentResponse.body.ordersPaid).toBe(2);

      // Step 10: Verify payment
      const unpaidAfterPayment = await request(app)
        .get(`/api/tables/${waiterTableNumber}/unpaid-total`);
      expect(unpaidAfterPayment.body.unpaidTotal).toBe(0);

      // Step 11: End session
      await request(app).delete(`/api/sessions/${sessionId}`);
    });

    test('waiter can create orders without explicit session', async () => {
      // Waiter creates order directly without creating session first
      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableNumber: waiterTableNumber,
          items: [{ menuItemId: 1, quantity: 2 }]
        });

      expect(orderResponse.status).toBe(201);
      expect(orderResponse.body.tableNumber).toBe(waiterTableNumber);
      expect(orderResponse.body).toHaveProperty('id');
      
      // Order can still be processed
      await request(app)
        .patch(`/api/orders/${orderResponse.body.id}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Preparing' });

      // And paid
      await request(app)
        .post(`/api/tables/${waiterTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);
    });
  });

  describe('Mixed Workflow - Customer Start, Waiter Assist', () => {
    const mixedTableNumber = 7;

    test('customer starts order, waiter helps complete process', async () => {
      // Customer creates session and places initial order
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: mixedTableNumber,
          deviceId: 'test-mixed-device'
        });
      const sessionId = sessionResponse.body.sessionId;

      const customerOrderResponse = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: mixedTableNumber,
          items: [{ menuItemId: 1, quantity: 1 }]
        });
      expect(customerOrderResponse.status).toBe(201);
      const customerOrderId = customerOrderResponse.body.id;

      // Kitchen processes customer's order
      await request(app)
        .patch(`/api/orders/${customerOrderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Preparing' });

      await request(app)
        .patch(`/api/orders/${customerOrderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Ready' });

      // Waiter serves it
      await request(app)
        .patch(`/api/orders/${customerOrderId}/status`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ status: 'Served' });

      // Customer asks waiter for help with additional order
      const waiterOrderResponse = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: mixedTableNumber,
          items: [{ menuItemId: 2, quantity: 2 }]
        });
      expect(waiterOrderResponse.status).toBe(201);
      expect(waiterOrderResponse.body.orderNumber).toBe(2);
      const waiterOrderId = waiterOrderResponse.body.id;

      // Process second order
      await request(app)
        .patch(`/api/orders/${waiterOrderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Preparing' });

      await request(app)
        .patch(`/api/orders/${waiterOrderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Ready' });

      await request(app)
        .patch(`/api/orders/${waiterOrderId}/status`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ status: 'Served' });

      // Waiter handles payment
      const paymentResponse = await request(app)
        .post(`/api/tables/${mixedTableNumber}/mark-paid`)
        .set('Authorization', `Bearer ${waiterToken}`);
      
      expect(paymentResponse.status).toBe(200);
      expect(paymentResponse.body.ordersPaid).toBe(2);

      // Cleanup
      await request(app).delete(`/api/sessions/${sessionId}`);
    });
  });

  describe('Order Status Flow Validation', () => {
    test('order must follow valid status progression', async () => {
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: 5,
          deviceId: 'test-status-flow-device'
        });
      const sessionId = sessionResponse.body.sessionId;

      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: 5,
          items: [{ menuItemId: 1, quantity: 1 }]
        });
      const orderId = orderResponse.body.id;

      // Valid flow: Pending -> Preparing -> Ready -> Served -> Paid
      let response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Preparing' });
      expect(response.status).toBe(200);

      response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: 'Ready' });
      expect(response.status).toBe(200);

      response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ status: 'Served' });
      expect(response.status).toBe(200);

      response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ status: 'Paid' });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('Paid');

      // Verify order is in final state
      const finalOrder = await request(app).get(`/api/orders/${orderId}`);
      expect(finalOrder.body.status).toBe('Paid');
    });
  });

  describe('Data Cleanup Verification', () => {
    test('all test data should be properly tracked for cleanup', async () => {
      const initialCounts = await getTestDataCounts();

      // Create test data
      const sessionResponse = await request(app)
        .post('/api/sessions')
        .send({
          tableNumber: 6,
          deviceId: 'test-cleanup-verification-device'
        });
      const sessionId = sessionResponse.body.sessionId;

      await request(app)
        .post('/api/orders')
        .send({
          sessionId,
          tableNumber: 6,
          items: [
            { menuItemId: 1, quantity: 1 },
            { menuItemId: 2, quantity: 1 }
          ]
        });

      // Verify data was created
      const afterCreateCounts = await getTestDataCounts();
      expect(afterCreateCounts.sessions).toBeGreaterThan(initialCounts.sessions);
      expect(afterCreateCounts.orders).toBeGreaterThan(initialCounts.orders);
      expect(afterCreateCounts.orderItems).toBeGreaterThan(initialCounts.orderItems);

      // Note: Actual cleanup happens in afterEach/afterAll hooks
      // This test verifies the tracking mechanism works
    });
  });
});
