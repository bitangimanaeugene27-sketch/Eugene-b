import './src/polyfills';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox } from 'react-native';
import { enableScreens } from 'react-native-screens';

enableScreens(false);
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
