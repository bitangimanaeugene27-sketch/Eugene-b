import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';

const { CallNotificationModule } = NativeModules;

/**
 * Show a high-priority system pop-up / heads-up call banner on Android
 * Displays caller name, call type, Accept and Decline buttons.
 * Visible even when user is outside the app on home screen or in another app.
 */
export const showSystemCallNotification = (
  callId: string,
  callerName: string,
  callType: 'VOICE' | 'VIDEO'
) => {
  if (Platform.OS === 'android' && CallNotificationModule?.showCallNotification) {
    try {
      CallNotificationModule.showCallNotification(callId, callerName, callType);
      console.log('[CallNotification] Heads-up system call notification displayed.');
    } catch (e) {
      console.warn('[CallNotification] show notification notice:', e);
    }
  }
};

/**
 * Dismiss the system call notification when call is answered, rejected, or ended
 */
export const dismissSystemCallNotification = () => {
  if (Platform.OS === 'android' && CallNotificationModule?.dismissCallNotification) {
    try {
      CallNotificationModule.dismissCallNotification();
      console.log('[CallNotification] System call notification dismissed.');
    } catch (e) {
      console.warn('[CallNotification] dismiss notification notice:', e);
    }
  }
};

/**
 * Listen for native notification actions (when user taps "Accept" or "Decline" on the pop-up notification)
 */
export const addCallNotificationListeners = (
  onAccept: (callId: string) => void,
  onDecline: (callId: string) => void
) => {
  const subAccept = DeviceEventEmitter.addListener('onNotificationAcceptCall', (callId: string) => {
    console.log('[CallNotification] Accept action received from system notification:', callId);
    onAccept(callId);
  });

  const subDecline = DeviceEventEmitter.addListener('onNotificationDeclineCall', (callId: string) => {
    console.log('[CallNotification] Decline action received from system notification:', callId);
    onDecline(callId);
  });

  return () => {
    subAccept.remove();
    subDecline.remove();
  };
};

export default {
  showSystemCallNotification,
  dismissSystemCallNotification,
  addCallNotificationListeners,
};
