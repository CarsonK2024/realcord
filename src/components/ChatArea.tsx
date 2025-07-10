import React, { useState, useRef, useEffect } from 'react'
import { Send, Smile, Hash, Mic, MicOff, Volume2, Plus, Headphones, Users } from 'lucide-react'
import ClickableUsername from './ClickableUsername'

interface Message {
  id: string
  content: string
  author: string
  timestamp: Date
  channelId: string
}

interface Channel {
  id: string
  name: string
  type: 'text' | 'voice'
  serverId: string
}

interface VoiceParticipant {
  id: string
  username: string
  isMuted: boolean
  isDeafened: boolean
}

interface ChatAreaProps {
  messages: Message[]
  onSendMessage: (content: string) => void
  currentUser: string | null
  currentChannel: Channel | null
  onChannelSelect: (channel: Channel) => void
  channels: Channel[]
  socket?: any
  voiceParticipants?: VoiceParticipant[]
  currentConversation?: any
}

const ChatArea: React.FC<ChatAreaProps> = ({ 
  messages, 
  onSendMessage, 
  currentUser, 
  currentChannel,
  onChannelSelect,
  channels,
  socket,
  voiceParticipants = [],
  currentConversation
}) => {
  const [newMessage, setNewMessage] = useState('')
  const [showChannelMenu, setShowChannelMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Voice channel state
  const [isInVoiceChannel, setIsInVoiceChannel] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  
  // WebRTC refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Voice channel effects
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newMessage.trim() && (currentChannel?.type === 'text' || currentConversation)) {
      onSendMessage(newMessage.trim())
      setNewMessage('')
    }
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleVoiceChannelJoin = async (channel: Channel) => {
    if (channel.type === 'voice' && !isInVoiceChannel) {
      try {
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        setLocalStream(stream)
        setIsInVoiceChannel(true)
        
        // Notify server
        if (socket) {
          socket.emit('joinVoiceChannel', {
            channelId: channel.id,
            username: currentUser,
            serverId: channel.serverId
          })
        }
        
        console.log('Joined voice channel:', channel.name)
      } catch (error) {
        console.error('Error accessing microphone:', error)
        alert('Could not access microphone. Please check permissions.')
      }
    }
  }

  const handleVoiceChannelLeave = () => {
    if (isInVoiceChannel) {
      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
        setLocalStream(null)
      }
      
      // Close peer connections
      peerConnections.current.forEach(connection => connection.close())
      peerConnections.current.clear()
      setRemoteStreams(new Map())
      
      // Notify server
      if (socket && currentChannel) {
        socket.emit('leaveVoiceChannel', {
          channelId: currentChannel.id,
          username: currentUser,
          serverId: currentChannel.serverId
        })
      }
      
      setIsInVoiceChannel(false)
      setIsMuted(false)
      setIsDeafened(false)
      
      console.log('Left voice channel')
    }
  }

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened)
    // Mute all remote audio when deafened
    remoteStreams.forEach(stream => {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isDeafened
      })
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      // Placeholder: handle file upload here
      // handleFileUpload(e.target.files[0])
      alert('File selected: ' + e.target.files[0].name)
    }
  }

  if (!currentChannel && !currentConversation) {
    return (
      <div className="flex-1 flex flex-col bg-discord-dark">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <Hash className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Select a Channel</h2>
            <p>Choose a channel to start chatting</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-discord-dark">
      {/* Header */}
      <div className="h-12 bg-discord-darker border-b border-discord-lightest flex items-center px-4">
        <div className="flex items-center space-x-2">
          {currentConversation ? (
            <>
              <div className="w-6 h-6 bg-discord-blue rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-medium">
                  {currentConversation.participants.find((p: string) => p !== currentUser)?.charAt(0).toUpperCase()}
                </span>
              </div>
              <h2 className="text-white font-semibold">
                {currentConversation.participants.find((p: string) => p !== currentUser)}
              </h2>
            </>
          ) : currentChannel ? (
            <>
              {currentChannel.type === 'text' ? (
                <Hash className="w-5 h-5 text-gray-400" />
              ) : (
                <Mic className="w-5 h-5 text-gray-400" />
              )}
              <h2 className="text-white font-semibold">#{currentChannel.name}</h2>
              {currentChannel.type === 'voice' && (
                <div className="flex items-center space-x-2 ml-4">
                  {!isInVoiceChannel ? (
                    <button
                      onClick={() => handleVoiceChannelJoin(currentChannel)}
                      className="p-1 text-green-400 hover:text-green-300"
                      title="Join Voice Channel"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={toggleMute}
                        className={`p-1 ${isMuted ? 'text-red-400' : 'text-green-400'} hover:text-white`}
                        title={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={toggleDeafen}
                        className={`p-1 ${isDeafened ? 'text-red-400' : 'text-green-400'} hover:text-white`}
                        title={isDeafened ? 'Undeafen' : 'Deafen'}
                      >
                        <Headphones className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleVoiceChannelLeave}
                        className="p-1 text-red-400 hover:text-red-300"
                        title="Leave Voice Channel"
                      >
                        <MicOff className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
        
        {/* Channel Menu */}
        {currentChannel && (
          <div className="ml-auto relative">
            <button
              onClick={() => setShowChannelMenu(!showChannelMenu)}
              className="p-2 text-gray-400 hover:text-white hover:bg-discord-light rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            
            {showChannelMenu && (
              <div className="absolute right-0 top-10 bg-discord-darker border border-discord-light rounded-lg shadow-xl p-2 min-w-48 z-10">
                <div className="text-gray-400 text-xs px-3 py-1 mb-2">CHANNELS</div>
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => {
                      onChannelSelect(channel)
                      setShowChannelMenu(false)
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm flex items-center space-x-2 ${
                      currentChannel?.id === channel.id
                        ? 'bg-discord-blue text-white'
                        : 'text-gray-300 hover:bg-discord-light'
                    }`}
                  >
                    {channel.type === 'text' ? (
                      <Hash className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                    <span>{channel.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Messages */}
      {currentConversation || currentChannel?.type === 'text' ? (
        <>
          <div className="flex-1 overflow-y-auto discord-scrollbar p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="flex space-x-3">
                <div className="w-8 h-8 bg-discord-blue rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-medium">
                    {message.author.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <ClickableUsername 
                      username={message.author}
                      socket={socket}
                      currentUser={currentUser}
                    />
                    <span className="text-gray-400 text-xs">{formatTime(message.timestamp)}</span>
                    {message.author === currentUser && (
                      <span className="text-xs bg-discord-blue px-2 py-1 rounded text-white">You</span>
                    )}
                  </div>
                  <p className="text-gray-200 mt-1">{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Message Input */}
          <div className="p-4 border-t border-discord-lightest">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <button
                type="button"
                className="text-gray-400 hover:text-white flex items-center justify-center px-2"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
              >
                <Plus className="w-5 h-5" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={currentConversation ? `Message @${currentConversation.participants.find((p: string) => p !== currentUser)}` : `Message #${currentChannel?.name}`}
                  className="w-full px-4 py-2 bg-discord-light border border-discord-lighter rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-discord-blue focus:border-transparent"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <Smile className="w-5 h-5" />
                </button>
              </div>
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="px-4 py-2 bg-discord-blue hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors duration-200"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </>
      ) : (
        /* Voice Channel UI */
        <div className="flex-1 flex">
          {/* Voice Channel Main Area */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Volume2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h2 className="text-xl font-semibold mb-2">Voice Channel</h2>
                <p className="mb-4">#{currentChannel?.name}</p>
                {!isInVoiceChannel ? (
                  <button
                    onClick={() => currentChannel && handleVoiceChannelJoin(currentChannel)}
                    className="bg-discord-green hover:bg-green-600 text-white px-6 py-2 rounded-md transition-colors"
                  >
                    Join Voice Channel
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm">Connected to voice channel</p>
                    <div className="flex space-x-2 justify-center">
                      <button
                        onClick={toggleMute}
                        className={`px-4 py-2 rounded-md transition-colors ${
                          isMuted ? 'bg-red-600 text-white' : 'bg-gray-600 text-gray-200'
                        }`}
                      >
                        {isMuted ? 'Unmute' : 'Mute'}
                      </button>
                      <button
                        onClick={toggleDeafen}
                        className={`px-4 py-2 rounded-md transition-colors ${
                          isDeafened ? 'bg-red-600 text-white' : 'bg-gray-600 text-gray-200'
                        }`}
                      >
                        {isDeafened ? 'Undeafen' : 'Deafen'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Hidden video element for local stream */}
            <video
              ref={localVideoRef}
              autoPlay
              muted
              style={{ display: 'none' }}
            />
          </div>
          
          {/* Voice Channel Participants */}
          <div className="w-64 bg-discord-darker border-l border-discord-lightest p-4">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="w-4 h-4 text-gray-400" />
              <h3 className="text-white font-medium">Voice Connected</h3>
            </div>
            <div className="space-y-2">
              {voiceParticipants.map((participant) => (
                <div key={participant.id} className="flex items-center space-x-2 p-2 rounded hover:bg-discord-light">
                  <div className="w-8 h-8 bg-discord-blue rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {participant.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white text-sm flex-1">{participant.username}</span>
                  {participant.isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                  {participant.isDeafened && <Headphones className="w-4 h-4 text-red-400" />}
                </div>
              ))}
              {voiceParticipants.length === 0 && (
                <p className="text-gray-400 text-sm">No one in voice channel</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatArea 