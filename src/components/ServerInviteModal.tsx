import React, { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'

interface ServerInviteModalProps {
  isOpen: boolean
  onClose: () => void
  inviteCode: string
  serverName: string
}

const ServerInviteModal: React.FC<ServerInviteModalProps> = ({ 
  isOpen, 
  onClose, 
  inviteCode, 
  serverName 
}) => {
  const [copied, setCopied] = useState(false)

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy invite code:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-discord-darker rounded-lg p-6 w-96 max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg font-semibold">Invite Friends</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-gray-300 text-sm mb-2">Invite friends to</p>
          <p className="text-white font-medium">{serverName}</p>
        </div>
        
        <div className="mb-4">
          <p className="text-gray-300 text-sm mb-2">Invite Code</p>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-discord-light rounded px-3 py-2">
              <span className="text-white font-mono text-lg">{inviteCode}</span>
            </div>
            <button
              onClick={copyInviteCode}
              className="p-2 bg-discord-blue hover:bg-blue-600 text-white rounded transition-colors"
              title="Copy invite code"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        <div className="text-gray-400 text-xs">
          <p>• This invite code can be used by anyone</p>
          <p>• The code will never expire</p>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-discord-light hover:bg-discord-lighter text-white rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default ServerInviteModal 