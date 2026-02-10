-- Restaurant Database Queries
-- Highlight a query and press F5 to run it

-- ========================================
-- VIEW ALL DATA
-- ========================================

-- View all menu items
SELECT * FROM menu_items ORDER BY category, name;

-- View all tables
SELECT * FROM tables ORDER BY table_number;

-- View all employees (kitchen, waiters, admin)
SELECT id, username, role, created_at, last_login 
FROM employees 
ORDER BY role, username;

-- View all customers
SELECT id, email, name, created_at, last_login 
FROM customers 
ORDER BY created_at DESC;

-- View all orders (most recent first)
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20;

-- View all active sessions
SELECT * FROM sessions WHERE is_active = true ORDER BY last_activity DESC;


-- ========================================
-- DETAILED VIEWS WITH JOINS
-- ========================================

-- Orders with their items (expanded view)
SELECT 
    o.id,
    o.order_number,
    o.table_number,
    o.status,
    o.total_price,
    o.created_at,
    oi.quantity,
    mi.name as item_name,
    mi.price as item_price,
    mi.category
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
ORDER BY o.created_at DESC, o.id
LIMIT 50;

-- Tables with assigned waiters
SELECT 
    t.table_number,
    t.capacity,
    t.status,
    t.waiter_id,
    e.username as waiter_name
FROM tables t
LEFT JOIN employees e ON t.waiter_id = e.id
ORDER BY t.table_number;

-- Active sessions with order counts
SELECT 
    s.id,
    s.table_number,
    s.device_id,
    s.created_at,
    s.last_activity,
    COUNT(o.id) as order_count,
    COALESCE(SUM(o.total_price), 0) as total_amount
FROM sessions s
LEFT JOIN orders o ON s.id = o.session_id
WHERE s.is_active = true
GROUP BY s.id, s.table_number, s.device_id, s.created_at, s.last_activity
ORDER BY s.last_activity DESC;


-- ========================================
-- STATISTICS & SUMMARIES
-- ========================================

-- Order status summary
SELECT 
    status,
    COUNT(*) as count,
    SUM(total_price) as total_revenue
FROM orders
GROUP BY status
ORDER BY count DESC;

-- Menu category summary
SELECT 
    category,
    COUNT(*) as item_count,
    AVG(price) as avg_price,
    MIN(price) as min_price,
    MAX(price) as max_price
FROM menu_items
GROUP BY category
ORDER BY category;

-- Orders by table
SELECT 
    table_number,
    COUNT(*) as total_orders,
    SUM(total_price) as total_revenue,
    AVG(total_price) as avg_order_value
FROM orders
GROUP BY table_number
ORDER BY total_orders DESC;

-- Unpaid orders by table
SELECT 
    table_number,
    COUNT(*) as unpaid_orders,
    SUM(total_price) as unpaid_total
FROM orders
WHERE paid_at IS NULL
GROUP BY table_number
HAVING COUNT(*) > 0
ORDER BY unpaid_total DESC;


-- ========================================
-- FILTER EXAMPLES
-- ========================================

-- Today's orders (adjust date as needed)
SELECT * FROM orders 
WHERE created_at >= CURRENT_DATE 
ORDER BY created_at DESC;

-- Pending orders only
SELECT * FROM orders 
WHERE status = 'Pending' 
ORDER BY created_at;

-- Orders for a specific table
SELECT * FROM orders 
WHERE table_number = 1 
ORDER BY created_at DESC;

-- Most expensive orders
SELECT * FROM orders 
ORDER BY total_price DESC 
LIMIT 10;

-- Recently served orders
SELECT * FROM orders 
WHERE status = 'Served' 
ORDER BY updated_at DESC 
LIMIT 20;


-- ========================================
-- DATA MANAGEMENT
-- ========================================

-- Count records in each table
SELECT 
    'menu_items' as table_name, COUNT(*) as count FROM menu_items
UNION ALL
SELECT 'tables', COUNT(*) FROM tables
UNION ALL
SELECT 'employees', COUNT(*) FROM employees
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions;

-- Check for inactive sessions (older than 30 minutes)
SELECT * FROM sessions 
WHERE is_active = true 
AND last_activity < NOW() - INTERVAL '30 minutes'
ORDER BY last_activity;


-- ========================================
-- USEFUL UPDATES (USE WITH CAUTION!)
-- ========================================

-- Mark old sessions as inactive (uncomment to run)
-- UPDATE sessions 
-- SET is_active = false 
-- WHERE last_activity < NOW() - INTERVAL '30 minutes';

-- Mark all table orders as paid (uncomment to run)
-- UPDATE orders 
-- SET paid_at = NOW() 
-- WHERE table_number = 1 AND paid_at IS NULL;

-- Clear test data (uncomment to run)
-- DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE table_number = 99);
-- DELETE FROM orders WHERE table_number = 99;
