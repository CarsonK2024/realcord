import React from 'react'

interface StartDMModalProps {
  isOpen: boolean
  onClose: () => void
  friends: { uid: string, username: string }[]
  onSelect: (username: string) => void
}

const StartDMModal: React.FC<StartDMModalProps> = ({ isOpen, onClose, friends, onSelect }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-discord-darker rounded-lg shadow-lg p-6 w-80">
        <h2 className="text-white text-lg font-semibold mb-4">Start a Direct Message</h2>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {friends.length === 0 ? (
            <p className="text-gray-400 text-sm">No friends to message.</p>
          ) : (
            friends.map(friend => (
              <button
                key={friend.uid}
                onClick={() => { onSelect(friend.username); onClose(); }}
                className="w-full text-left px-3 py-2 rounded bg-discord-light hover:bg-discord-blue hover:text-white text-gray-200 transition-colors"
              >
                {friend.username}
              </button>
            ))
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-discord-blue text-white rounded hover:bg-blue-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default StartDMModal 