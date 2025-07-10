import { useState } from 'react'
import { MessageCircle, Settings, Plus } from 'lucide-react'

interface Channel {
  id: string
  name: string
  type: 'text' | 'voice'
  serverId: string
}

interface Server {
  id: string
  name: string
  ownerId: string
  inviteCode: string
  channels: Channel[]
  members: string[]
}

interface SidebarProps {
  servers: Server[]
  currentServer: Server | null
  onServerSelect: (server: Server) => void
  onCreateServer: () => void
  onJoinServer: () => void
}

const Sidebar: React.FC<SidebarProps> = ({ 
  servers, 
  currentServer, 
  onServerSelect, 
  onCreateServer, 
  onJoinServer 
}) => {
  const [showServerMenu, setShowServerMenu] = useState(false)

  const generateServerIcon = (name: string) => {
    return name.charAt(0).toUpperCase()
  }

  return (
    <div className="w-60 bg-discord-darkest flex flex-col">
      {/* Server List */}
      <div className="flex-1 p-4 space-y-2">
        {/* Home Server */}
        <div className="w-12 h-12 bg-discord-blue rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors mx-auto">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
        
        <div className="w-8 h-0.5 bg-discord-light rounded-full mx-auto"></div>
        
        {/* User Servers */}
        {servers.map((server) => (
          <div key={server.id} className="flex flex-col items-center space-y-2">
            <div 
              className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                currentServer?.id === server.id 
                  ? 'bg-discord-blue' 
                  : 'bg-discord-light hover:bg-discord-lighter'
              }`}
              onClick={() => onServerSelect(server)}
            >
              <span className="text-white font-medium">
                {generateServerIcon(server.name)}
              </span>
            </div>
          </div>
        ))}
        
        {/* Add Server Button */}
        <div className="flex flex-col items-center space-y-2">
          <button
            onClick={() => setShowServerMenu(!showServerMenu)}
            className="w-12 h-12 bg-discord-light rounded-full flex items-center justify-center cursor-pointer hover:bg-discord-lighter transition-colors"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
      
      {/* Server Menu */}
      {showServerMenu && (
        <div className="absolute left-16 bottom-20 bg-discord-darker border border-discord-light rounded-lg shadow-xl p-2 min-w-48">
          <button
            onClick={() => {
              onCreateServer()
              setShowServerMenu(false)
            }}
            className="w-full text-left px-3 py-2 text-white hover:bg-discord-light rounded text-sm"
          >
            Create Server
          </button>
          <button
            onClick={() => {
              onJoinServer()
              setShowServerMenu(false)
            }}
            className="w-full text-left px-3 py-2 text-white hover:bg-discord-light rounded text-sm"
          >
            Join Server
          </button>
        </div>
      )}
      
      {/* Settings */}
      <div className="p-4">
        <div className="w-12 h-12 bg-discord-light rounded-full flex items-center justify-center cursor-pointer hover:bg-discord-lighter transition-colors mx-auto">
          <Settings className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}

export default Sidebar 