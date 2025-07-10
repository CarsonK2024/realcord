import React, { useState, useRef, useEffect } from 'react'
import { UserPlus, MessageCircle, Check } from 'lucide-react'

interface ClickableUsernameProps {
  username: string
  socket: any
  currentUser: string | null
  onStartDM?: (username: string) => void
}

const ClickableUsername: React.FC<ClickableUsernameProps> = ({ 
  username, 
  socket, 
  currentUser, 
  onStartDM 
}) => {
  const [showMenu, setShowMenu] = useState(false)
  const [isFriend, setIsFriend] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (socket && currentUser && username !== currentUser) {
      // Check if they're already friends
      socket.emit('getFriends')
      
      socket.on('friendsList', (friends: any[]) => {
        const isAlreadyFriend = friends.some(friend => friend.username === username)
        setIsFriend(isAlreadyFriend)
      })

      return () => {
        socket.off('friendsList')
      }
    }
  }, [socket, currentUser, username])

  const handleSendFriendRequest = () => {
    if (socket && username !== currentUser) {
      socket.emit('sendFriendRequest', username)
      setRequestSent(true)
      setShowMenu(false)
      
      // Listen for response
      socket.once('friendRequestSent', () => {
        console.log('Friend request sent to', username)
      })
      
      socket.once('friendRequestError', (error: string) => {
        alert(error)
        setRequestSent(false)
      })
    }
  }

  const handleStartDM = () => {
    if (onStartDM) {
      onStartDM(username)
      setShowMenu(false)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (username !== currentUser) {
      setShowMenu(!showMenu)
    }
  }

  if (username === currentUser) {
    return <span className="text-blue-400 font-medium">{username}</span>
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={handleClick}
        className="text-blue-400 hover:text-blue-300 font-medium hover:underline cursor-pointer flex items-center space-x-1"
      >
        <span>{username}</span>
        {isFriend && <Check className="inline w-4 h-4 text-green-400 ml-1" />}
      </button>

      {showMenu && (
        <div className="absolute top-6 left-0 bg-discord-darker border border-discord-light rounded-lg shadow-xl p-2 min-w-48 z-50">
          <div className="text-white text-sm">
            <div className="px-3 py-2 border-b border-discord-light">
              <span className="text-gray-400">User: </span>
              <span className="font-medium">{username}</span>
            </div>
            
            {!isFriend && !requestSent && (
              <button
                onClick={handleSendFriendRequest}
                className="w-full text-left px-3 py-2 hover:bg-discord-light rounded flex items-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Send Friend Request</span>
              </button>
            )}
            
            {requestSent && (
              <div className="px-3 py-2 text-gray-400 text-sm">
                Friend request sent
              </div>
            )}
            
            {isFriend && onStartDM && (
              <button
                onClick={handleStartDM}
                className="w-full text-left px-3 py-2 hover:bg-discord-light rounded flex items-center space-x-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Send Message</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ClickableUsername 