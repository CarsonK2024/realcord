import React, { useState } from 'react'
import { X, Hash, Users } from 'lucide-react'

interface JoinServerModalProps {
  isOpen: boolean
  onClose: () => void
  onJoinServer: (inviteCode: string) => void
}

const JoinServerModal: React.FC<JoinServerModalProps> = ({ isOpen, onClose, onJoinServer }) => {
  const [inviteCode, setInviteCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inviteCode.trim()) {
      setIsLoading(true)
      try {
        onJoinServer(inviteCode.trim().toUpperCase())
        setInviteCode('')
        onClose()
      } catch (error) {
        console.error('Error joining server:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-discord-darker rounded-lg p-6 w-96 max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-xl font-semibold">Join a Server</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              INVITE LINK
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Hash className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code"
                className="w-full pl-10 pr-4 py-3 bg-discord-light border border-discord-lighter rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-discord-blue focus:border-transparent"
                maxLength={6}
              />
            </div>
            <p className="text-gray-400 text-xs mt-1">
              Enter the 6-character invite code to join a server
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-discord-light text-gray-300 rounded-md hover:bg-discord-lighter transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!inviteCode.trim() || isLoading}
              className="flex-1 px-4 py-2 bg-discord-blue text-white rounded-md hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Joining...' : 'Join Server'}
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-discord-light rounded-md">
          <div className="flex items-center space-x-2 mb-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-gray-300 text-sm font-medium">How to get an invite code</span>
          </div>
          <p className="text-gray-400 text-xs">
            Ask a server admin to share their invite code with you. 
            Invite codes are 6-character codes that look like "ABC123".
          </p>
        </div>
      </div>
    </div>
  )
}

export default JoinServerModal 