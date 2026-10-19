import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { THEME } from '../../styles/theme';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ServerStatusBar } from '../../components/common/ServerStatusBar';

type RegisterRole = 'MEMBER' | 'ADMIN';

export const RegisterScreen = ({ navigation, route }: any) => {
  const { register } = useAuth();
  const initialRole: RegisterRole = route?.params?.defaultRole === 'ADMIN' ? 'ADMIN' : 'MEMBER';

  const [role, setRole] = useState<RegisterRole>(initialRole);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdminRole = role === 'ADMIN';

  const validate = (): string | null => {
    if (!fullName.trim()) return 'Full name is required.';
    if (fullName.trim().length < 2) return 'Full name must be at least 2 characters.';

    if (!username.trim()) return 'Username is required.';
    if (username.trim().length < 3) return 'Username must be at least 3 characters long.';
    if (username.trim().length > 30) return 'Username must be 30 characters or fewer.';
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      return 'Username may only contain letters, numbers, and underscores ( _ ).';
    }

    if (!email.trim()) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Please enter a valid email address (e.g. you@example.com).';
    }

    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter (A-Z).';
    if (!/[0-9]/.test(password)) return 'Password must include at least one number (0-9).';

    if (!confirmPassword) return 'Please confirm your password.';
    if (password !== confirmPassword) return 'Passwords do not match. Please re-enter them.';

    if (phoneNumber.trim() && !/^\+?[1-9]\d{6,14}$/.test(phoneNumber.trim())) {
      return 'Phone number must be in international format (e.g. +14155552671).';
    }

    if (isAdminRole && !adminPasscode.trim()) {
      return 'Admin Security Passcode is required to create an Administrator account.';
    }

    return null;
  };

  const handleRegister = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Please Fix the Following', validationError);
      return;
    }

    try {
      setLoading(true);
      await register(
        fullName.trim(),
        username.trim().toLowerCase(),
        email.trim().toLowerCase(),
        password,
        phoneNumber.trim() || undefined,
        role,
        isAdminRole ? adminPasscode.trim() : undefined
      );
    } catch (err: any) {
      const serverMsg = err.response?.data?.message;
      const networkMsg = !err.response
        ? 'Cannot connect to backend server. Make sure your phone is connected to the same Wi-Fi or USB bridge.'
        : null;
      const msg = serverMsg || networkMsg || err.message || 'Registration failed. Please try again.';
      Alert.alert('Registration Notice', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Server & Wi-Fi Auto-Scan Status Bar */}
        <ServerStatusBar />

        {/* Role Selection Tabs (Admin registration only if explicitly requested) */}
        {route?.params?.allowAdminRegistration && (
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, !isAdminRole && styles.segmentBtnActiveMember]}
              onPress={() => setRole('MEMBER')}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, !isAdminRole && styles.segmentTextActive]}>
                👤 Standard Member
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, isAdminRole && styles.segmentBtnActiveAdmin]}
              onPress={() => setRole('ADMIN')}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, isAdminRole && styles.segmentTextActiveAdmin]}>
                🛡️ System Administrator
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Informative Role Banner */}
        {isAdminRole && route?.params?.allowAdminRegistration ? (
          <View style={styles.adminNotice}>
            <Text style={styles.adminNoticeTitle}>🛡️ Administrator Account Entitlements</Text>
            <Text style={styles.adminNoticeText}>
              • Master Admin privileges with unlimited call durations{'\n'}
              • Real-time system monitoring and call audit logs{'\n'}
              • User management, role elevation, and suspension controls{'\n'}
              • Instant license key generation and system announcements
            </Text>
          </View>
        ) : null}

        {/* Form Card */}
        <View style={[styles.card, isAdminRole && styles.cardAdmin]}>
          <Text style={styles.cardTitle}>
            {isAdminRole ? 'Register Administrator' : 'Create Member Account'}
          </Text>
          <Text style={styles.cardSubtitle}>
            {isAdminRole
              ? 'Complete the setup to establish administrative control'
              : 'Join CallFar for crystal-clear real-time communication'}
          </Text>

          {isAdminRole && route?.params?.allowAdminRegistration && (
            <View style={styles.passcodeBox}>
              <Input
                label="Admin Security Passcode *"
                placeholder="Enter admin passcode (e.g. admin2026)"
                value={adminPasscode}
                onChangeText={setAdminPasscode}
                autoCapitalize="none"
                isPassword
              />
              <Text style={styles.passcodeHint}>
                💡 Default system passcode is: <Text style={{ color: '#FCD34D', fontWeight: '700' }}>admin2026</Text>
              </Text>
            </View>
          )}

          <Input
            label="Full Name *"
            placeholder="e.g. Alex Johnson"
            value={fullName}
            onChangeText={setFullName}
          />

          <Input
            label="Username *"
            placeholder="letters, numbers, underscore only"
            value={username}
            onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Email Address *"
            placeholder="e.g. alex@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Phone Number (Optional)"
            placeholder="e.g. +14155552671"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />

          <Input
            label="Password *"
            placeholder="Min 8 chars, 1 uppercase, 1 digit"
            value={password}
            onChangeText={setPassword}
            isPassword
          />

          <Input
            label="Confirm Password *"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
          />

          <Button
            title={isAdminRole ? '🛡️ Create Administrator Account' : 'Create Account'}
            onPress={handleRegister}
            loading={loading}
            style={[styles.submitBtn, isAdminRole && styles.submitBtnAdmin]}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already registered? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.linkText, isAdminRole && styles.linkTextAdmin]}>
                Sign in here
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingVertical: 32,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
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
    fontSize: 13.5,
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
  adminNotice: {
    backgroundColor: 'rgba(30, 27, 20, 0.9)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  adminNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F59E0B',
    marginBottom: 4,
  },
  adminNoticeText: {
    fontSize: 12,
    color: '#FDE68A',
    lineHeight: 18,
  },
  memberNotice: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  memberNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#60A5FA',
    marginBottom: 2,
  },
  memberNoticeText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 17,
  },
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
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: THEME.spacing.md,
    marginTop: 2,
  },
  passcodeBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  passcodeHint: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: -4,
    marginBottom: 4,
  },
  submitBtn: {
    marginTop: 10,
    backgroundColor: '#2563EB',
  },
  submitBtnAdmin: {
    backgroundColor: '#D97706',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: THEME.spacing.md,
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
});

export default RegisterScreen;
