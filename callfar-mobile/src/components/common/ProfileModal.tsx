import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { THEME } from '../../styles/theme';
import { Avatar } from './Avatar';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onEditProfile?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  onClose,
  onEditProfile,
}) => {
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of CallFar on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            onClose();
            await logout();
          },
        },
      ]
    );
  };

  if (!user) return null;

  const displayName = user.profile?.displayName || user.username || 'User';
  const memberSince = (user as any).createdAt
    ? new Date((user as any).createdAt).toLocaleDateString([], {
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.card}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>User Profile</Text>
              <Text style={styles.headerSub}>Account & Session Control</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Avatar & Identifiers */}
            <View style={styles.profileHeader}>
              <View style={styles.avatarBorder}>
                <Avatar
                  name={displayName}
                  url={user.profile?.avatarUrl}
                  size={84}
                  isOnline={user.profile?.isOnline ?? true}
                />
              </View>
              <Text style={styles.displayName}>{displayName}</Text>
              <Text style={styles.username}>@{user.username}</Text>

              <View
                style={[
                  styles.roleBadge,
                  isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeMember,
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    isAdmin ? styles.roleBadgeTextAdmin : styles.roleBadgeTextMember,
                  ]}
                >
                  {isAdmin ? '🛡️ System Administrator • Master Tier' : '👤 CallFar Member • Verified'}
                </Text>
              </View>
            </View>

            {/* Details Section */}
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>✉️</Text>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Email Address</Text>
                  <Text style={styles.infoVal}>{user.email || 'None'}</Text>
                </View>
              </View>

              {user.phoneNumber ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📱</Text>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Cellular / PSTN Number</Text>
                    <Text style={styles.infoVal}>{user.phoneNumber}</Text>
                  </View>
                </View>
              ) : null}

              {memberSince ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📅</Text>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Member Since</Text>
                    <Text style={styles.infoVal}>{memberSince}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>🔒</Text>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Security & Privacy</Text>
                  <Text style={styles.infoVal}>256-bit End-to-End Encrypted Session</Text>
                </View>
              </View>
            </View>

            {/* Edit Profile Option */}
            {onEditProfile && (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  onClose();
                  onEditProfile();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.editBtnText}>✏️  Edit Profile & Preferences</Text>
              </TouchableOpacity>
            )}

            {/* Prominent Sign Out / Logout Action Button */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutBtnText}>🚪  Log Out of CallFar</Text>
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              CallFar Ultra HD Communication Engine • Active Secure Session
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(3, 7, 18, 0.82)',
    paddingHorizontal: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 14,
    marginBottom: 16,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  scroll: {
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarBorder: {
    padding: 3,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#38BDF8',
    marginBottom: 12,
    backgroundColor: '#0A0F1D',
  },
  displayName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  username: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 2,
  },
  roleBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  roleBadgeMember: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  roleBadgeAdmin: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  roleBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  roleBadgeTextMember: {
    color: '#38BDF8',
  },
  roleBadgeTextAdmin: {
    color: '#FBBF24',
  },
  infoSection: {
    width: '100%',
    backgroundColor: '#0A0F1D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIcon: {
    fontSize: 18,
    width: 26,
    textAlign: 'center',
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoVal: {
    fontSize: 13.5,
    color: '#E2E8F0',
    fontWeight: '600',
    marginTop: 1,
  },
  editBtn: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  editBtnText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutBtn: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    marginBottom: 14,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footerNote: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 4,
  },
});
