// Build Frontend and Start Combined Server
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('=== BUILDING FRONTEND AND STARTING SERVER ===');

try {
  // Check if frontend dist exists
  const frontendDistPath = path.join(__dirname, 'frontend/dist');
  
  if (!fs.existsSync(frontendDistPath)) {
    console.log('📦 Building frontend...');
    
    // Change to frontend directory and build
    process.chdir(path.join(__dirname, 'frontend'));
    
    // Install dependencies if needed
    if (!fs.existsSync('node_modules')) {
      console.log('📦 Installing frontend dependencies...');
      execSync('npm install', { stdio: 'inherit' });
    }
    
    // Build the frontend
    console.log('🔨 Building frontend...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Change back to root directory
    process.chdir(__dirname);
    
    console.log('✅ Frontend built successfully');
  } else {
    console.log('✅ Frontend already built');
  }
  
  // Start the combined server
  console.log('🚀 Starting combined server...');
  require('./server-combined.js');
  
} catch (error) {
  console.error('❌ Build error:', error.message);
  console.log('🔄 Starting server in API-only mode...');
  
  // Start server anyway (API-only mode)
  require('./server-combined.js');
}
