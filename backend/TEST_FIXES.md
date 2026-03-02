# Test Suite Fixes - Summary

## Issues Fixed

### 1. Foreign Key Constraint Violations
**Problem**: Tests were using table numbers (10-23, 101-102) that don't exist in the database.  
**Solution**: Updated all tests to use existing tables 1-7.

**Files Modified**:
- `src/__tests__/workflow.test.ts` - Changed tables 10-14 to 5-7
- `src/__tests__/orders.test.ts` - Changed tables 20-23 to 5-7  
- `src/__tests__/auth.test.ts` - Changed tables 15-16 to 5-6
- `src/__tests__/sessions.test.ts` - Changed table 101 to 3
- `src/__tests__/tables.test.ts` - Changed table 102 to 4

### 2. Authentication Failures
**Problem**: Tests were attempting to login with usernames `waiter1` and `kitchen1` which don't exist.  
**Actual Usernames**: The database seeds these employee accounts:
- `Chef` (kitchen role, password: kitchen123)
- `Ana` (waiter role, password: waiter123)
- `Mihai` (waiter role, password: waiter123)
- `Admin` (admin role, password: admin123)

**Solution**: Updated all test files to use correct usernames.

**Files Modified**:
- `src/__tests__/workflow.test.ts` - Changed `waiter1` → `Ana`, `kitchen1` → `Chef`
- `src/__tests__/orders.test.ts` - Changed `waiter1` → `Ana`, added `Chef` login
- `src/__tests__/auth.test.ts` - Changed `waiter1` → `Ana`
- `src/__tests__/tables.test.ts` - Changed `waiter1` → `Ana` (2 occurrences)

### 3. Missing Authorization Headers
**Problem**: Order status update endpoints require authentication (kitchen/waiter/admin roles) but tests were calling them without tokens.  
**Solution**: Added `Authorization` headers with appropriate tokens to all PATCH /api/orders/:id/status requests.

**Files Modified**:
- `src/__tests__/orders.test.ts` - Added `kitchenToken` and authorization headers to status update tests

### 4. Cleanup Logic Issues
**Problem**: Cleanup function was trying to reset `waiter_id` for tables >= 100, which were real tables 1-7.  
**Solution**: Removed table number filtering from cleanup, relying only on `device_id LIKE '%test%'` pattern.

**Files Modified**:
- `src/__tests__/setup.ts` - Removed `table_number >= 100` conditions from `cleanupTestData()` and `getTestDataCounts()`

## Test Configuration

### Table Assignments
- Table 3: `sessions.test.ts`
- Table 4: `tables.test.ts`  
- Table 5: `workflow.test.ts` (customer flow), `orders.test.ts` (concurrent orders), `auth.test.ts` (RBAC tests)
- Table 6: `workflow.test.ts` (waiter flow), `orders.test.ts` (order sequencing), `auth.test.ts` (RBAC tests)
- Table 7: `workflow.test.ts` (mixed flow), `orders.test.ts` (main test table), `menu.test.ts` (order increment tests)

### Employee Credentials Used in Tests
- **Chef** (Kitchen): username=`Chef`, password=`kitchen123`
- **Ana** (Waiter): username=`Ana`, password=`waiter123`

### Test Data Identification
All test data is identified by `device_id` containing "test" (e.g., `test-device-orders`, `test-customer-device`).  
Cleanup automatically removes all orders, sessions, and customers with test identifiers.

## Running Tests

```bash
cd backend
npm test
```

### Run Specific Test Suites
```bash
npm test -- --testPathPattern=auth        # Authentication tests
npm test -- --testPathPattern=orders      # Order management tests
npm test -- --testPathPattern=workflow    # Integration workflow tests
npm test -- --testPathPattern=sessions    # Session management tests
npm test -- --testPathPattern=tables      # Table management tests
npm test -- --testPathPattern=menu        # Menu API tests
```

## Test Coverage

Total: **160+ test scenarios** across 6 test suites:

1. **auth.test.ts** (~40 tests) - Authentication, authorization, RBAC, password security
2. **orders.test.ts** (~45 tests) - Order creation, status updates, payment flow, validation
3. **workflow.test.ts** (~10 tests) - End-to-end integration scenarios
4. **sessions.test.ts** (~30 tests) - Session lifecycle, heartbeat, concurrency
5. **tables.test.ts** (~35 tests) - Table operations, QR codes, assignments, payments
6. **menu.test.ts** (~15 tests) - Menu retrieval, categories, availability

## Expected Results

All tests should now pass with:
- ✅ No foreign key constraint violations
- ✅ Successful authentication for all employee logins
- ✅ Proper authorization for protected endpoints
- ✅ Clean test data removal after each test

## Notes

- Tests use real database tables (1-7), so ensure these exist before running tests
- Employee accounts (Chef, Ana, Mihai, Admin) must be seeded in the database
- Database initialization creates these accounts automatically with `initDb()` function
- Test cleanup only removes test data (identified by device_id pattern), not real data
