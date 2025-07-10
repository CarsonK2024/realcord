const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';

// Import server dependencies directly
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');

let mainWindow;
let serverProcess;

// Start the backend server directly in the main process
function startServer() {
  try {
    console.log('Starting embedded server...');
  
  // Initialize Firebase Admin (optional for now)
  let db = null;
  try {
    const serviceAccountPath = path.join(__dirname, '..', 'server', 'firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      db = admin.firestore();
      console.log('Firebase Admin initialized successfully');
    } else {
      console.log('Firebase Admin not configured - using local file storage');
    }
  } catch (error) {
    console.log('Firebase Admin not configured - using local file storage');
    console.log('Error:', error.message);
  }

  // Local file storage functions
  const DATA_DIR = path.join(__dirname, '..', 'server', 'data');
  const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');
  const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Load data from local files
  function loadLocalData() {
    try {
      if (fs.existsSync(SERVERS_FILE)) {
        const serversData = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
        Object.entries(serversData).forEach(([id, server]) => {
          servers.set(id, server);
          if (server.inviteCode) {
            usedInviteCodes.add(server.inviteCode);
          }
        });
        console.log(`Loaded ${servers.size} servers from local file`);
      }
      
      if (fs.existsSync(MESSAGES_FILE)) {
        const messagesData = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
        Object.entries(messagesData).forEach(([serverId, serverMessages]) => {
          messages.set(serverId, serverMessages);
        });
        console.log(`Loaded messages from local file for ${messages.size} servers`);
      }
    } catch (error) {
      console.error('Error loading local data:', error);
    }
  }

  // Save data to local files
  function saveLocalData() {
    try {
      // Save servers
      const serversData = {};
      servers.forEach((server, id) => {
        serversData[id] = server;
      });
      fs.writeFileSync(SERVERS_FILE, JSON.stringify(serversData, null, 2));
      
      // Save messages
      const messagesData = {};
      messages.forEach((serverMessages, serverId) => {
        messagesData[serverId] = serverMessages;
      });
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messagesData, null, 2));
      
      console.log('Data saved to local files');
    } catch (error) {
      console.error('Error saving local data:', error);
    }
  }

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
    res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      connections: io.engine.clientsCount,
      servers: servers.size,
      users: users.size
    });
  });

  // Store connected users and servers
  const users = new Map(); // socketId -> User
  const allUsers = new Map(); // uid -> User (persistent storage)
  const messages = new Map(); // serverId -> Message[]
  const servers = new Map();

  // Voice channel tracking
  const voiceChannels = new Map(); // channelId -> Set of socketIds
  const voiceParticipants = new Map(); // socketId -> { channelId, username }

  // Direct messaging
  const directMessages = new Map(); // conversationId -> Message[]
  const conversations = new Map(); // conversationId -> { participants: [userId1, userId2] }

  // Friend system
  const friendRequests = new Map(); // receiverId -> Array of { fromId, fromUsername, timestamp }
  const friends = new Map(); // userId -> Set of friend userIds
  const notifications = new Map(); // userId -> Array of { type, content, timestamp, id }

  // Track used invite codes to ensure uniqueness
  const usedInviteCodes = new Set();

  // Generate unique random invite code
  const generateUniqueInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
      result = '';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
    } while (usedInviteCodes.has(result) && attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
      console.error('Failed to generate unique invite code after', maxAttempts, 'attempts');
      return null;
    }
    
    usedInviteCodes.add(result);
    return result;
  };

  // Create default server if none exists
  const createDefaultServer = () => {
    const defaultServer = {
      id: 'default',
      name: 'General Chat',
      ownerId: 'system',
      inviteCode: 'WELCOME',
      channels: [
        { id: 'general', name: 'general', type: 'text', serverId: 'default' },
        { id: 'voice', name: 'Voice Chat', type: 'voice', serverId: 'default' }
      ],
      members: []
    };
    servers.set('default', defaultServer);
    usedInviteCodes.add('WELCOME');
    return defaultServer;
  };

  // Initialize default server
  if (servers.size === 0) {
    createDefaultServer();
  }

  // Load local data
  loadLocalData();

  // Helper: get servers for a user
  const getServersForUser = (userUid) => {
    return Array.from(servers.values()).filter(server => server.members.includes(userUid));
  };

  io.on('connection', (socket) => {
    console.log('=== NEW CONNECTION ===');
    console.log('User connected:', socket.id);
    console.log('Total connections:', io.engine.clientsCount);

    // Handle user login
    socket.on('login', async (data) => {
      console.log('Login attempt for user:', data);
      
      // Handle both old format (username string) and new format (object with username and uid)
      const username = typeof data === 'string' ? data : data.username;
      const uid = typeof data === 'string' ? data : data.uid;
      
      const user = {
        id: socket.id,
        username: username,
        uid: uid,
        status: 'online',
        lastSeen: new Date()
      };
      
      users.set(socket.id, user);
      
      // Store user persistently
      const persistentUser = {
        username: username,
        uid: uid,
        status: 'online',
        lastSeen: new Date()
      };
      allUsers.set(uid, persistentUser);
      
      console.log('Users map size:', users.size);
      console.log('All users map size:', allUsers.size);
      console.log('User object created:', user);
      
      // Send current user list to all clients (including offline users)
      const userListForFrontend = Array.from(allUsers.values()).map(user => ({
        id: user.uid,
        username: user.username,
        status: user.status
      }));
      io.emit('userList', userListForFrontend);
      
      // Send server-specific user list if user is in a server
      const userServersForList = getServersForUser(user.uid);
      if (userServersForList.length > 0) {
        const serverUserIds = new Set();
        userServersForList.forEach(server => {
          server.members.forEach(memberId => serverUserIds.add(memberId));
        });
        
        const serverUserList = Array.from(allUsers.values())
          .filter(user => serverUserIds.has(user.uid))
          .map(user => ({
            id: user.uid,
            username: user.username,
            status: user.status
          }));
        
        socket.emit('serverUserList', serverUserList);
      }
      
      // Notify others that user joined
      socket.broadcast.emit('userJoined', {
        id: user.uid,
        username: user.username,
        status: user.status
      });
      
      // Send existing messages to new user (only from servers they're in)
      const userServersForMessages = getServersForUser(user.uid);
      const userServerMessages = [];
      userServersForMessages.forEach(server => {
        const serverMessages = messages.get(server.id) || [];
        userServerMessages.push(...serverMessages);
      });
      socket.emit('messageHistory', userServerMessages);
      
      // Send a test message to verify messaging works
      const testMessage = {
        id: Date.now().toString(),
        content: `Welcome ${username}! This is a test message.`,
        author: 'System',
        timestamp: new Date(),
        channelId: 'general',
        serverId: 'default',
        type: 'text'
      };
      
      // Add test message to default server
      if (!messages.has('default')) {
        messages.set('default', []);
      }
      messages.get('default').push(testMessage);
      
      // Send test message only to users in default server
      const defaultServer = servers.get('default');
      if (defaultServer) {
        defaultServer.members.forEach(memberUid => {
          const memberSocket = Array.from(users.entries()).find(([_, u]) => u.uid === memberUid)?.[0];
          if (memberSocket) {
            io.to(memberSocket).emit('message', testMessage);
          }
        });
      } else {
        io.emit('message', testMessage);
      }
      
      // Send only servers the user is a member of
      const userServers = getServersForUser(user.uid);
      console.log(`Sending ${userServers.length} servers to user ${username}`);
      socket.emit('servers', userServers);
      
      // Send pending friend requests and notifications
      const pendingRequests = friendRequests.get(user.uid) || [];
      const pendingNotifications = notifications.get(user.uid) || [];
      
      if (pendingRequests.length > 0) {
        console.log(`Sending ${pendingRequests.length} pending friend requests to ${username}`);
        socket.emit('friendRequests', pendingRequests);
      }
      
      if (pendingNotifications.length > 0) {
        console.log(`Sending ${pendingNotifications.length} pending notifications to ${username}`);
        socket.emit('notifications', pendingNotifications);
      }
      
      // Send user's conversations (DMs)
      const userConversations = [];
      for (const [conversationId, conversation] of conversations) {
        if (conversation.participants.includes(username)) {
          userConversations.push({
            id: conversationId,
            participants: conversation.participants
          });
        }
      }
      
      if (userConversations.length > 0) {
        console.log(`Sending ${userConversations.length} conversations to ${username}`);
        socket.emit('conversations', userConversations);
      }
      
      // Send user's friends list
      const userFriends = friends.get(user.uid) || new Set();
      const friendsList = Array.from(userFriends).map(friendId => {
        const friend = Array.from(allUsers.values()).find(u => u.uid === friendId);
        return friend ? { uid: friend.uid, username: friend.username } : null;
      }).filter(Boolean);
      
      if (friendsList.length > 0) {
        console.log(`Sending ${friendsList.length} friends to ${username}`);
        socket.emit('friendsList', friendsList);
      }
      
      console.log(`${username} joined the chat`);
    });

    // Handle server creation
    socket.on('createServer', async (data) => {
      console.log('=== CREATE SERVER ===', data);
      
      const user = users.get(socket.id);
      if (!user) return;
      
      const inviteCode = generateUniqueInviteCode();
      if (!inviteCode) {
        socket.emit('error', 'Failed to generate invite code');
        return;
      }
      
      const newServer = {
        id: Date.now().toString(),
        name: data.name,
        ownerId: user.uid,
        inviteCode: inviteCode,
        channels: [
          { id: 'general', name: 'general', type: 'text', serverId: data.name },
          { id: 'voice', name: 'Voice Chat', type: 'voice', serverId: data.name }
        ],
        members: [user.uid]
      };
      
      servers.set(newServer.id, newServer);
      
      // Save to storage
      if (db) {
        try {
          await db.collection('servers').doc(newServer.id).set(newServer);
          console.log(`Server ${newServer.id} saved to Firestore`);
        } catch (error) {
          console.error('Error saving server to Firestore:', error);
        }
      } else {
        saveLocalData();
        console.log(`Server ${newServer.id} saved to local file`);
      }
      
      // Send new server to all users
      io.emit('serverCreated', newServer);
      console.log(`Server "${newServer.name}" created by ${user.username}`);
    });

    // Handle joining server with invite code
    socket.on('joinServer', async (data) => {
      console.log('=== JOIN SERVER ===', data);
      
      const user = users.get(socket.id);
      if (!user) return;
      
      const server = Array.from(servers.values()).find(s => s.inviteCode === data.inviteCode);
      if (!server) {
        socket.emit('error', 'Invalid invite code');
        return;
      }
      
      if (!server.members.includes(user.uid)) {
        server.members.push(user.uid);
        
        // Save to storage
        if (db) {
          try {
            await db.collection('servers').doc(server.id).update({
              members: server.members
            });
            console.log(`User ${user.uid} added to server ${server.id} in Firestore`);
          } catch (error) {
            console.error('Error updating server in Firestore:', error);
          }
        } else {
          saveLocalData();
          console.log(`User ${user.uid} added to server ${server.id} in local file`);
        }
        
        // Notify all users about the new member
        io.emit('serverUpdated', server);
        console.log(`${user.username} joined server "${server.name}"`);
      }
    });

    // Handle friend requests
    socket.on('sendFriendRequest', async (data) => {
      console.log('=== FRIEND REQUEST ===', data);
      
      const user = users.get(socket.id);
      if (!user) return;
      
      const targetUser = Array.from(allUsers.values()).find(u => u.username === data.targetUsername);
      if (!targetUser) {
        socket.emit('error', 'User not found');
        return;
      }
      
      if (targetUser.uid === user.uid) {
        socket.emit('error', 'Cannot send friend request to yourself');
        return;
      }
      
      const request = {
        fromId: user.uid,
        fromUsername: user.username,
        timestamp: new Date()
      };
      
      if (!friendRequests.has(targetUser.uid)) {
        friendRequests.set(targetUser.uid, []);
      }
      friendRequests.get(targetUser.uid).push(request);
      
      // Save to storage
      if (db) {
        try {
          await db.collection('friendRequests').doc(`${user.uid}_${targetUser.uid}`).set(request);
          console.log(`Friend request saved to Firestore`);
        } catch (error) {
          console.error('Error saving friend request to Firestore:', error);
        }
      }
      
      // Notify target user if they're online
      const targetSocket = Array.from(users.entries()).find(([_, u]) => u.uid === targetUser.uid)?.[0];
      if (targetSocket) {
        io.to(targetSocket).emit('friendRequest', request);
      }
      
      console.log(`${user.username} sent friend request to ${targetUser.username}`);
    });

    // Handle friend request responses
    socket.on('respondToFriendRequest', async (data) => {
      console.log('=== FRIEND REQUEST RESPONSE ===', data);
      
      const user = users.get(socket.id);
      if (!user) return;
      
      const requests = friendRequests.get(user.uid) || [];
      const request = requests.find(r => r.fromId === data.fromId);
      
      if (!request) {
        socket.emit('error', 'Friend request not found');
        return;
      }
      
      if (data.accepted) {
        // Add to friends list for both users
        if (!friends.has(user.uid)) {
          friends.set(user.uid, new Set());
        }
        if (!friends.has(data.fromId)) {
          friends.set(data.fromId, new Set());
        }
        
        friends.get(user.uid).add(data.fromId);
        friends.get(data.fromId).add(user.uid);
        
        // Save to storage
        if (db) {
          try {
            await db.collection('friends').doc(user.uid).set({
              friends: Array.from(friends.get(user.uid))
            });
            await db.collection('friends').doc(data.fromId).set({
              friends: Array.from(friends.get(data.fromId))
            });
            console.log(`Friendship saved to Firestore`);
          } catch (error) {
            console.error('Error saving friendship to Firestore:', error);
          }
        }
        
        // Notify both users
        const fromSocket = Array.from(users.entries()).find(([_, u]) => u.uid === data.fromId)?.[0];
        if (fromSocket) {
          io.to(fromSocket).emit('friendRequestAccepted', { by: user.username });
        }
        
        socket.emit('friendRequestAccepted', { by: request.fromUsername });
        console.log(`${user.username} accepted friend request from ${request.fromUsername}`);
      }
      
      // Remove the request
      const updatedRequests = requests.filter(r => r.fromId !== data.fromId);
      friendRequests.set(user.uid, updatedRequests);
    });

    // Handle conversation creation
    socket.on('createConversation', async (data) => {
      console.log('=== CREATE CONVERSATION ===', data);
      
      const user = users.get(socket.id);
      if (!user) return;
      
      const targetUser = Array.from(allUsers.values()).find(u => u.username === data.targetUsername);
      if (!targetUser) {
        socket.emit('error', 'User not found');
        return;
      }
      
      const conversationId = [user.username, targetUser.username].sort().join('_');
      const conversation = {
        participants: [user.username, targetUser.username]
      };
      
      conversations.set(conversationId, conversation);
      
      // Save to storage
      if (db) {
        try {
          await db.collection('conversations').doc(conversationId).set(conversation);
          console.log(`Conversation ${conversationId} saved to Firestore`);
        } catch (error) {
          console.error('Error saving conversation to Firestore:', error);
        }
      }
      
      // Notify both users
      const targetSocket = Array.from(users.entries()).find(([_, u]) => u.uid === targetUser.uid)?.[0];
      if (targetSocket) {
        io.to(targetSocket).emit('conversationCreated', {
          id: conversationId,
          participants: conversation.participants
        });
      }
      
      socket.emit('conversationCreated', {
        id: conversationId,
        participants: conversation.participants
      });
      
      console.log(`Conversation created between ${user.username} and ${targetUser.username}`);
    });

    // Handle direct message history request
    socket.on('getDirectMessageHistory', async (data) => {
      console.log('=== GET DM HISTORY ===', data);
      
      const user = users.get(socket.id);
      if (!user) return;
      
      const conversationId = data.conversationId;
      const dmHistory = directMessages.get(conversationId) || [];
      
      socket.emit('directMessageHistory', dmHistory);
      console.log(`Sent ${dmHistory.length} DM messages to ${user.username}`);
    });

    // Handle new messages
    socket.on('message', async (data) => {
      console.log('=== MESSAGE RECEIVED ===', data);

      const user = users.get(socket.id);
      if (!user) return;

      if (data.type === 'dm') {
        // Store DM
        const conversationId = data.conversationId;
        const message = {
          id: Date.now().toString(),
          content: data.content,
          author: user.username,
          timestamp: new Date(),
          type: data.type || 'dm'
        };
        if (data.conversationId) {
          message.conversationId = data.conversationId;
        }
        if (data.channelId) {
          message.channelId = data.channelId;
        }
        if (data.serverId) {
          message.serverId = data.serverId;
        }
        if (!directMessages.has(conversationId)) {
          directMessages.set(conversationId, []);
        }
        directMessages.get(conversationId).push(message);

        // Save DM to Firestore or local file
        if (db) {
          try {
            console.log('Attempting to save DM to Firestore:', message);
            await db.collection('directMessages').doc(message.id).set(message);
            console.log(`DM ${message.id} saved to Firestore`);
          } catch (error) {
            console.error('Error saving DM to Firestore:', error);
          }
        } else {
          saveLocalData();
          console.log(`DM ${message.id} saved to local file`);
        }

        // Emit to BOTH participants (including sender)
        const conversation = conversations.get(conversationId);
        if (conversation) {
          conversation.participants.forEach(participantUsername => {
            const participantSocket = Array.from(users.entries()).find(([_, u]) => u.username === participantUsername)?.[0];
            if (participantSocket) {
              io.to(participantSocket).emit('message', message);
            }
          });
          console.log('DM message sent to both participants:', conversation.participants);
        } else {
          console.log('DM conversation not found:', conversationId);
        }
      } else {
        // Handle server message
        const serverId = data.serverId || 'default';
        
        // Create message object for server messages
        const message = {
          id: Date.now().toString(),
          content: data.content,
          author: user.username,
          timestamp: new Date(),
          channelId: data.channelId,
          serverId: serverId,
          type: data.type || 'text'
        };
        
        if (!messages.has(serverId)) {
          messages.set(serverId, []);
        }
        messages.get(serverId).push(message);
        
        // Save to storage
        if (db) {
          try {
            console.log('Attempting to save message to Firestore:', message);
            await db.collection('messages').doc(message.id).set(message);
            console.log(`Message ${message.id} saved to Firestore`);
          } catch (error) {
            console.error('Error saving message to Firestore:', error);
          }
        } else {
          saveLocalData();
          console.log(`Message ${message.id} saved to local file`);
        }
        
        console.log(`Added message to server ${serverId}. Total messages in server: ${messages.get(serverId).length}`);
        
        // Broadcast message only to users in this server
        const server = servers.get(serverId);
        if (server) {
          server.members.forEach(memberUid => {
            const memberSocket = Array.from(users.entries()).find(([_, u]) => u.uid === memberUid)?.[0];
            if (memberSocket) {
              io.to(memberSocket).emit('message', message);
            }
          });
        } else {
          io.emit('message', message);
        }
      }
      
      console.log(`${user.username}: ${data.content} (${data.type || 'text'}) in server ${data.serverId || 'default'}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('=== USER DISCONNECTED ===');
      console.log('Socket ID:', socket.id);
      
      const user = users.get(socket.id);
      if (user) {
        console.log('User disconnected:', user.username);
        
        // Update user status to offline
        user.status = 'offline';
        user.lastSeen = new Date();
        
        // Update persistent user status
        const persistentUser = allUsers.get(user.uid);
        if (persistentUser) {
          persistentUser.status = 'offline';
          persistentUser.lastSeen = new Date();
        }
        
        // Remove from users map
        users.delete(socket.id);
        
        // Notify other users
        socket.broadcast.emit('userLeft', user.uid);
        
        console.log('Total connections after disconnect:', io.engine.clientsCount);
      } else {
        console.log('Unknown socket disconnected:', socket.id);
      }
    });
  });

  const PORT = process.env.PORT || 3001;

  server.listen(PORT, () => {
    console.log(`Embedded server running on port ${PORT}`);
  }).on('error', (error) => {
    console.error('Failed to start embedded server:', error);
    // Don't crash the app if server fails to start
  });
  } catch (error) {
    console.error('Failed to start embedded server:', error);
    // Don't crash the app if server fails to start
  }
}

// Stop the backend server
function stopServer() {
  // Since the server is now embedded, we don't need to kill a separate process
  console.log('Server is embedded in main process - no separate process to stop');
}

function createWindow() {
  console.log('Creating main window...');
  
  // Create the browser window
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
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    titleBarStyle: 'default',
    show: false
  });

  console.log('Window created, loading app...');

  // Load the app
  if (isDev) {
    console.log('Loading development URL: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    console.log('Loading production file:', indexPath);
    
    // Check if the file exists
    if (!fs.existsSync(indexPath)) {
      console.error('Production index.html not found at:', indexPath);
      mainWindow.loadURL('data:text/html,<h1>Error: index.html not found</h1>');
    } else {
      console.log('Production file exists, loading...');
      mainWindow.loadFile(indexPath);
    }
    
    // Open dev tools in production for debugging
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show, displaying...');
    mainWindow.show();
    mainWindow.focus();
  });
  
  // Force show window after 5 seconds if not shown
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('Forcing window to show after timeout...');
      mainWindow.show();
      mainWindow.focus();
    }
  }, 5000);

  // Handle window closed
  mainWindow.on('closed', () => {
    console.log('Main window closed');
    mainWindow = null;
  });

  // Handle load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
  });

  // Handle console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`Renderer [${level}]: ${message}`);
  });
}

// Create menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Restart Server',
          click: () => {
            stopServer();
            setTimeout(() => {
              startServer();
            }, 1000);
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(() => {
  console.log('App is ready, starting server...');
  startServer();
  
  // Wait longer for server to start before creating window
  setTimeout(() => {
    console.log('Creating window after server startup...');
    createWindow();
    createMenu();
  }, 5000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});

// Handle app quit
app.on('quit', () => {
  stopServer();
});

// IPC handlers for communication between main and renderer processes
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-name', () => {
  return app.getName();
}); 