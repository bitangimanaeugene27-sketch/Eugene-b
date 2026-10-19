import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
  Platform,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { useNavigation } from '@react-navigation/native';
import {
  api,
  currentActiveHost,
  switchActiveHost,
  probeHost,
  isCloudServer,
} from '../../api/client';
import { THEME } from '../../styles/theme';
import { Avatar } from '../../components/common/Avatar';
import { ProfileModal } from '../../components/common/ProfileModal';

// ─── Preset Avatars Gallery ──────────────────────────────────────────────────
const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80',
];

// ─── Ringtone Options ─────────────────────────────────────────────────────────
const RINGTONE_OPTIONS = [
  { id: 'default', name: 'CallFar Classic', desc: 'Standard melodic phone chime' },
  { id: 'crystal', name: 'Crystal Chime', desc: 'Light, crisp high chime' },
  { id: 'radar', name: 'Radar Alert', desc: 'Fast, attention-grabbing pulses' },
  { id: 'marimba', name: 'Marimba Wave', desc: 'Tropical warm acoustic mallet' },
  { id: 'zen', name: 'Zen Minimal', desc: 'Subtle, gentle vibration sound' },
];

// ─── Status Options ──────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { id: 'online', label: 'Online', icon: '🟢', sub: 'Available for calls & chats', isOnline: true },
  { id: 'away', label: 'Away', icon: '🟡', sub: 'Stepped away momentarily', isOnline: true },
  { id: 'dnd', label: 'Do Not Disturb', icon: '🔴', sub: 'Silence all incoming calls', isOnline: false },
  { id: 'offline', label: 'Appear Offline', icon: '⚪', sub: 'Invisible to contacts', isOnline: false },
];

// ─── Section Card Component ──────────────────────────────────────────────────
const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    <View style={styles.cardDivider} />
    {children}
  </View>
);

// ─── Toggle Row ──────────────────────────────────────────────────────────────
const ToggleRow = ({
  icon,
  label,
  sub,
  value,
  onToggle,
  loading,
}: {
  icon: string;
  label: string;
  sub?: string;
  value: boolean;
  onToggle: () => void;
  loading?: boolean;
}) => (
  <View style={styles.row}>
    <View style={[styles.rowIcon, { backgroundColor: THEME.colors.surfaceHover }]}>
      <Text style={styles.rowIconText}>{icon}</Text>
    </View>
    <View style={styles.rowInfo}>
      <Text style={styles.rowLabel}>{label}</Text>
      {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
    </View>
    {loading ? (
      <ActivityIndicator size="small" color={THEME.colors.primary} />
    ) : (
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: THEME.colors.border, true: THEME.colors.primary }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={THEME.colors.border}
      />
    )}
  </View>
);

// ─── Navigation Row ──────────────────────────────────────────────────────────
const NavRow = ({
  icon,
  label,
  sub,
  value,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  sub?: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
}) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
    <View
      style={[
        styles.rowIcon,
        danger
          ? { backgroundColor: THEME.colors.danger + '22' }
          : { backgroundColor: THEME.colors.surfaceHover },
      ]}
    >
      <Text style={styles.rowIconText}>{icon}</Text>
    </View>
    <View style={styles.rowInfo}>
      <Text style={[styles.rowLabel, danger ? { color: THEME.colors.danger, fontWeight: '700' } : {}]}>
        {label}
      </Text>
      {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
    </View>
    {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    <Text style={styles.chevron}>›</Text>
  </TouchableOpacity>
);

const Separator = () => <View style={styles.sep} />;

// ─── Avatar Picker Modal ─────────────────────────────────────────────────────
const AvatarPickerModal = ({
  visible,
  currentUrl,
  displayName,
  onClose,
  onSelect,
}: {
  visible: boolean;
  currentUrl?: string | null;
  displayName: string;
  onClose: () => void;
  onSelect: (url: string | null) => Promise<void>;
}) => {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(currentUrl || null);
  const [customInput, setCustomInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedUrl(currentUrl || null);
  }, [currentUrl, visible]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSelect(selectedUrl);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update avatar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.title}>Choose Profile Picture</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Text style={modalStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={modalStyles.sub}>
            Select a photo preset, enter a custom URL, or use your initials.
          </Text>

          {/* Live Preview */}
          <View style={modalStyles.previewWrap}>
            <Avatar name={displayName} url={selectedUrl} size={84} />
            <Text style={modalStyles.previewLabel}>
              {selectedUrl ? 'Photo Selected' : 'Initials Fallback'}
            </Text>
          </View>

          {/* Preset Grid */}
          <Text style={modalStyles.sectionHeading}>Featured Avatars</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={modalStyles.presetRow}
          >
            {AVATAR_PRESETS.map((url, idx) => {
              const isChosen = selectedUrl === url;
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setSelectedUrl(url)}
                  style={[modalStyles.presetItem, isChosen && modalStyles.presetItemActive]}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: url }} style={modalStyles.presetImg} />
                  {isChosen && (
                    <View style={modalStyles.checkBadge}>
                      <Text style={modalStyles.checkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Custom URL Input */}
          <Text style={[modalStyles.sectionHeading, { marginTop: 16 }]}>Or Image Web URL</Text>
          <View style={modalStyles.inputRow}>
            <TextInput
              style={[modalStyles.input, { flex: 1 }]}
              value={customInput}
              onChangeText={setCustomInput}
              placeholder="https://example.com/avatar.jpg"
              placeholderTextColor={THEME.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={modalStyles.applyBtn}
              onPress={() => {
                if (customInput.trim().startsWith('http')) {
                  setSelectedUrl(customInput.trim());
                  setCustomInput('');
                } else {
                  Alert.alert('Invalid URL', 'Please enter a valid HTTP/HTTPS image URL.');
                }
              }}
            >
              <Text style={modalStyles.applyBtnText}>Load</Text>
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={modalStyles.actionRow}>
            <TouchableOpacity
              style={modalStyles.removeBtn}
              onPress={() => setSelectedUrl(null)}
            >
              <Text style={modalStyles.removeBtnText}>Clear Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={modalStyles.saveBtnText}>Save Avatar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Status Picker Modal ─────────────────────────────────────────────────────
const StatusPickerModal = ({
  visible,
  currentStatus,
  onClose,
  onSelect,
}: {
  visible: boolean;
  currentStatus: string;
  onClose: () => void;
  onSelect: (opt: (typeof STATUS_OPTIONS)[0]) => void;
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={modalStyles.backdrop} activeOpacity={1} onPress={onClose}>
      <View style={modalStyles.sheet} onStartShouldSetResponder={() => true}>
        <View style={modalStyles.sheetHeader}>
          <Text style={modalStyles.title}>Set Status</Text>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
            <Text style={modalStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={modalStyles.sub}>Choose how you appear to other contacts.</Text>

        {STATUS_OPTIONS.map((item) => {
          const isSelected = currentStatus === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[modalStyles.choiceRow, isSelected && modalStyles.choiceRowActive]}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 22, marginRight: 12 }}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.choiceTitle}>{item.label}</Text>
                <Text style={modalStyles.choiceSub}>{item.sub}</Text>
              </View>
              {isSelected && <Text style={modalStyles.choiceCheck}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </TouchableOpacity>
  </Modal>
);

// ─── Ringtone Selector Modal ─────────────────────────────────────────────────
const RingtoneModal = ({
  visible,
  selectedId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selectedId: string;
  onClose: () => void;
  onSelect: (ringtoneId: string) => Promise<void>;
}) => {
  const [saving, setSaving] = useState(false);

  const handlePick = async (id: string) => {
    try {
      setSaving(true);
      await onSelect(id);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not change ringtone.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.title}>Incoming Call Ringtone</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Text style={modalStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={modalStyles.sub}>Select the ringtone played during incoming calls.</Text>

          {RINGTONE_OPTIONS.map((r) => {
            const isSelected = selectedId === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                style={[modalStyles.choiceRow, isSelected && modalStyles.choiceRowActive]}
                onPress={() => handlePick(r.id)}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 20, marginRight: 12 }}>🔔</Text>
                <View style={{ flex: 1 }}>
                  <Text style={modalStyles.choiceTitle}>{r.name}</Text>
                  <Text style={modalStyles.choiceSub}>{r.desc}</Text>
                </View>
                {isSelected && <Text style={modalStyles.choiceCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
};

// ─── Blocked Users Modal ─────────────────────────────────────────────────────
const BlockedUsersModal = ({
  visible,
  onClose,
  onUnblocked,
}: {
  visible: boolean;
  onClose: () => void;
  onUnblocked: () => void;
}) => {
  const [blockedList, setBlockedList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const fetchBlocked = async () => {
    try {
      setLoading(true);
      const res = await api.get('/contacts/blocked');
      setBlockedList(res.data.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Could not load blocked list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchBlocked();
    }
  }, [visible]);

  const handleUnblock = async (blockedId: string, name: string) => {
    Alert.alert('Unblock User', `Unblock ${name}? They will be able to call and message you again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        style: 'destructive',
        onPress: async () => {
          try {
            setUnblockingId(blockedId);
            await api.delete(`/contacts/blocked/${blockedId}`);
            setBlockedList((prev) => prev.filter((item) => item.blockedId !== blockedId));
            onUnblocked();
            Alert.alert('Unblocked', `${name} has been unblocked.`);
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to unblock user.');
          } finally {
            setUnblockingId(null);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={[modalStyles.sheet, { maxHeight: '80%' }]}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.title}>Blocked Users</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Text style={modalStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={modalStyles.sub}>
            Blocked users cannot call, message, or see your online status.
          </Text>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={THEME.colors.primary} />
            </View>
          ) : blockedList.length === 0 ? (
            <View style={modalStyles.emptyWrap}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>🛡️</Text>
              <Text style={modalStyles.emptyTitle}>No Blocked Users</Text>
              <Text style={modalStyles.emptySub}>
                You haven't blocked anyone yet. You can block someone anytime from your Contacts list.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ marginTop: 8 }} showsVerticalScrollIndicator={false}>
              {blockedList.map((item) => (
                <View key={item.blockedId} style={modalStyles.blockedItem}>
                  <Avatar
                    name={item.displayName || item.username}
                    url={item.avatarUrl}
                    size={46}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={modalStyles.choiceTitle}>{item.displayName || item.username}</Text>
                    <Text style={modalStyles.choiceSub}>@{item.username}</Text>
                  </View>
                  <TouchableOpacity
                    style={modalStyles.unblockBtn}
                    onPress={() => handleUnblock(item.blockedId, item.displayName || item.username)}
                    disabled={unblockingId === item.blockedId}
                  >
                    {unblockingId === item.blockedId ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={modalStyles.unblockBtnText}>Unblock</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─── Change Password Modal ────────────────────────────────────────────────────
const ChangePasswordModal = ({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setShowCurrent(false);
    setShowNext(false);
  };

  const handleChange = async () => {
    if (!current || !next || !confirm) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (next !== confirm) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    if (next.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(next)) {
      Alert.alert('Error', 'New password must include at least one uppercase letter.');
      return;
    }
    if (!/[0-9]/.test(next)) {
      Alert.alert('Error', 'New password must include at least one number.');
      return;
    }

    try {
      setSaving(true);
      await api.patch('/users/password', { currentPassword: current, newPassword: next });
      reset();
      onSuccess();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.title}>Change Password</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Text style={modalStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={modalStyles.sub}>
            Ensure your account stays secure by creating a strong password.
          </Text>

          <Text style={modalStyles.label}>Current Password</Text>
          <View style={modalStyles.passwordRow}>
            <TextInput
              style={[modalStyles.input, { flex: 1 }]}
              value={current}
              onChangeText={setCurrent}
              secureTextEntry={!showCurrent}
              placeholderTextColor={THEME.colors.textMuted}
              placeholder="Enter current password"
            />
            <TouchableOpacity
              onPress={() => setShowCurrent(!showCurrent)}
              style={modalStyles.eyeBtn}
            >
              <Text style={{ fontSize: 16 }}>{showCurrent ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[modalStyles.label, { marginTop: 14 }]}>New Password</Text>
          <View style={modalStyles.passwordRow}>
            <TextInput
              style={[modalStyles.input, { flex: 1 }]}
              value={next}
              onChangeText={setNext}
              secureTextEntry={!showNext}
              placeholderTextColor={THEME.colors.textMuted}
              placeholder="Min 8 chars, 1 uppercase, 1 digit"
            />
            <TouchableOpacity onPress={() => setShowNext(!showNext)} style={modalStyles.eyeBtn}>
              <Text style={{ fontSize: 16 }}>{showNext ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[modalStyles.label, { marginTop: 14 }]}>Confirm New Password</Text>
          <TextInput
            style={modalStyles.input}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showNext}
            placeholderTextColor={THEME.colors.textMuted}
            placeholder="Repeat new password"
          />

          <View style={modalStyles.actionRow}>
            <TouchableOpacity
              style={modalStyles.removeBtn}
              onPress={() => {
                reset();
                onClose();
              }}
            >
              <Text style={modalStyles.removeBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleChange}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={modalStyles.saveBtnText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Delete Account Modal (Cross-Platform Android & iOS) ─────────────────────
const DeleteAccountModal = ({
  visible,
  onClose,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!password) {
      Alert.alert('Required', 'Please enter your password to confirm account deletion.');
      return;
    }
    try {
      setDeleting(true);
      await api.delete('/users/account', { data: { password } });
      onDeleted();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Could not delete account. Verify password.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={[modalStyles.title, { color: THEME.colors.danger }]}>
              ⚠️ Permanently Delete Account
            </Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Text style={modalStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={modalStyles.dangerNotice}>
            <Text style={modalStyles.dangerNoticeText}>
              This action is permanent and cannot be undone. All your messages, call logs, contacts,
              and profile information will be wiped.
            </Text>
          </View>

          <Text style={modalStyles.label}>Enter your password to confirm:</Text>
          <View style={modalStyles.passwordRow}>
            <TextInput
              style={[modalStyles.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor={THEME.colors.textMuted}
              placeholder="Your current password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={modalStyles.eyeBtn}
            >
              <Text style={{ fontSize: 16 }}>{showPassword ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>

          <View style={modalStyles.actionRow}>
            <TouchableOpacity
              style={modalStyles.removeBtn}
              onPress={() => {
                setPassword('');
                onClose();
              }}
            >
              <Text style={modalStyles.removeBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                modalStyles.saveBtn,
                { backgroundColor: THEME.colors.danger },
                deleting && { opacity: 0.7 },
              ]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={modalStyles.saveBtnText}>Delete Forever</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Server Configuration Modal ──────────────────────────────────────────────
const ServerConfigModal = ({
  visible,
  currentHost,
  onClose,
  onApply,
}: {
  visible: boolean;
  currentHost: string;
  onClose: () => void;
  onApply: (newHost: string) => Promise<void>;
}) => {
  const [hostInput, setHostInput] = useState(currentHost);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ alive: boolean; latency: number } | null>(null);

  useEffect(() => {
    setHostInput(currentHost);
    setTestResult(null);
  }, [currentHost, visible]);

  const handleTest = async () => {
    const target = hostInput.trim();
    if (!target) return;
    try {
      setTesting(true);
      setTestResult(null);
      const start = Date.now();
      const alive = await probeHost(target, 3000);
      const latency = Date.now() - start;
      setTestResult({ alive, latency });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const target = hostInput.trim();
    if (!target) {
      Alert.alert('Required', 'Please enter a server host or URL.');
      return;
    }
    await onApply(target);
    onClose();
  };

  const isCurrentCloud = isCloudServer(hostInput);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.title}>Server & Cloud Endpoint</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Text style={modalStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={modalStyles.sub}>
            Connect CallFar to your online production cloud server or local development machine.
          </Text>

          {/* Quick Presets */}
          <Text style={[styles.editLabel, { marginTop: 12, marginBottom: 8 }]}>Quick Presets:</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <TouchableOpacity
              style={[
                modalStyles.choiceRow,
                { flex: 1, minWidth: 90, marginBottom: 0, paddingVertical: 8, justifyContent: 'center' },
              ]}
              onPress={() => setHostInput('172.23.224.248')}
            >
              <Text style={{ color: THEME.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                🏠 Wi-Fi LAN
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                modalStyles.choiceRow,
                { flex: 1, minWidth: 90, marginBottom: 0, paddingVertical: 8, justifyContent: 'center' },
              ]}
              onPress={() => setHostInput('localhost')}
            >
              <Text style={{ color: THEME.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                💻 Localhost
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                modalStyles.choiceRow,
                { flex: 1, minWidth: 100, marginBottom: 0, paddingVertical: 8, justifyContent: 'center' },
              ]}
              onPress={() => setHostInput('https://')}
            >
              <Text style={{ color: THEME.colors.primaryLight, fontSize: 13, fontWeight: '600' }}>
                🌐 Cloud HTTPS
              </Text>
            </TouchableOpacity>
          </View>

          {/* Input field */}
          <Text style={styles.editLabel}>Server Host or HTTPS URL</Text>
          <TextInput
            style={[styles.editInput, { marginTop: 6 }]}
            value={hostInput}
            onChangeText={setHostInput}
            placeholder="e.g., https://callfar-backend.onrender.com"
            placeholderTextColor={THEME.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, color: THEME.colors.textMuted }}>
              Type: {isCurrentCloud ? '🌐 Cloud (HTTPS/WSS)' : '🏠 Local (HTTP:5000)'}
            </Text>
            <TouchableOpacity
              onPress={handleTest}
              disabled={testing}
              style={{ paddingVertical: 4, paddingHorizontal: 10, backgroundColor: THEME.colors.surfaceHover, borderRadius: 8 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: THEME.colors.primaryLight }}>
                {testing ? 'Testing...' : '⚡ Test Connection'}
              </Text>
            </TouchableOpacity>
          </View>

          {testResult && (
            <View
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 10,
                backgroundColor: testResult.alive ? THEME.colors.success + '20' : THEME.colors.danger + '20',
                borderWidth: 1,
                borderColor: testResult.alive ? THEME.colors.success + '50' : THEME.colors.danger + '50',
              }}
            >
              <Text style={{ color: testResult.alive ? THEME.colors.success : THEME.colors.danger, fontWeight: '700', fontSize: 13 }}>
                {testResult.alive ? `✅ Connected! Latency: ${testResult.latency}ms` : '❌ Server unreachable at this address'}
              </Text>
            </View>
          )}

          <View style={[styles.editActions, { marginTop: 20 }]}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Apply & Connect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main SettingsScreen ──────────────────────────────────────────────────────
export const SettingsScreen = () => {
  const navigation = useNavigation();
  const { user, logout, updateUser, isAdmin, role, license, redeemLicenseKey, refreshProfile, elevateToAdmin } = useAuth();
  const { startCall } = useCall();

  // Server & Cloud Infrastructure State
  const [showServerModal, setShowServerModal] = useState(false);
  const [activeHostState, setActiveHostState] = useState(currentActiveHost);

  const handleApplyServerHost = async (newHost: string) => {
    try {
      await switchActiveHost(newHost, true);
      setActiveHostState(newHost);
      Alert.alert('✅ Server Updated', `CallFar connected to: ${newHost}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update server endpoint.');
    }
  };

  // Profile editing
  const [displayName, setDisplayName] = useState(user?.profile?.displayName || user?.username || '');
  const [bio, setBio] = useState(user?.profile?.bio || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [isEditing, setIsEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Settings Toggles (synced with user.settings and user.profile)
  const [allowCalls, setAllowCalls] = useState(user?.settings?.allowIncomingCalls ?? true);
  const [readReceipts, setReadReceipts] = useState(user?.settings?.allowReadReceipts ?? true);
  const [notifications, setNotifications] = useState(user?.settings?.notificationsEnabled ?? true);
  const [onlineStatus, setOnlineStatus] = useState(user?.profile?.isOnline ?? true);
  const [currentRingtone, setCurrentRingtone] = useState(user?.settings?.callRingtone || 'default');
  const [savingToggle, setSavingToggle] = useState<string | null>(null);

  // Phone Features (stored locally & in memory)
  const [vibrateOnRing, setVibrateOnRing] = useState(true);
  const [inAppSounds, setInAppSounds] = useState(true);
  const [cacheSize, setCacheSize] = useState('3.8 MB');
  const [blockedCount, setBlockedCount] = useState<number | null>(null);

  // Modals
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showRingtoneModal, setShowRingtoneModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showElevateModal, setShowElevateModal] = useState(false);
  const [elevatePasscode, setElevatePasscode] = useState('');
  const [isElevating, setIsElevating] = useState(false);
  const [redeemKeyInput, setRedeemKeyInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const handleElevateSubmit = async () => {
    if (!elevatePasscode.trim()) {
      Alert.alert('Required', 'Please enter the admin security passcode.');
      return;
    }
    try {
      setIsElevating(true);
      await elevateToAdmin(elevatePasscode.trim());
      Alert.alert('🎉 Admin Mode Activated', 'Your account has been elevated to System Administrator with Master privileges!');
      setShowElevateModal(false);
      setElevatePasscode('');
      refreshData();
    } catch (e: any) {
      Alert.alert('Elevation Failed', e.response?.data?.message || 'Invalid admin security passcode.');
    } finally {
      setIsElevating(false);
    }
  };

  const handleRedeemKeySubmit = async () => {
    if (!redeemKeyInput.trim()) {
      Alert.alert('Required', 'Please enter a valid license key.');
      return;
    }
    try {
      setIsRedeeming(true);
      const resLicense = await redeemLicenseKey(redeemKeyInput.trim());
      Alert.alert('🎉 License Activated!', `Your account has been upgraded to ${resLicense.tier}. All features are now unlocked!`);
      setShowRedeemModal(false);
      setRedeemKeyInput('');
      refreshData();
    } catch (e: any) {
      Alert.alert('Redemption Failed', e.response?.data?.message || 'Invalid or expired license key.');
    } finally {
      setIsRedeeming(false);
    }
  };

  // Initial Sync from Backend
  useEffect(() => {
    refreshData();
    loadLocalSettings();
  }, []);

  const loadLocalSettings = async () => {
    try {
      const vib = await AsyncStorage.getItem('callfar_vibrate_on_ring');
      if (vib !== null) setVibrateOnRing(vib === 'true');
      const snd = await AsyncStorage.getItem('callfar_in_app_sounds');
      if (snd !== null) setInAppSounds(snd === 'true');
    } catch {}
  };

  const refreshData = async () => {
    try {
      const res = await api.get('/users/profile');
      if (res.data?.data) {
        const u = res.data.data;
        updateUser(u);
        setDisplayName(u.profile?.displayName || u.username);
        setBio(u.profile?.bio || '');
        setPhoneNumber(u.phoneNumber || '');
        if (u.settings) {
          setAllowCalls(u.settings.allowIncomingCalls ?? true);
          setReadReceipts(u.settings.allowReadReceipts ?? true);
          setNotifications(u.settings.notificationsEnabled ?? true);
          setCurrentRingtone(u.settings.callRingtone || 'default');
        }
        if (u.profile) {
          setOnlineStatus(u.profile.isOnline ?? true);
        }
      }
      // Count blocked users
      const blockedRes = await api.get('/contacts/blocked');
      if (blockedRes.data?.data) {
        setBlockedCount(blockedRes.data.data.length);
      }
    } catch {}
  };

  // ── Save Profile Edit ───────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Required', 'Display name cannot be empty.');
      return;
    }
    try {
      setSavingProfile(true);
      const res = await api.patch('/users/profile', {
        displayName: displayName.trim(),
        bio: bio.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
      });

      if (res.data?.data) {
        updateUser(res.data.data);
      }
      setIsEditing(false);
      Alert.alert('✅ Profile Saved', 'Your profile details have been successfully updated.');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    setDisplayName(user?.profile?.displayName || user?.username || '');
    setBio(user?.profile?.bio || '');
    setPhoneNumber(user?.phoneNumber || '');
    setIsEditing(false);
  };

  // ── Save Avatar ─────────────────────────────────────────────────────────────
  const handleSelectAvatar = async (url: string | null) => {
    const res = await api.patch('/users/profile', { avatarUrl: url });
    if (res.data?.data) {
      updateUser(res.data.data);
    } else {
      updateUser({ profile: { ...user!.profile, avatarUrl: url } as any });
    }
    Alert.alert('✅ Avatar Updated', 'Your profile photo has been refreshed.');
  };

  // ── Save Status ─────────────────────────────────────────────────────────────
  const handleSelectStatus = async (opt: (typeof STATUS_OPTIONS)[0]) => {
    try {
      setOnlineStatus(opt.isOnline);
      const res = await api.patch('/users/profile', { isOnline: opt.isOnline });
      if (res.data?.data) {
        updateUser(res.data.data);
      }
      if (opt.id === 'dnd') {
        await api.patch('/users/settings', { allowIncomingCalls: false });
        setAllowCalls(false);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to update status.');
    }
  };

  // ── Save Setting Toggle ─────────────────────────────────────────────────────
  const saveToggle = async (key: string, value: boolean) => {
    setSavingToggle(key);
    try {
      const res = await api.patch('/users/settings', { [key]: value });
      updateUser({ settings: { ...user!.settings, ...res.data.data } as any });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Could not save setting.');
      if (key === 'allowIncomingCalls') setAllowCalls((v) => !v);
      if (key === 'allowReadReceipts') setReadReceipts((v) => !v);
      if (key === 'notificationsEnabled') setNotifications((v) => !v);
    } finally {
      setSavingToggle(null);
    }
  };

  // ── Save Ringtone ───────────────────────────────────────────────────────────
  const handleSelectRingtone = async (ringtoneId: string) => {
    setCurrentRingtone(ringtoneId);
    await api.patch('/users/settings', { callRingtone: ringtoneId });
    updateUser({ settings: { ...user!.settings, callRingtone: ringtoneId } as any });
  };

  // ── Clear App Cache ─────────────────────────────────────────────────────────
  const handleClearCache = async () => {
    Alert.alert('Clear Cache', 'Clear temporary app data and cached media to free up storage?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear Cache',
        onPress: async () => {
          try {
            // Keep auth tokens safe while clearing temp keys
            const token = await AsyncStorage.getItem('callfar_access_token');
            const rToken = await AsyncStorage.getItem('callfar_refresh_token');
            const usr = await AsyncStorage.getItem('callfar_user');
            await AsyncStorage.clear();
            if (token) await AsyncStorage.setItem('callfar_access_token', token);
            if (rToken) await AsyncStorage.setItem('callfar_refresh_token', rToken);
            if (usr) await AsyncStorage.setItem('callfar_user', usr);
            setCacheSize('0 KB');
            Alert.alert('✨ Cache Cleared', 'Successfully freed 3.8 MB of local cache.');
          } catch {
            Alert.alert('Notice', 'Cache already cleared.');
          }
        },
      },
    ]);
  };

  // ── Sign Out ────────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Sign out of CallFar on this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  const memberSince = user
    ? new Date((user as any).createdAt || Date.now()).toLocaleDateString([], {
        month: 'long',
        year: 'numeric',
      })
    : '';

  const activeRingtoneObj = RINGTONE_OPTIONS.find((r) => r.id === currentRingtone);

  return (
    <View style={styles.screenWrapper}>
      {/* ── Top Header Bar with Profile Action ── */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <Text style={styles.topHeaderTitle}>Settings</Text>
          <Text style={styles.topHeaderSub}>Account, Audio & Privacy</Text>
        </View>

        <TouchableOpacity
          style={styles.profileCornerBtn}
          onPress={() => setShowProfileModal(true)}
          activeOpacity={0.8}
        >
          <Avatar
            name={user?.profile?.displayName || user?.username || 'U'}
            url={user?.profile?.avatarUrl}
            size={40}
            isOnline={onlineStatus}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      {/* ── Profile Hero ── */}
      <View style={styles.hero}>
        <TouchableOpacity
          onPress={() => setShowAvatarModal(true)}
          style={styles.avatarWrap}
          activeOpacity={0.85}
        >
          <Avatar
            name={user?.profile?.displayName || user?.username || 'U'}
            url={user?.profile?.avatarUrl}
            size={90}
            isOnline={onlineStatus}
          />
          <View style={styles.cameraBadge}>
            <Text style={{ fontSize: 13 }}>📷</Text>
          </View>
        </TouchableOpacity>

        {!isEditing ? (
          <>
            <Text style={styles.heroName}>{user?.profile?.displayName || user?.username}</Text>
            <Text style={styles.heroUsername}>@{user?.username}</Text>

            {user?.profile?.bio ? (
              <Text style={styles.heroBio}>"{user.profile.bio}"</Text>
            ) : null}

            <Text style={styles.heroEmail}>✉️ {user?.email}</Text>
            {user?.phoneNumber ? (
              <Text style={styles.heroPhone}>📱 {user.phoneNumber}</Text>
            ) : null}
            {memberSince ? (
              <Text style={styles.heroSince}>Member since {memberSince}</Text>
            ) : null}

            {/* Quick Status and Encrypted Badges */}
            <View style={styles.heroBadges}>
              <TouchableOpacity
                style={styles.badge}
                onPress={() => setShowStatusModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.badgeText}>
                  {onlineStatus ? '🟢 Online' : '⚪ Offline'} ▾
                </Text>
              </TouchableOpacity>
              <View style={[styles.badge, { borderColor: THEME.colors.success + '60' }]}>
                <Text style={styles.badgeText}>🔒 E2E Encrypted</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => setIsEditing(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.editProfileBtnText}>✏️  Edit Profile</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.editForm}>
            <Text style={styles.editLabel}>Display Name</Text>
            <TextInput
              style={styles.editInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your full name"
              placeholderTextColor={THEME.colors.textMuted}
              maxLength={60}
            />

            <Text style={[styles.editLabel, { marginTop: 12 }]}>Bio / About</Text>
            <TextInput
              style={[styles.editInput, { height: 76, textAlignVertical: 'top' }]}
              value={bio}
              onChangeText={setBio}
              placeholder="What's on your mind?"
              placeholderTextColor={THEME.colors.textMuted}
              multiline
              maxLength={120}
            />
            <Text style={styles.charCount}>{bio.length}/120</Text>

            <Text style={[styles.editLabel, { marginTop: 10 }]}>Phone Number</Text>
            <TextInput
              style={styles.editInput}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={THEME.colors.textMuted}
              keyboardType="phone-pad"
              maxLength={30}
            />

            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, savingProfile && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Admin Master Hub Banner (Admins Only) ── */}
      {isAdmin && (
        <View style={styles.adminBannerCard}>
          <View style={styles.adminBannerHeader}>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>🛡️ SYSTEM ADMINISTRATOR</Text>
            </View>
            <View style={styles.masterBadgeSmall}>
              <Text style={styles.masterBadgeSmallText}>MASTER ALL-ACCESS</Text>
            </View>
          </View>
          <Text style={styles.adminBannerTitle}>Full Platform Control Center</Text>
          <Text style={styles.adminBannerDesc}>
            Manage all registered users, generate & issue licenses, audit live calls, and broadcast system announcements.
          </Text>
          <TouchableOpacity
            style={styles.adminHubBtn}
            onPress={() => navigation.navigate('AdminHub' as never)}
            activeOpacity={0.8}
          >
            <Text style={styles.adminHubBtnText}>Open Administrator Hub →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── CallFar License & Plan ── */}
      <SectionCard title="License & Capabilities">
        <View style={styles.licenseInfoRow}>
          <View>
            <Text style={styles.licenseCurrentLabel}>Current License Tier</Text>
            <Text style={styles.licenseTierName}>
              {license?.tier === 'MASTER_ADMIN'
                ? '🛡️ Master Admin License'
                : license?.tier === 'ENTERPRISE'
                ? '💎 Enterprise Plan'
                : license?.tier === 'PRO'
                ? '⚡ Pro Plan'
                : '🌱 Free Member'}
            </Text>
          </View>
          <View style={[
            styles.licenseStatusBadge,
            license?.tier === 'MASTER_ADMIN'
              ? { backgroundColor: '#059669' }
              : license?.tier === 'PRO' || license?.tier === 'ENTERPRISE'
              ? { backgroundColor: '#2563EB' }
              : { backgroundColor: '#334155' }
          ]}>
            <Text style={styles.licenseStatusBadgeText}>
              {license?.status || 'ACTIVE'}
            </Text>
          </View>
        </View>

        <View style={styles.entitlementsList}>
          <Text style={styles.entitlementItem}>
            ✓ Max Call Duration: {license?.maxCallDurationMinutes === -1 ? 'Unlimited (∞)' : `${license?.maxCallDurationMinutes || 15} min`}
          </Text>
          <Text style={styles.entitlementItem}>
            ✓ Video Calling: {license?.canVideoCall !== false ? 'Enabled' : 'Disabled'}
          </Text>
          <Text style={styles.entitlementItem}>
            ✓ HD Audio (Opus 48kHz): {license?.canHdAudio ? 'Active (Hi-Fi Studio)' : 'Standard Bitrate'}
          </Text>
          <Text style={styles.entitlementItem}>
            ✓ Priority TURN Relay: {license?.priorityTurn ? 'VIP Ultra-Low Latency' : 'Standard Relay'}
          </Text>
          {license?.expiresAt ? (
            <Text style={[styles.entitlementItem, { color: '#F59E0B' }]}>
              ⏳ Expires: {new Date(license.expiresAt).toLocaleDateString()}
            </Text>
          ) : (
            <Text style={[styles.entitlementItem, { color: '#10B981' }]}>
              ♾️ Access: Lifetime / Permanent
            </Text>
          )}
        </View>

        <Separator />

        <NavRow
          icon="🔑"
          label="Redeem License Key"
          sub="Enter key from Administrator to unlock features"
          value="Redeem ›"
          onPress={() => setShowRedeemModal(true)}
        />
      </SectionCard>

      {/* ── Notifications & Sounds ── */}
      <SectionCard title="Notifications & Sounds">
        <ToggleRow
          icon="🔔"
          label="Push Notifications"
          sub="Alerts for incoming calls and new messages"
          value={notifications}
          loading={savingToggle === 'notificationsEnabled'}
          onToggle={() => {
            const v = !notifications;
            setNotifications(v);
            saveToggle('notificationsEnabled', v);
          }}
        />
        <Separator />
        <NavRow
          icon="🎵"
          label="Call Ringtone"
          sub="Sound played during incoming voice/video calls"
          value={activeRingtoneObj?.name || 'Classic'}
          onPress={() => setShowRingtoneModal(true)}
        />
        <Separator />
        <ToggleRow
          icon="📳"
          label="Vibrate on Ring"
          sub="Haptic feedback when phone rings"
          value={vibrateOnRing}
          onToggle={() => {
            const v = !vibrateOnRing;
            setVibrateOnRing(v);
            AsyncStorage.setItem('callfar_vibrate_on_ring', String(v));
          }}
        />
        <Separator />
        <ToggleRow
          icon="🔊"
          label="In-App Sounds"
          sub="Sound effects for sent and received chats"
          value={inAppSounds}
          onToggle={() => {
            const v = !inAppSounds;
            setInAppSounds(v);
            AsyncStorage.setItem('callfar_in_app_sounds', String(v));
          }}
        />
      </SectionCard>

      {/* ── Privacy & Calling ── */}
      <SectionCard title="Privacy & Calling">
        <ToggleRow
          icon="📞"
          label="Allow Incoming Calls"
          sub="Receive direct audio and video calls from contacts"
          value={allowCalls}
          loading={savingToggle === 'allowIncomingCalls'}
          onToggle={() => {
            const v = !allowCalls;
            setAllowCalls(v);
            saveToggle('allowIncomingCalls', v);
          }}
        />
        <Separator />
        <ToggleRow
          icon="✓✓"
          label="Read Receipts"
          sub="Let contacts know when you have read their messages"
          value={readReceipts}
          loading={savingToggle === 'allowReadReceipts'}
          onToggle={() => {
            const v = !readReceipts;
            setReadReceipts(v);
            saveToggle('allowReadReceipts', v);
          }}
        />
        <Separator />
        <ToggleRow
          icon="🟢"
          label="Show Online Status"
          sub="Display your active online presence to friends"
          value={onlineStatus}
          onToggle={() => {
            const v = !onlineStatus;
            setOnlineStatus(v);
            api.patch('/users/profile', { isOnline: v });
            updateUser({ profile: { ...user!.profile, isOnline: v } as any });
          }}
        />
        <Separator />
        <NavRow
          icon="🚫"
          label="Blocked Users"
          sub="Manage contacts you have restricted from reaching you"
          value={blockedCount !== null ? `${blockedCount} blocked` : undefined}
          onPress={() => setShowBlockedModal(true)}
        />
      </SectionCard>

      {/* ── Account & Security ── */}
      <SectionCard title="Account & Security">
        <NavRow
          icon="🔑"
          label="Change Password"
          sub="Update your login password securely"
          onPress={() => setShowPasswordModal(true)}
        />
        <Separator />
        <NavRow
          icon="📧"
          label="Email Address"
          sub={user?.email || 'None'}
          value="Verified 🛡️"
          onPress={() =>
            Alert.alert(
              'Email Address',
              `Your verified email is ${user?.email}.\n\nFor security reasons, changing your email requires reaching out to support@callfar.app.`
            )
          }
        />
        <Separator />
        <NavRow
          icon="📱"
          label="Phone Number"
          sub={user?.phoneNumber || 'No phone number linked'}
          value={user?.phoneNumber ? 'Active' : '+ Add'}
          onPress={() => setIsEditing(true)}
        />
      </SectionCard>

      {/* ── Storage & Network ── */}
      <SectionCard title="Storage & Network">
        <NavRow
          icon="💾"
          label="Cached Data"
          sub="Local cached images, icons, and temporary files"
          value={cacheSize}
          onPress={handleClearCache}
        />
        <Separator />
        <NavRow
          icon="🌐"
          label="Signaling Protocol"
          sub="WebSocket · WebSockets Port 5000"
          value="Connected"
          onPress={() =>
            Alert.alert(
              'Network Diagnostics',
              '• Signaling: Socket.IO Server active\n• Media: WebRTC P2P direct audio/video\n• Encryption: DTLS-SRTP (256-bit AES)'
            )
          }
        />
      </SectionCard>

      {/* ── About CallFar ── */}
      <SectionCard title="About CallFar">
        <NavRow
          icon="📱"
          label="App Version"
          sub="CallFar Mobile v1.2.0 (Build 2026.10)"
          value="Up to date"
          onPress={() => {}}
        />
        <Separator />
        <NavRow
          icon="📜"
          label="Terms of Service"
          sub="Usage guidelines and user agreement"
          onPress={() =>
            Alert.alert(
              'Terms of Service',
              'By using CallFar, you agree to respectful communication, encrypted P2P calling, and data privacy principles. Full details at callfar.app/terms'
            )
          }
        />
        <Separator />
        <NavRow
          icon="🔐"
          label="Privacy Policy"
          sub="How your data is encrypted and protected"
          onPress={() =>
            Alert.alert(
              'Privacy Policy',
              'CallFar employs peer-to-peer WebRTC connections. Call audio and video streams never pass through third-party servers. Details at callfar.app/privacy'
            )
          }
        />
        <Separator />
        <NavRow
          icon="🐛"
          label="Report a Bug"
          sub="Send diagnostic feedback or report issues"
          onPress={() =>
            Alert.alert(
              'Report an Issue',
              'Thank you for helping us improve CallFar! Please send details and screenshots to bugs@callfar.app or GitHub issues.'
            )
          }
        />
      </SectionCard>

      {/* ── Server & Cloud Infrastructure ── */}
      <SectionCard title="Server & Cloud Infrastructure">
        <NavRow
          icon={isCloudServer(activeHostState) ? '🌐' : '🏠'}
          label="Server Endpoint"
          sub={`Host: ${activeHostState}`}
          value={isCloudServer(activeHostState) ? 'Cloud Online ›' : 'Local LAN ›'}
          onPress={() => setShowServerModal(true)}
        />
        <Separator />
        <NavRow
          icon="⚡"
          label="Database Provider"
          sub="Cloud PostgreSQL with Supavisor Connection Pooling"
          value="Supabase"
          onPress={() => {
            Alert.alert(
              'Supabase Cloud Architecture',
              'CallFar runs on Supabase PostgreSQL with real-time transactional pooling, encrypted credential hashing, and low-latency WebRTC signaling.'
            );
          }}
        />
      </SectionCard>

      {/* ── Danger Zone ── */}
      <SectionCard title="Danger Zone">
        <NavRow
          icon="🗑️"
          label="Delete Account"
          sub="Permanently erase account, contacts, and all data"
          onPress={() => setShowDeleteModal(true)}
          danger
        />
      </SectionCard>

      <View style={{ height: 48 }} />

      {/* ── Modals ── */}
      <ServerConfigModal
        visible={showServerModal}
        currentHost={activeHostState}
        onClose={() => setShowServerModal(false)}
        onApply={handleApplyServerHost}
      />
      <ProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onEditProfile={() => setIsEditing(true)}
      />
      <AvatarPickerModal
        visible={showAvatarModal}
        currentUrl={user?.profile?.avatarUrl}
        displayName={user?.profile?.displayName || user?.username || 'U'}
        onClose={() => setShowAvatarModal(false)}
        onSelect={handleSelectAvatar}
      />

      <StatusPickerModal
        visible={showStatusModal}
        currentStatus={onlineStatus ? 'online' : 'offline'}
        onClose={() => setShowStatusModal(false)}
        onSelect={handleSelectStatus}
      />

      <RingtoneModal
        visible={showRingtoneModal}
        selectedId={currentRingtone}
        onClose={() => setShowRingtoneModal(false)}
        onSelect={handleSelectRingtone}
      />

      <BlockedUsersModal
        visible={showBlockedModal}
        onClose={() => setShowBlockedModal(false)}
        onUnblocked={() => {
          setBlockedCount((c) => (c !== null && c > 0 ? c - 1 : 0));
        }}
      />

      <ChangePasswordModal
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          setShowPasswordModal(false);
          Alert.alert('✅ Success', 'Password updated. Other sessions have been revoked.');
        }}
      />

      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={() => {
          setShowDeleteModal(false);
          Alert.alert('Account Deleted', 'Your account has been deleted.', [
            { text: 'OK', onPress: () => logout() },
          ]);
        }}
      />

      {/* ── Redeem License Key Modal ── */}
      <Modal visible={showRedeemModal} transparent animationType="slide">
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.sheetHeader}>
              <Text style={modalStyles.title}>🔑 Redeem License Key</Text>
              <TouchableOpacity onPress={() => setShowRedeemModal(false)} style={modalStyles.closeBtn}>
                <Text style={modalStyles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={modalStyles.sub}>
              Enter an activation key provided by the Administrator to instantly upgrade your account to Pro or Enterprise.
            </Text>

            <TextInput
              style={[
                modalStyles.input,
                {
                  letterSpacing: 1,
                  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                },
              ]}
              value={redeemKeyInput}
              onChangeText={setRedeemKeyInput}
              placeholder="e.g. CALLFAR-PRO-2026-VIP"
              placeholderTextColor={THEME.colors.textMuted}
              autoCapitalize="characters"
            />

            <View style={modalStyles.actionRow}>
              <TouchableOpacity
                style={modalStyles.removeBtn}
                onPress={() => {
                  setRedeemKeyInput('');
                  setShowRedeemModal(false);
                }}
              >
                <Text style={modalStyles.removeBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.saveBtn, { backgroundColor: THEME.colors.primary }, isRedeeming && { opacity: 0.7 }]}
                onPress={handleRedeemKeySubmit}
                disabled={isRedeeming}
              >
                {isRedeeming ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={modalStyles.saveBtnText}>Activate Key</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  topHeader: {
    paddingTop: Platform.OS === 'ios' ? 56 : 18,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  topHeaderLeft: {
    flex: 1,
  },
  topHeaderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  topHeaderSub: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  profileCornerBtn: {
    padding: 2,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    backgroundColor: '#1E293B',
  },
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 20,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: THEME.colors.primary,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.background,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
  },
  heroUsername: {
    fontSize: 14,
    color: THEME.colors.primaryLight,
    fontWeight: '600',
    marginTop: 2,
  },
  heroBio: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 280,
  },
  heroEmail: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 6,
  },
  heroPhone: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  heroSince: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 3,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  badge: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: THEME.colors.surfaceHover,
  },
  badgeText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  editProfileBtn: {
    backgroundColor: THEME.colors.primary + '22',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: THEME.colors.primary + '55',
  },
  editProfileBtnText: {
    color: THEME.colors.primaryLight,
    fontWeight: '700',
    fontSize: 14,
  },

  // Edit form
  editForm: {
    width: '100%',
    marginTop: 10,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  editInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: THEME.colors.textPrimary,
    fontSize: 15,
  },
  charCount: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  // Section card
  card: {
    backgroundColor: THEME.colors.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  adminBannerCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    padding: 16,
    marginBottom: 14,
  },
  adminBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  adminBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  masterBadgeSmall: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  masterBadgeSmallText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  adminBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
  },
  adminBannerDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 18,
  },
  adminHubBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  adminHubBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  elevateBannerCard: {
    backgroundColor: '#0F172A',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginBottom: 14,
  },
  memberBadgeSmall: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  memberBadgeSmallText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  elevateBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
  },
  elevateBannerDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 18,
  },
  elevateBtn: {
    backgroundColor: '#B45309',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  elevateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  licenseInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  licenseCurrentLabel: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  licenseTierName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  licenseStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  licenseStatusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  entitlementsList: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  entitlementItem: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingTop: 14,
    paddingBottom: 6,
  },
  cardDivider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginBottom: 4,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconText: {
    fontSize: 18,
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    color: THEME.colors.textPrimary,
    fontWeight: '500',
  },
  rowSub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
    marginRight: 4,
  },
  chevron: {
    fontSize: 20,
    color: THEME.colors.textMuted,
  },
  sep: {
    height: 1,
    backgroundColor: THEME.colors.border,
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: Platform.OS === 'android' ? 32 : 44,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  sub: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: 5,
  },
  input: {
    backgroundColor: THEME.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: THEME.colors.textPrimary,
    fontSize: 15,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  removeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  removeBtnText: {
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  // Avatar picker specifics
  previewWrap: {
    alignItems: 'center',
    marginVertical: 12,
  },
  previewLabel: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 6,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  presetRow: {
    gap: 10,
    paddingVertical: 4,
  },
  presetItem: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  presetItemActive: {
    borderColor: THEME.colors.primary,
    transform: [{ scale: 1.08 }],
  },
  presetImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  checkBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: THEME.colors.primary,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  applyBtn: {
    backgroundColor: THEME.colors.surfaceHover,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  applyBtnText: {
    color: THEME.colors.primaryLight,
    fontWeight: '700',
    fontSize: 13,
  },

  // Choice rows (Status & Ringtone)
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: THEME.colors.background,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  choiceRowActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primary + '14',
  },
  choiceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  choiceSub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  choiceCheck: {
    fontSize: 16,
    color: THEME.colors.primaryLight,
    fontWeight: '800',
  },

  // Blocked modal specifics
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
  blockedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  unblockBtn: {
    backgroundColor: THEME.colors.danger + '22',
    borderWidth: 1,
    borderColor: THEME.colors.danger + '66',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  unblockBtnText: {
    color: THEME.colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },

  // Danger notice
  dangerNotice: {
    backgroundColor: THEME.colors.danger + '18',
    borderColor: THEME.colors.danger + '55',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  dangerNoticeText: {
    color: THEME.colors.danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});

export default SettingsScreen;
