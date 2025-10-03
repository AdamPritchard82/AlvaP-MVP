// Simple server for testing
console.log('=== SIMPLE SERVER STARTING ===');

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('Loading dependencies...');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { join } = require('node:path');
console.log('Basic dependencies loaded');

console.log('Loading database modules...');
const { initDatabase, getDb } = require('./db-commonjs.js');
console.log('Database modules loaded');

console.log('Loading route modules...');
const candidatesRouter = require('./routes/candidates-new.js');
console.log('Route modules loaded');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Initialize database
initDatabase();

// Routes
app.use('/api/candidates/parse-cv', candidatesRouter);
app.use('/api/candidates', candidatesRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'simple-server'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Simple AlvaP Server is running!',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('=====================================');
  console.log(`✅ Simple Server running on port ${PORT}`);
  console.log(`✅ Health: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Candidates: http://0.0.0.0:${PORT}/api/candidates`);
  console.log('=====================================');
});
