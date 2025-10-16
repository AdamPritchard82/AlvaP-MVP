// Simple script to reset account
const https = require('https');

const resetAccount = async () => {
  const email = 'adam@door10.co.uk'; // Your email
  const url = 'https://alvap-mvp-production.up.railway.app/api/reset-account';
  
  const postData = JSON.stringify({ email });
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  console.log(`🔄 Resetting account for: ${email}`);
  
  const req = https.request(url, options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('✅ Response:', response);
        if (response.success) {
          console.log('🎉 Account reset successfully! You can now register with the original email.');
        } else {
          console.log('❌ Reset failed:', response.error);
        }
      } catch (error) {
        console.log('❌ Error parsing response:', error);
        console.log('Raw response:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ Request failed:', error);
  });
  
  req.write(postData);
  req.end();
};

resetAccount();