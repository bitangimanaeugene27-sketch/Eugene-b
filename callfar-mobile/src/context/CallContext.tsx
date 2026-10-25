import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { api } from '../api/client';
import { soundManager } from '../utils/SoundManager';
import {
  showSystemCallNotification,
  dismissSystemCallNotification,
  addCallNotificationListeners,
  startKeepAliveService,
} from '../utils/CallNotification';

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
  isSpeakerOn: boolean;
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
  toggleSpeaker: () => void;
  speakAssistantGreeting: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

// Helper to inject Opus codec optimization parameters for crystal clear audio, low latency and resilience
function tuneOpusSdp(sdp: string): string {
  if (!sdp) return sdp;
  return sdp.replace(/a=fmtp:(\d+) (.*)/g, (match, pt, params) => {
    if (sdp.includes(`a=rtpmap:${pt} opus/48000`)) {
      let tuned = params;
      if (!tuned.includes('useinbandfec=')) tuned += ';useinbandfec=1';
      if (!tuned.includes('usedtx=')) tuned += ';usedtx=1';
      if (!tuned.includes('minptime=')) tuned += ';minptime=10';
      if (!tuned.includes('maxaveragebitrate=')) tuned += ';maxaveragebitrate=64000';
      return `a=fmtp:${pt} ${tuned}`;
    }
    return match;
  });
}

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
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [assistantTranscript, setAssistantTranscript] = useState('');

  const peerConnection = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const audioWatchdogRef = useRef<any>(null);
  const isSpeakerOnRef = useRef<boolean>(false);
  const pendingOfferSdp = useRef<any>(null);
  // Queue ICE candidates that arrive before remote description is set
  const pendingIceCandidates = useRef<any[]>([]);
  const remoteDescSet = useRef<boolean>(false);
  // Track current call ID/peer in refs so socket handlers always see latest value
  const activeCallIdRef = useRef<string>('');
  const activePeerIdRef = useRef<string>('');
  const localStreamRef = useRef<any>(null);
  const startCallRef = useRef<any>(null);
  // Stable refs so native notification listeners always call the latest accept/reject
  const acceptCallRef = useRef<() => Promise<void>>(async () => {});
  const rejectCallRef = useRef<() => void>(() => {});

  // Duration Timer + Audio Watchdog
  useEffect(() => {
    if (callState === 'CONNECTED') {
      setDurationSeconds(0);
      timerRef.current = setInterval(() => {
        setDurationSeconds((sec) => sec + 1);
      }, 1000);

      // ─── Audio Watchdog: every 5 seconds while call is live ──────────────
      // Re-acquires audio focus with the current speaker/earpiece mode and validates tracks.
      // Keeps sound continuously communicating without interruption.
      audioWatchdogRef.current = setInterval(() => {
        const pc = peerConnection.current;
        const stream = localStreamRef.current;
        const iceState = pc?.iceConnectionState;

        // Re-apply call audio session with current user speaker selection
        soundManager.switchToCallAudio(isSpeakerOnRef.current);

        // Validate that the local audio track is still enabled (unless muted by user)
        if (stream && !isMuted) {
          const audioTracks = stream.getAudioTracks?.() || [];
          audioTracks.forEach((track: any) => {
            if (!track.enabled) {
              track.enabled = true;
              console.log('[Watchdog] Re-enabled local audio track');
            }
          });
        }

        console.log(`[Watchdog] ICE=${iceState} | Speaker=${isSpeakerOnRef.current} | Audio tracks=${stream?.getAudioTracks?.()?.length ?? 0}`);
      }, 5000);

    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioWatchdogRef.current) clearInterval(audioWatchdogRef.current);
      if (callState === 'IDLE') setDurationSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioWatchdogRef.current) clearInterval(audioWatchdogRef.current);
    };
  }, [callState, isMuted]);

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

    // Start background keepalive service to keep connection active while phone is locked
    startKeepAliveService();

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

        const callerName =
          data.caller.profile?.displayName || data.caller.username || 'CallFar Contact';

        // 🔔 Show Android high-priority pop-up heads-up notification (over any app / home screen)
        showSystemCallNotification(data.callId, callerName, data.callType);

        setIncomingCall({
          callId: data.callId,
          peerId: data.caller.id,
          peerName: callerName,
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
        
        const useSpeaker = activeCall?.callType === 'VIDEO';
        setIsSpeakerOn(useSpeaker);
        isSpeakerOnRef.current = useSpeaker;
        // 🔑 Switch audio session to call mode with appropriate speaker state
        await soundManager.switchToCallAudio(useSpeaker);

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

    // 4. Remote ICE Candidate received - queue if remote desc is not yet set or peer connection is still initializing
    socket.on('call:ice-candidate', async (data: { candidate: any }) => {
      if (!data?.candidate) return;

      if (!remoteDescSet.current || !peerConnection.current) {
        pendingIceCandidates.current.push(data.candidate);
        return;
      }
      try {
        if (RTCIceCandidate) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
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

    // 8. 📵 Recipient is Switched Off / Offline (Telecom Carrier Detection)
    socket.on('call:unavailable', (data: {
      callId: string;
      receiverId?: string;
      receiverName?: string;
      reason: string;
      message: string;
    }) => {
      console.log('[CallFar Telecom] Recipient is unavailable/switched off:', data.message);
      soundManager.stopAll();
      soundManager.playCallEnded();
      soundManager.speak('The person you called is currently switched off or unavailable.');
      cleanupCall();
      Alert.alert(
        '📵 Phone Switched Off / Offline',
        data.message || 'The user you called is currently switched off or not reachable on the network. A missed call alert has been sent.',
        [{ text: 'OK' }]
      );
    });

    // 9. 📲 Missed Call Alerts Received When Phone Turns On / App Reconnects
    socket.on('call:missed_alerts', (data: { count: number; alerts: any[] }) => {
      if (!data?.alerts || data.alerts.length === 0) return;
      const latest = data.alerts[0];
      const callerName = latest.data?.callerName || 'A contact';
      const callType = latest.data?.callType === 'VIDEO' ? 'Video' : 'Voice';
      const plural = data.count > 1 ? ` (and ${data.count - 1} other)` : '';

      soundManager.playCallConnected();

      Alert.alert(
        '📞 Missed Call',
        `${callerName} called you for a ${callType} call while your phone was switched off or offline${plural}.`,
        [
          {
            text: 'Dismiss',
            style: 'cancel',
            onPress: () => {
              socket.emit('call:acknowledge_missed', {
                notificationIds: data.alerts.map((a: any) => a.id),
              });
            },
          },
          {
            text: `Call Back`,
            onPress: () => {
              socket.emit('call:acknowledge_missed', {
                notificationIds: data.alerts.map((a: any) => a.id),
              });
              if (latest.data?.callerId && startCallRef.current) {
                startCallRef.current(
                  latest.data.callerId,
                  callerName,
                  latest.data.callType || 'VOICE',
                  latest.data.callerAvatar
                );
              }
            },
          },
        ]
      );
    });

    // Listen for notification action buttons (when user clicks Accept/Decline on pop-up banner).
    // Use stable refs to avoid stale-closure capture of incomingCall state.
    const cleanupNotifListeners = addCallNotificationListeners(
      (_callId) => {
        acceptCallRef.current();
      },
      (_callId) => {
        rejectCallRef.current();
      }
    );

    return () => {
      cleanupNotifListeners();
      socket.off('call:incoming');
      socket.off('call:ringing');
      socket.off('call:accepted');
      socket.off('call:ice-candidate');
      socket.off('call:rejected');
      socket.off('call:ended');
      socket.off('call:error');
      socket.off('call:unavailable');
      socket.off('call:missed_alerts');
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
      // High-performance STUN servers for instant connection establishment
      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ];

      const pc = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });
      peerConnection.current = pc;
      remoteDescSet.current = false;
      pendingIceCandidates.current = [];

      // High-definition telecom audio constraints for crystal clear voice & noise filtering
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        highpassFilter: true,
      };

      let constraints: any = { audio: audioConstraints, video: false };
      if (callType === 'VIDEO') {
        constraints = {
          audio: audioConstraints,
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
      localStreamRef.current = stream;

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

      // ─── ICE State Monitor ───────────────────────────────────────────────
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log('[ICE State]:', state);

        if (state === 'connected' || state === 'completed') {
          // Re-apply call audio mode in case Android stole audio focus
          soundManager.switchToCallAudio(false);
          // Ensure local audio track is active
          const audioTrack = localStreamRef.current?.getAudioTracks?.()[0];
          if (audioTrack && !audioTrack.enabled) {
            audioTrack.enabled = true;
            console.log('[Audio] Re-enabled audio track after ICE reconnect');
          }
        }

        if (state === 'disconnected') {
          console.log('[ICE] Disconnected — attempting recovery...');
          // Re-apply audio focus immediately on disconnect
          soundManager.switchToCallAudio(false);
          // Give ICE 4 seconds to self-recover before forcing a restart
          setTimeout(() => {
            if (
              peerConnection.current &&
              peerConnection.current.iceConnectionState === 'disconnected'
            ) {
              if (isCaller && peerConnection.current.restartIce) {
                console.log('[ICE] Forcing ICE restart...');
                peerConnection.current.restartIce();
              }
            }
          }, 4000);
        }

        if (state === 'failed') {
          if (isCaller && pc.restartIce) {
            console.log('[ICE] Failed — restarting ICE...');
            pc.restartIce();
          }
        }
      };

      // ─── Connection State Monitor ────────────────────────────────────────
      pc.onconnectionstatechange = () => {
        console.log('[PC State]:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          // Audio session keepalive: re-apply call audio mode
          soundManager.switchToCallAudio(false);
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
    startCallRef.current = startCall;

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
        if (offer.sdp) {
          offer.sdp = tuneOpusSdp(offer.sdp);
        }
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

    dismissSystemCallNotification();
    soundManager.stopAll();
    soundManager.playCallConnected();

    const currentIncoming = { ...incomingCall };
    const useSpeaker = currentIncoming.callType === 'VIDEO';
    setIsSpeakerOn(useSpeaker);
    isSpeakerOnRef.current = useSpeaker;
    // 🔑 Switch audio session to call mode with appropriate speaker state
    soundManager.switchToCallAudio(useSpeaker);

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
        if (answer.sdp) {
          answer.sdp = tuneOpusSdp(answer.sdp);
        }
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
    dismissSystemCallNotification();
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
    dismissSystemCallNotification();
    // Stop watchdog first
    if (audioWatchdogRef.current) {
      clearInterval(audioWatchdogRef.current);
      audioWatchdogRef.current = null;
    }
    soundManager.stopAll();
    // Restore audio session to normal media mode after call ends
    soundManager.switchToMediaAudio();
    if (localStreamRef.current) {
      try { localStreamRef.current.getTracks().forEach((track: any) => track.stop()); } catch {}
      localStreamRef.current = null;
    }
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
    setIsSpeakerOn(false);
    isSpeakerOnRef.current = false;

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

  const toggleSpeaker = () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    isSpeakerOnRef.current = next;
    soundManager.switchToCallAudio(next);
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
        isSpeakerOn,
        durationSeconds,
        isAssistantSpeaking,
        assistantTranscript,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        toggleSpeaker,
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
