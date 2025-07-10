import React, { useEffect, useState } from 'react'

interface VoiceSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  audioInputId: string | null
  audioOutputId: string | null
  setAudioInputId: (id: string) => void
  setAudioOutputId: (id: string) => void
}

const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  audioInputId,
  audioOutputId,
  setAudioInputId,
  setAudioOutputId
}) => {
  // Early return before any hooks
  if (!isOpen) return null

  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setInputs(devices.filter(d => d.kind === 'audioinput'))
      setOutputs(devices.filter(d => d.kind === 'audiooutput'))
    })
  }, [isOpen])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-discord-darker rounded-lg p-6 w-96 max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-xl font-semibold">Voice Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Input Device</label>
            <select
              className="w-full px-3 py-2 bg-discord-light border border-discord-lighter rounded-md text-white focus:outline-none focus:ring-2 focus:ring-discord-blue"
              value={audioInputId || ''}
              onChange={e => setAudioInputId(e.target.value)}
            >
              <option value="">Default</option>
              {inputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone (${device.deviceId})`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Output Device</label>
            <select
              className="w-full px-3 py-2 bg-discord-light border border-discord-lighter rounded-md text-white focus:outline-none focus:ring-2 focus:ring-discord-blue"
              value={audioOutputId || ''}
              onChange={e => setAudioOutputId(e.target.value)}
            >
              <option value="">Default</option>
              {outputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || `Speaker (${device.deviceId})`}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-discord-blue text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default VoiceSettingsModal 