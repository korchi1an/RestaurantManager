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
import { pool } from './db/database';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});

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
      }
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
  httpServer.listen(PORT, () => {
    logger.info(`✓ Server running on http://localhost:${PORT}`);
    logger.info(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`✓ Socket.IO server ready`);
  });
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

// Export app and io for testing and routes
export default app;
export { io };
