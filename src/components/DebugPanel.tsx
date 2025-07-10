import React, { useState } from 'react'
import { Bug, Send} from 'lucide-react'

interface DebugPanelProps {
  socket: any
  currentUser: string | null
  currentServer: any
  currentChannel: any
  messages: any[]
  onSendTestMessage: () => void
  onDebugUserInfo: () => void
  onDebugMessages: () => void
}

const DebugPanel: React.FC<DebugPanelProps> = ({ 
  socket, 
  currentUser, 
  currentServer, 
  currentChannel, 
  messages,
  onSendTestMessage,
  onDebugUserInfo,
  onDebugMessages
}) => {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg z-50"
        title="Debug Panel"
      >
        <Bug className="w-5 h-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-discord-darker border border-discord-light rounded-lg p-4 w-80 max-h-96 overflow-y-auto shadow-xl z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center space-x-2">
          <Bug className="w-4 h-4" />
          <span>Debug Panel</span>
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <span className="text-gray-400">Socket:</span>
          <span className={`ml-2 ${socket?.connected ? 'text-green-400' : 'text-red-400'}`}>
            {socket?.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div>
          <span className="text-gray-400">User:</span>
          <span className="ml-2 text-white">{currentUser || 'None'}</span>
        </div>

        <div>
          <span className="text-gray-400">Server:</span>
          <span className="ml-2 text-white">{currentServer?.name || 'None'}</span>
        </div>

        <div>
          <span className="text-gray-400">Channel:</span>
          <span className="ml-2 text-white">{currentChannel?.name || 'None'}</span>
        </div>

        <div>
          <span className="text-gray-400">Messages:</span>
          <span className="ml-2 text-white">{messages.length}</span>
        </div>

        <div className="pt-2 border-t border-discord-light">
          <button
            onClick={onSendTestMessage}
            className="w-full bg-discord-blue hover:bg-blue-600 text-white px-3 py-2 rounded text-sm flex items-center justify-center space-x-2 mb-2"
          >
            <Send className="w-4 h-4" />
            <span>Send Test Message</span>
          </button>
          <button
            onClick={onDebugUserInfo}
            className="w-full bg-discord-light hover:bg-discord-lighter text-white px-3 py-2 rounded text-sm flex items-center justify-center space-x-2 mb-2"
          >
            <span>Debug User Info</span>
          </button>
          <button
            onClick={onDebugMessages}
            className="w-full bg-discord-light hover:bg-discord-lighter text-white px-3 py-2 rounded text-sm flex items-center justify-center space-x-2"
          >
            <span>Debug Messages</span>
          </button>
        </div>

        <div className="pt-2 border-t border-discord-light">
          <h4 className="text-gray-300 font-medium mb-2">Recent Messages:</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {messages.slice(-5).map((msg, index) => (
              <div key={index} className="text-xs bg-discord-light p-2 rounded">
                <div className="text-gray-400">{msg.author}</div>
                <div className="text-white">{msg.content}</div>
                <div className="text-gray-500 text-xs">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DebugPanel 