// Hello world server - basic Express server with health endpoint
console.log('=== HELLO WORLD SERVER STARTING ===');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);

// Test basic functionality
console.log('Testing basic math...');
const result = 2 + 2;
console.log('2 + 2 =', result);

console.log('Testing string operations...');
const message = 'Hello from Railway!';
console.log('Message:', message);

console.log('Testing object creation...');
const obj = { test: true, timestamp: new Date().toISOString() };
console.log('Object:', JSON.stringify(obj));

// Now create a basic Express server
console.log('Creating Express server...');
import express from 'express';
const app = express();
const PORT = process.env.PORT || 3001;

console.log('Setting up routes...');
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    ok: true, 
    message: 'Hello from Railway!',
    timestamp: new Date().toISOString(),
    result: result,
    platform: process.platform
  });
});

app.get('/', (req, res) => {
  console.log('Root route requested');
  res.json({ 
    message: 'Hello World Server is running!',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

console.log('Starting server...');
app.listen(PORT, '0.0.0.0', () => {
  console.log('=== HELLO WORLD SERVER STARTED SUCCESSFULLY ===');
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Root: http://0.0.0.0:${PORT}/`);
});

console.log('=== HELLO WORLD SERVER SETUP COMPLETED ===');
