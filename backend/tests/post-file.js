// backend/tests/post-file.js
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const file = process.argv[2];
if (!file) {
  console.error('Usage: node tests/post-file.js tests/sample-text.txt');
  process.exit(1);
}
const abs = path.resolve(process.cwd(), file);
if (!fs.existsSync(abs)) {
  console.error('File not found:', abs);
  process.exit(1);
}

const form = new FormData();
form.append('file', fs.createReadStream(abs)); // field **must** be "file"

const BASE = process.env.API_BASE || 'http://localhost:3001';
console.log(`Testing file: ${file}`);
console.log(`Sending to: ${BASE}/api/candidates/parse-cv`);

fetch(`${BASE}/api/candidates/parse-cv`, { method: 'POST', body: form })
  .then(r => r.json())
  .then(json => {
    console.log('Status:', json.error ? 'FAIL' : 'OK');
    console.log(JSON.stringify(json, null, 2));
  })
  .catch(err => {
    console.error('Request error:', err);
    process.exit(1);
  });
