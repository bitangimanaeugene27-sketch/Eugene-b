import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Platform,
  Vibration,
} from 'react-native';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { navigate } from '../../navigation/navigationRef';
import { Avatar } from './Avatar';
import { THEME } from '../../styles/theme';

export interface InAppNotification {
  id: string;
  type: 'MESSAGE' | 'MISSED_CALL';
  title: string;
  senderName: string;
  senderAvatar?: string | null;
  senderId: string;
  content: string;
  callType?: 'VOICE' | 'VIDEO';
  conversationId?: string;
  timestamp: Date;
}

export const InAppNotificationBanner = () => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { startCall } = useCall();

  const [notification, setNotification] = useState<InAppNotification | null>(null);

  const translateY = useRef(new Animated.Value(-140)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const dismissTimer = useRef<any>(null);

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.timing(translateY, {
      toValue: -140,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setNotification(null);
    });
  };

  const showNotification = (notif: InAppNotification) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);

    setNotification(notif);
    progressAnim.setValue(1);

    // Haptic feedback
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(notif.type === 'MISSED_CALL' ? [0, 120, 80, 120] : [0, 60]);
      } catch {}
    }

    // Slide down animation
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 45,
    }).start();

    // Progress bar animation for 5 seconds
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 5000,
      useNativeDriver: false,
    }).start();

    dismissTimer.current = setTimeout(() => {
      dismiss();
    }, 5000);
  };

  useEffect(() => {
    if (!socket) return;

    // 1. Real Message Notification
    const onNewMessage = (data: { conversationId: string; message: any }) => {
      const msg = data.message;
      if (!msg || msg.senderId === user?.id) return;

      const senderName =
        msg.sender?.profile?.displayName || msg.sender?.username || 'A friend';
      const senderAvatar = msg.sender?.profile?.avatarUrl;

      showNotification({
        id: msg.id || String(Date.now()),
        type: 'MESSAGE',
        title: 'New Message',
        senderName,
        senderAvatar,
        senderId: msg.senderId,
        content: msg.content || 'Sent an attachment',
        conversationId: data.conversationId,
        timestamp: new Date(),
      });
    };

    // 2. Missed Call Notification
    const onMissedCall = (data: {
      callId: string;
      caller: any;
      callType: 'VOICE' | 'VIDEO';
      timestamp: string;
    }) => {
      if (!data.caller || data.caller.id === user?.id) return;

      const callerName =
        data.caller.profile?.displayName || data.caller.username || 'A friend';

      showNotification({
        id: data.callId || String(Date.now()),
        type: 'MISSED_CALL',
        title: `Missed ${data.callType === 'VIDEO' ? 'Video' : 'Voice'} Call`,
        senderName: callerName,
        senderAvatar: data.caller.profile?.avatarUrl,
        senderId: data.caller.id,
        content: `Tap to call back or send message`,
        callType: data.callType,
        timestamp: new Date(data.timestamp || Date.now()),
      });
    };

    socket.on('chat:new_message', onNewMessage);
    socket.on('call:missed', onMissedCall);

    return () => {
      socket.off('chat:new_message', onNewMessage);
      socket.off('call:missed', onMissedCall);
    };
  }, [socket, user?.id]);

  const handlePress = () => {
    if (!notification) return;

    const notif = notification;
    dismiss();

    if (notif.type === 'MESSAGE' && notif.conversationId) {
      navigate('Chat', {
        conversationId: notif.conversationId,
        peerId: notif.senderId,
        peerName: notif.senderName,
        peerAvatar: notif.senderAvatar,
      });
    } else if (notif.type === 'MISSED_CALL') {
      // Start call back
      startCall(
        notif.senderId,
        notif.senderName,
        notif.callType || 'VOICE',
        notif.senderAvatar
      );
    }
  };

  const handleReplyMessage = () => {
    if (!notification) return;
    const notif = notification;
    dismiss();

    if (notif.conversationId) {
      navigate('Chat', {
        conversationId: notif.conversationId,
        peerId: notif.senderId,
        peerName: notif.senderName,
        peerAvatar: notif.senderAvatar,
      });
    } else {
      navigate('ChatsTab');
    }
  };

  if (!notification) return null;

  const isMissed = notification.type === 'MISSED_CALL';

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.container,
          isMissed ? styles.containerMissed : styles.containerMessage,
        ]}
        onPress={handlePress}
        activeOpacity={0.92}
      >
        {/* Left Icon / Avatar */}
        <View style={styles.avatarWrap}>
          <Avatar
            name={notification.senderName}
            url={notification.senderAvatar}
            size={44}
          />
          <View
            style={[
              styles.typeBadge,
              isMissed ? styles.badgeMissed : styles.badgeMessage,
            ]}
          >
            <Text style={styles.badgeEmoji}>{isMissed ? '📵' : '💬'}</Text>
          </View>
        </View>

        {/* Info Column */}
        <View style={styles.contentCol}>
          <View style={styles.headerRow}>
            <Text
              style={[
                styles.titleText,
                isMissed ? styles.titleMissed : styles.titleMessage,
              ]}
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            <Text style={styles.timeText}>Just now</Text>
          </View>
          <Text style={styles.senderText} numberOfLines={1}>
            {notification.senderName}
          </Text>
          <Text style={styles.bodyText} numberOfLines={2}>
            {notification.content}
          </Text>
        </View>

        {/* Right Action Buttons */}
        <View style={styles.actionCol}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              isMissed ? styles.actionBtnMissed : styles.actionBtnMessage,
            ]}
            onPress={isMissed ? handlePress : handleReplyMessage}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>
              {isMissed ? '📞 Call' : 'Reply'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={dismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar at bottom */}
        <Animated.View
          style={[
            styles.progressBar,
            {
              backgroundColor: isMissed ? '#EF4444' : '#10B981',
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 26,
    left: 12,
    right: 12,
    zIndex: 999999,
    elevation: 999,
  },
  container: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    overflow: 'hidden',
  },
  containerMessage: {
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  containerMissed: {
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 10,
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  badgeMessage: {
    backgroundColor: '#10B981',
  },
  badgeMissed: {
    backgroundColor: '#EF4444',
  },
  badgeEmoji: {
    fontSize: 10,
  },
  contentCol: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  titleText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  titleMessage: {
    color: '#34D399',
  },
  titleMissed: {
    color: '#F87171',
  },
  timeText: {
    fontSize: 10,
    color: '#64748B',
  },
  senderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  bodyText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  actionCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: 8,
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnMessage: {
    backgroundColor: '#10B981',
  },
  actionBtnMissed: {
    backgroundColor: '#EF4444',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    padding: 2,
  },
  closeText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2.5,
  },
});

export default InAppNotificationBanner;
