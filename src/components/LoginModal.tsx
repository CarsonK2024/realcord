import React, { useState } from 'react'
import { User, LogIn } from 'lucide-react'

interface LoginModalProps {
  onLogin: (username: string) => void
}

const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim()) {
      onLogin(username.trim())
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-discord-darker p-8 rounded-lg shadow-xl w-96">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-discord-blue rounded-full mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to Discord Clone</h2>
          <p className="text-gray-400">Enter your username to start chatting</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-discord-dark border border-discord-light rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-discord-blue focus:border-transparent"
              placeholder="Enter your username"
              autoFocus
            />
          </div>
          
          <button
            type="submit"
            disabled={!username.trim()}
            className="w-full bg-discord-blue hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <LogIn className="w-4 h-4" />
            <span>Join Chat</span>
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginModal 