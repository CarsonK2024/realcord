import React, { useState, useEffect } from 'react'
import { Bell, X, Check} from 'lucide-react'

interface Notification {
  id: string
  type: string
  content: string
  timestamp: Date
  data?: any
}

interface FriendRequest {
  fromId: string
  fromUsername: string
  timestamp: Date
}

interface NotificationBellProps {
  socket: any
}

const NotificationBell: React.FC<NotificationBellProps> = ({ socket }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (socket) {
      // Get initial data
      socket.emit('getNotifications')
      socket.emit('getFriendRequests')

      // Listen for new notifications
      socket.on('newNotification', (notification: Notification) => {
        setNotifications(prev => [notification, ...prev])
        setUnreadCount(prev => prev + 1)
      })

      // Listen for notifications list
      socket.on('notifications', (notificationsList: Notification[]) => {
        setNotifications(notificationsList)
        setUnreadCount(notificationsList.length)
      })

      // Listen for friend requests
      socket.on('friendRequests', (requests: FriendRequest[]) => {
        setFriendRequests(requests)
      })

      // Listen for friend request responses
      socket.on('friendRequestAccepted', (data: any) => {
        // Remove the request from the list
        setFriendRequests(prev => prev.filter(req => req.fromId !== data.fromId))
        // Add notification
        const notification: Notification = {
          id: Date.now().toString(),
          type: 'friend_accepted',
          content: `${data.byUsername} accepted your friend request!`,
          timestamp: new Date()
        }
        setNotifications(prev => [notification, ...prev])
      })

      return () => {
        socket.off('newNotification')
        socket.off('notifications')
        socket.off('friendRequests')
        socket.off('friendRequestAccepted')
      }
    }
  }, [socket])

  const handleFriendRequest = (fromId: string, accepted: boolean) => {
    if (socket) {
      socket.emit('respondToFriendRequest', { fromId, accepted })
    }
  }

  const markNotificationRead = (notificationId: string) => {
    if (socket) {
      socket.emit('markNotificationRead', notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white hover:bg-discord-light rounded transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 bg-discord-darker border border-discord-light rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto z-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Friend Requests */}
          {friendRequests.length > 0 && (
            <div className="mb-4">
              <h4 className="text-gray-300 text-sm font-medium mb-2">Friend Requests</h4>
              <div className="space-y-2">
                {friendRequests.map((request) => (
                  <div key={request.fromId} className="bg-discord-light p-3 rounded">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{request.fromUsername}</p>
                        <p className="text-gray-400 text-xs">
                          {new Date(request.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleFriendRequest(request.fromId, true)}
                          className="p-1 bg-green-600 hover:bg-green-700 text-white rounded"
                          title="Accept"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleFriendRequest(request.fromId, false)}
                          className="p-1 bg-red-600 hover:bg-red-700 text-white rounded"
                          title="Decline"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications */}
          {notifications.length > 0 && (
            <div>
              <h4 className="text-gray-300 text-sm font-medium mb-2">Recent Notifications</h4>
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div key={notification.id} className="bg-discord-light p-3 rounded">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-white text-sm">{notification.content}</p>
                        <p className="text-gray-400 text-xs">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => markNotificationRead(notification.id)}
                        className="text-gray-400 hover:text-white ml-2"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {friendRequests.length === 0 && notifications.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">
              No notifications
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell 