// Minimal Node.js server for Railway
const http = require('http');

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
      ok: true,
      message: 'Minimal Node.js server running on Railway v2',
      timestamp: new Date().toISOString(),
      port: PORT
    }));
  } else if (req.url === '/api/jobs') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      jobs: [
        {
          id: 1,
          title: "Senior Communications Manager",
          status: "New",
          client: { name: "Leading Consultancy" },
          salary_min: 60000,
          salary_max: 80000,
          tags: ["communications", "campaigns"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      total: 1,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Not Found',
      message: 'Route not found',
      url: req.url,
      availableEndpoints: ['/health', '/api/jobs']
    }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal server running on port ${PORT}`);
});
