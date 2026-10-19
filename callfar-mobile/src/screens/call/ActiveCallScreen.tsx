import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useCall } from '../../context/CallContext';
import { THEME } from '../../styles/theme';
import { Avatar } from '../../components/common/Avatar';

// Safe import of RTCView
let RTCView: any = null;
try {
  RTCView = require('react-native-webrtc').RTCView;
} catch {}

// ─── Animated Sound Wave Bars ────────────────────────────────────────────────
const AudioWaveBars = ({ active }: { active: boolean }) => {
  const bar1 = useRef(new Animated.Value(12)).current;
  const bar2 = useRef(new Animated.Value(24)).current;
  const bar3 = useRef(new Animated.Value(18)).current;
  const bar4 = useRef(new Animated.Value(30)).current;
  const bar5 = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    if (!active) return;

    const animateBar = (anim: Animated.Value, minH: number, maxH: number, dur: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: maxH,
            duration: dur,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: minH,
            duration: dur,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );
    };

    const anims = [
      animateBar(bar1, 10, 34, 380),
      animateBar(bar2, 14, 46, 460),
      animateBar(bar3, 8, 38, 310),
      animateBar(bar4, 16, 52, 420),
      animateBar(bar5, 12, 32, 350),
    ];

    anims.forEach((a) => a.start());

    return () => {
      anims.forEach((a) => a.stop());
    };
  }, [active]);

  return (
    <View style={waveStyles.container}>
      {[bar1, bar2, bar3, bar4, bar5].map((anim, idx) => (
        <Animated.View
          key={idx}
          style={[
            waveStyles.bar,
            {
              height: anim,
              backgroundColor: active ? THEME.colors.primaryLight : THEME.colors.textMuted,
            },
          ]}
        />
      ))}
    </View>
  );
};

const waveStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 60,
    marginVertical: 14,
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
});

export const ActiveCallScreen: React.FC = () => {
  const {
    callState,
    activeCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoEnabled,
    isSpeakerOn,
    durationSeconds,
    isAssistantSpeaking,
    assistantTranscript,
    endCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    speakAssistantGreeting,
  } = useCall();

  // Pulse animation for avatar while dialing/ringing
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (callState === 'DIALING' || callState === 'RINGING') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [callState]);

  if (callState === 'IDLE' || !activeCall) return null;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isVideo = activeCall.callType === 'VIDEO';
  const isSelfCall = activeCall.isSelfCall;

  return (
    <Modal visible={true} animationType="fade" statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        {/* Background / Video Area */}
        {isVideo && remoteStream && RTCView ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.fullScreenVideo}
            objectFit="cover"
          />
        ) : (
          <View style={styles.audioCallBackground}>
            {/* Top header badge */}
            <View style={styles.topBadge}>
              <Text style={styles.topBadgeText}>
                {isSelfCall
                  ? '🤖 AI Voice Assistant · Echo Test'
                  : '🔒 End-to-End Encrypted Session'}
              </Text>
            </View>

            {/* Avatar with animated pulse */}
            <Animated.View
              style={[
                styles.avatarGlow,
                (callState === 'DIALING' || callState === 'RINGING') && {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Avatar
                name={isSelfCall ? 'Voice Bot' : activeCall.peerName}
                url={isSelfCall ? null : activeCall.peerAvatar}
                size={120}
              />
            </Animated.View>

            <Text style={styles.peerName}>
              {isSelfCall ? 'CallFar Voice Assistant' : activeCall.peerName}
            </Text>

            <Text style={styles.callStateText}>
              {callState === 'CONNECTED'
                ? formatTimer(durationSeconds)
                : callState === 'RINGING'
                ? '🔔 Ringing phone...'
                : '📞 Calling...'}
            </Text>

            {/* Audio Wave Visualizer */}
            {callState === 'CONNECTED' && (
              <AudioWaveBars active={isAssistantSpeaking || !isMuted} />
            )}

            {/* Self-Call AI Assistant Card */}
            {isSelfCall && callState === 'CONNECTED' && (
              <View style={styles.assistantCard}>
                <View style={styles.assistantCardHeader}>
                  <Text style={styles.assistantCardTitle}>
                    {isAssistantSpeaking ? '🔊 Assistant Speaking...' : '🎤 Echo Mode Active'}
                  </Text>
                  <TouchableOpacity
                    style={styles.replayBtn}
                    onPress={speakAssistantGreeting}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.replayBtnText}>🔊 Replay Voice</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.assistantTranscriptText}>
                  "{assistantTranscript || 'Speak into your microphone to hear your voice echo back.'}"
                </Text>

                <Text style={styles.assistantSubText}>
                  💡 Tip: Speak normally. You will hear your voice in real time to verify your audio
                  latency and microphone quality.
                </Text>
              </View>
            )}

            {!isSelfCall && (
              <Text style={styles.encryptionBadge}>
                SRTP DTLS-256 · WebRTC Peer-to-Peer
              </Text>
            )}
          </View>
        )}

        {/* Local Video Picture-in-Picture for Video Calls */}
        {isVideo && localStream && RTCView && (
          <View style={styles.pipContainer}>
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.pipVideo}
              objectFit="cover"
              zOrder={1}
            />
          </View>
        )}

        {/* Call Controls Bar */}
        <View style={styles.controlsBar}>
          {/* Mute Mic */}
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={toggleMute}
          >
            <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          {/* Speaker / Earpiece Toggle */}
          <TouchableOpacity
            style={[styles.controlBtn, isSpeakerOn && styles.controlBtnSpeakerActive]}
            onPress={toggleSpeaker}
          >
            <Text style={styles.controlIcon}>{isSpeakerOn ? '📢' : '👂'}</Text>
            <Text style={styles.controlLabel}>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</Text>
          </TouchableOpacity>

          {/* End Call Button */}
          <TouchableOpacity
            style={[styles.controlBtn, styles.endCallBtn]}
            onPress={endCall}
          >
            <Text style={styles.endCallIcon}>✕</Text>
            <Text style={[styles.controlLabel, { color: '#FFFFFF', fontWeight: '700' }]}>
              End
            </Text>
          </TouchableOpacity>

          {/* Camera Toggle (if video call) */}
          {isVideo && (
            <TouchableOpacity
              style={[styles.controlBtn, !isVideoEnabled && styles.controlBtnActive]}
              onPress={toggleCamera}
            >
              <Text style={styles.controlIcon}>{isVideoEnabled ? '📹' : '🚫'}</Text>
              <Text style={styles.controlLabel}>{isVideoEnabled ? 'Cam On' : 'Cam Off'}</Text>
            </TouchableOpacity>
          )}

          {/* If self-call and audio call, show replay voice button in controls */}
          {isSelfCall && !isVideo && (
            <TouchableOpacity style={styles.controlBtn} onPress={speakAssistantGreeting}>
              <Text style={styles.controlIcon}>🔊</Text>
              <Text style={styles.controlLabel}>Speak</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  fullScreenVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  audioCallBackground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 110,
  },
  topBadge: {
    backgroundColor: THEME.colors.surfaceHover,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 24,
  },
  topBadgeText: {
    fontSize: 12,
    color: THEME.colors.primaryLight,
    fontWeight: '600',
  },
  avatarGlow: {
    borderRadius: 70,
    padding: 6,
    backgroundColor: THEME.colors.surface,
    borderWidth: 2,
    borderColor: THEME.colors.primary + '55',
    marginBottom: 20,
  },
  peerName: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  callStateText: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  encryptionBadge: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 12,
  },

  // Self-Call Assistant Card
  assistantCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.primary + '44',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 340,
    marginTop: 8,
  },
  assistantCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assistantCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primaryLight,
  },
  replayBtn: {
    backgroundColor: THEME.colors.primary + '22',
    borderWidth: 1,
    borderColor: THEME.colors.primary + '66',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  replayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primaryLight,
  },
  assistantTranscriptText: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  assistantSubText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 15,
  },

  // Picture-in-Picture Video
  pipContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  pipVideo: {
    width: '100%',
    height: '100%',
  },

  // Controls Bar
  controlsBar: {
    position: 'absolute',
    bottom: 36,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface + 'EE',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: THEME.colors.surfaceHover,
  },
  controlBtnActive: {
    backgroundColor: THEME.colors.primary,
  },
  controlBtnSpeakerActive: {
    backgroundColor: '#10B981',
  },
  controlIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  controlLabel: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  endCallBtn: {
    backgroundColor: THEME.colors.danger,
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  endCallIcon: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '900',
  },
});

export default ActiveCallScreen;
