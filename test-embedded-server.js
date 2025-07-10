const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

console.log('Testing embedded server startup...');

try {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:5173"],
      methods: ["GET", "POST"]
    }
  });

  app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true
  }));
  app.use(express.json());

  // Test endpoint
  app.get('/test', (req, res) => {
    res.json({ message: 'Embedded server is running!', timestamp: new Date().toISOString() });
  });

  const PORT = 3001;

  server.listen(PORT, () => {
    console.log(`Embedded server running on port ${PORT}`);
    console.log('Test endpoint available at: http://localhost:3001/test');
  }).on('error', (error) => {
    console.error('Failed to start embedded server:', error);
  });

  // Stop after 10 seconds
  setTimeout(() => {
    console.log('Stopping test...');
    server.close();
    process.exit(0);
  }, 10000);

} catch (error) {
  console.error('Error in embedded server test:', error);
  process.exit(1);
} 