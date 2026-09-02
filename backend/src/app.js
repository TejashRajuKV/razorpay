/**
 * Express Application Server
 * Main entry point for the AI Revenue Recovery Agent backend
 * Configures middleware, routes, and error handling
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import configuration
const db = require('./config/database');
const { initializeDatabase, closeDatabase } = require('./config/database');

// Import routes
const dashboardRoutes = require('./routes/dashboardRoutes');
const casesRoutes = require('./routes/casesRoutes');
const recoveryRoutes = require('./routes/recoveryRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const auditRoutes = require('./routes/auditRoutes');
const simulatorRoutes = require('./routes/simulatorRoutes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
const API_VERSION = process.env.API_VERSION || 'v1';
const apiBase = `/api/${API_VERSION}`;

app.use(`${apiBase}/dashboard`, dashboardRoutes);
app.use(`${apiBase}/cases`, casesRoutes);
app.use(`${apiBase}/recovery`, recoveryRoutes);
app.use(`${apiBase}/analytics`, analyticsRoutes);
app.use(`${apiBase}/audit`, auditRoutes);
app.use(`${apiBase}/simulator`, simulatorRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: isDevelopment ? err.message : 'An unexpected error occurred',
    stack: isDevelopment ? err.stack : undefined,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('[Server] Database initialized');
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║     AI Revenue Recovery Agent - Backend Server           ║
╠══════════════════════════════════════════════════════════╣
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(45)}║
║  Port: ${String(PORT).padEnd(52)}║
║  API Version: ${API_VERSION.padEnd(45)}║
║  Database: ${(process.env.DB_TYPE || 'sqlite').padEnd(48)}║
╚══════════════════════════════════════════════════════════╝
      `);
      console.log(`[Server] API available at http://localhost:${PORT}/api/${API_VERSION}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[Fatal Error] Uncaught Exception:', err);
  closeDatabase().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal Error] Unhandled Rejection at:', promise, 'reason:', reason);
  closeDatabase().then(() => process.exit(1));
});

// Export for testing
module.exports = { app, startServer };

// Start if running directly
if (require.main === module) {
  startServer();
}
