import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { THEME } from '../../styles/theme';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ServerStatusBar } from '../../components/common/ServerStatusBar';

type LoginMode = 'member' | 'admin';

export const LoginScreen = ({ navigation, route }: any) => {
  const { login, forgotPassword } = useAuth();
  const [mode, setMode] = useState<LoginMode>('member');
  const [identifier, setIdentifier] = useState(route?.params?.prefillIdentifier || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  useEffect(() => {
    if (route?.params?.prefillIdentifier) {
      setIdentifier(route.params.prefillIdentifier);
    }
  }, [route?.params?.prefillIdentifier]);

  const isAdminMode = mode === 'admin';

  const handleLogin = async (customIdentifier?: string, customPassword?: string) => {
    const idToUse = customIdentifier || identifier;
    const pwdToUse = customPassword || password;

    if (!idToUse.trim() || !pwdToUse) {
      Alert.alert('Required Fields', 'Please enter your username/email and password.');
      return;
    }

    try {
      if (customIdentifier) {
        setQuickLoading(customIdentifier);
      } else {
        setLoading(true);
      }

      await login(idToUse.trim(), pwdToUse);
    } catch (err: any) {
      const serverMsg = err.response?.data?.message;
      const networkMsg = !err.response
        ? 'Cannot connect to backend server. Make sure your phone is connected to the same Wi-Fi or USB bridge.'
        : null;
      const msg = serverMsg || networkMsg || err.message || 'Login failed. Please check your credentials.';
      Alert.alert(isAdminMode ? 'Admin Access Notice' : 'Login Notice', msg);
    } finally {
      setLoading(false);
      setQuickLoading(null);
    }
  };

  const handleQuickDemo = (userType: 'admin') => {
    if (userType === 'admin') {
      setIdentifier('alice');
      setPassword('Password123!');
      handleLogin('alice', 'Password123!');
    }
  };

  const handleForgotPasswordClick = () => {
    const raw = (identifier || '').trim();
    if (raw.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      Alert.alert(
        'Reset Password ✉️',
        `Send a password reset link directly to ${raw}?`,
        [
          {
            text: 'Send Link Now',
            onPress: async () => {
              try {
                setLoading(true);
                await forgotPassword(raw.toLowerCase());
                navigation.navigate('ForgotPassword', {
                  initialEmail: raw,
                  autoSent: true,
                });
              } catch (err: any) {
                const msg = err.response?.data?.message || err.message || 'Could not send reset link.';
                Alert.alert('Reset Notice', msg);
                navigation.navigate('ForgotPassword', { initialEmail: raw });
              } finally {
                setLoading(false);
              }
            },
          },
          {
            text: 'Open Recovery Screen',
            style: 'cancel',
            onPress: () => navigation.navigate('ForgotPassword', { initialEmail: raw }),
          },
        ]
      );
    } else {
      navigation.navigate('ForgotPassword', { initialEmail: raw });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={[styles.logoWrapper, isAdminMode && styles.logoWrapperAdmin]}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>CallFar</Text>
          <Text style={styles.subtitle}>Ultra High-Definition Internet Calling & Messaging</Text>
        </View>

        {/* ─── Wi-Fi / LAN Network Auto-Scan & Server Status Bar ─────────── */}
        <ServerStatusBar />

        {/* ─── Role Switcher Segmented Tabs ──────────────────────────────── */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, !isAdminMode && styles.segmentBtnActiveMember]}
            onPress={() => {
              setMode('member');
              setIdentifier('');
              setPassword('');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, !isAdminMode && styles.segmentTextActive]}>
              👤 Enter as User
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, isAdminMode && styles.segmentBtnActiveAdmin]}
            onPress={() => {
              setMode('admin');
              setIdentifier('');
              setPassword('');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, isAdminMode && styles.segmentTextActiveAdmin]}>
              🛡️ Enter as Admin
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── Mode Indicator Banner ─────────────────────────────────────── */}
        {isAdminMode ? (
          <View style={styles.adminBanner}>
            <View style={styles.adminBadgeRow}>
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>🛡️ SYSTEM ADMINISTRATOR PORTAL</Text>
              </View>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Master Mode</Text>
              </View>
            </View>
            <Text style={styles.adminDesc}>
              Authoritative console access: manage registered users, monitor live calls, generate license keys, and audit system activity.
            </Text>
          </View>
        ) : (
          <View style={styles.memberBanner}>
            <Text style={styles.memberBannerText}>
              ✨ Welcome! Sign in to connect with your team, start video calls, and exchange messages.
            </Text>
          </View>
        )}

        {/* ─── Login Card ─────────────────────────────────────────────────── */}
        <View style={[styles.card, isAdminMode && styles.cardAdmin]}>
          <Text style={styles.cardTitle}>
            {isAdminMode ? 'Administrator Sign In' : 'Welcome Back'}
          </Text>
          <Text style={styles.cardSubtitle}>
            {isAdminMode
              ? 'Enter administrator credentials to unlock the master console'
              : 'Sign in with your username or email address'}
          </Text>

          {/* Quick Demo One-Tap Shortcut (Admin Mode Only) */}
          {isAdminMode ? (
            <>
              <View style={styles.quickBox}>
                <Text style={styles.quickBoxTitle}>⚡ Fast Admin Access (Demo)</Text>
                <TouchableOpacity
                  style={styles.quickBtnAdmin}
                  onPress={() => handleQuickDemo('admin')}
                  disabled={loading || !!quickLoading}
                  activeOpacity={0.8}
                >
                  {quickLoading === 'alice' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.quickBtnText}>👑 One-Tap Sign In as Admin (alice)</Text>
                      <Text style={styles.quickBtnSub}>Master License • Full Authority</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign in manually</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          ) : null}

          <Input
            label={isAdminMode ? 'Admin Username or Email' : 'Username or Email'}
            placeholder={isAdminMode ? 'e.g. alice or admin@callfar.test' : 'e.g. username or user@domain.com'}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            isPassword
            rightLabelAction={
              <TouchableOpacity
                onPress={handleForgotPasswordClick}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.forgotPasswordText, isAdminMode && styles.forgotPasswordTextAdmin]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            }
          />

          <Button
            title={isAdminMode ? '🛡️ Access Master Console' : 'Sign In'}
            onPress={() => handleLogin()}
            loading={loading}
            style={[styles.submitBtn, isAdminMode && styles.submitBtnAdmin]}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              {isAdminMode ? 'Need an Admin account? ' : "Don't have an account? "}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register', { defaultRole: isAdminMode ? 'ADMIN' : 'MEMBER' })}>
              <Text style={[styles.linkText, isAdminMode && styles.linkTextAdmin]}>
                {isAdminMode ? 'Register as Admin' : 'Register here'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.troubleRow}>
            <TouchableOpacity
              onPress={handleForgotPasswordClick}
              activeOpacity={0.7}
            >
              <Text style={styles.troubleText}>
                🔑 Trouble signing in?{' '}
                <Text style={[styles.troubleLink, isAdminMode && styles.troubleLinkAdmin]}>
                  Reset Password
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Security Footer Notice */}
        <View style={styles.securityFooter}>
          <Text style={styles.securityText}>🔒 End-to-End Encrypted Signaling & Role-Based Security</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070B14',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: THEME.spacing.lg,
    paddingVertical: 36,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  logoWrapper: {
    padding: 3,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    marginBottom: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  logoWrapperAdmin: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    shadowColor: '#F59E0B',
  },
  logoImage: {
    width: 76,
    height: 76,
    borderRadius: 19,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },

  // Role Switcher Segmented Control
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1F293D',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  segmentBtnActiveMember: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  segmentBtnActiveAdmin: {
    backgroundColor: '#D97706',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  segmentTextActiveAdmin: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Banners
  memberBanner: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  memberBannerText: {
    fontSize: 12.5,
    color: '#CBD5E1',
    lineHeight: 18,
    textAlign: 'center',
  },
  adminBanner: {
    backgroundColor: 'rgba(30, 27, 20, 0.85)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  adminBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  adminBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  liveText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  adminDesc: {
    fontSize: 12,
    color: '#FCD34D',
    lineHeight: 17,
  },

  // Main Card
  card: {
    backgroundColor: '#10172A',
    borderRadius: 20,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  cardAdmin: {
    backgroundColor: '#141424',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
    marginTop: 2,
  },

  // Quick Demo Access Button
  quickBox: {
    backgroundColor: '#182238',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#24324E',
  },
  quickBoxTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  quickBtnMember: {
    backgroundColor: '#1D4ED8',
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  quickBtnAdmin: {
    backgroundColor: '#B45309',
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  quickBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  quickBtnSub: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    marginTop: 2,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E293B',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#64748B',
    fontSize: 12,
  },

  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginTop: -4,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  forgotPasswordText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  forgotPasswordTextAdmin: {
    color: '#F59E0B',
  },

  submitBtn: {
    marginTop: 6,
    backgroundColor: '#2563EB',
  },
  submitBtnAdmin: {
    backgroundColor: '#D97706',
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
    alignItems: 'center',
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  linkText: {
    color: '#60A5FA',
    fontWeight: '700',
    fontSize: 13,
  },
  linkTextAdmin: {
    color: '#FBBF24',
  },
  troubleRow: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 4,
  },
  troubleText: {
    color: '#64748B',
    fontSize: 12.5,
  },
  troubleLink: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  troubleLinkAdmin: {
    color: '#F59E0B',
  },

  securityFooter: {
    marginTop: 20,
    alignItems: 'center',
  },
  securityText: {
    color: '#475569',
    fontSize: 11.5,
  },
});

export default LoginScreen;
