import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing } from 'react-native';
import { useCall } from '../../context/CallContext';
import { THEME } from '../../styles/theme';
import { Avatar } from '../../components/common/Avatar';

export const IncomingCallModal: React.FC = () => {
  const { incomingCall, acceptCall, rejectCall } = useCall();
  const ringAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!incomingCall) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, {
          toValue: 1.15,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [incomingCall]);

  if (!incomingCall) return null;

  return (
    <Modal visible={true} transparent={true} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.callTypeLabel}>
            INCOMING {incomingCall.callType} CALL
          </Text>

          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: ringAnim }] }]}>
            <Avatar
              name={incomingCall.peerName}
              url={incomingCall.peerAvatar}
              size={100}
            />
          </Animated.View>

          <Text style={styles.callerName}>{incomingCall.peerName}</Text>
          <Text style={styles.ringingStatus}>CallFar Internet Calling...</Text>

          <View style={styles.actionsRow}>
            {/* Decline Button */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.declineBtn]}
              onPress={rejectCall}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnIcon}>✕</Text>
              <Text style={styles.actionBtnText}>Decline</Text>
            </TouchableOpacity>

            {/* Accept Button */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={acceptCall}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnIcon}>
                {incomingCall.callType === 'VIDEO' ? '📹' : '📞'}
              </Text>
              <Text style={styles.actionBtnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 25, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  callTypeLabel: {
    color: THEME.colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  callerName: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  ringingStatus: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 6,
    marginBottom: 32,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  declineBtn: {
    backgroundColor: THEME.colors.danger,
  },
  acceptBtn: {
    backgroundColor: THEME.colors.success,
  },
  actionBtnIcon: {
    color: THEME.colors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  actionBtnText: {
    color: THEME.colors.white,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default IncomingCallModal;
