import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useCall } from '../../context/CallContext';
import { THEME } from '../../styles/theme';
import { Avatar } from '../../components/common/Avatar';

export const IncomingCallModal: React.FC = () => {
  const { incomingCall, acceptCall, rejectCall } = useCall();

  // Multi-tier pulsating radar ring animations
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.6)).current;
  const opacity2 = useRef(new Animated.Value(0.4)).current;
  const buttonBounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!incomingCall) return;

    // Outer radar wave 1
    const anim1 = Animated.loop(
      Animated.parallel([
        Animated.timing(pulse1, {
          toValue: 1.45,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity1, {
          toValue: 0,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Inner radar wave 2 (offset)
    const anim2 = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(pulse2, {
            toValue: 1.35,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity2, {
            toValue: 0,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Subtle accept button heartbeat
    const anim3 = Animated.loop(
      Animated.sequence([
        Animated.timing(buttonBounce, {
          toValue: 1.1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(buttonBounce, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [incomingCall]);

  if (!incomingCall) return null;

  const isVideo = incomingCall.callType === 'VIDEO';

  return (
    <Modal visible={true} transparent={false} animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {isVideo ? '📹 CallFar HD Video Call' : '📞 CallFar Voice Call'}
            </Text>
          </View>
          <Text style={styles.statusSubtitle}>Incoming call...</Text>
        </View>

        {/* Center: Pulsating Caller Avatar & Info */}
        <View style={styles.centerArea}>
          <View style={styles.radarWrapper}>
            {/* Radar Wave 1 */}
            <Animated.View
              style={[
                styles.radarCircle,
                {
                  transform: [{ scale: pulse1 }],
                  opacity: opacity1,
                },
              ]}
            />
            {/* Radar Wave 2 */}
            <Animated.View
              style={[
                styles.radarCircle,
                {
                  transform: [{ scale: pulse2 }],
                  opacity: opacity2,
                },
              ]}
            />

            {/* Glowing Avatar Container */}
            <View style={styles.avatarBorder}>
              <Avatar
                name={incomingCall.peerName}
                url={incomingCall.peerAvatar}
                size={130}
              />
            </View>
          </View>

          <Text style={styles.callerName}>{incomingCall.peerName}</Text>
          <Text style={styles.callerSub}>CallFar Secure Telecom</Text>
        </View>

        {/* Bottom Actions: Native-style Decline & Accept */}
        <View style={styles.bottomArea}>
          <View style={styles.actionsRow}>
            {/* Decline */}
            <TouchableOpacity
              style={styles.actionBtnContainer}
              onPress={rejectCall}
              activeOpacity={0.7}
            >
              <View style={[styles.circleBtn, styles.declineBtn]}>
                <Text style={styles.btnIcon}>✕</Text>
              </View>
              <Text style={styles.btnLabel}>Decline</Text>
            </TouchableOpacity>

            {/* Accept */}
            <TouchableOpacity
              style={styles.actionBtnContainer}
              onPress={acceptCall}
              activeOpacity={0.7}
            >
              <Animated.View
                style={[
                  styles.circleBtn,
                  styles.acceptBtn,
                  { transform: [{ scale: buttonBounce }] },
                ]}
              >
                <Text style={styles.btnIcon}>{isVideo ? '📹' : '📞'}</Text>
              </Animated.View>
              <Text style={[styles.btnLabel, { color: '#34D399', fontWeight: '700' }]}>
                Accept
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.encryptionNote}>
            🔒 End-to-end encrypted · Crystal Clear Audio
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070C18',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 30) + 16 : 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 16,
  },
  badge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  badgeText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusSubtitle: {
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 10,
    fontWeight: '500',
  },
  centerArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  radarWrapper: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  radarCircle: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  avatarBorder: {
    padding: 6,
    borderRadius: 75,
    backgroundColor: '#0F172A',
    borderWidth: 3,
    borderColor: '#10B981',
    elevation: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
  },
  callerName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  callerSub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500',
  },
  bottomArea: {
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 320,
    marginBottom: 24,
  },
  actionBtnContainer: {
    alignItems: 'center',
  },
  circleBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  declineBtn: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  btnIcon: {
    fontSize: 30,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  btnLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  encryptionNote: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
});

export default IncomingCallModal;
