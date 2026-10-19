import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { api } from '../api/client';
import { soundManager } from '../utils/SoundManager';

// Optional WebRTC import handling for dev/prebuild flexibility
let RTCPeerConnection: any;
let RTCSessionDescription: any;
let RTCIceCandidate: any;
let mediaDevices: any;

try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  mediaDevices = webrtc.mediaDevices;
} catch {
  // WebRTC native module placeholder for initial layout before native compilation
}

export type CallState = 'IDLE' | 'DIALING' | 'RINGING' | 'CONNECTED' | 'ENDED';

export interface ActiveCallData {
  callId: string;
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  callType: 'VOICE' | 'VIDEO';
  isIncoming: boolean;
  isSelfCall?: boolean;
  networkTopology?: {
    isSameNetwork: boolean;
    mode: 'SAME_NETWORK_LAN' | 'REMOTE_NETWORK_WAN';
    route: 'DIRECT_P2P_LAN' | 'CLOUD_RELAY';
    routeLabel: string;
    estimatedLatencyMs: number;
    dataConsumption: string;
    audioCodec: string;
  };
}

interface CallContextType {
  callState: CallState;
  activeCall: ActiveCallData | null;
  incomingCall: ActiveCallData | null;
  localStream: any;
  remoteStream: any;
  isMuted: boolean;
  isVideoEnabled: boolean;
  durationSeconds: number;
  isAssistantSpeaking: boolean;
  assistantTranscript: string;
  startCall: (
    peerId: string,
    peerName: string,
    callType: 'VOICE' | 'VIDEO',
    peerAvatar?: string | null
  ) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  speakAssistantGreeting: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket, reconnectSocket } = useSocket();
  const { user } = useAuth();

  const [callState, setCallState] = useState<CallState>('IDLE');
  const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null);
  const [incomingCall, setIncomingCall] = useState<ActiveCallData | null>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [assistantTranscript, setAssistantTranscript] = useState('');

  const peerConnection = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const pendingOfferSdp = useRef<any>(null);
  // Queue ICE candidates that arrive before remote description is set
  const pendingIceCandidates = useRef<any[]>([]);
  const remoteDescSet = useRef<boolean>(false);
  // Track current call ID/peer in refs so socket handlers always see latest value
  const activeCallIdRef = useRef<string>('');
  const activePeerIdRef = useRef<string>('');

  // Duration Timer
  useEffect(() => {
    if (callState === 'CONNECTED') {
      setDurationSeconds(0);
      timerRef.current = setInterval(() => {
        setDurationSeconds((sec) => sec + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (callState === 'IDLE') setDurationSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  const speakAssistantGreeting = () => {
    const greeting =
      'Hello! Welcome to CallFar Voice and Audio Echo Service. Your connection is active and crystal clear! Speak into your microphone to test your audio quality and network latency.';
    setAssistantTranscript(greeting);
    setIsAssistantSpeaking(true);
    soundManager.speak(greeting, () => {
      setIsAssistantSpeaking(false);
    });
  };

  // Drain pending ICE candidates after remote description is set
  const drainPendingIceCandidates = async () => {
    if (!peerConnection.current || !RTCIceCandidate) return;
    while (pendingIceCandidates.current.length > 0) {
      const candidate = pendingIceCandidates.current.shift();
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[ICE drain error]:', e);
      }
    }
  };

  // Setup Socket listeners for calling
  useEffect(() => {
    if (!socket) return;

    // 1. Incoming Call
    socket.on(
      'call:incoming',
      (data: {
        callId: string;
        caller: { id: string; username: string; profile: { displayName: string; avatarUrl?: string } };
        callType: 'VOICE' | 'VIDEO';
        offerSdp: any;
        networkTopology?: any;
      }) => {
        console.log('[Call Incoming]:', data.callId, 'from', data.caller.username);
        pendingOfferSdp.current = data.offerSdp;
        remoteDescSet.current = false;
        pendingIceCandidates.current = [];
        soundManager.playRingtone();
        setIncomingCall({
          callId: data.callId,
          peerId: data.caller.id,
          peerName: data.caller.profile?.displayName || data.caller.username,
          peerAvatar: data.caller.profile?.avatarUrl,
          callType: data.callType,
          isIncoming: true,
          isSelfCall: false,
          networkTopology: data.networkTopology,
        });
      }
    );

    // 2. Caller receives ringing state - IMPORTANT: update callId from server
    socket.on('call:ringing', (data?: { callId?: string; isSelfCall?: boolean; networkTopology?: any }) => {
      setCallState('RINGING');
      setActiveCall((prev) => {
        if (!prev) return prev;
        const updatedCallId = data?.callId || prev.callId;
        activeCallIdRef.current = updatedCallId;
        return {
          ...prev,
          callId: updatedCallId,
          ...(data?.networkTopology ? { networkTopology: data.networkTopology } : {}),
        };
      });
      soundManager.playRingback();
    });

    // 3. Caller receives accept notification
    socket.on(
      'call:accepted',
      async (data: { callId: string; answerSdp: any; isSelfCall?: boolean; networkTopology?: any }) => {
        console.log('[Call Accepted by peer]', data.callId);
        soundManager.stopAll();
        soundManager.playCallConnected();

        setActiveCall((prev) => {
          if (!prev) return prev;
          const updatedCallId = data.callId || prev.callId;
          activeCallIdRef.current = updatedCallId;
          return {
            ...prev,
            callId: updatedCallId,
            ...(data?.networkTopology ? { networkTopology: data.networkTopology } : {}),
          };
        });

        if (peerConnection.current && data.answerSdp && RTCSessionDescription) {
          try {
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(data.answerSdp)
            );
            remoteDescSet.current = true;
            await drainPendingIceCandidates();
          } catch (e) {
            console.warn('[Remote description error]:', e);
          }
        }
        setCallState('CONNECTED');

        if (data.isSelfCall) {
          setTimeout(() => {
            speakAssistantGreeting();
          }, 600);
        }
      }
    );

    // 4. Remote ICE Candidate received - queue until remote desc is set
    socket.on('call:ice-candidate', async (data: { candidate: any }) => {
      if (!data.candidate || !RTCIceCandidate || !peerConnection.current) return;

      if (!remoteDescSet.current) {
        pendingIceCandidates.current.push(data.candidate);
        return;
      }
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.warn('[Add ICE error]:', e);
      }
    });

    // 5. Call Rejected
    socket.on('call:rejected', () => {
      soundManager.stopAll();
      soundManager.playCallEnded();
      Alert.alert('Call Declined', 'The person you called is not available right now.', [{ text: 'OK' }]);
      cleanupCall();
    });

    // 6. Call Ended
    socket.on('call:ended', () => {
      soundManager.stopAll();
      soundManager.playCallEnded();
      cleanupCall();
    });

    // 7. Call Error
    socket.on('call:error', (err: { message: string }) => {
      console.warn('[Call Error]:', err.message);
      soundManager.stopAll();
      Alert.alert(
        'Call Failed',
        err.message || 'Could not connect the call. Please check your network and try again.',
        [{ text: 'OK' }]
      );
      cleanupCall();
    });

    return () => {
      socket.off('call:incoming');
      socket.off('call:ringing');
      socket.off('call:accepted');
      socket.off('call:ice-candidate');
      socket.off('call:rejected');
      socket.off('call:ended');
      socket.off('call:error');
    };
  }, [socket]);

  /**
   * Initialize WebRTC Peer Connection and Local Media Stream
   */
  const initWebRTC = async (
    isCaller: boolean,
    targetUserId: string,
    callId: string,
    callType: 'VOICE' | 'VIDEO',
    isSelfCall = false
  ) => {
    if (!RTCPeerConnection || !mediaDevices) {
      console.warn('WebRTC native library not initialized yet.');
      Alert.alert(
        'WebRTC Not Ready',
        'The calling module is still loading. Please try again in a moment.',
        [{ text: 'OK' }]
      );
      return null;
    }

    try {
      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ];
      try {
        const iceRes = await api.get('/calls/ice-servers', { timeout: 3000 });
        if (iceRes.data?.data?.length) {
          iceServers.push(...iceRes.data.data);
        }
      } catch {
        console.log('[ICE] Using fallback public STUN servers');
      }

      const pc = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });
      peerConnection.current = pc;
      remoteDescSet.current = false;
      pendingIceCandidates.current = [];

      // Build media constraints - try video, fall back to audio-only if needed
      let constraints: any = { audio: true, video: false };
      if (callType === 'VIDEO') {
        constraints = {
          audio: true,
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        };
      }

      let stream: any = null;
      try {
        stream = await mediaDevices.getUserMedia(constraints);
      } catch (mediaErr: any) {
        if (callType === 'VIDEO') {
          console.warn('[Media] Video access failed, falling back to audio only:', mediaErr?.message);
          stream = await mediaDevices.getUserMedia({ audio: true, video: false });
        } else {
          throw mediaErr;
        }
      }

      setLocalStream(stream);

      if (isSelfCall) {
        setRemoteStream(stream);
        remoteDescSet.current = true;
      }

      stream.getTracks().forEach((track: any) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event: any) => {
        console.log('[WebRTC] Remote track received');
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event: any) => {
        if (event.candidate && socket && !isSelfCall) {
          const currentCallId = activeCallIdRef.current || callId;
          const currentPeerId = activePeerIdRef.current || targetUserId;
          socket.emit('call:ice-candidate', {
            targetUserId: currentPeerId,
            callId: currentCallId,
            candidate: event.candidate,
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[ICE State]:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed' && isCaller && pc.restartIce) {
          pc.restartIce();
        }
      };

      return pc;
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[WebRTC Init Error]:', msg);
      if (!msg.includes('Network') && !msg.includes('net::') && !msg.includes('ECONNREFUSED')) {
        Alert.alert(
          'Microphone / Camera Error',
          'Could not access microphone or camera. Please grant permissions in Settings and try again.',
          [{ text: 'OK' }]
        );
      }
      return null;
    }
  };

  /**
   * Start an outgoing call
   */
  const startCall = async (
    peerId: string,
    peerName: string,
    callType: 'VOICE' | 'VIDEO',
    peerAvatar?: string | null
  ) => {
    if (!user) {
      Alert.alert('Session Expired', 'Please sign in again to place calls.', [{ text: 'OK' }]);
      return;
    }

    if (!socket || !socket.connected) {
      console.log('[CallContext] Socket disconnected. Auto-reconnecting before call...');
      reconnectSocket();
      let attempts = 8;
      while (attempts > 0) {
        await new Promise((res) => setTimeout(res, 250));
        attempts--;
        if (socket && socket.connected) break;
      }
    }

    if (!socket || !socket.connected) {
      Alert.alert(
        'Not Connected',
        'CallFar is connecting to the signaling server. Please tap Call again in 2 seconds.',
        [{ text: 'OK' }]
      );
      return;
    }

    const isSelfCall = peerId === user.id;

    activeCallIdRef.current = '';
    activePeerIdRef.current = peerId;
    remoteDescSet.current = false;
    pendingIceCandidates.current = [];

    setActiveCall({
      callId: '',
      peerId,
      peerName: isSelfCall ? 'Voice Assistant - Echo Test' : peerName,
      peerAvatar: isSelfCall ? null : peerAvatar,
      callType,
      isIncoming: false,
      isSelfCall,
    });
    setCallState('DIALING');
    soundManager.playRingback();

    const pc = await initWebRTC(true, peerId, '', callType, isSelfCall);
    let offerSdp = null;

    if (pc) {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === 'VIDEO',
        });
        await pc.setLocalDescription(offer);
        offerSdp = offer;
      } catch (e) {
        console.warn('[Offer creation error]:', e);
      }
    }

    socket.emit('call:invite', { receiverId: peerId, callType, offerSdp });
  };

  /**
   * Accept an incoming call
   */
  const acceptCall = async () => {
    if (!incomingCall || !socket) return;

    soundManager.stopAll();
    soundManager.playCallConnected();

    const currentIncoming = { ...incomingCall };
    activeCallIdRef.current = currentIncoming.callId;
    activePeerIdRef.current = currentIncoming.peerId;
    remoteDescSet.current = false;
    pendingIceCandidates.current = [];

    setIncomingCall(null);
    setActiveCall(currentIncoming);
    setCallState('CONNECTED');

    const pc = await initWebRTC(
      false,
      currentIncoming.peerId,
      currentIncoming.callId,
      currentIncoming.callType,
      false
    );

    if (pc && pendingOfferSdp.current && RTCSessionDescription) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferSdp.current));
        remoteDescSet.current = true;
        await drainPendingIceCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('call:accept', {
          callId: currentIncoming.callId,
          callerId: currentIncoming.peerId,
          answerSdp: answer,
        });
      } catch (e) {
        console.warn('[Accept call answer error]:', e);
        Alert.alert('Call Setup Failed', 'Could not complete call setup. Please try again.', [{ text: 'OK' }]);
        cleanupCall();
      }
    } else if (pc) {
      socket.emit('call:accept', {
        callId: currentIncoming.callId,
        callerId: currentIncoming.peerId,
        answerSdp: null,
      });
    }
  };

  /**
   * Reject an incoming call
   */
  const rejectCall = () => {
    if (!incomingCall || !socket) return;
    soundManager.stopAll();
    soundManager.playCallEnded();
    socket.emit('call:reject', {
      callId: incomingCall.callId,
      callerId: incomingCall.peerId,
      reason: 'DECLINED',
    });
    setIncomingCall(null);
    pendingOfferSdp.current = null;
    pendingIceCandidates.current = [];
  };

  /**
   * End an active call
   */
  const endCall = () => {
    soundManager.stopAll();
    soundManager.playCallEnded();

    if (activeCall && socket && !activeCall.isSelfCall) {
      const callId = activeCallIdRef.current || activeCall.callId;
      const peerId = activePeerIdRef.current || activeCall.peerId;
      if (callId) {
        socket.emit('call:end', { callId, peerId });
      }
    }
    cleanupCall();
  };

  /**
   * Release media hardware and clear call states
   */
  const cleanupCall = () => {
    soundManager.stopAll();
    if (localStream) {
      try { localStream.getTracks().forEach((track: any) => track.stop()); } catch {}
    }
    if (peerConnection.current) {
      try { peerConnection.current.close(); } catch {}
      peerConnection.current = null;
    }
    activeCallIdRef.current = '';
    activePeerIdRef.current = '';
    remoteDescSet.current = false;
    pendingIceCandidates.current = [];
    pendingOfferSdp.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setIncomingCall(null);
    setCallState('IDLE');
    setIsMuted(false);
    setIsVideoEnabled(true);
    setIsAssistantSpeaking(false);
    setAssistantTranscript('');
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  return (
    <CallContext.Provider
      value={{
        callState,
        activeCall,
        incomingCall,
        localStream,
        remoteStream,
        isMuted,
        isVideoEnabled,
        durationSeconds,
        isAssistantSpeaking,
        assistantTranscript,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        speakAssistantGreeting,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};

export default CallContext;
