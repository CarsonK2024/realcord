import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateServer: (name: string) => void;
}

const CreateServerModal: React.FC<CreateServerModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreateServer 
}) => {
  const [serverName, setServerName] = useState('');
  const [channels, setChannels] = useState([
    { name: 'general', type: 'text' as const }
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('CreateServerModal: Form submitted with server name:', serverName);
    
    if (serverName.trim()) {
      console.log('CreateServerModal: Calling onCreateServer with:', serverName.trim());
      onCreateServer(serverName.trim());
      setServerName('');
      setChannels([{ name: 'general', type: 'text' as const }]);
      onClose();
    } else {
      console.log('CreateServerModal: Server name is empty');
    }
  };

  const addChannel = () => {
    setChannels([...channels, { name: `channel-${channels.length + 1}`, type: 'text' as const }]);
  };

  const updateChannel = (index: number, field: 'name' | 'type', value: string) => {
    const newChannels = [...channels];
    newChannels[index] = { ...newChannels[index], [field]: value };
    setChannels(newChannels);
  };

  const removeChannel = (index: number) => {
    if (channels.length > 1) {
      setChannels(channels.filter((_, i) => i !== index));
    }
  };

  console.log('CreateServerModal: isOpen =', isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-discord-darker p-6 rounded-lg shadow-xl w-96 max-w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create Your Server</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="serverName" className="block text-sm font-medium text-gray-300 mb-2">
              Server Name
            </label>
            <input
              type="text"
              id="serverName"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              className="w-full px-3 py-2 bg-discord-dark border border-discord-light rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-discord-blue focus:border-transparent"
              placeholder="Enter server name"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Channels
            </label>
            <div className="space-y-2">
              {channels.map((channel, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <select
                    value={channel.type}
                    onChange={(e) => updateChannel(index, 'type', e.target.value)}
                    className="px-2 py-1 bg-discord-dark border border-discord-light rounded text-white text-sm"
                  >
                    <option value="text">Text</option>
                    <option value="voice">Voice</option>
                  </select>
                  <input
                    type="text"
                    value={channel.name}
                    onChange={(e) => updateChannel(index, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 bg-discord-dark border border-discord-light rounded text-white text-sm"
                    placeholder="Channel name"
                  />
                  {channels.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChannel(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addChannel}
                className="flex items-center space-x-2 text-discord-blue hover:text-blue-400 text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Channel</span>
              </button>
            </div>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-discord-light hover:bg-discord-lighter text-white rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!serverName.trim()}
              className="flex-1 px-4 py-2 bg-discord-blue hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
            >
              Create Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateServerModal; 