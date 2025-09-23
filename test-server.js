// Simple test server to debug Railway issues
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Door 10 MVP Test Server', 
    status: 'running',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

console.log('=== TEST SERVER STARTING ===');
console.log(`Port: ${PORT}`);
console.log(`Node version: ${process.version}`);
console.log(`Working directory: ${process.cwd()}`);

app.listen(PORT, '0.0.0.0', () => {
  console.log('=== TEST SERVER STARTED ===');
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
