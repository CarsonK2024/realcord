import React from 'react'
import { Circle } from 'lucide-react'
import ClickableUsername from './ClickableUsername'

interface User {
  id: string
  username: string
  status: 'online' | 'offline' | 'away'
}

interface UserListProps {
  users: User[]
  currentUser: string | null
  onUserClick?: (username: string) => void
  socket?: any
}

const UserList: React.FC<UserListProps> = ({ users, currentUser, onUserClick, socket }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-discord-green'
      case 'away':
        return 'text-discord-yellow'
      case 'offline':
        return 'text-gray-500'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <div className="flex-1 p-4 space-y-2 overflow-y-auto discord-scrollbar">
      {/* Online Users */}
      <div className="mb-4">
        <h4 className="text-gray-400 text-xs font-semibold mb-2">ONLINE — {users.filter(u => u.status === 'online').length}</h4>
        {users.filter(u => u.status === 'online').map((user) => (
        <div 
          key={user.id} 
          className="flex items-center space-x-3 p-2 rounded hover:bg-discord-light transition-colors"
        >
          <div className="relative">
            <div className="w-8 h-8 bg-discord-blue rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <Circle className={`w-3 h-3 absolute -bottom-1 -right-1 ${getStatusColor(user.status)}`} fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <ClickableUsername 
                username={user.username}
                socket={socket}
                currentUser={currentUser}
                onStartDM={onUserClick}
              />
              {user.username === currentUser && (
                <span className="text-xs bg-discord-blue px-2 py-1 rounded text-white">You</span>
              )}
            </div>
            <span className="text-gray-400 text-xs capitalize">{user.status}</span>
          </div>
        </div>
      ))}
      </div>
      
      {/* Offline Users */}
      <div>
        <h4 className="text-gray-400 text-xs font-semibold mb-2">OFFLINE — {users.filter(u => u.status === 'offline').length}</h4>
        {users.filter(u => u.status === 'offline').map((user) => (
          <div 
            key={user.id} 
            className="flex items-center space-x-3 p-2 rounded hover:bg-discord-light transition-colors"
          >
            <div className="relative">
              <div className="w-8 h-8 bg-discord-blue rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <Circle className={`w-3 h-3 absolute -bottom-1 -right-1 ${getStatusColor(user.status)}`} fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <ClickableUsername 
                  username={user.username}
                  socket={socket}
                  currentUser={currentUser}
                  onStartDM={onUserClick}
                />
                {user.username === currentUser && (
                  <span className="text-xs bg-discord-blue px-2 py-1 rounded text-white">You</span>
                )}
              </div>
              <span className="text-gray-400 text-xs capitalize">{user.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default UserList 