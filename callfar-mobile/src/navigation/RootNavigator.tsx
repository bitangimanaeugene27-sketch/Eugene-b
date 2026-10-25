import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { navigationRef } from './navigationRef';

import { useAuth } from '../context/AuthContext';
import { THEME } from '../styles/theme';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import HomeScreen from '../screens/main/HomeScreen';
import ContactsScreen from '../screens/main/ContactsScreen';
import ChatScreen from '../screens/main/ChatScreen';
import CallHistoryScreen from '../screens/main/CallHistoryScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import AdminHubScreen from '../screens/admin/AdminHubScreen';
import DialpadScreen from '../screens/call/DialpadScreen';
import ActivePstnCallScreen from '../screens/call/ActivePstnCallScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { isAdmin } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F172A',
          borderTopColor: '#1E293B',
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#38BDF8',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="ChatsTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>💬</Text>,
        }}
      />
      <Tab.Screen
        name="ContactsTab"
        component={ContactsScreen}
        options={{
          tabBarLabel: 'Contacts',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>👥</Text>,
        }}
      />
      <Tab.Screen
        name="CallsTab"
        component={CallHistoryScreen}
        options={{
          tabBarLabel: 'Calls',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📞</Text>,
        }}
      />
      {isAdmin && (
        <Tab.Screen
          name="AdminTab"
          component={AdminHubScreen}
          options={{
            tabBarLabel: 'Admin Hub',
            tabBarActiveTintColor: '#F59E0B',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🛡️</Text>,
          }}
        />
      )}
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>⚙️</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: THEME.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            {isAdmin && <Stack.Screen name="AdminHub" component={AdminHubScreen} />}
            <Stack.Screen name="Dialpad" component={DialpadScreen} />
            <Stack.Screen name="ActivePstnCall" component={ActivePstnCallScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default RootNavigator;
