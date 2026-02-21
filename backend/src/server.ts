import { validateRequiredEnv } from './config/validateEnv';

// Validate environment variables before importing anything else
validateRequiredEnv();

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import compression from 'compression';
import menuRoutes from './routes/menu';
import ordersRoutes from './routes/orders';
import tablesRoutes from './routes/tables';
import sessionsRoutes from './routes/sessions';
import authRoutes from './routes/auth';
import tableAssignmentsRoutes from './routes/tableAssignments';
import { authenticate, authorize, optionalAuth } from './middleware/auth';
import { apiLimiter, orderLimiter, sessionLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';
import { pool, initDb } from './db/database';
import SocketManager from './utils/socketManager';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});

// Initialize SocketManager with io instance
SocketManager.setIO(io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Socket.IO
  crossOriginEmbedderPolicy: false,
}));
app.use(compression()); // Compress responses

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.url}`);
  next();
});

// Rate limiting on all API routes
app.use('/api', apiLimiter);

// Public routes (no authentication required)
app.use('/api/auth', authRoutes); // Login/register
app.use('/api/menu', menuRoutes); // Menu is public for customers
app.use('/api/tables', tablesRoutes); // Tables/QR codes are public
app.use('/api/sessions', sessionLimiter, sessionsRoutes); // Customer sessions are public

// Protected routes (authentication required)
app.use('/api/table-assignments', authenticate, authorize('kitchen', 'waiter', 'admin'), tableAssignmentsRoutes);

// Wrap orders routes to emit socket events
// Orders are public for customers to create, but updates require auth
app.use('/api/orders', orderLimiter, (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = function(data: any) {
    // Emit socket events for order updates
    if (req.method === 'POST' && req.path === '/') {
      // New order created
      logger.info(`Order created: ${data.id} for table ${data.tableNumber}`);
      io.emit('orderCreated', data);
    } else if (req.method === 'PATCH' && req.path.includes('/status')) {
      // Order status updated
      logger.info(`Order ${data.id} status updated to: ${data.status}`);
      io.emit('orderUpdated', data);
      
      // Emit specific events based on status
      if (data.status === 'Ready') {
        io.emit('orderReady', data);
      } else if (data.status === 'Served') {
        io.emit('orderServed', data);
      } else if (data.status === 'Paid') {
        io.emit('orderPaid', data);
      }
    } else if (req.method === 'DELETE' && req.path.match(/^\/\d+$/)) {
      // Order cancelled
      logger.info(`Order cancelled: ${data.orderId}`);
      io.emit('orderCancelled', { orderId: data.orderId });
    }
    
    return originalJson(data);
  };
  
  next();
}, ordersRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Socket.IO client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Socket.IO client disconnected: ${socket.id}`);
  });
  
  socket.on('error', (error) => {
    logger.error(`Socket.IO error: ${error}`);
  });
});

// Health check with database connectivity test
app.get('/health', async (req, res) => {
  const healthcheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: 'unknown'
  };

  try {
    // Test database connection
    const result = await pool.query('SELECT NOW() as current_time');
    healthcheck.database = 'connected';
    healthcheck.status = 'healthy';
    
    res.status(200).json(healthcheck);
  } catch (error) {
    logger.error('HEALTH CHECK - Database connection failed', { error });
    healthcheck.database = 'disconnected';
    healthcheck.status = 'unhealthy';
    
    // Return 503 Service Unavailable if database is down
    res.status(503).json(healthcheck);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.url 
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // Initialize database and start server
  const startServer = async () => {
    try {
      logger.info('=== SERVER STARTING ===');
      logger.info(`Node version: ${process.version}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Port: ${PORT}`);
      logger.info(`CORS Origin: ${process.env.CORS_ORIGIN}`);
      
      // Test database connection first
      logger.info('Testing database connection...');
      await pool.query('SELECT NOW()');
      logger.info('✓ Database connection successful');
      
      // Initialize database (create tables, seed data)
      logger.info('Initializing database schema...');
      await initDb();
      logger.info('✓ Database initialized');
      
      // Start HTTP server
      httpServer.listen(PORT, () => {
        logger.info(`✓ Server running on port ${PORT}`);
        logger.info(`✓ Socket.IO server ready`);
        logger.info('=== SERVER READY ===');
      });
      
      // ============================================================
      // 🧹 AUTOMATIC SESSION CLEANUP (runs every minute)
      // ============================================================
      const SESSION_CLEANUP_INTERVAL = 60 * 1000; // 1 minute
      const SESSION_TIMEOUT_AFTER_PAYMENT = 10 * 60 * 1000; // 10 minutes
      
      const cleanupPaidSessions = async () => {
        try {
          const paymentThreshold = new Date(Date.now() - SESSION_TIMEOUT_AFTER_PAYMENT);
          
          // Find sessions where all orders are paid and the LAST payment was 10+ minutes ago
          const result = await pool.query(`
            UPDATE sessions s
            SET is_active = FALSE
            WHERE s.is_active = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM orders o 
              WHERE o.session_id = s.id 
              AND o.status != 'Paid'
            )
            AND EXISTS (
              SELECT 1 FROM orders o2 
              WHERE o2.session_id = s.id 
              AND o2.status = 'Paid'
            )
            AND (
              SELECT MAX(o3.paid_at) 
              FROM orders o3 
              WHERE o3.session_id = s.id 
              AND o3.status = 'Paid'
            ) < $1
            RETURNING id, table_number, customer_name
          `, [paymentThreshold]);
          
          if (result.rows.length > 0) {
            logger.info(`🧹 Closed ${result.rows.length} paid sessions:`, 
              result.rows.map(s => `Table ${s.table_number} (${s.customer_name || 'Guest'})`).join(', ')
            );
          }
        } catch (error) {
          logger.error('❌ Session cleanup error:', { error });
        }
      };
      
      // Run cleanup every minute
      setInterval(cleanupPaidSessions, SESSION_CLEANUP_INTERVAL);
      
      // Run cleanup immediately on server start (clean up old sessions)
      cleanupPaidSessions();
      
      logger.info('✅ Session auto-cleanup enabled (closes 10 min after LAST payment)');
      
    } catch (error) {
      logger.error('❌ Failed to start server', { error });
      logger.error('Server cannot start. Exiting.');
      process.exit(1);
    }
  };
  
  startServer();
}

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  
  // Close the HTTP server (stops accepting new connections)
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close Socket.IO connections
      io.close(() => {
        logger.info('Socket.IO server closed');
      });
      
      // Close database pool
      await pool.end();
      logger.info('Database pool closed');
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error });
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000);
};

// Handle graceful shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('UNHANDLED REJECTION - Unhandled Promise Rejection detected', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString()
  });
  
  // In production, you might want to restart the process
  if (process.env.NODE_ENV === 'production') {
    logger.error('Exiting due to unhandled promise rejection');
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('UNCAUGHT EXCEPTION - Fatal error detected', {
    message: error.message,
    stack: error.stack
  });
  
  // Uncaught exceptions are fatal - we must exit
  logger.error('Process will exit due to uncaught exception');
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Export app for testing
export default app;
