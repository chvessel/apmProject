// Add New Relic at the very top
require('newrelic');

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Simple endpoints
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Fast endpoint
app.get('/fast', (req, res) => {
  res.json({ status: 'success', message: 'This is a fast endpoint' });
});

// Slow endpoint with artificial delay
app.get('/slow', (req, res) => {
  setTimeout(() => {
    res.json({ status: 'success', message: 'This is a slow endpoint' });
  }, 2000);
});

app.get('/api/test', (req, res) => {
  // Simulate some processing
  const result = [];
  for (let i = 0; i < 1000; i++) {
    result.push({ id: i, value: Math.random() });
  }
  res.json(result);
});

// Error endpoint
app.get('/error', (req, res) => {
  throw new Error('This is a demonstration error');
});

// Handle errors
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ status: 'error', message: err.message });
});
app.use((req, res, next) => {
  console.log(`Received request: ${req.method} ${req.url}`);
  next();
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});