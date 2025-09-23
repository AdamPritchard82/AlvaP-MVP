// Simple server using CommonJS require (not ES modules)
console.log('=== SIMPLE SERVER STARTING ===');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());

// Test basic functionality
console.log('Testing basic math...');
const result = 2 + 2;
console.log('2 + 2 =', result);

console.log('Testing string operations...');
const message = 'Hello from Railway!';
console.log('Message:', message);

// Create a basic HTTP server without Express
console.log('Creating HTTP server...');
const http = require('http');
const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  console.log('Request received:', req.method, req.url);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.url === '/health') {
    console.log('Health check requested');
    res.writeHead(200);
    res.end(JSON.stringify({ 
      ok: true, 
      message: 'Hello from Railway!',
      timestamp: new Date().toISOString(),
      result: result,
      platform: process.platform
    }));
  } else if (req.url === '/api/candidates/parse-cv' && req.method === 'POST') {
    console.log('CV parse requested');
    res.writeHead(200);
    res.end(JSON.stringify({ 
      success: true,
      message: 'CV parsing endpoint is working!',
      timestamp: new Date().toISOString(),
      note: 'This is a test response - full CV parsing will be implemented next'
    }));
  } else if (req.url === '/') {
    console.log('Root route requested');
    res.writeHead(200);
    res.end(JSON.stringify({ 
      message: 'Simple Server is running!',
      timestamp: new Date().toISOString(),
      status: 'success',
      endpoints: {
        health: '/health',
        cvParse: '/api/candidates/parse-cv (POST)'
      }
    }));
  } else {
    console.log('404 - Route not found:', req.url);
    res.writeHead(404);
    res.end(JSON.stringify({ 
      error: 'Not Found',
      message: 'Route not found',
      url: req.url
    }));
  }
});

console.log('Starting server...');
server.listen(PORT, '0.0.0.0', () => {
  console.log('=== SIMPLE SERVER STARTED SUCCESSFULLY ===');
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`✅ Root: http://0.0.0.0:${PORT}/`);
});

console.log('=== SIMPLE SERVER SETUP COMPLETED ===');
