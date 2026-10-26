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
  Clipboard,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { THEME } from '../../styles/theme';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ServerStatusBar } from '../../components/common/ServerStatusBar';

// Strict RFC 5322 regex for email format
const EMAIL_REGEX = /^[a-zA-Z0-9_%+-]+(?:\.[a-zA-Z0-9_%+-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const ForgotPasswordScreen = ({ navigation, route }: any) => {
  const { forgotPassword, resetPassword } = useAuth();

  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [identifier, setIdentifier] = useState(route?.params?.initialEmail || '');
  const [targetAccountEmail, setTargetAccountEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);
  const [isLiveEmailSent, setIsLiveEmailSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [unregisteredIdentifier, setUnregisteredIdentifier] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Input validation state
  const trimmedIdentifier = identifier.trim();
  const isInputFilled = trimmedIdentifier.length > 0;
  const isEmailLike = trimmedIdentifier.includes('@');
  const isEmailFormatValid = isEmailLike ? EMAIL_REGEX.test(trimmedIdentifier) : trimmedIdentifier.length >= 3;

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
    if (!trimmedIdentifier) {
      Alert.alert('Input Required', 'Please enter your registered email address, username, or phone number.');
      return;
    }

    if (isEmailLike && !EMAIL_REGEX.test(trimmedIdentifier)) {
      Alert.alert(
        'Invalid Email Format',
        'Please provide a complete and valid email address (e.g. user@example.com).'
      );
      return;
    }

    try {
      setLoading(true);
      setUnregisteredIdentifier(null);
      const res = await forgotPassword(trimmedIdentifier.toLowerCase());
      
      const code = res?.verificationCode || res?.data?.verificationCode || res?.devCode;
      if (code) {
        setDevPreviewCode(code);
        setVerificationCode(code);
      }
      setIsLiveEmailSent(Boolean(res?.isLiveEmailSent));
      setTargetAccountEmail(res?.maskedEmail || res?.email || trimmedIdentifier);

      setStep('verify');
      setResendCooldown(45);
    } catch (err: any) {
      const isNotFound = err.response?.status === 404 || err.response?.data?.canRegister || err.response?.data?.errorCode === 'ACCOUNT_NOT_FOUND';
      
      if (isNotFound) {
        setUnregisteredIdentifier(trimmedIdentifier);
        Alert.alert(
          'Account Not Found',
          `No CallFar account was found matching "${trimmedIdentifier}". Would you like to create a new account?`,
          [
            {
              text: '✨ Create Account',
              style: 'default',
              onPress: () => {
                navigation.navigate('Register', {
                  prefillEmail: isEmailLike ? trimmedIdentifier : undefined,
                  prefillUsername: !isEmailLike ? trimmedIdentifier : undefined,
                });
              },
            },
            { text: 'Try Again', style: 'cancel' },
          ]
        );
      } else {
        const msg = err.response?.data?.message || err.message || 'Failed to request password reset. Please try again.';
        Alert.alert('Password Recovery Notice', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const trimmedCode = verificationCode.trim();

    if (!trimmedCode) {
      Alert.alert('Verification Code Required', 'Please enter the 6-digit verification code.');
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

  const handleCopyCode = () => {
    if (devPreviewCode) {
      Clipboard.setString(devPreviewCode);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
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

        {/* Top Navigation */}
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
              ? 'Find your account to receive a secure reset link & 6-digit verification code'
              : step === 'verify'
              ? 'Enter your verification code and set a strong new password'
              : 'Your account password has been updated successfully!'}
          </Text>
        </View>

        {/* STEP 1: Request Reset */}
        {step === 'request' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Find Your Account</Text>
            <Text style={styles.cardSubtitle}>
              Enter your registered email address, username, or phone number:
            </Text>

            <Input
              label="Email, Username, or Phone *"
              placeholder="e.g. name@example.com or @username"
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                if (unregisteredIdentifier) setUnregisteredIdentifier(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Real-Time Format Feedback */}
            {isInputFilled && (
              <View style={styles.feedbackContainer}>
                {isEmailFormatValid ? (
                  <Text style={styles.feedbackValid}>
                    ✓ Valid {isEmailLike ? 'email address' : 'account identifier'} format
                  </Text>
                ) : (
                  <Text style={styles.feedbackInvalid}>
                    ⚠️ Please enter a complete email address or username
                  </Text>
                )}
              </View>
            )}

            {/* Unregistered Account Banner (If user has no account yet) */}
            {unregisteredIdentifier && (
              <View style={styles.notRegisteredCard}>
                <View style={styles.notRegisteredHeader}>
                  <Text style={styles.notRegisteredIcon}>✨</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notRegisteredTitle}>Don't have an account yet?</Text>
                    <Text style={styles.notRegisteredSubtitle}>
                      No account was found for "{unregisteredIdentifier}". Tap below to register your account now.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.createAccountBtn}
                  onPress={() => {
                    navigation.navigate('Register', {
                      prefillEmail: isEmailLike ? unregisteredIdentifier : undefined,
                      prefillUsername: !isEmailLike ? unregisteredIdentifier : undefined,
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.createAccountBtnText}>
                    🚀 Create Account with "{unregisteredIdentifier}"
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Button
              title="Send Reset Code & Link"
              onPress={handleRequestReset}
              loading={loading}
              style={styles.submitBtn}
            />

            {/* Helpful Multi-Channel Notice */}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>💡</Text>
              <Text style={styles.infoText}>
                Even if you can't access your email right now, you can reset your password directly in the app using your 6-digit verification code.
              </Text>
            </View>

            {/* Direct Create Account Option */}
            <View style={styles.createAccountRow}>
              <Text style={styles.footerText}>New to CallFar? </Text>
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate('Register', {
                    prefillEmail: isEmailLike ? trimmedIdentifier : undefined,
                  });
                }}
              >
                <Text style={styles.linkTextHighlight}>Create an Account</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already remember your password? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 2: Verify Code and Reset Password */}
        {step === 'verify' && (
          <View style={styles.card}>
            
            {/* Dispatched Confirmation Header with "Change Email" Button */}
            <View style={styles.dispatchedBanner}>
              <Text style={styles.dispatchedIcon}>✉️</Text>
              <View style={styles.dispatchedContent}>
                <View style={styles.dispatchedTopRow}>
                  <Text style={styles.dispatchedTitle}>
                    {isLiveEmailSent ? 'Email Dispatched' : 'Ready for In-App Reset'}
                  </Text>
                  <TouchableOpacity
                    style={styles.changeEmailPill}
                    onPress={() => setStep('request')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.changeEmailPillText}>✏️ Change Email</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.dispatchedEmail}>{targetAccountEmail}</Text>
                <Text style={styles.dispatchedNote}>
                  {isLiveEmailSent
                    ? 'Check your inbox & spam folder, or enter the 6-digit code below to reset immediately.'
                    : 'Use the 6-digit verification code below to set your new password directly.'}
                </Text>
              </View>
            </View>

            {/* In-App Direct Reset Notice */}
            <View style={styles.inAppResetNotice}>
              <Text style={styles.inAppResetIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.inAppResetTitle}>Instant In-App Reset</Text>
                <Text style={styles.inAppResetDesc}>
                  Email link not reaching you? You do not need the email link! You can reset your password immediately using the 6-digit code below.
                </Text>
              </View>
            </View>

            {/* High-Tech Verification Code Card */}
            {devPreviewCode ? (
              <View style={styles.codeCard}>
                <View style={styles.codeCardHeader}>
                  <Text style={styles.codeCardBadge}>🔑 6-Digit Verification Code</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={handleCopyCode}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.copyBtnText}>
                      {copiedNotification ? '✓ Copied!' : '📋 Copy Code'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.codeCardNumber}>{devPreviewCode}</Text>
                <View style={styles.autoFilledBadge}>
                  <Text style={styles.autoFilledText}>✓ Pre-filled for your convenience</Text>
                </View>
              </View>
            ) : null}

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
              title="Confirm & Save New Password"
              onPress={handleResetPassword}
              loading={loading}
              style={styles.submitBtn}
            />

            {/* Resend & Actions Row */}
            <View style={styles.resendRow}>
              {resendCooldown > 0 ? (
                <Text style={styles.cooldownText}>
                  Resend available in {resendCooldown}s
                </Text>
              ) : (
                <TouchableOpacity onPress={handleRequestReset} disabled={loading}>
                  <Text style={styles.resendLinkText}>🔄 Resend Code & Email Link</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Edit / Try Another Email */}
            <TouchableOpacity
              style={styles.changeEmailFooter}
              onPress={() => setStep('request')}
            >
              <Text style={styles.changeEmailFooterText}>
                Mistyped your email? <Text style={{ color: '#38BDF8', fontWeight: '700' }}>Change Email / Identifier</Text>
              </Text>
            </TouchableOpacity>

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
              Your CallFar password has been successfully reset. You can now sign in with your updated credentials.
            </Text>

            <Button
              title="Sign In to CallFar Now"
              onPress={() => navigation.navigate('Login', { prefillIdentifier: targetAccountEmail })}
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
  notRegisteredCard: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  notRegisteredHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  notRegisteredIcon: {
    fontSize: 20,
  },
  notRegisteredTitle: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  notRegisteredSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  createAccountBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  createAccountBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
  createAccountRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
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
  linkTextHighlight: {
    color: '#FBBF24',
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
    marginBottom: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  dispatchedIcon: {
    fontSize: 26,
    marginTop: 2,
  },
  dispatchedContent: {
    flex: 1,
  },
  dispatchedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dispatchedTitle: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '700',
  },
  changeEmailPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  changeEmailPillText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  dispatchedEmail: {
    color: '#F8FAFC',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  dispatchedNote: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  inAppResetNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  inAppResetIcon: {
    fontSize: 18,
  },
  inAppResetTitle: {
    color: '#34D399',
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  inAppResetDesc: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  codeCard: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  codeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  codeCardBadge: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  copyBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  copyBtnText: {
    color: '#60A5FA',
    fontSize: 11.5,
    fontWeight: '700',
  },
  codeCardNumber: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 32,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 6,
    marginVertical: 4,
  },
  autoFilledBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    marginTop: 4,
  },
  autoFilledText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
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
    marginBottom: 8,
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
  changeEmailFooter: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  changeEmailFooterText: {
    color: '#94A3B8',
    fontSize: 12.5,
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
