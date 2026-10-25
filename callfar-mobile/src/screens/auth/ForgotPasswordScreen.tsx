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
  TextInput,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { THEME } from '../../styles/theme';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ServerStatusBar } from '../../components/common/ServerStatusBar';

// Strict RFC 5322 regex requiring valid local part, domain labels, and TLD (min 2 letters) without consecutive dots
const EMAIL_REGEX = /^[a-zA-Z0-9_%+-]+(?:\.[a-zA-Z0-9_%+-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const ForgotPasswordScreen = ({ navigation, route }: any) => {
  const { forgotPassword, resetPassword } = useAuth();

  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [email, setEmail] = useState(route?.params?.initialEmail || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email validation state
  const trimmedEmail = email.trim();
  const isEmailFilled = trimmedEmail.length > 0;
  const isEmailValid = EMAIL_REGEX.test(trimmedEmail);

  // Password requirements
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleRequestReset = async () => {
    if (!trimmedEmail) {
      Alert.alert('Email Required', 'Please enter your registered email address.');
      return;
    }

    if (!isEmailValid) {
      Alert.alert(
        'Invalid Email Format',
        'Please provide a complete and valid email address (e.g. user@example.com) with a valid domain.'
      );
      return;
    }

    try {
      setLoading(true);
      const res = await forgotPassword(trimmedEmail.toLowerCase());
      
      if (res?.devCode) {
        setDevPreviewCode(res.devCode);
        setVerificationCode(res.devCode);
      }

      setStep('verify');
      setResendCooldown(45);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to request password reset. Please try again.';
      Alert.alert('Password Recovery Notice', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const trimmedCode = verificationCode.trim();

    if (!trimmedCode) {
      Alert.alert('Verification Code Required', 'Please enter the 6-digit code from your email (or reset link token).');
      return;
    }

    if (trimmedCode.length < 6) {
      Alert.alert('Invalid Code', 'The verification code must be at least 6 characters.');
      return;
    }

    if (!isPasswordValid) {
      Alert.alert(
        'Password Requirements',
        'Please ensure your password has at least 8 characters, 1 uppercase letter, 1 number, and matches the confirmation.'
      );
      return;
    }

    try {
      setLoading(true);
      await resetPassword(trimmedCode, newPassword);
      setStep('success');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to reset password. The code or link may have expired.';
      Alert.alert('Reset Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ServerStatusBar />

        {/* Back Link */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>← Back to Sign In</Text>
        </TouchableOpacity>

        {/* Top Header Card */}
        <View style={styles.brandContainer}>
          <View style={styles.badgeWrapper}>
            <Text style={styles.badgeText}>🔒 CallFar Account Recovery</Text>
          </View>
          <Text style={styles.title}>Password Recovery</Text>
          <Text style={styles.subtitle}>
            {step === 'request'
              ? 'Enter your registered email address to receive a secure reset link & verification code'
              : step === 'verify'
              ? 'Verify your identity and set a strong new password'
              : 'Your account password has been updated successfully!'}
          </Text>
        </View>

        {/* STEP 1: Request Reset Link */}
        {step === 'request' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Find Your Account</Text>
            <Text style={styles.cardSubtitle}>
              We will send a password reset link and a 6-digit verification code directly to your email.
            </Text>

            <Input
              label="Email Address *"
              placeholder="e.g. name@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Live Email Validation Feedback */}
            {isEmailFilled && (
              <View style={styles.feedbackContainer}>
                {isEmailValid ? (
                  <Text style={styles.feedbackValid}>✓ Valid email format</Text>
                ) : (
                  <Text style={styles.feedbackInvalid}>
                    ⚠️ Please enter a valid email address (e.g. name@example.com)
                  </Text>
                )}
              </View>
            )}

            <Button
              title="Send Reset Link & Code"
              onPress={handleRequestReset}
              loading={loading}
              style={styles.submitBtn}
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>💡</Text>
              <Text style={styles.infoText}>
                You will be able to either tap the link sent to your email or enter the 6-digit code directly in the app.
              </Text>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already remember your password? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 2: Verify Code and Reset */}
        {step === 'verify' && (
          <View style={styles.card}>
            {/* Confirmation Banner */}
            <View style={styles.dispatchedBanner}>
              <Text style={styles.dispatchedIcon}>✉️</Text>
              <View style={styles.dispatchedContent}>
                <Text style={styles.dispatchedTitle}>Reset Instructions Dispatched</Text>
                <Text style={styles.dispatchedEmail}>{trimmedEmail.toLowerCase()}</Text>
                <Text style={styles.dispatchedNote}>
                  Check your inbox and spam folder. Click the email link or enter the 6-digit code below:
                </Text>
              </View>
            </View>

            {/* Dev/Demo Helper if active */}
            {devPreviewCode && (
              <View style={styles.devBanner}>
                <Text style={styles.devBannerTitle}>⚡ Local Dev Mode Preview</Text>
                <Text style={styles.devBannerText}>
                  Verification Code: <Text style={styles.devCodeHighlight}>{devPreviewCode}</Text>
                </Text>
              </View>
            )}

            <Text style={styles.inputLabel}>6-Digit Verification Code *</Text>
            <View style={styles.codeInputWrapper}>
              <TextInput
                style={styles.codeInput}
                placeholder="123456"
                placeholderTextColor="#475569"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="numeric"
                maxLength={32}
                autoCapitalize="none"
              />
            </View>

            <Input
              label="New Password *"
              placeholder="Min 8 characters, 1 uppercase, 1 digit"
              value={newPassword}
              onChangeText={setNewPassword}
              isPassword
            />

            <Input
              label="Confirm New Password *"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              isPassword
            />

            {/* Password Criteria Checklist */}
            <View style={styles.criteriaBox}>
              <Text style={[styles.criteriaItem, hasMinLength && styles.criteriaItemValid]}>
                {hasMinLength ? '●' : '○'} At least 8 characters
              </Text>
              <Text style={[styles.criteriaItem, hasUppercase && styles.criteriaItemValid]}>
                {hasUppercase ? '●' : '○'} At least one uppercase letter (A-Z)
              </Text>
              <Text style={[styles.criteriaItem, hasNumber && styles.criteriaItemValid]}>
                {hasNumber ? '●' : '○'} At least one number (0-9)
              </Text>
              <Text style={[styles.criteriaItem, passwordsMatch && styles.criteriaItemValid]}>
                {passwordsMatch ? '●' : '○'} Passwords match
              </Text>
            </View>

            <Button
              title="Confirm & Reset Password"
              onPress={handleResetPassword}
              loading={loading}
              style={styles.submitBtn}
            />

            <View style={styles.resendRow}>
              {resendCooldown > 0 ? (
                <Text style={styles.cooldownText}>
                  Resend available in {resendCooldown}s
                </Text>
              ) : (
                <TouchableOpacity onPress={handleRequestReset} disabled={loading}>
                  <Text style={styles.resendLinkText}>Resend Link & Code</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* STEP 3: Success Screen */}
        {step === 'success' && (
          <View style={styles.card}>
            <View style={styles.successIconCircle}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Password Updated!</Text>
            <Text style={styles.successMessage}>
              Your account password has been successfully reset. You can now log into CallFar using your updated credentials.
            </Text>

            <Button
              title="Sign In to CallFar Now"
              onPress={() => navigation.navigate('Login', { prefillIdentifier: trimmedEmail })}
              style={styles.submitBtn}
            />
          </View>
        )}

        {/* Security Footer Notice */}
        <View style={styles.securityFooter}>
          <Text style={styles.securityText}>
            🔒 Protected by CallFar End-to-End Cryptographic Security
          </Text>
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
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  badgeWrapper: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 20,
  },
  feedbackContainer: {
    marginTop: -8,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  feedbackValid: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackInvalid: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: 10,
    marginBottom: 16,
    backgroundColor: '#2563EB',
    borderRadius: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  linkText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
  dispatchedBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 12,
    alignItems: 'center',
  },
  dispatchedIcon: {
    fontSize: 26,
  },
  dispatchedContent: {
    flex: 1,
  },
  dispatchedTitle: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  dispatchedEmail: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  dispatchedNote: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  devBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  devBannerTitle: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  devBannerText: {
    color: '#FDE68A',
    fontSize: 13,
    marginTop: 2,
  },
  devCodeHighlight: {
    fontWeight: '800',
    letterSpacing: 2,
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 6,
  },
  codeInputWrapper: {
    backgroundColor: '#070B14',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 6,
    color: '#38BDF8',
    textAlign: 'center',
  },
  criteriaBox: {
    backgroundColor: 'rgba(11, 17, 32, 0.7)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
    marginBottom: 16,
  },
  criteriaItem: {
    fontSize: 12,
    color: '#64748B',
    marginVertical: 2,
  },
  criteriaItemValid: {
    color: '#34D399',
    fontWeight: '600',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 6,
  },
  cooldownText: {
    color: '#64748B',
    fontSize: 12,
  },
  resendLinkText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  successIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 16,
  },
  successCheck: {
    fontSize: 36,
    color: '#34D399',
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  securityFooter: {
    alignItems: 'center',
    marginTop: 24,
  },
  securityText: {
    color: '#64748B',
    fontSize: 11,
    letterSpacing: 0.3,
  },
});

export default ForgotPasswordScreen;
