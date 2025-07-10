import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './contexts/AuthContext'
import ChatArea from './components/ChatArea'
import UserList from './components/UserList'
import AuthModal from './components/AuthModal'
import CreateServerModal from './components/CreateServerModal'
import JoinServerModal from './components/JoinServerModal'
import ServerInviteModal from './components/ServerInviteModal'
import DebugPanel from './components/DebugPanel'
import NotificationBell from './components/NotificationBell'
import StartDMModal from './components/StartDMModal'
import { LogOut, User, Plus, Share2, LogOut as LeaveIcon, Hash, Mic, Settings } from 'lucide-react'
import VoiceSettingsModal from './components/VoiceSettingsModal'
import { useVoiceWebRTC } from './hooks/useVoiceWebRTC'

interface Message {
  id: string
  content: string
  author: string
  timestamp: Date
  channelId: string
  serverId?: string
  type?: 'text' | 'dm'
  conversationId?: string
}

interface User {
  id: string
  username: string
  status: 'online' | 'offline' | 'away'
}

interface Server {
  id: string
  name: string
  ownerId: string
  inviteCode: string
  channels: Channel[]
  members: string[]
}

interface Channel {
  id: string
  name: string
  type: 'text' | 'voice'
  serverId: string
}

interface Conversation {
  id: string
  participants: string[]
  lastMessage?: Message
}

function App() {
  // All hooks at the top
  const { currentUser, userProfile, logout } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [serverUsers, setServerUsers] = useState<User[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [currentServer, setCurrentServer] = useState<Server | null>(null)
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null)
  const [showCreateServer, setShowCreateServer] = useState(false)
  const [showJoinServer, setShowJoinServer] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [voiceParticipants, setVoiceParticipants] = useState<any[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [showStartDM, setShowStartDM] = useState(false)
  const [friendsList, setFriendsList] = useState<{ uid: string, username: string }[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [retryCount, setRetryCount] = useState(0)
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)
  const [audioInputId, setAudioInputId] = useState<string | null>(null)
  const [audioOutputId, setAudioOutputId] = useState<string | null>(null)
  const [unreadDMs, setUnreadDMs] = useState<Set<string>>(new Set())
  // Only call useVoiceWebRTC for voice channels
  const isVoiceChannel = currentChannel?.type === 'voice'
  useVoiceWebRTC({
    socket: socket,
    channelId: isVoiceChannel ? currentChannel?.id ?? null : null,
    userId: userProfile?.uid ?? null,
    username: userProfile?.username ?? null,
    audioInputId,
    audioOutputId
  })
  // All useEffect hooks here...
  useEffect(() => {
    if (currentUser && userProfile) {
      console.log('App: Attempting to connect to server...');
      setConnectionStatus('connecting');
      
      // Connect to the embedded server (same for both dev and prod since server is embedded)
      const newSocket = io('http://localhost:3001', {
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      })
      setSocket(newSocket)

      // Test socket connection
      newSocket.on('connect', () => {
        console.log('App: Socket connected successfully');
        setConnectionStatus('connected');
      });

      newSocket.on('disconnect', () => {
        console.log('App: Socket disconnected');
        setConnectionStatus('disconnected');
      });

      newSocket.on('connect_error', (error) => {
        console.error('App: Socket connection error:', error);
        setConnectionStatus('error');
        setRetryCount(prev => prev + 1);
        
        // Auto-retry after 3 seconds if we haven't exceeded max retries
        if (retryCount < 5) {
          setTimeout(() => {
            console.log('App: Retrying connection...');
            setConnectionStatus('connecting');
            newSocket.connect();
          }, 3000);
        } else {
          console.error('Failed to connect to server after multiple attempts.');
          // In development, show alert; in production, just log
          if (process.env.NODE_ENV === 'development') {
            alert('Failed to connect to server after multiple attempts. Please restart the application.');
          }
        }
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('App: Socket reconnected after', attemptNumber, 'attempts');
        setConnectionStatus('connected');
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('App: Socket reconnection error:', error);
        setConnectionStatus('error');
      });

      // Login to socket with username
      newSocket.emit('login', {
        username: userProfile.username,
        uid: userProfile.uid
      })

      newSocket.on('message', (message: Message) => {
        setMessages(prev => [...prev, message])
      })

      newSocket.on('userJoined', (user: User) => {
        setUsers(prev => {
          const existingUser = prev.find(u => u.id === user.id)
          if (existingUser) {
            return prev.map(u => u.id === user.id ? { ...u, status: 'online' } : u)
          } else {
            return [...prev, user]
          }
        })
      })

      newSocket.on('userLeft', (userId: string) => {
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, status: 'offline' as const } : user
        ))
      })

      newSocket.on('userList', (userList: User[]) => {
        setUsers(userList)
      })

      newSocket.on('serverUserList', (serverUserList: User[]) => {
        setServerUsers(serverUserList)
      })

      newSocket.on('messageHistory', (messageHistory: Message[]) => {
        setMessages(messageHistory)
      })

      newSocket.on('servers', (serverList: Server[]) => {
        console.log('App: Received servers:', serverList);
        setServers(serverList)
        if (serverList.length > 0 && !currentServer) {
          setCurrentServer(serverList[0])
          setCurrentChannel(serverList[0].channels[0] || null)
        }
      })

      newSocket.on('serverCreated', (server: Server) => {
        console.log('App: Received serverCreated event:', server);
        setServers(prev => [...prev, server])
        setCurrentServer(server)
        setCurrentChannel(server.channels[0] || null)
      })

      newSocket.on('serverJoined', (data: { server: Server, message: string }) => {
        console.log('App: Received serverJoined event:', data);
        setServers(prev => {
          const existing = prev.find(s => s.id === data.server.id)
          if (!existing) {
            return [...prev, data.server]
          }
          return prev.map(s => s.id === data.server.id ? data.server : s)
        })
        setCurrentServer(data.server)
        setCurrentChannel(data.server.channels[0] || null)
        alert(data.message)
      })

      newSocket.on('serverError', (error: string) => {
        console.log('App: Received serverError:', error);
        alert(`Server Error: ${error}`)
      })

      newSocket.on('debugResponse', (data: any) => {
        console.log('=== DEBUG RESPONSE ===')
        console.log('Server messages:', data.servers)
        console.log('DM messages:', data.dms)
      })

      newSocket.on('serverLeft', ({ serverId }) => {
        console.log('=== SERVER LEFT EVENT ===')
        console.log('Received serverLeft event with serverId:', serverId)
        console.log('Current server ID:', currentServer?.id)
        
        setServers(prev => {
          console.log('Previous servers:', prev.map(s => ({ id: s.id, name: s.name })))
          const filtered = prev.filter(s => s.id !== serverId)
          console.log('Filtered servers:', filtered.map(s => ({ id: s.id, name: s.name })))
          return filtered
        })
        
        if (currentServer?.id === serverId) {
          console.log('Clearing current server selection')
          setCurrentServer(null)
          setCurrentChannel(null)
        }
      })

      // Voice channel events
      newSocket.on('voiceChannelJoined', (data: { channelId: string, username: string, serverId: string }) => {
        console.log('Voice channel joined:', data)
        if (data.serverId === currentServer?.id && data.channelId === currentChannel?.id) {
          setVoiceParticipants(prev => [...prev, { id: Date.now().toString(), username: data.username }])
        }
      })

      newSocket.on('voiceChannelLeft', (data: { channelId: string, username: string, serverId: string }) => {
        console.log('Voice channel left:', data)
        if (data.serverId === currentServer?.id && data.channelId === currentChannel?.id) {
          setVoiceParticipants(prev => prev.filter(p => p.username !== data.username))
        }
      })

      newSocket.on('voiceParticipants', (participants: any[]) => {
        console.log('Voice participants updated:', participants)
        setVoiceParticipants(participants)
      })

      // Direct messaging events
      newSocket.on('conversationCreated', (data: { conversationId: string, participants: string[] }) => {
        console.log('Conversation created:', data)
        const newConversation: Conversation = {
          id: data.conversationId,
          participants: data.participants
        }
        setConversations(prev => {
          // Only add if not already present
          if (prev.some(conv => conv.id === newConversation.id)) return prev;
          return [...prev, newConversation]
        })
      })

      newSocket.on('directMessageHistory', (data: { conversationId: string, messages: Message[] }) => {
        console.log('Direct message history:', data)
        setMessages(data.messages)
      })

      // Friend system events
      newSocket.on('friendRequestSent', (data: { targetUsername: string }) => {
        console.log('Friend request sent to:', data.targetUsername)
        alert(`Friend request sent to ${data.targetUsername}`)
      })

      newSocket.on('friendRequestError', (error: string) => {
        console.log('Friend request error:', error)
        alert(`Friend request error: ${error}`)
      })

      newSocket.on('friendRequestAccepted', (data: { byUsername: string, conversationId: string, participants: string[] }) => {
        console.log('Friend request accepted:', data)
        // Add new conversation to the list
        const newConversation: Conversation = {
          id: data.conversationId,
          participants: data.participants
        }
        setConversations(prev => {
          if (prev.some(conv => conv.id === newConversation.id)) return prev;
          return [...prev, newConversation]
        })
        alert(`${data.byUsername} accepted your friend request!`)
      })

      newSocket.on('newNotification', (notification: any) => {
        console.log('New notification:', notification)
      })

      return () => {
        newSocket.close()
      }
    }
  }, [currentUser, userProfile])

  useEffect(() => {
    if (socket) {
      socket.emit('getFriends')
      socket.on('friendsList', (friends: any[]) => {
        setFriendsList(friends)
      })
      return () => {
        socket.off('friendsList')
      }
    }
  }, [socket])

  // Update unreadDMs when a new DM arrives
  useEffect(() => {
    if (!socket) return
    const handleMessage = (message: Message) => {
      if (message.type === 'dm' && (!currentConversation || message.conversationId !== currentConversation.id)) {
        setUnreadDMs(prev => new Set(prev).add(message.conversationId!))
      }
    }
    socket.on('message', handleMessage)
    return () => {
      socket.off('message', handleMessage)
    }
  }, [socket, currentConversation])
  // Mark DM as read when opened
  useEffect(() => {
    if (currentConversation) {
      setUnreadDMs(prev => {
        const next = new Set(prev)
        next.delete(currentConversation.id)
        return next
      })
    }
  }, [currentConversation])

  const sendMessage = (content: string) => {
    console.log('sendMessage called with:', content)
    console.log('currentChannel:', currentChannel)
    console.log('currentServer:', currentServer)
    console.log('currentConversation:', currentConversation)
    
    if (socket && userProfile && (currentChannel || currentConversation)) {
      if (currentConversation) {
        // Send direct message
        console.log('Sending DM to conversation:', currentConversation.id)
        socket.emit('message', { 
          content, 
          author: userProfile.username,
          conversationId: currentConversation.id,
          type: 'dm'
        })
      } else if (currentChannel) {
        // Send server message
        const serverId = currentServer?.id || 'default'
        console.log('Sending server message to channel:', currentChannel.id, 'in server:', serverId)
        socket.emit('message', { 
          content, 
          author: userProfile.username,
          channelId: currentChannel.id,
          serverId: serverId
        })
      }
    } else {
      console.log('Cannot send message - missing socket, userProfile, or channel/conversation')
    }
  }

  const handleServerSelect = (server: Server) => {
    console.log('Selecting server:', server)
    setCurrentServer(server)
    setCurrentChannel(server.channels[0] || null)
    setCurrentConversation(null) // Clear DM when switching servers
    
    // Request server-specific messages
    if (socket) {
      socket.emit('selectServer', server.id)
    }
  }

  const startDirectMessage = (username: string) => {
    if (socket && userProfile && username !== userProfile.username) {
      socket.emit('createConversation', { participantId: username })
    }
  }

  const selectConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation)
    setCurrentServer(null)
    setCurrentChannel(null)
    
    // Request DM history
    if (socket) {
      socket.emit('getDirectMessageHistory', conversation.id)
    }
  }

  const handleLogout = async () => {
    try {
      console.log('Logging out...')
      await logout()
      if (socket) {
        socket.close()
        setSocket(null)
      }
      setMessages([])
      setUsers([])
      setServers([])
      setCurrentServer(null)
      setCurrentChannel(null)
      setCurrentConversation(null)
      setConversations([])
      console.log('Logout successful')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const createServer = (name: string) => {
    console.log('App: createServer called with name:', name);
    console.log('App: socket exists?', !!socket);
    console.log('App: userProfile exists?', !!userProfile);
    
    if (socket && userProfile) {
      console.log('App: Emitting createServer event with:', { name, ownerId: userProfile.uid });
      socket.emit('createServer', { name, ownerId: userProfile.uid });
    } else {
      console.log('App: Cannot create server - socket or userProfile missing');
    }
  }

  const joinServer = (inviteCode: string) => {
    console.log('App: joinServer called with inviteCode:', inviteCode);
    if (socket && userProfile) {
      socket.emit('joinServer', { inviteCode, userId: userProfile.uid })
    }
  }

  const sendTestMessage = () => {
    console.log('Sending test message...')
    if (socket && userProfile) {
      if (currentConversation) {
        // Send DM test message
        const testMessage = {
          content: `Test DM from ${userProfile.username} at ${new Date().toLocaleTimeString()}`,
          author: userProfile.username,
          conversationId: currentConversation.id,
          type: 'dm'
        }
        console.log('Emitting test DM:', testMessage)
        socket.emit('message', testMessage)
      } else if (currentChannel && currentServer) {
        // Send server test message
        const testMessage = {
          content: `Test server message from ${userProfile.username} at ${new Date().toLocaleTimeString()}`,
          author: userProfile.username,
          channelId: currentChannel.id,
          serverId: currentServer.id
        }
        console.log('Emitting test server message:', testMessage)
        socket.emit('message', testMessage)
      } else {
        console.log('No active channel or conversation for test message')
      }
    }
  }

  const debugUserInfo = () => {
    console.log('=== DEBUG USER INFO ===')
    console.log('userProfile:', userProfile)
    console.log('userProfile.uid:', userProfile?.uid)
    console.log('userProfile.username:', userProfile?.username)
    console.log('Current servers:', servers.map(s => ({ id: s.id, name: s.name, members: s.members })))
    console.log('Current server:', currentServer)
  }

  const debugMessages = () => {
    console.log('=== DEBUG MESSAGES ===')
    console.log('Current messages:', messages)
    console.log('Messages count:', messages.length)
    if (socket) {
      socket.emit('debugMessages')
    }
  }

  const leaveServer = () => {
    console.log('=== LEAVE SERVER DEBUG ===')
    console.log('Socket exists:', !!socket)
    console.log('Current server:', currentServer)
    console.log('User profile:', userProfile)
    
    if (socket && currentServer) {
      if (window.confirm(`Are you sure you want to leave ${currentServer.name}?`)) {
        console.log('Emitting leaveServer with serverId:', currentServer.id)
        socket.emit('leaveServer', currentServer.id)
      }
    } else {
      console.log('Cannot leave server - missing socket or currentServer')
    }
  }

  // Only after all hooks, do any conditional return
  if (!currentUser || !userProfile) {
    return <AuthModal />
  }

  // Debug current state
  console.log('Current state:', {
    currentServer: currentServer?.name,
    currentChannel: currentChannel?.name,
    currentConversation: currentConversation?.id,
    messagesCount: messages.length,
    serversCount: servers.length
  })

  return (
    <>
      <div className="flex h-screen bg-discord-dark">
        {/* Server Sidebar */}
        <div className="w-16 bg-discord-darker flex flex-col items-center py-4 space-y-2">
          {/* Home/DMs */}
          <button
            onClick={() => {
              setCurrentServer(null)
              setCurrentChannel(null)
              setCurrentConversation(null)
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              !currentServer && !currentConversation ? 'bg-discord-blue text-white' : 'bg-discord-light text-gray-400 hover:bg-discord-lighter'
            }`}
            style={{ position: 'relative' }}
          >
            <Hash className="w-6 h-6" />
            {unreadDMs.size > 0 && (
              <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-discord-dark"></span>
            )}
          </button>
          
          {/* Server List */}
          {servers.map((server) => (
            <button
              key={server.id}
              onClick={() => handleServerSelect(server)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                currentServer?.id === server.id ? 'bg-discord-blue text-white' : 'bg-discord-light text-gray-400 hover:bg-discord-lighter'
              }`}
              title={server.name}
            >
              <span className="text-white font-medium text-sm">
                {server.name.charAt(0).toUpperCase()}
              </span>
            </button>
          ))}
          
          {/* Add Server */}
          <button
            onClick={() => setShowCreateServer(true)}
            className="w-12 h-12 rounded-full bg-discord-light text-gray-400 hover:bg-discord-lighter flex items-center justify-center transition-colors"
            title="Add Server"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Channel Sidebar */}
        <div className="w-60 bg-discord-light flex flex-col relative">
          {currentServer ? (
            <>
              {/* Server Header */}
              <div className="h-12 bg-discord-darker border-b border-discord-lightest flex items-center px-4">
                <h2 className="text-white font-semibold truncate">{currentServer.name}</h2>
                <div className="ml-auto flex space-x-1">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="p-1 text-gray-400 hover:text-white hover:bg-discord-light rounded transition-colors"
                    title="Invite Friends"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowJoinServer(true)}
                    className="p-1 text-gray-400 hover:text-white hover:bg-discord-light rounded transition-colors"
                    title="Join Server"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={leaveServer}
                    className="p-1 text-red-400 hover:text-white hover:bg-red-500 rounded transition-colors"
                    title="Leave Server"
                  >
                    <LeaveIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Channel List */}
              <div className="flex-1 p-2 space-y-1">
                <div className="text-gray-400 text-xs px-2 py-1 font-semibold">TEXT CHANNELS</div>
                {currentServer.channels.filter(c => c.type === 'text').map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setCurrentChannel(channel)}
                    className={`w-full text-left px-2 py-1 rounded text-sm flex items-center space-x-2 ${
                      currentChannel?.id === channel.id
                        ? 'bg-discord-blue text-white'
                        : 'text-gray-300 hover:bg-discord-lighter'
                    }`}
                  >
                    <Hash className="w-4 h-4" />
                    <span>{channel.name}</span>
                  </button>
                ))}
                
                <div className="text-gray-400 text-xs px-2 py-1 font-semibold mt-4">VOICE CHANNELS</div>
                {currentServer.channels.filter(c => c.type === 'voice').map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setCurrentChannel(channel)}
                    className={`w-full text-left px-2 py-1 rounded text-sm flex items-center space-x-2 ${
                      currentChannel?.id === channel.id
                        ? 'bg-discord-blue text-white'
                        : 'text-gray-300 hover:bg-discord-lighter'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                    <span>{channel.name}</span>
                  </button>
                ))}
              </div>
              {/* Settings Wheel */}
              <div className="absolute bottom-4 left-0 w-full flex justify-center">
                <button
                  onClick={() => setShowVoiceSettings(true)}
                  className="p-2 rounded-full bg-discord-light text-gray-400 hover:text-white hover:bg-discord-lighter transition-colors"
                  title="Voice Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Direct Messages Header */}
              <div className="h-12 bg-discord-darker border-b border-discord-lightest flex items-center px-4">
                <h2 className="text-white font-semibold flex-1">Direct Messages</h2>
                <button
                  onClick={() => setShowStartDM(true)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-discord-light rounded transition-colors ml-2"
                  title="Start DM"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              {/* DM List */}
              <div className="flex-1 p-2 space-y-1">
                {conversations
                  .filter(
                    (conversation) =>
                      // Only show unique conversations and filter out self-DMs
                      conversation.participants.length === 2 &&
                      conversation.participants.some(p => p !== userProfile.username)
                  )
                  .map((conversation) => {
                    const otherParticipant = conversation.participants.find(p => p !== userProfile.username)
                    return (
                      <button
                        key={conversation.id}
                        onClick={() => selectConversation(conversation)}
                        className={`w-full text-left px-2 py-1 rounded text-sm flex items-center space-x-2 ${
                          currentConversation?.id === conversation.id
                            ? 'bg-discord-blue text-white'
                            : 'text-gray-300 hover:bg-discord-lighter'
                        }`}
                      >
                        <div className="w-6 h-6 bg-discord-blue rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-medium">
                            {otherParticipant?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span>{otherParticipant}</span>
                      </button>
                    )
                  })}
              </div>
            </>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex">
          {/* Connection Status Banner */}
          {connectionStatus === 'error' && (
            <div className="absolute top-0 left-0 right-0 bg-red-600 text-white px-4 py-2 text-center z-10">
              <strong>Connection Error:</strong> Unable to connect to server. 
              <button 
                onClick={() => {
                  setRetryCount(0);
                  setConnectionStatus('connecting');
                  if (socket) {
                    socket.connect();
                  }
                }}
                className="ml-2 px-2 py-1 bg-white text-red-600 rounded text-sm hover:bg-gray-100"
              >
                Retry
              </button>
            </div>
          )}
          {connectionStatus === 'connecting' && (
            <div className="absolute top-0 left-0 right-0 bg-yellow-600 text-white px-4 py-2 text-center z-10">
              <strong>Connecting...</strong> Attempting to connect to server.
            </div>
          )}
          <ChatArea 
            messages={messages.filter(m => {
              // Only show DM messages when in DM context
              if (currentConversation) {
                return m.type === 'dm' && m.conversationId === currentConversation.id
              }
              // Only show server messages when in server context
              if (currentChannel && currentServer) {
                return m.type !== 'dm' && m.channelId === currentChannel.id && m.serverId === currentServer.id
              }
              // No context selected, show no messages
              return false
            })}
            onSendMessage={sendMessage}
            currentUser={userProfile.username}
            currentChannel={currentChannel}
            onChannelSelect={setCurrentChannel}
            channels={currentServer?.channels || []}
            socket={socket}
            voiceParticipants={voiceParticipants}
            currentConversation={currentConversation}
          />
          
          {/* User List */}
          <div className="w-60 bg-discord-darker border-l border-discord-lightest flex flex-col">
            {/* User Profile Section */}
            <div className="p-4 border-b border-discord-lightest">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-discord-blue rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{userProfile.username}</p>
                  <p className="text-gray-400 text-xs truncate">{userProfile.email}</p>
                </div>
                <div className="flex items-center space-x-1">
                  {/* Connection Status Indicator */}
                  <div 
                    className={`w-3 h-3 rounded-full ${
                      connectionStatus === 'connected' ? 'bg-green-500' :
                      connectionStatus === 'connecting' ? 'bg-yellow-500' :
                      connectionStatus === 'error' ? 'bg-red-500' :
                      'bg-gray-500'
                    }`}
                    title={`Connection: ${connectionStatus}`}
                  />
                  <NotificationBell socket={socket} />
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-400 hover:text-white hover:bg-discord-light rounded transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Online Users */}
            <div className="flex-1 p-4">
              <h3 className="text-gray-400 text-xs font-semibold mb-3">
                {currentServer ? `MEMBERS — ${serverUsers.length}` : `ONLINE — ${users.length}`}
              </h3>
              <UserList 
                users={currentServer ? serverUsers : users} 
                currentUser={userProfile.username}
                onUserClick={startDirectMessage}
                socket={socket}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateServer && (
        <CreateServerModal
          isOpen={showCreateServer}
          onClose={() => setShowCreateServer(false)}
          onCreateServer={createServer}
        />
      )}
      
      {showJoinServer && (
        <JoinServerModal
          isOpen={showJoinServer}
          onClose={() => setShowJoinServer(false)}
          onJoinServer={joinServer}
        />
      )}

      {showInviteModal && currentServer && (
        <ServerInviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          inviteCode={currentServer.inviteCode}
          serverName={currentServer.name}
        />
      )}

      {/* Start DM Modal */}
      <StartDMModal
        isOpen={showStartDM}
        onClose={() => setShowStartDM(false)}
        friends={friendsList}
        onSelect={startDirectMessage}
      />

      {/* Voice Settings Modal */}
      <VoiceSettingsModal
        isOpen={showVoiceSettings}
        onClose={() => setShowVoiceSettings(false)}
        audioInputId={audioInputId}
        audioOutputId={audioOutputId}
        setAudioInputId={setAudioInputId}
        setAudioOutputId={setAudioOutputId}
      />

      {/* Debug Panel */}
      <DebugPanel
        socket={socket}
        currentUser={userProfile?.username || null}
        currentServer={currentServer}
        currentChannel={currentChannel}
        messages={messages}
        onSendTestMessage={sendTestMessage}
        onDebugUserInfo={debugUserInfo}
        onDebugMessages={debugMessages}
      />
    </>
  )
}

export default App 