// Ultra-simple route test to identify the exact failing import
console.log('=== SIMPLE ROUTE TEST STARTING (v2) ===');

async function testOneRoute() {
  try {
    console.log('Testing candidates-new route...');
    const router = await import('./src/routes/candidates-new.js');
    console.log('✅ candidates-new loaded successfully');
    
    console.log('Testing dashboard route...');
    const dashboard = await import('./src/routes/dashboard.js');
    console.log('✅ dashboard loaded successfully');
    
    console.log('Testing clients route...');
    const clients = await import('./src/routes/clients.js');
    console.log('✅ clients loaded successfully');
    
    console.log('All basic routes loaded successfully!');
    
  } catch (error) {
    console.error('❌ Route import failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testOneRoute();
