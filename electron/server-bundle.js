// Bundled server for Electron app
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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
  console.log(`Bundled server running on port ${PORT}`);
}); 