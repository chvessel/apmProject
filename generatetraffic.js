const http = require('http');

const endpoints = ['/', '/fast', '/slow', '/error'];
const BASE_URL = 'http://localhost:3000';

console.log('Generating traffic to demonstrate New Relic APM...');

// Generate 20 requests to random endpoints
for (let i = 0; i < 20; i++) {
  setTimeout(() => {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    console.log(`Requesting: ${endpoint}`);
    
    http.get(`${BASE_URL}${endpoint}`, (res) => {
      console.log(`Status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error(`Error: ${err.message}`);
    });
  }, i * 500); // Space requests 500ms apart
}