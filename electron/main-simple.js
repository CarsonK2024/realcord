const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

let mainWindow;
let server;

function startServer() {
  try {
    console.log('Starting simplified embedded server...');
    
    const app_express = express();
    server = http.createServer(app_express);
    const io = socketIo(server, {
      cors: {
        origin: ["http://localhost:3000", "http://localhost:5173"],
        methods: ["GET", "POST"]
      }
    });

    app_express.use(cors({
      origin: ["http://localhost:3000", "http://localhost:5173"],
      credentials: true
    }));
    app_express.use(express.json());

    // Test endpoint
    app_express.get('/test', (req, res) => {
      res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
    });

    // Simple socket connection
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    const PORT = 3001;
    server.listen(PORT, () => {
      console.log(`Simplified server running on port ${PORT}`);
    }).on('error', (error) => {
      console.error('Failed to start server:', error);
    });
    
  } catch (error) {
    console.error('Error starting server:', error);
  }
}

function createWindow() {
  console.log('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  console.log('Window created, loading app...');

  // Load the app
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  console.log('Loading production file:', indexPath);
  
  mainWindow.loadFile(indexPath);
  mainWindow.webContents.openDevTools();

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show, displaying...');
    mainWindow.show();
    mainWindow.focus();
  });

  // Force show window after 5 seconds
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('Forcing window to show after timeout...');
      mainWindow.show();
      mainWindow.focus();
    }
  }, 5000);

  mainWindow.on('closed', () => {
    console.log('Main window closed');
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(() => {
  console.log('App is ready, starting server...');
  startServer();
  
  setTimeout(() => {
    console.log('Creating window after server startup...');
    createWindow();
  }, 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (server) {
      server.close();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
}); 