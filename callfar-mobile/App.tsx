import './src/polyfills';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox } from 'react-native';
import { enableScreens } from 'react-native-screens';

// ─── Screen initialisation ───────────────────────────────────────────────────
// polyfills.ts already pre-registers the missing native event types
// (topTransitionProgress etc.) BEFORE this module loads, so it is now
// safe to enable native screens. This eliminates the
// "Unsupported top level event type" crash.
enableScreens(true);

// Suppress all LogBox overlays in the dev build so the red-screen never
// appears for end-users who install the development APK.
LogBox.ignoreAllLogs(true);

import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import { CallProvider } from './src/context/CallContext';
import { RootNavigator } from './src/navigation/RootNavigator';

import IncomingCallModal from './src/screens/call/IncomingCallModal';
import ActiveCallScreen from './src/screens/call/ActiveCallScreen';
import InAppNotificationBanner from './src/components/common/InAppNotificationBanner';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <RootNavigator />
            <InAppNotificationBanner />
            <IncomingCallModal />
            <ActiveCallScreen />
          </CallProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
