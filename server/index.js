const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')
const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

// Initialize Firebase Admin (optional for now)
let db = null
try {
  const serviceAccount = require('./firebase-service-account.json')
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })
  db = admin.firestore()
  console.log('Firebase Admin initialized successfully for project: discord-clone-a5b1c')
} catch (error) {
  console.log('Firebase Admin not configured - using local file storage')
  console.log('To enable Firestore integration, add your firebase-service-account.json file')
  console.log('Make sure the service account has access to project: discord-clone-a5b1c')
}

// Local file storage functions
const DATA_DIR = path.join(__dirname, 'data')
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json')
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json')

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Load data from local files
function loadLocalData() {
  try {
    if (fs.existsSync(SERVERS_FILE)) {
      const serversData = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'))
      Object.entries(serversData).forEach(([id, server]) => {
        servers.set(id, server)
        if (server.inviteCode) {
          usedInviteCodes.add(server.inviteCode)
        }
      })
      console.log(`Loaded ${servers.size} servers from local file`)
    }
    
    if (fs.existsSync(MESSAGES_FILE)) {
      const messagesData = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'))
      Object.entries(messagesData).forEach(([serverId, serverMessages]) => {
        messages.set(serverId, serverMessages)
      })
      console.log(`Loaded messages from local file for ${messages.size} servers`)
    }
  } catch (error) {
    console.error('Error loading local data:', error)
  }
}

// Save data to local files
function saveLocalData() {
  try {
    // Save servers
    const serversData = {}
    servers.forEach((server, id) => {
      serversData[id] = server
    })
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(serversData, null, 2))
    
    // Save messages
    const messagesData = {}
    messages.forEach((serverMessages, serverId) => {
      messagesData[serverId] = serverMessages
    })
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messagesData, null, 2))
    
    console.log('Data saved to local files')
  } catch (error) {
    console.error('Error saving local data:', error)
  }
}

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"]
  }
})

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173"],
  credentials: true
}))
app.use(express.json())

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running!', timestamp: new Date().toISOString() })
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount,
    servers: servers.size,
    users: users.size
  })
})

// Store connected users and servers
const users = new Map() // socketId -> User
const allUsers = new Map() // uid -> User (persistent storage)
const messages = new Map() // serverId -> Message[]
const servers = new Map()

// Voice channel tracking
const voiceChannels = new Map() // channelId -> Set of socketIds
const voiceParticipants = new Map() // socketId -> { channelId, username }

// Direct messaging
const directMessages = new Map() // conversationId -> Message[]
const conversations = new Map() // conversationId -> { participants: [userId1, userId2] }

// Friend system
const friendRequests = new Map() // receiverId -> Array of { fromId, fromUsername, timestamp }
const friends = new Map() // userId -> Set of friend userIds
const notifications = new Map() // userId -> Array of { type, content, timestamp, id }

// Track used invite codes to ensure uniqueness
const usedInviteCodes = new Set()

// Generate unique random invite code
const generateUniqueInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  let attempts = 0
  const maxAttempts = 100
  
  do {
    result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    attempts++
  } while (usedInviteCodes.has(result) && attempts < maxAttempts)
  
  if (attempts >= maxAttempts) {
    console.error('Failed to generate unique invite code after', maxAttempts, 'attempts')
    return null
  }
  
  usedInviteCodes.add(result)
  return result
}

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
  }
  servers.set('default', defaultServer)
  usedInviteCodes.add('WELCOME')
  return defaultServer
}

// Initialize default server
if (servers.size === 0) {
  createDefaultServer()
}

// Load servers from Firestore on startup (if available)
async function loadServersFromFirestore() {
  if (!db) return
  
  try {
    console.log('Loading servers from Firestore...')
    const serversSnapshot = await db.collection('servers').get()
    serversSnapshot.forEach(doc => {
      const serverData = doc.data()
      servers.set(doc.id, serverData)
      if (serverData.inviteCode) {
        usedInviteCodes.add(serverData.inviteCode)
      }
    })
    console.log(`Loaded ${servers.size} servers from Firestore`)
  } catch (error) {
    console.error('Error loading servers from Firestore:', error)
  }
}

// Load messages from Firestore on startup (if available)
async function loadMessagesFromFirestore() {
  if (!db) return
  
  try {
    console.log('Loading messages from Firestore...')
    const messagesSnapshot = await db.collection('messages').get()
    messagesSnapshot.forEach(doc => {
      const messageData = doc.data()
      const serverId = messageData.serverId || 'default'
      if (!messages.has(serverId)) {
        messages.set(serverId, [])
      }
      messages.get(serverId).push(messageData)
    })
    console.log(`Loaded messages from Firestore for ${messages.size} servers`)
  } catch (error) {
    console.error('Error loading messages from Firestore:', error)
  }
}

// Load DMs from Firestore on startup
async function loadDMsFromFirestore() {
  if (!db) return;
  try {
    console.log('Loading DMs from Firestore...');
    const dmsSnapshot = await db.collection('directMessages').get();
    dmsSnapshot.forEach(doc => {
      const dmData = doc.data();
      const conversationId = dmData.conversationId;
      if (!directMessages.has(conversationId)) {
        directMessages.set(conversationId, []);
      }
      directMessages.get(conversationId).push(dmData);
    });
    console.log(`Loaded DMs from Firestore for ${directMessages.size} conversations`);
  } catch (error) {
    console.error('Error loading DMs from Firestore:', error);
  }
}

// Firestore friends persistence helpers
async function saveFriendsToFirestore(userUid) {
  if (!db) return;
  const userFriends = Array.from(friends.get(userUid) || []);
  try {
    await db.collection('friends').doc(userUid).set({ friends: userFriends });
    console.log(`Saved friends for ${userUid} to Firestore`);
  } catch (error) {
    console.error('Error saving friends to Firestore:', error);
  }
}

async function loadFriendsFromFirestore() {
  if (!db) return;
  try {
    console.log('Loading friends from Firestore...');
    const friendsSnapshot = await db.collection('friends').get();
    friendsSnapshot.forEach(doc => {
      friends.set(doc.id, new Set(doc.data().friends));
    });
    console.log(`Loaded friends for ${friends.size} users from Firestore`);
  } catch (error) {
    console.error('Error loading friends from Firestore:', error);
  }
}

// Firestore conversations persistence helpers
async function saveConversationToFirestore(conversationId) {
  if (!db) return;
  const conversation = conversations.get(conversationId);
  if (!conversation) return;
  try {
    await db.collection('conversations').doc(conversationId).set(conversation);
    console.log(`Saved conversation ${conversationId} to Firestore`);
  } catch (error) {
    console.error('Error saving conversation to Firestore:', error);
  }
}

async function loadConversationsFromFirestore() {
  if (!db) return;
  try {
    console.log('Loading conversations from Firestore...');
    const snapshot = await db.collection('conversations').get();
    snapshot.forEach(doc => {
      conversations.set(doc.id, doc.data());
    });
    console.log(`Loaded ${conversations.size} conversations from Firestore`);
  } catch (error) {
    console.error('Error loading conversations from Firestore:', error);
  }
}

// Initialize data from storage
if (db) {
  // Use Firestore if available
  loadServersFromFirestore().then(() => {
    console.log('Servers loaded from Firestore')
  }).catch(error => {
    console.error('Error loading servers:', error)
  })

  loadMessagesFromFirestore().then(() => {
    console.log('Messages loaded from Firestore')
  }).catch(error => {
    console.error('Error loading messages:', error)
  })

  loadDMsFromFirestore().then(() => {
    console.log('DMs loaded from Firestore');
  }).catch(error => {
    console.error('Error loading DMs:', error);
  });

  loadFriendsFromFirestore().then(() => {
    console.log('Friends loaded from Firestore');
  }).catch(error => {
    console.error('Error loading friends:', error);
  });

  loadConversationsFromFirestore().then(() => {
    console.log('Conversations loaded from Firestore');
  }).catch(error => {
    console.error('Error loading conversations:', error);
  });
} else {
  // Use local file storage
  loadLocalData()
}

// Helper: get servers for a user
const getServersForUser = (userUid) => {
  return Array.from(servers.values()).filter(server => server.members.includes(userUid))
}

io.on('connection', (socket) => {
  console.log('=== NEW CONNECTION ===')
  console.log('User connected:', socket.id)
  console.log('Total connections:', io.engine.clientsCount)

  // Handle user login
  socket.on('login', async (data) => {
    console.log('Login attempt for user:', data)
    
    // Handle both old format (username string) and new format (object with username and uid)
    const username = typeof data === 'string' ? data : data.username
    const uid = typeof data === 'string' ? data : data.uid
    
    const user = {
      id: socket.id,
      username: username,
      uid: uid, // Use the actual Firebase UID
      status: 'online',
      lastSeen: new Date()
    }
    
    users.set(socket.id, user)
    
    // Store user persistently
    const persistentUser = {
      username: username,
      uid: uid,
      status: 'online',
      lastSeen: new Date()
    }
    allUsers.set(uid, persistentUser)
    
    console.log('Users map size:', users.size)
    console.log('All users map size:', allUsers.size)
    console.log('User object created:', user)
    
    // Update user status in Firestore (if available)
    if (db) {
      try {
        await db.collection('users').doc(username).set({
          username: username,
          status: 'online',
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
          socketId: socket.id
        }, { merge: true })
        console.log(`Updated ${username} status to online in Firestore`)
      } catch (error) {
        console.error('Error updating user status in Firestore:', error)
      }
    } else {
      console.log(`User ${username} logged in (local tracking only)`)
    }
    
    // Send current user list to all clients (including offline users)
    const userListForFrontend = Array.from(allUsers.values()).map(user => ({
      id: user.uid, // Use UID as ID for consistency
      username: user.username,
      status: user.status
    }))
    io.emit('userList', userListForFrontend)
    
    // Send server-specific user list if user is in a server
    const userServersForList = getServersForUser(user.uid)
    if (userServersForList.length > 0) {
      // Get all users in the same servers as this user
      const serverUserIds = new Set()
      userServersForList.forEach(server => {
        server.members.forEach(memberId => serverUserIds.add(memberId))
      })
      
      const serverUserList = Array.from(allUsers.values())
        .filter(user => serverUserIds.has(user.uid))
        .map(user => ({
          id: user.uid,
          username: user.username,
          status: user.status
        }))
      
      socket.emit('serverUserList', serverUserList)
    }
    
    // Notify others that user joined
    socket.broadcast.emit('userJoined', {
      id: user.uid,
      username: user.username,
      status: user.status
    })
    
    // Send existing messages to new user (only from servers they're in)
    const userServersForMessages = getServersForUser(user.uid)
    const userServerMessages = []
    userServersForMessages.forEach(server => {
      const serverMessages = messages.get(server.id) || []
      userServerMessages.push(...serverMessages)
    })
    socket.emit('messageHistory', userServerMessages)
    
    // Send a test message to verify messaging works
    const testMessage = {
      id: Date.now().toString(),
      content: `Welcome ${username}! This is a test message.`,
      author: 'System',
      timestamp: new Date(),
      channelId: 'general',
      serverId: 'default',
      type: 'text'
    }
    
    // Add test message to default server
    if (!messages.has('default')) {
      messages.set('default', [])
    }
    messages.get('default').push(testMessage)
    
    // Send test message only to users in default server
    const defaultServer = servers.get('default')
    if (defaultServer) {
      defaultServer.members.forEach(memberUid => {
        const memberSocket = Array.from(users.entries()).find(([_, u]) => u.uid === memberUid)?.[0]
        if (memberSocket) {
          io.to(memberSocket).emit('message', testMessage)
        }
      })
    } else {
      // Fallback: send to all if default server not found
      io.emit('message', testMessage)
    }
    
    // Send only servers the user is a member of
    const userServers = getServersForUser(user.uid)
    console.log(`Sending ${userServers.length} servers to user ${username}`)
    socket.emit('servers', userServers)
    
    // Send pending friend requests and notifications
    const pendingRequests = friendRequests.get(user.uid) || []
    const pendingNotifications = notifications.get(user.uid) || []
    
    if (pendingRequests.length > 0) {
      console.log(`Sending ${pendingRequests.length} pending friend requests to ${username}`)
      socket.emit('friendRequests', pendingRequests)
    }
    
    if (pendingNotifications.length > 0) {
      console.log(`Sending ${pendingNotifications.length} pending notifications to ${username}`)
      socket.emit('notifications', pendingNotifications)
    }
    
    // Send user's conversations (DMs)
    const userConversations = []
    for (const [conversationId, conversation] of conversations) {
      if (conversation.participants.includes(username)) {
        userConversations.push({
          id: conversationId,
          participants: conversation.participants
        })
      }
    }
    
    if (userConversations.length > 0) {
      console.log(`Sending ${userConversations.length} conversations to ${username}`)
      socket.emit('conversations', userConversations)
    }
    
    // Send user's friends list
    const userFriends = friends.get(user.uid) || new Set()
    const friendsList = Array.from(userFriends).map(friendId => {
      const friend = Array.from(allUsers.values()).find(u => u.uid === friendId)
      return friend ? { uid: friend.uid, username: friend.username } : null
    }).filter(Boolean)
    
    if (friendsList.length > 0) {
      console.log(`Sending ${friendsList.length} friends to ${username}`)
      socket.emit('friendsList', friendsList)
    }
    
    console.log(`${username} joined the chat`)
  })

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
      const serverId = data.serverId || 'default'
      
      // Create message object for server messages
      const message = {
        id: Date.now().toString(),
        content: data.content,
        author: user.username,
        timestamp: new Date(),
        channelId: data.channelId,
        serverId: serverId,
        type: data.type || 'text'
      }
      
      if (!messages.has(serverId)) {
        messages.set(serverId, [])
      }
      messages.get(serverId).push(message)
      
      // Save to storage
      if (db) {
        try {
          console.log('Attempting to save message to Firestore:', message)
          await db.collection('messages').doc(message.id).set(message)
          console.log(`Message ${message.id} saved to Firestore`)
        } catch (error) {
          console.error('Error saving message to Firestore:', error)
        }
      } else {
        // Save to local file
        saveLocalData()
        console.log(`Message ${message.id} saved to local file`)
      }
      
      console.log(`Added message to server ${serverId}. Total messages in server: ${messages.get(serverId).length}`)
      console.log('All servers with messages:', Array.from(messages.entries()).map(([id, msgs]) => `${id}: ${msgs.length} msgs`))
      
      // Broadcast message only to users in this server
      const server = servers.get(serverId)
      if (server) {
        server.members.forEach(memberUid => {
          const memberSocket = Array.from(users.entries()).find(([_, u]) => u.uid === memberUid)?.[0]
          if (memberSocket) {
            io.to(memberSocket).emit('message', message)
          }
        })
      } else {
        // Fallback: broadcast to all if server not found
        io.emit('message', message)
      }
    }
    
    console.log(`${user.username}: ${data.content} (${data.type || 'text'}) in server ${data.serverId || 'default'}`)
  })

  // Debug command to list all stored messages
  socket.on('debugMessages', () => {
    const user = users.get(socket.id)
    if (user) {
      console.log('=== DEBUG MESSAGES ===')
      console.log('All servers with messages:')
      Array.from(messages.entries()).forEach(([serverId, msgs]) => {
        console.log(`Server ${serverId}: ${msgs.length} messages`)
        msgs.slice(-3).forEach(msg => console.log(`  - ${msg.author}: ${msg.content}`))
      })
      
      console.log('All DM conversations:')
      Array.from(directMessages.entries()).forEach(([convId, msgs]) => {
        console.log(`Conversation ${convId}: ${msgs.length} messages`)
        msgs.slice(-3).forEach(msg => console.log(`  - ${msg.author}: ${msg.content}`))
      })
      
      socket.emit('debugResponse', {
        servers: Array.from(messages.entries()).map(([id, msgs]) => ({ id, count: msgs.length })),
        dms: Array.from(directMessages.entries()).map(([id, msgs]) => ({ id, count: msgs.length }))
      })
    }
  })

  // Handle server creation
  socket.on('createServer', async (data) => {
    console.log('Server: Received createServer event:', data);
    const user = users.get(socket.id)
    console.log('Server: User found:', user);
    
    if (user) {
      const serverId = Date.now().toString()
      const inviteCode = generateUniqueInviteCode()
      
      if (!inviteCode) {
        console.error('Failed to generate unique invite code')
        socket.emit('serverError', 'Failed to create server - please try again')
        return
      }
      
      const newServer = {
        id: serverId,
        name: data.name,
        ownerId: data.ownerId,
        inviteCode: inviteCode,
        channels: [
          { id: 'general', name: 'general', type: 'text', serverId: serverId },
          { id: 'voice', name: 'Voice Chat', type: 'voice', serverId: serverId }
        ],
        members: [user.uid]
      }
      
      console.log('Server: Creating new server:', newServer);
      servers.set(serverId, newServer)
      
      // Save to storage
      if (db) {
        try {
          await db.collection('servers').doc(serverId).set(newServer)
          console.log(`Server ${serverId} saved to Firestore`)
        } catch (error) {
          console.error('Error saving server to Firestore:', error)
        }
      } else {
        // Save to local file
        saveLocalData()
        console.log(`Server ${serverId} saved to local file`)
      }
      
      // Only send new server to the creator
      socket.emit('serverCreated', newServer)
      
      // Optionally, send updated server list
      socket.emit('servers', getServersForUser(user.uid))
      
      // Send server user list for the new server
      const serverUserList = Array.from(allUsers.values())
        .filter(u => newServer.members.includes(u.uid))
        .map(user => ({
          id: user.uid,
          username: user.username,
          status: user.status
        }))
      
      socket.emit('serverUserList', serverUserList)
      
      console.log(`Server created: ${data.name} with invite code: ${inviteCode}`)
    } else {
      console.log('Server: User not found for socket:', socket.id);
    }
  })

  // Handle server joining
  socket.on('joinServer', async (data) => {
    console.log('=== JOIN SERVER REQUEST ===')
    console.log('Join server data:', data)
    
    const user = users.get(socket.id)
    if (user) {
      console.log('User found:', user.username)
      
      // Find server by invite code
      let targetServer = null
      for (const [serverId, server] of servers) {
        console.log(`Checking server ${server.name} with invite code: ${server.inviteCode}`)
        if (server.inviteCode === data.inviteCode) {
          targetServer = server
          break
        }
      }
      
      if (targetServer) {
        console.log('Target server found:', targetServer.name)
        
        // Add user to server if not already a member
        if (!targetServer.members.includes(user.uid)) {
          targetServer.members.push(user.uid)
          console.log(`Added ${user.username} to server ${targetServer.name}`)
          
          // Update server in storage
          if (db) {
            try {
              await db.collection('servers').doc(targetServer.id).update({
                members: targetServer.members
              })
              console.log(`Updated server ${targetServer.id} members in Firestore`)
            } catch (error) {
              console.error('Error updating server in Firestore:', error)
            }
          } else {
            // Save to local file
            saveLocalData()
            console.log(`Updated server ${targetServer.id} members in local file`)
          }
        } else {
          console.log(`${user.username} is already a member of ${targetServer.name}`)
        }
        
        // Only send updated server list to this user
        socket.emit('servers', getServersForUser(user.uid))
        
        // Send server user list for the joined server
        const serverUserList = Array.from(allUsers.values())
          .filter(u => targetServer.members.includes(u.uid))
          .map(user => ({
            id: user.uid,
            username: user.username,
            status: user.status
          }))
        
        socket.emit('serverUserList', serverUserList)
        
        // Send success message to client
        socket.emit('serverJoined', { server: targetServer, message: `Successfully joined ${targetServer.name}` })
        
        console.log(`${user.username} joined server: ${targetServer.name}`)
      } else {
        console.log('No server found with invite code:', data.inviteCode)
        // Send error to client
        socket.emit('serverError', 'Invalid invite code')
      }
    } else {
      console.log('No user found for socket:', socket.id)
      socket.emit('serverError', 'User not authenticated')
    }
  })

  // Handle server selection - send server-specific messages
  socket.on('selectServer', (serverId) => {
    const user = users.get(socket.id)
    if (user) {
      // Send server-specific message history
      const serverMessages = messages.get(serverId) || []
      console.log(`Sending ${serverMessages.length} messages for server ${serverId}`)
      socket.emit('messageHistory', serverMessages)
      
      // Send server-specific user list
      const server = servers.get(serverId)
      if (server) {
        const serverUserList = Array.from(allUsers.values())
          .filter(user => server.members.includes(user.uid))
          .map(user => ({
            id: user.uid,
            username: user.username,
            status: user.status
          }))
        
        socket.emit('serverUserList', serverUserList)
        console.log(`Sending ${serverUserList.length} users for server ${serverId}`)
      }
      
      console.log(`${user.username} selected server ${serverId}`)
    }
  })

  // Handle direct message history request
  socket.on('getDirectMessages', (conversationId) => {
    const user = users.get(socket.id)
    if (user) {
      const dmHistory = directMessages.get(conversationId) || []
      socket.emit('directMessageHistory', { conversationId, messages: dmHistory })
    }
  })

  // Handle direct message conversation creation
  socket.on('createConversation', (data) => {
    const user = users.get(socket.id)
    if (user) {
      const { participantId } = data
      const conversationId = [user.username, participantId].sort().join('-')
      
      if (!conversations.has(conversationId)) {
        conversations.set(conversationId, {
          participants: [user.username, participantId],
          createdAt: new Date()
        })
        directMessages.set(conversationId, [])
      }
      
      // Send conversation info to both participants
      const conversation = conversations.get(conversationId)
      conversation.participants.forEach(participantId => {
        const participantSocket = Array.from(users.entries()).find(([_, u]) => u.username === participantId)?.[0]
        if (participantSocket) {
          io.to(participantSocket).emit('conversationCreated', {
            conversationId,
            participants: conversation.participants
          })
        }
      })
    }
  })

  // Handle voice channel join
  socket.on('joinVoiceChannel', (data) => {
    const user = users.get(socket.id)
    if (user) {
      const { channelId, username, serverId } = data
      // Add to voice channel
      if (!voiceChannels.has(channelId)) {
        voiceChannels.set(channelId, new Set())
      }
      voiceChannels.get(channelId).add(socket.id)
      // Track participant
      voiceParticipants.set(socket.id, { channelId, username, serverId })
      // Notify others in the same channel (for WebRTC signaling)
      voiceChannels.get(channelId).forEach(peerSocketId => {
        if (peerSocketId !== socket.id) {
          io.to(peerSocketId).emit('voice-user-joined', socket.id)
          // Also notify the new user about existing peers
          socket.emit('voice-user-joined', peerSocketId)
        }
      })
      // Notify others in the same server's voice channel (for UI presence)
      socket.to(channelId).emit('voiceChannelJoined', { channelId, username, serverId })
      // Send current participants to the new user (for UI presence)
      const participants = Array.from(voiceChannels.get(channelId)).map(socketId => {
        const participant = voiceParticipants.get(socketId)
        return participant ? { id: socketId, username: participant.username } : null
      }).filter(Boolean)
      socket.emit('voiceParticipants', participants)
      console.log(`${username} joined voice channel ${channelId} in server ${serverId}`)
    }
  })

  // Handle voice channel leave
  socket.on('leaveVoiceChannel', (data) => {
    const user = users.get(socket.id)
    if (user) {
      const { channelId, username, serverId } = data
      // Remove from voice channel
      if (voiceChannels.has(channelId)) {
        voiceChannels.get(channelId).delete(socket.id)
        if (voiceChannels.get(channelId).size === 0) {
          voiceChannels.delete(channelId)
        }
      }
      // Remove participant tracking
      voiceParticipants.delete(socket.id)
      // Notify others in the channel (for WebRTC signaling)
      if (voiceChannels.has(channelId)) {
        voiceChannels.get(channelId).forEach(peerSocketId => {
          io.to(peerSocketId).emit('voice-user-left', socket.id)
        })
      }
      // Notify others in the channel (for UI presence)
      socket.to(channelId).emit('voiceChannelLeft', { channelId, username, serverId })
      console.log(`${username} left voice channel ${channelId} in server ${serverId}`)
    }
  })

  // Relay WebRTC signaling messages
  socket.on('voice-signal', (data) => {
    const { to } = data
    if (to && users.has(to)) {
      io.to(to).emit('voice-signal', { ...data, from: socket.id })
    }
  })

  // Handle disconnection
  socket.on('disconnect', async () => {
    const user = users.get(socket.id)
    if (user) {
      // Handle voice channel cleanup
      const participant = voiceParticipants.get(socket.id)
      if (participant) {
        const { channelId, username, serverId } = participant
        
        // Remove from voice channel
        if (voiceChannels.has(channelId)) {
          voiceChannels.get(channelId).delete(socket.id)
          if (voiceChannels.get(channelId).size === 0) {
            voiceChannels.delete(channelId)
          }
        }
        
        // Remove participant tracking
        voiceParticipants.delete(socket.id)
        
        // Notify others in the channel
        socket.to(channelId).emit('voiceChannelLeft', { channelId, username, serverId })
        
        console.log(`${username} disconnected from voice channel ${channelId} in server ${serverId}`)
      }
      
      // Update user status to offline in persistent storage
      const persistentUser = allUsers.get(user.uid)
      if (persistentUser) {
        persistentUser.status = 'offline'
        persistentUser.lastSeen = new Date()
      }
      
      users.delete(socket.id)
      
      // Update user status in Firestore (if available)
      if (db) {
        try {
          await db.collection('users').doc(user.username).set({
            status: 'offline',
            lastSeen: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true })
          console.log(`Updated ${user.username} status to offline in Firestore`)
        } catch (error) {
          console.error('Error updating user status in Firestore:', error)
        }
      } else {
        console.log(`User ${user.username} disconnected (local tracking only)`)
      }
      
      // Notify others that user left
      socket.broadcast.emit('userLeft', user.uid)
      
      // Send updated user list (including offline users)
      const userListForFrontend = Array.from(allUsers.values()).map(user => ({
        id: user.uid,
        username: user.username,
        status: user.status
      }))
      io.emit('userList', userListForFrontend)
      
      console.log(`${user.username} left the chat`)
    }
  })

  // On request, send only user's servers
  socket.on('getServers', () => {
    const user = users.get(socket.id)
    if (user) {
      socket.emit('servers', getServersForUser(user.uid))
    }
  })

  // Handle leaving a server
  socket.on('leaveServer', (serverId) => {
    console.log('=== LEAVE SERVER REQUEST ===')
    console.log('ServerId:', serverId)
    
    const user = users.get(socket.id)
    console.log('User found:', user)
    
    if (user) {
      const server = servers.get(serverId)
      console.log('Server found:', server)
      console.log('Server members before:', server?.members)
      console.log('User uid:', user.uid)
      console.log('Is user in members?', server?.members.includes(user.uid))
      
      if (server) {
        // Remove user from members
        const beforeCount = server.members.length
        server.members = server.members.filter(uid => uid !== user.uid)
        const afterCount = server.members.length
        console.log(`Removed user from server. Members: ${beforeCount} -> ${afterCount}`)
        
        // If no members left, delete the server
        if (server.members.length === 0) {
          console.log('No members left, deleting server')
          servers.delete(serverId)
        }
        
        // Send updated server list to user
        const userServers = getServersForUser(user.uid)
        console.log('Sending updated servers to user:', userServers.length)
        socket.emit('servers', userServers)
        socket.emit('serverLeft', { serverId })
        
        console.log(`User ${user.username} left server ${server.name}`)
      } else {
        console.log('Server not found')
        socket.emit('serverError', 'Server not found')
      }
    } else {
      console.log('User not found for socket:', socket.id)
      socket.emit('serverError', 'User not authenticated')
    }
  })

  // Friend request system
  socket.on('sendFriendRequest', async (targetUsername) => {
    const user = users.get(socket.id)
    if (!user) return

    console.log('=== FRIEND REQUEST DEBUG ===')
    console.log('Current user:', user)
    console.log('Target username:', targetUsername)
    console.log('All users:', Array.from(users.values()).map(u => ({ username: u.username, uid: u.uid })))

    // Find target user by username (check both online and offline users)
    const targetUser = Array.from(allUsers.values()).find(u => u.username === targetUsername)
    if (!targetUser) {
      console.log('Target user not found in any users')
      socket.emit('friendRequestError', 'User not found')
      return
    }

    if (targetUser.uid === user.uid) {
      socket.emit('friendRequestError', 'Cannot send friend request to yourself')
      return
    }

    // Check if already friends
    const userFriends = friends.get(user.uid) || new Set()
    const targetFriends = friends.get(targetUser.uid) || new Set()
    if (userFriends.has(targetUser.uid) || targetFriends.has(user.uid)) {
      socket.emit('friendRequestError', 'Already friends')
      return
    }

    // Check if request already sent
    const existingRequests = friendRequests.get(targetUser.uid) || []
    if (existingRequests.some(req => req.fromId === user.uid)) {
      socket.emit('friendRequestError', 'Friend request already sent')
      return
    }

    // Add friend request
    const request = {
      fromId: user.uid,
      fromUsername: user.username,
      timestamp: new Date()
    }
    
    if (!friendRequests.has(targetUser.uid)) {
      friendRequests.set(targetUser.uid, [])
    }
    friendRequests.get(targetUser.uid).push(request)

    // Add notification
    const notification = {
      id: Date.now().toString(),
      type: 'friend_request',
      content: `${user.username} sent you a friend request`,
      timestamp: new Date(),
      data: { fromId: user.uid, fromUsername: user.username }
    }
    
    if (!notifications.has(targetUser.uid)) {
      notifications.set(targetUser.uid, [])
    }
    notifications.get(targetUser.uid).push(notification)

    // Send notification to target user (if online)
    const targetSocket = Array.from(users.entries()).find(([_, u]) => u.uid === targetUser.uid)?.[0]
    console.log('Target socket found:', targetSocket)
    if (targetSocket) {
      io.to(targetSocket).emit('newNotification', notification)
      io.to(targetSocket).emit('friendRequests', friendRequests.get(targetUser.uid) || [])
      console.log('Sent notification to target user')
    } else {
      console.log('Target user is offline - friend request will be available when they come online')
      // The friend request is still stored and will be available when they log in
    }

    socket.emit('friendRequestSent', { targetUsername })
    console.log(`${user.username} sent friend request to ${targetUsername}`)
  })

  socket.on('respondToFriendRequest', async (data) => {
    const user = users.get(socket.id)
    if (!user) return

    console.log('=== FRIEND REQUEST RESPONSE DEBUG ===')
    console.log('Response data:', data)
    console.log('Current user:', user)

    const { fromId, accepted } = data
    const requests = friendRequests.get(user.uid) || []
    console.log('User friend requests:', requests)
    const request = requests.find(req => req.fromId === fromId)
    
    if (!request) {
      console.log('Friend request not found')
      socket.emit('friendRequestError', 'Friend request not found')
      return
    }

    // Remove the request
    friendRequests.set(user.uid, requests.filter(req => req.fromId !== fromId))

    if (accepted) {
      console.log('Friend request accepted - adding to friends list')
      
      // Add to friends list for both users
      if (!friends.has(user.uid)) friends.set(user.uid, new Set())
      if (!friends.has(fromId)) friends.set(fromId, new Set())
      
      friends.get(user.uid).add(fromId)
      friends.get(fromId).add(user.uid)

      console.log('Friends lists updated')
      console.log('User friends:', Array.from(friends.get(user.uid) || []))
      console.log('From user friends:', Array.from(friends.get(fromId) || []))

      // Create DM conversation
      const conversationId = [user.uid, fromId].sort().join('-')
      console.log('Creating conversation with ID:', conversationId)
      if (!conversations.has(conversationId)) {
        conversations.set(conversationId, {
          participants: [user.username, request.fromUsername],
          createdAt: new Date()
        })
        directMessages.set(conversationId, [])
        console.log('Conversation created with participants:', [user.username, request.fromUsername])
      }

      // Notify both users
      const fromUser = Array.from(users.values()).find(u => u.uid === fromId)
      console.log('From user found:', fromUser)
      if (fromUser) {
        const fromSocket = Array.from(users.entries()).find(([_, u]) => u.uid === fromId)?.[0]
        console.log('From socket found:', fromSocket)
        if (fromSocket) {
          io.to(fromSocket).emit('friendRequestAccepted', { 
            byUsername: user.username,
            conversationId,
            participants: [user.username, request.fromUsername]
          })
          console.log('Sent acceptance notification to from user')
        } else {
          console.log('From user socket not found')
        }
      } else {
        console.log('From user not found in online users')
      }

      socket.emit('friendRequestAccepted', { 
        byUsername: request.fromUsername,
        conversationId,
        participants: [user.username, request.fromUsername]
      })
      console.log('Sent acceptance notification to current user')
      
      // Send conversation to both users
      const conversation = {
        id: conversationId,
        participants: [user.username, request.fromUsername]
      }
      
      // Send to current user
      socket.emit('conversationCreated', {
        conversationId,
        participants: [user.username, request.fromUsername]
      })
      
      // Send to from user if online
      const fromSocket = Array.from(users.entries()).find(([_, u]) => u.uid === fromId)?.[0]
      if (fromSocket) {
        io.to(fromSocket).emit('conversationCreated', {
          conversationId,
          participants: [user.username, request.fromUsername]
        })
      }
    }

    // Update friend requests for both users
    const fromSocket = Array.from(users.entries()).find(([_, u]) => u.uid === fromId)?.[0]
    if (fromSocket) {
      io.to(fromSocket).emit('friendRequests', friendRequests.get(fromId) || [])
    }
    socket.emit('friendRequests', friendRequests.get(user.uid) || [])

    // Save friends to Firestore for both users
    await saveFriendsToFirestore(user.uid);
    await saveFriendsToFirestore(fromId);

    // Save conversation to Firestore
    await saveConversationToFirestore(conversationId);

    console.log(`${user.username} ${accepted ? 'accepted' : 'declined'} friend request from ${request.fromUsername}`)
  })

  socket.on('getFriendRequests', () => {
    const user = users.get(socket.id)
    if (user) {
      const requests = friendRequests.get(user.uid) || []
      socket.emit('friendRequests', requests)
    }
  })

  socket.on('getFriends', () => {
    const user = users.get(socket.id)
    if (user) {
      const userFriends = friends.get(user.uid) || new Set()
      const friendsList = Array.from(userFriends).map(friendId => {
        const friend = Array.from(users.values()).find(u => u.uid === friendId)
        return friend ? { uid: friend.uid, username: friend.username } : null
      }).filter(Boolean)
      socket.emit('friendsList', friendsList)
    }
  })

  socket.on('getNotifications', () => {
    const user = users.get(socket.id)
    if (user) {
      const userNotifications = notifications.get(user.uid) || []
      socket.emit('notifications', userNotifications)
    }
  })

  socket.on('markNotificationRead', (notificationId) => {
    const user = users.get(socket.id)
    if (user) {
      const userNotifications = notifications.get(user.uid) || []
      notifications.set(user.uid, userNotifications.filter(n => n.id !== notificationId))
      socket.emit('notifications', notifications.get(user.uid) || [])
    }
  })

  // Handle DM history requests
  socket.on('getDirectMessageHistory', (conversationId) => {
    const user = users.get(socket.id)
    if (user) {
      const dmHistory = directMessages.get(conversationId) || []
      console.log(`Sending ${dmHistory.length} DM messages for conversation ${conversationId}`)
      socket.emit('directMessageHistory', {
        conversationId,
        messages: dmHistory
      })
    }
  })

  // Handle conversation creation
  socket.on('createConversation', (data) => {
    const user = users.get(socket.id)
    if (user) {
      const { participantId } = data
      
      // Find the participant user
      const participant = Array.from(allUsers.values()).find(u => u.username === participantId)
      if (!participant) {
        socket.emit('serverError', 'User not found')
        return
      }
      
      // Create conversation ID (sorted to ensure consistency)
      const conversationId = [user.uid, participant.uid].sort().join('-')
      
      // Check if conversation already exists
      if (!conversations.has(conversationId)) {
        conversations.set(conversationId, {
          participants: [user.username, participant.username],
          createdAt: new Date()
        })
        directMessages.set(conversationId, [])
        
        // Save to Firestore
        if (db) {
          saveConversationToFirestore(conversationId)
        }
        
        console.log(`Created conversation ${conversationId} between ${user.username} and ${participant.username}`)
      }
      
      // Send conversation to both users
      const conversation = {
        id: conversationId,
        participants: [user.username, participant.username]
      }
      
      socket.emit('conversationCreated', {
        conversationId,
        participants: [user.username, participant.username]
      })
      
      // Send to participant if online
      const participantSocket = Array.from(users.entries()).find(([_, u]) => u.username === participant.username)?.[0]
      if (participantSocket) {
        io.to(participantSocket).emit('conversationCreated', {
          conversationId,
          participants: [user.username, participant.username]
        })
      }
    }
  })

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('=== USER DISCONNECTED ===')
    console.log('Socket ID:', socket.id)
    
    const user = users.get(socket.id)
    if (user) {
      console.log('User disconnected:', user.username)
      
      // Update user status to offline
      user.status = 'offline'
      user.lastSeen = new Date()
      
      // Update persistent user status
      const persistentUser = allUsers.get(user.uid)
      if (persistentUser) {
        persistentUser.status = 'offline'
        persistentUser.lastSeen = new Date()
      }
      
      // Remove from users map
      users.delete(socket.id)
      
      // Update Firestore if available
      if (db) {
        db.collection('users').doc(user.username).update({
          status: 'offline',
          lastSeen: admin.firestore.FieldValue.serverTimestamp()
        }).catch(error => {
          console.error('Error updating user status in Firestore:', error)
        })
      }
      
      // Notify other users
      socket.broadcast.emit('userLeft', user.uid)
      
      console.log('Total connections after disconnect:', io.engine.clientsCount)
    } else {
      console.log('Unknown socket disconnected:', socket.id)
    }
  })
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
}) 