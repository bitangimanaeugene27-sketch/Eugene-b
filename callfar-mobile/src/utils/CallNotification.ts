import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';

const { CallNotificationModule, CallKeepAliveModule } = NativeModules;

/**
 * Show a high-priority system pop-up / floating call overlay on Android
 * Displays caller name, call type, Accept and Decline buttons.
 * Works even when phone is locked, asleep, or inside another app like YouTube / TikTok!
 */
export const showSystemCallNotification = (
  callId: string,
  callerName: string,
  callType: 'VOICE' | 'VIDEO'
) => {
  if (Platform.OS === 'android' && CallNotificationModule?.showCallNotification) {
    try {
      CallNotificationModule.showCallNotification(callId, callerName, callType);
      console.log('[CallNotification] Floating call overlay & heads-up system notification displayed.');
    } catch (e) {
      console.warn('[CallNotification] show notification notice:', e);
    }
  }
};

/**
 * Dismiss the system call notification, floating overlay, and stop native ringtone/vibration
 */
export const dismissSystemCallNotification = () => {
  if (Platform.OS === 'android' && CallNotificationModule?.dismissCallNotification) {
    try {
      CallNotificationModule.dismissCallNotification();
      console.log('[CallNotification] System call notification and floating overlay dismissed.');
    } catch (e) {
      console.warn('[CallNotification] dismiss notification notice:', e);
    }
  }
};

/**
 * Start background Keep-Alive service to keep Wi-Fi and socket awake when phone is locked
 */
export const startKeepAliveService = () => {
  if (Platform.OS === 'android' && CallKeepAliveModule?.startKeepAlive) {
    try {
      CallKeepAliveModule.startKeepAlive();
      console.log('[CallNotification] Background Keep-Alive service started.');
    } catch (e) {
      console.warn('[CallNotification] startKeepAlive notice:', e);
    }
  }
};

/**
 * Stop background Keep-Alive service
 */
export const stopKeepAliveService = () => {
  if (Platform.OS === 'android' && CallKeepAliveModule?.stopKeepAlive) {
    try {
      CallKeepAliveModule.stopKeepAlive();
      console.log('[CallNotification] Background Keep-Alive service stopped.');
    } catch (e) {
      console.warn('[CallNotification] stopKeepAlive notice:', e);
    }
  }
};

/**
 * Check if the user has granted "Display over other apps" (Floating pop-up permission)
 */
export const canDrawOverlays = async (): Promise<boolean> => {
  if (Platform.OS === 'android' && CallNotificationModule?.canDrawOverlays) {
    try {
      return await CallNotificationModule.canDrawOverlays();
    } catch (e) {
      return false;
    }
  }
  return false;
};

/**
 * Open Android Settings to grant "Display over other apps" permission
 */
export const requestOverlayPermission = () => {
  if (Platform.OS === 'android' && CallNotificationModule?.requestOverlayPermission) {
    try {
      CallNotificationModule.requestOverlayPermission();
    } catch (e) {
      console.warn('[CallNotification] requestOverlayPermission notice:', e);
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
  startKeepAliveService,
  stopKeepAliveService,
  canDrawOverlays,
  requestOverlayPermission,
  addCallNotificationListeners,
};
