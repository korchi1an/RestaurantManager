# Comprehensive Test Suite Documentation

## Overview

This test suite provides complete coverage for the restaurant ordering application, testing all possible scenarios for the order processing workflow including customer self-ordering, waiter-assisted ordering, and proper data cleanup.

## Test Files

### 1. `setup.ts` - Test Environment Configuration
- **Purpose**: Manages test environment setup and cleanup
- **Features**:
  - Automated cleanup of test data before and after tests
  - Helper functions for creating test customers
  - Data count verification utilities
  - Database connection management

### 2. `auth.test.ts` - Authentication & Authorization
- **Coverage**: 25+ test scenarios
- **Test Categories**:
  - Customer registration (validation, duplicate emails, password hashing)
  - Customer and staff login
  - Token validation and security
  - Role-based access control (RBAC)
  - Password security (hashing, salting)
  - Email validation and case handling
  - Multiple login attempts
  - Staff authentication (waiter, kitchen, admin)
  - User information in tokens

### 3. `menu.test.ts` - Menu Operations
- **Coverage**: 15+ test scenarios
- **Test Categories**:
  - Retrieve all menu items
  - Menu item structure validation
  - Sorting and ordering
  - Category management
  - Individual item retrieval
  - Data integrity checks
  - Performance testing
  - Concurrent request handling

### 4. `sessions.test.ts` - Session Management
- **Coverage**: 30+ test scenarios
- **Test Categories**:
  - Session creation with/without customer info
  - Multiple sessions per table
  - Session lookup by table
  - Session details with orders
  - Heartbeat/activity tracking
  - Session lifecycle (create, use, end)
  - Session order history
  - Inactive session filtering
  - Data persistence after session end

### 5. `orders.test.ts` - Order Management
- **Coverage**: 45+ test scenarios
- **Test Categories**:
  - Order creation and validation
  - Order number sequencing
  - Price calculation
  - Order status updates
  - Payment flow
  - Edge cases (invalid items, negative quantities, etc.)
  - Authorization for status updates
  - Concurrent order creation
  - Order filtering by table/status
  - Large orders with many items
  - Duplicate menu items in same order

### 6. `tables.test.ts` - Table Operations
- **Coverage**: 35+ test scenarios
- **Test Categories**:
  - Table listing and retrieval
  - QR code generation
  - Table orders retrieval
  - Unpaid total calculation
  - Payment processing (mark as paid)
  - Table assignments
  - Waiter assignment/unassignment
  - Authorization checks
  - Data consistency after payment

### 7. `workflow.test.ts` - End-to-End Integration Tests
- **Coverage**: 10+ comprehensive workflow scenarios
- **Test Categories**:
  - **Complete Customer Self-Ordering Flow**:
    1. Scan QR code
    2. View menu
    3. Create session
    4. Place multiple orders
    5. Kitchen processes orders (Pending → Preparing → Ready)
    6. Waiter serves orders (Ready → Served)
    7. Check unpaid total
    8. Mark as paid
    9. End session
    10. Verify data cleanup
  
  - **Complete Waiter-Assisted Ordering Flow**:
    1. Waiter checks menu
    2. Waiter creates session
    3. Waiter places order for customer
    4. Kitchen processes order
    5. Waiter serves order
    6. Customer adds more items (via waiter)
    7. Process additional orders
    8. Check total
    9. Mark as paid
    10. End session
  
  - **Mixed Workflow** (Customer starts, waiter assists):
    - Customer creates session and places order
    - Kitchen processes
    - Waiter serves
    - Waiter helps with additional order
    - Waiter handles payment
  
  - **Concurrent Operations**:
    - Multiple devices at same table
    - Separate order numbering per session
    - Concurrent order creation
  
  - **Order Status Validation**:
    - Valid status progression (Pending → Preparing → Ready → Served → Paid)
    - Status transition rules
  
  - **Data Cleanup Verification**:
    - All test data properly tracked
    - Cleanup removes test sessions, orders, and customers
    - No data leakage between tests

## Test Execution

### Running All Tests
```bash
cd backend
npm test
```

### Running Specific Test Suites
```bash
npm test -- auth.test.ts       # Authentication tests only
npm test -- menu.test.ts       # Menu tests only
npm test -- sessions.test.ts   # Session tests only
npm test -- orders.test.ts     # Order tests only
npm test -- tables.test.ts     # Table tests only
npm test -- workflow.test.ts   # Integration tests only
```

### Running Tests with Coverage
```bash
npm test -- --coverage
```

### Running Tests in Watch Mode
```bash
npm test -- --watch
```

## Test Data Management

### Test Data Identification
All test data is identified by:
- **Sessions**: Device ID contains 'test'
- **Orders**: Table numbers >= 100 or linked to test sessions
- **Customers**: Email contains 'test'

### Cleanup Strategy
- **beforeEach**: Cleans up all test data to ensure clean slate
- **afterAll**: Final cleanup and closes database connections
- **Automatic**: Test data is automatically removed after test completion

### Test Table Ranges
- **Regular tables**: 1-50 (used for general testing)
- **Test-specific tables**: 100-999 (automatically cleaned)

## Key Testing Scenarios

### 1. Customer Self-Ordering (Complete Flow)
✅ Customer scans QR code  
✅ Views menu and selects items  
✅ Creates session  
✅ Places order (order number 1)  
✅ Places additional order (order number 2)  
✅ Kitchen updates status to Preparing  
✅ Kitchen updates status to Ready  
✅ Waiter marks as Served  
✅ Customer checks bill  
✅ Waiter processes payment  
✅ Session ends  
✅ Data cleanup verified  

### 2. Waiter-Assisted Ordering (Complete Flow)
✅ Waiter creates session for customer  
✅ Waiter places order on behalf of customer  
✅ Kitchen processes order  
✅ Waiter serves order  
✅ Customer requests additional items  
✅ Waiter places additional order  
✅ Kitchen processes additional order  
✅ Waiter serves additional order  
✅ Waiter calculates total  
✅ Waiter processes payment  
✅ Session ends  

### 3. Edge Cases Covered
✅ Invalid menu items  
✅ Negative quantities  
✅ Zero quantities  
✅ Missing required fields  
✅ Invalid order status values  
✅ Unauthorized access attempts  
✅ Duplicate email registration  
✅ Invalid email formats  
✅ Malformed authentication tokens  
✅ Concurrent order creation  
✅ Multiple sessions at same table  
✅ Order number sequencing across sessions  

### 4. Security Testing
✅ Password hashing verification  
✅ Salt usage in password hashing  
✅ Token validation  
✅ Role-based access control  
✅ Authorization for protected routes  
✅ Customer cannot access staff functions  
✅ Staff cannot masquerade as customers  

### 5. Data Integrity
✅ Price calculations accurate  
✅ Order numbers sequential per session  
✅ Timestamps correctly recorded  
✅ Status transitions follow valid flow  
✅ Payment marks orders correctly  
✅ Unpaid totals calculated correctly  
✅ Session order counts accurate  

## Test Coverage Goals

- **Line Coverage**: > 80%
- **Branch Coverage**: > 75%
- **Function Coverage**: > 85%
- **Statement Coverage**: > 80%

## Success Criteria

All tests must:
1. ✅ Pass consistently
2. ✅ Clean up all test data
3. ✅ Not interfere with other tests
4. ✅ Complete within reasonable time (< 30 seconds for full suite)
5. ✅ Provide clear error messages on failure

## Known Test Dependencies

### Required Database State
- Menu items must exist (seeded data)
- Tables must exist (seeded data)
- Staff accounts must exist:
  - `waiter1` with password `waiter123`
  - `kitchen1` with password `kitchen123`

### Environment Variables
- Database connection (TEST_DATABASE_URL or DATABASE_URL)
- JWT secret for token generation
- CORS origins for API testing

## Troubleshooting

### Tests Failing Due to Database Connection
- Verify DATABASE_URL environment variable is set
- Ensure PostgreSQL is running
- Check database permissions

### Tests Failing Due to Data Conflicts
- Run cleanup manually: `npm run test:cleanup`
- Verify beforeEach hooks are executing
- Check for leftover test data

### Timeout Issues
- Increase Jest timeout in jest.config.js
- Check for network connectivity issues
- Verify database performance

## Future Enhancements

1. **Performance Testing**: Load testing with multiple concurrent users
2. **Socket.IO Testing**: Real-time event testing for order updates
3. **Rate Limiting**: Verify rate limiting functionality
4. **Caching Tests**: If caching is implemented
5. **Database Transaction Tests**: Rollback scenarios
6. **File Upload Tests**: If menu images are added

## Maintenance

### Adding New Tests
1. Create test file in `__tests__` directory
2. Use test data conventions (device_id with 'test', table >= 100)
3. Ensure cleanup in afterEach/afterAll
4. Update this documentation

### Updating Existing Tests
1. Verify tests still pass after changes
2. Update documentation if test behavior changes
3. Ensure backward compatibility where possible

---

**Last Updated**: March 2, 2026  
**Total Test Count**: 160+ test scenarios  
**Test Coverage**: Comprehensive end-to-end coverage for production readiness
