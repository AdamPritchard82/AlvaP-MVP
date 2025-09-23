// Hello world test - no imports, no async, just basic Node.js
console.log('=== HELLO WORLD TEST STARTING ===');
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

console.log('=== HELLO WORLD TEST COMPLETED SUCCESSFULLY ===');
