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
  ActivityIndicator,
  Linking,
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

  const isAutoSent = Boolean(route?.params?.autoSent);
  const initialEmail = route?.params?.initialEmail || '';

  const [step, setStep] = useState<'request' | 'email_sent' | 'success'>(
    isAutoSent ? 'email_sent' : 'request'
  );
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [targetAccountEmail, setTargetAccountEmail] = useState(initialEmail);
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccessNotice, setResendSuccessNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [unregisteredIdentifier, setUnregisteredIdentifier] = useState<string | null>(null);
  const [showManualCodeInput, setShowManualCodeInput] = useState(false);
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Input validation state
  const trimmedEmail = emailInput.trim();
  const isInputFilled = trimmedEmail.length > 0;
  const isEmailLike = trimmedEmail.includes('@');
  const isEmailFormatValid = isEmailLike ? EMAIL_REGEX.test(trimmedEmail) : trimmedEmail.length >= 3;

  // Password requirements
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  useEffect(() => {
    if (route?.params?.initialEmail) {
      setEmailInput(route.params.initialEmail);
    }
  }, [route?.params?.initialEmail]);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleRequestReset = async () => {
    if (!trimmedEmail) {
      Alert.alert('Email Required', 'Please enter the email address you used when you registered.');
      return;
    }

    if (isEmailLike && !EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert(
        'Invalid Email Format',
        'Please provide a complete and valid email address (e.g. user@example.com).'
      );
      return;
    }

    try {
      setLoading(true);
      setUnregisteredIdentifier(null);
      const res = await forgotPassword(trimmedEmail.toLowerCase());

      const displayedEmail = res?.email || trimmedEmail;
      setTargetAccountEmail(displayedEmail);

      // Only in dev/offline mode without live SMTP will verificationCode be present
      if (res?.verificationCode) {
        setDevPreviewCode(res.verificationCode);
        setVerificationCode(res.verificationCode);
      }

      setStep('email_sent');
      setResendCooldown(45);
    } catch (err: any) {
      const isNotFound =
        err.response?.status === 404 ||
        err.response?.data?.canRegister ||
        err.response?.data?.errorCode === 'ACCOUNT_NOT_FOUND';

      if (isNotFound) {
        setUnregisteredIdentifier(trimmedEmail);
        Alert.alert(
          'Account Not Found',
          `No CallFar account was found matching "${trimmedEmail}". Would you like to create a new account?`,
          [
            {
              text: '✨ Create Account',
              style: 'default',
              onPress: () => {
                navigation.navigate('Register', {
                  prefillEmail: isEmailLike ? trimmedEmail : undefined,
                  prefillUsername: !isEmailLike ? trimmedEmail : undefined,
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

  const handleResendLink = async () => {
    if (resending || resendCooldown > 0) return;

    const target = (trimmedEmail || targetAccountEmail || '').trim();
    if (!target) {
      Alert.alert('Email Required', 'Please tap "Change Email" to enter your email address.');
      return;
    }

    try {
      setResending(true);
      setResendSuccessNotice(null);
      const res = await forgotPassword(target.toLowerCase());

      if (res?.verificationCode) {
        setDevPreviewCode(res.verificationCode);
        setVerificationCode(res.verificationCode);
      }

      setResendCooldown(45);
      setResendSuccessNotice('Fresh reset link dispatched to your email!');
      setTimeout(() => setResendSuccessNotice(null), 5000);

      Alert.alert(
        'Reset Link Sent! ✉️',
        `A fresh password reset link has been dispatched to ${res?.maskedEmail || targetAccountEmail || target}.\n\nPlease check your inbox and spam folder.`
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to resend link. Please check your network connection.';
      Alert.alert('Resend Notice', msg);
    } finally {
      setResending(false);
    }
  };

  const handleOpenEmailApp = async () => {
    try {
      const mailtoUrl = 'mailto:';
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        Alert.alert(
          'Open Your Email',
          `Please open your email app or visit your email provider in a browser to view the message sent to ${targetAccountEmail}.`
        );
      }
    } catch {
      Alert.alert(
        'Open Your Email',
        `Please open your email inbox to view the password reset email sent to ${targetAccountEmail}.`
      );
    }
  };

  const handleManualResetPassword = async () => {
    let effectiveTokenOrCode = verificationCode.trim();

    // If user pasted a full reset link (e.g. https://.../reset-password?token=abc...)
    const tokenMatch = effectiveTokenOrCode.match(/[?&](?:token|code|t)=([a-f0-9]+)/i);
    if (tokenMatch) {
      effectiveTokenOrCode = tokenMatch[1];
    } else if (effectiveTokenOrCode.includes('token=')) {
      const parts = effectiveTokenOrCode.split('token=');
      effectiveTokenOrCode = (parts[1] || '').split('&')[0];
    }

    if (!effectiveTokenOrCode) {
      Alert.alert('Verification Code or Link Required', 'Please enter your 6-digit verification code or paste your reset link.');
      return;
    }

    if (effectiveTokenOrCode.length < 6) {
      Alert.alert('Invalid Code', 'The verification code must be at least 6 digits or a valid reset token.');
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
      await resetPassword(effectiveTokenOrCode, newPassword);
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
          <Text style={styles.title}>
            {step === 'request'
              ? 'Forgot Password?'
              : step === 'email_sent'
              ? 'Check Your Email'
              : 'Password Updated!'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'request'
              ? 'Enter your registered email address and we will send you a secure link to reset your password.'
              : step === 'email_sent'
              ? 'We have sent a secure password reset link to your registered email address.'
              : 'Your account password has been updated successfully!'}
          </Text>
        </View>

        {/* ─── STEP 1: Enter Email & Request Reset Link ───────────────────── */}
        {step === 'request' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reset Your Password</Text>
            <Text style={styles.cardSubtitle}>
              Please enter the email address you used when you registered for CallFar:
            </Text>

            <Input
              label="Registered Email Address *"
              placeholder="e.g. name@example.com"
              value={emailInput}
              onChangeText={(text) => {
                setEmailInput(text);
                if (unregisteredIdentifier) setUnregisteredIdentifier(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Real-Time Format Feedback */}
            {isInputFilled && (
              <View style={styles.feedbackContainer}>
                {isEmailFormatValid ? (
                  <Text style={styles.feedbackValid}>
                    ✓ Valid {isEmailLike ? 'email address' : 'account'} format
                  </Text>
                ) : (
                  <Text style={styles.feedbackInvalid}>
                    ⚠️ Please enter a complete email address (e.g. name@domain.com)
                  </Text>
                )}
              </View>
            )}

            {/* Unregistered Account Notice */}
            {unregisteredIdentifier && (
              <View style={styles.notRegisteredCard}>
                <View style={styles.notRegisteredHeader}>
                  <Text style={styles.notRegisteredIcon}>✨</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notRegisteredTitle}>Don't have an account yet?</Text>
                    <Text style={styles.notRegisteredSubtitle}>
                      No account was found for "{unregisteredIdentifier}". Tap below to register a new account now.
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
              title="✉️ Send Password Reset Link"
              onPress={handleRequestReset}
              loading={loading}
              style={styles.submitBtn}
            />

            {/* Security Notice */}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>🛡️</Text>
              <Text style={styles.infoText}>
                We will email you a secure, time-sensitive link that opens directly in your browser or phone so you can easily choose a new password.
              </Text>
            </View>

            {/* Create Account Option */}
            <View style={styles.createAccountRow}>
              <Text style={styles.footerText}>New to CallFar? </Text>
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate('Register', {
                    prefillEmail: isEmailLike ? trimmedEmail : undefined,
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

        {/* ─── STEP 2: Email Dispatched & Instructions ─────────────────────── */}
        {step === 'email_sent' && (
          <View style={styles.card}>
            {/* Animated / Glowing Mail Hero Badge */}
            <View style={styles.emailHeroWrapper}>
              <View style={styles.emailHeroIconCircle}>
                <Text style={styles.emailHeroIcon}>✉️</Text>
              </View>
              <View style={styles.emailSentBadge}>
                <Text style={styles.emailSentBadgeText}>✓ RESET LINK DISPATCHED</Text>
              </View>
            </View>

            <Text style={styles.emailSentHeading}>Check Your Inbox</Text>
            <Text style={styles.emailSentSubheading}>
              We have dispatched a password reset link to:
            </Text>

            {/* Highlighted Email Badge */}
            <View style={styles.emailPill}>
              <Text style={styles.emailPillText}>{targetAccountEmail}</Text>
            </View>

            {/* Visual Step-by-Step Instructions */}
            <View style={styles.stepsCard}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Open Your Email</Text>
                  <Text style={styles.stepDesc}>
                    Check your inbox (or spam folder) for the email from CallFar Security.
                  </Text>
                </View>
              </View>

              <View style={styles.stepDivider} />

              <View style={styles.stepItem}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Tap "Reset Password"</Text>
                  <Text style={styles.stepDesc}>
                    Click the secure link in the email to open the password reset page.
                  </Text>
                </View>
              </View>

              <View style={styles.stepDivider} />

              <View style={styles.stepItem}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Save New Password</Text>
                  <Text style={styles.stepDesc}>
                    Enter your new password and return to CallFar to sign in immediately.
                  </Text>
                </View>
              </View>
            </View>

            {/* 1-Tap Open Email Client Button */}
            <TouchableOpacity
              style={styles.openMailBtn}
              onPress={handleOpenEmailApp}
              activeOpacity={0.8}
            >
              <Text style={styles.openMailBtnText}>📬 Open Email App</Text>
            </TouchableOpacity>

            {/* Resend Success Notice */}
            {resendSuccessNotice && (
              <View style={styles.resendSuccessBadge}>
                <Text style={styles.resendSuccessText}>✓ {resendSuccessNotice}</Text>
              </View>
            )}

            {/* Resend Action Row */}
            <View style={styles.resendRow}>
              {resending ? (
                <View style={styles.resendingContainer}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text style={styles.resendingText}>Sending fresh email link...</Text>
                </View>
              ) : resendCooldown > 0 ? (
                <View style={styles.cooldownBadge}>
                  <Text style={styles.cooldownText}>
                    ⏳ Resend link in {resendCooldown}s
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={handleResendLink}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resendLinkText}>🔄 Resend Reset Link</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Change Email Link */}
            <TouchableOpacity
              style={styles.changeEmailFooter}
              onPress={() => setStep('request')}
              activeOpacity={0.7}
            >
              <Text style={styles.changeEmailFooterText}>
                Wrong email address?{' '}
                <Text style={{ color: '#38BDF8', fontWeight: '700' }}>
                  Change Email
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Optional Collapsible In-App Reset Section */}
            <View style={styles.manualToggleContainer}>
              <TouchableOpacity
                style={styles.manualToggleBtn}
                onPress={() => setShowManualCodeInput(!showManualCodeInput)}
                activeOpacity={0.7}
              >
                <Text style={styles.manualToggleText}>
                  {showManualCodeInput
                    ? '▲ Hide in-app reset form'
                    : '▼ Have a 6-digit code or link? Reset in-app'}
                </Text>
              </TouchableOpacity>
            </View>

            {showManualCodeInput && (
              <View style={styles.manualCard}>
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

                <Text style={styles.inputLabel}>Verification Code or Paste Reset Link *</Text>
                <View style={styles.codeInputWrapper}>
                  <TextInput
                    style={[
                      styles.codeInput,
                      verificationCode.length > 6 && { fontSize: 13, letterSpacing: 0.5 },
                    ]}
                    placeholder="123456 or paste full reset link"
                    placeholderTextColor="#475569"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    autoCapitalize="none"
                    autoCorrect={false}
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
                  onPress={handleManualResetPassword}
                  loading={loading}
                  style={styles.submitBtn}
                />
              </View>
            )}

            <View style={styles.footerRow}>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>← Return to Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ─── STEP 3: Success Screen ──────────────────────────────────────── */}
        {step === 'success' && (
          <View style={styles.card}>
            <View style={styles.successIconCircle}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Password Updated!</Text>
            <Text style={styles.successMessage}>
              Your CallFar password has been successfully updated. You can now sign in with your updated credentials.
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
    paddingHorizontal: 12,
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
    marginTop: 6,
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
  // Step 2: Email Sent Hero & Elements
  emailHeroWrapper: {
    alignItems: 'center',
    marginBottom: 18,
  },
  emailHeroIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(37, 99, 235, 0.18)',
    borderWidth: 2,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  emailHeroIcon: {
    fontSize: 34,
  },
  emailSentBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  emailSentBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  emailSentHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 4,
  },
  emailSentSubheading: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 10,
  },
  emailPill: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 20,
  },
  emailPillText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  stepsCard: {
    backgroundColor: '#070B14',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  stepDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 10,
    marginLeft: 38,
  },
  openMailBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  openMailBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  resendSuccessBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
    marginBottom: 10,
  },
  resendSuccessText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  resendRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
    minHeight: 36,
  },
  resendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  resendingText: {
    color: '#38BDF8',
    fontSize: 12.5,
    fontWeight: '600',
  },
  cooldownBadge: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cooldownText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  resendBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  resendLinkText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  changeEmailFooter: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  changeEmailFooterText: {
    color: '#94A3B8',
    fontSize: 12.5,
  },
  manualToggleContainer: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  manualToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  manualToggleText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  manualCard: {
    backgroundColor: '#0B1120',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  codeCard: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
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
    fontSize: 30,
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
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
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
  // Step 3: Success Screen
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
