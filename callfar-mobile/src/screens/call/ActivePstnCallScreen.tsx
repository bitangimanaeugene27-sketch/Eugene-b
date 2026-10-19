import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  Vibration,
} from 'react-native';
import { api } from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { THEME } from '../../styles/theme';
import { DetectedCarrier } from '../../types';

export const ActivePstnCallScreen = ({ route, navigation }: any) => {
  const { callId, targetNumber, carrierInfo } = route.params as {
    callId: string;
    targetNumber: string;
    carrierInfo: DetectedCarrier;
  };

  const { socket } = useSocket();

  const [callStatus, setCallStatus] = useState<string>('Connecting to Carrier Gateway...');
  const [durationSec, setDurationSec] = useState(0);
  const [costTotal, setCostTotal] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [dialedTones, setDialedTones] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for live carrier updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data: any) => {
      if (data.id === callId) {
        if (data.state === 'CONNECTING_GATEWAY') {
          setCallStatus('Connecting to Carrier Gateway...');
        } else if (data.state === 'CARRIER_DIALING') {
          setCallStatus(`Dialing on ${data.carrierName}...`);
        } else if (data.state === 'RINGING_SUBSCRIBER') {
          setCallStatus(`Ringing on ${data.carrierBrand || 'Mobile Network'}...`);
        } else if (data.state === 'IN_CALL') {
          setCallStatus('In Call (HD Cellular Audio)');
          setDurationSec(data.durationSeconds || 0);
          setCostTotal(data.costTotal || 0);
        } else if (data.state === 'COMPLETED' || data.state === 'FAILED') {
          setCallStatus('Call Ended');
          setTimeout(() => {
            navigation.goBack();
          }, 1200);
        }
      }
    };

    socket.on('pstn:call_update', handleUpdate);

    return () => {
      socket.off('pstn:call_update', handleUpdate);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket, callId, navigation]);

  const handleEndCall = async () => {
    try {
      await api.post('/pstn/hangup', { callId });
    } catch {}
    navigation.goBack();
  };

  const handleSendDtmf = async (digit: string) => {
    if (Platform.OS !== 'web') Vibration.vibrate(10);
    setDialedTones((prev) => prev + digit);
    try {
      await api.post('/pstn/dtmf', { callId, digit });
    } catch {}
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const carrierColor = carrierInfo?.carrierColor || '#F59E0B';

  return (
    <View style={styles.container}>
      {/* ── Carrier Network Top Banner ── */}
      <View style={[styles.networkBanner, { backgroundColor: carrierColor + '25', borderColor: carrierColor }]}>
        <View style={[styles.pulseDot, { backgroundColor: carrierColor }]} />
        <Text style={[styles.networkText, { color: carrierColor }]}>
          {carrierInfo?.carrierName || 'PSTN Cellular Gateway'}
        </Text>
      </View>

      {/* ── Caller & Destination Info ── */}
      <View style={styles.centerSection}>
        <View style={[styles.flagBadge, { borderColor: carrierColor }]}>
          <Text style={styles.flagEmoji}>{carrierInfo?.country?.flag || '📞'}</Text>
        </View>

        <Text style={styles.destinationNumber}>
          {carrierInfo?.displayFormat || targetNumber}
        </Text>
        <Text style={styles.destinationCountry}>
          {carrierInfo?.country?.name || 'International Destination'}
        </Text>

        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{callStatus}</Text>
        </View>

        {durationSec > 0 && (
          <View style={styles.timerBox}>
            <Text style={styles.timerText}>{formatTimer(durationSec)}</Text>
            <Text style={styles.costText}>
              Est. Cost: ${costTotal.toFixed(3)} {carrierInfo?.currency || 'USD'}
            </Text>
          </View>
        )}

        {dialedTones.length > 0 && (
          <View style={styles.dtmfPill}>
            <Text style={styles.dtmfText}>DTMF Sent: {dialedTones}</Text>
          </View>
        )}
      </View>

      {/* ── In-Call Keypad Modal (for IVR e.g. Press 1 for English) ── */}
      <Modal visible={isKeypadOpen} transparent animationType="slide">
        <View style={styles.keypadModalOverlay}>
          <View style={styles.keypadModalBox}>
            <View style={styles.keypadModalHeader}>
              <Text style={styles.keypadModalTitle}>Dial Touch-Tone (DTMF)</Text>
              <TouchableOpacity onPress={() => setIsKeypadOpen(false)}>
                <Text style={styles.keypadModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dtmfDisplay}>
              <Text style={styles.dtmfDisplayText}>{dialedTones || 'Tap digits...'}</Text>
            </View>

            <View style={styles.dtmfGrid}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={styles.dtmfKey}
                  onPress={() => handleSendDtmf(d)}
                >
                  <Text style={styles.dtmfKeyText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── In-Call Action Buttons ── */}
      <View style={styles.actionsContainer}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, isMuted && styles.actionBtnActive]}
            onPress={() => setIsMuted(!isMuted)}
          >
            <Text style={styles.actionIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
            <Text style={styles.actionLabel}>{isMuted ? 'Muted' : 'Mute'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setIsKeypadOpen(true)}
          >
            <Text style={styles.actionIcon}>🔢</Text>
            <Text style={styles.actionLabel}>Keypad</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, isSpeaker && styles.actionBtnActive]}
            onPress={() => setIsSpeaker(!isSpeaker)}
          >
            <Text style={styles.actionIcon}>{isSpeaker ? '📢' : '🔈'}</Text>
            <Text style={styles.actionLabel}>{isSpeaker ? 'Speaker On' : 'Speaker'}</Text>
          </TouchableOpacity>
        </View>

        {/* End Call Button */}
        <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall} activeOpacity={0.8}>
          <Text style={styles.endCallText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070B14',
    paddingTop: 50,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  networkText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  centerSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  flagBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  flagEmoji: {
    fontSize: 44,
  },
  destinationNumber: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  destinationCountry: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  statusPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 14,
  },
  statusText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  timerBox: {
    alignItems: 'center',
    marginTop: 16,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  costText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  dtmfPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  dtmfText: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '700',
  },

  // Actions
  actionsContainer: {
    gap: 24,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionBtn: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#111827',
    width: 80,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  actionBtnActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#38BDF8',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  endCallBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  endCallText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Keypad Modal
  keypadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  keypadModalBox: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  keypadModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  keypadModalTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  keypadModalClose: {
    color: '#94A3B8',
    fontSize: 18,
    padding: 4,
  },
  dtmfDisplay: {
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 14,
  },
  dtmfDisplayText: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  dtmfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  dtmfKey: {
    width: '30%',
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dtmfKeyText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
});

export default ActivePstnCallScreen;
