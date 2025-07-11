import { useEffect, useRef } from 'react'

interface UseVoiceWebRTCProps {
  socket: any | null
  channelId: string | null
  userId: string | null
  username: string | null
  audioInputId: string | null
  audioOutputId: string | null
}

// Helper: create audio element for remote stream
function playRemoteStream(stream: MediaStream, audioOutputId: string | null) {
  const audio = document.createElement('audio')
  audio.srcObject = stream
  audio.autoplay = true
  audio.controls = false
  audio.style.display = 'none'
  if (audioOutputId && 'setSinkId' in audio) {
    // @ts-ignore
    audio.setSinkId(audioOutputId).catch(() => {})
  }
  document.body.appendChild(audio)
  // Remove element when stream ends
  stream.getTracks().forEach(track => {
    track.addEventListener('ended', () => {
      audio.remove()
    })
  })
  return audio
}

export function useVoiceWebRTC(props: UseVoiceWebRTCProps) {
  const { socket, channelId, userId, username, audioInputId, audioOutputId } = props;
  
  const peersRef = useRef<{ [id: string]: RTCPeerConnection }>({})
  const remoteStreamsRef = useRef<{ [id: string]: MediaStream }>({})
  const localStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    // Only proceed if we have all required parameters
    if (!socket || !channelId || !userId || !username) {
      // Only log if we have a socket but are missing other parameters (not when channelId is null for text channels)
      if (socket && (!channelId || !userId || !username)) {
        console.log('useVoiceWebRTC: Missing required parameters', { socket: !!socket, channelId, userId, username })
      }
      return
    }
    
    console.log('useVoiceWebRTC: Starting voice setup', { channelId, userId, username })

    // 1. Get user media (microphone)
    async function startLocalStream() {
      if (localStreamRef.current) return localStreamRef.current
      console.log('useVoiceWebRTC: Getting user media...')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioInputId ? { deviceId: { exact: audioInputId } } : true
        })
        console.log('useVoiceWebRTC: Got user media stream', stream.getTracks().map(t => t.kind))
        localStreamRef.current = stream
        return stream
      } catch (error) {
        console.error('useVoiceWebRTC: Error getting user media:', error)
        throw error
      }
    }

    // 2. Join the voice channel (notify server)
    console.log('useVoiceWebRTC: Joining voice channel', { channelId, userId, username })
    socket.emit('joinVoiceChannel', { channelId, userId, username })

    // 3. Handle new participant (someone else joined)
    socket.on('voice-user-joined', async (peerId: string) => {
      if (peerId === userId) return // Don't connect to self
      if (peersRef.current[peerId]) return // Already connected
      const localStream = await startLocalStream()
      const pc = createPeerConnection(peerId)
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream))
      // Create and send offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('voice-signal', {
        to: peerId,
        from: userId,
        type: 'offer',
        sdp: offer.sdp,
        channelId
      })
    })

    // 4. Handle signaling events
    socket.on('voice-signal', async (data: any) => {
      const { from, type, sdp, candidate } = data
      if (from === userId) return
      let pc = peersRef.current[from]
      if (!pc) {
        const localStream = await startLocalStream()
        pc = createPeerConnection(from)
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream))
      }
      if (type === 'offer') {
        console.log('Before setRemoteDescription (offer):', pc.signalingState)
        if (pc.signalingState === 'stable') {
          await pc.setRemoteDescription({ type: 'offer', sdp })
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.emit('voice-signal', {
            to: from,
            from: userId,
            type: 'answer',
            sdp: answer.sdp,
            channelId
          })
        }
      } else if (type === 'answer') {
        console.log('Before setRemoteDescription (answer):', pc.signalingState)
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription({ type: 'answer', sdp })
        }
      } else if (type === 'candidate' && candidate) {
        try {
          await pc.addIceCandidate(candidate)
        } catch {}
      }
    })

    // 5. Handle participant leaving
    socket.on('voice-user-left', (peerId: string) => {
      if (peersRef.current[peerId]) {
        peersRef.current[peerId].close()
        delete peersRef.current[peerId]
      }
      if (remoteStreamsRef.current[peerId]) {
        // Remove audio element
        remoteStreamsRef.current[peerId].getTracks().forEach(track => track.stop())
        delete remoteStreamsRef.current[peerId]
      }
    })

    // Helper: create peer connection
    function createPeerConnection(peerId: string) {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      })
      peersRef.current[peerId] = pc
      // Send ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('voice-signal', {
            to: peerId,
            from: userId,
            type: 'candidate',
            candidate: event.candidate,
            channelId
          })
        }
      }
      // Handle remote stream
      pc.ontrack = (event) => {
        let stream = remoteStreamsRef.current[peerId]
        if (!stream) {
          stream = new MediaStream()
          remoteStreamsRef.current[peerId] = stream
          playRemoteStream(stream, audioOutputId)
        }
        stream.addTrack(event.track)
      }
      return pc
    }

    // 6. Cleanup on leave
    return () => {
      socket.emit('leaveVoiceChannel', { channelId, userId })
      Object.values(peersRef.current).forEach(pc => pc.close())
      peersRef.current = {}
      Object.values(remoteStreamsRef.current).forEach(stream => {
        stream.getTracks().forEach(track => track.stop())
      })
      remoteStreamsRef.current = {}
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
      }
    }
  }, [socket, channelId, audioInputId, audioOutputId, userId, username])

  // TODO: Expose functions to mute/unmute, get participant list, etc.
} 