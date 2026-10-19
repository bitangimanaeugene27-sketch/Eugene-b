import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
  Clipboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { THEME } from '../../styles/theme';
import { Avatar } from '../../components/common/Avatar';
import { SystemStats, LicenseKey, LicenseTier } from '../../types';

type AdminTab = 'overview' | 'users' | 'licenses' | 'telecom' | 'audit';

export default function AdminHubScreen() {
  const navigation = useNavigation();
  const { isAdmin } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Telecom PSTN Data
  const [pstnLogs, setPstnLogs] = useState<any[]>([]);
  const [telecomConfig, setTelecomConfig] = useState<any | null>(null);
  const [telecomFilter, setTelecomFilter] = useState<'all' | 'rwanda' | 'eastafrica' | 'international'>('all');

  // Overview Data
  const [stats, setStats] = useState<SystemStats | null>(null);

  // Users Data
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'admins' | 'members' | 'suspended'>('all');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isUserActionModalVisible, setIsUserActionModalVisible] = useState(false);
  const [isLicenseModalVisible, setIsLicenseModalVisible] = useState(false);
  const [selectedTierForUser, setSelectedTierForUser] = useState<LicenseTier>('PRO');
  const [selectedDurationDays, setSelectedDurationDays] = useState<number>(30);

  // Create User/Admin Modal Data
  const [isCreateUserModalVisible, setIsCreateUserModalVisible] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [newTier, setNewTier] = useState<LicenseTier>('PRO');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Licenses Data
  const [licenseKeys, setLicenseKeys] = useState<LicenseKey[]>([]);
  const [isGenKeyModalVisible, setIsGenKeyModalVisible] = useState(false);
  const [genTier, setGenTier] = useState<LicenseTier>('PRO');
  const [genDurationDays, setGenDurationDays] = useState<number>(30);
  const [genCount, setGenCount] = useState<number>(1);
  const [genNotes, setGenNotes] = useState<string>('');

  // Audit & Broadcast Data
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Initial Load
  const fetchAllData = useCallback(async () => {
    if (!isAdmin) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }
    try {
      setIsLoading(true);
      const [statsRes, usersRes, keysRes, callsRes, pstnLogsRes, configRes] = await Promise.allSettled([
        api.get('/admin/stats'),
        api.get('/admin/users?limit=50'),
        api.get('/admin/licenses/keys'),
        api.get('/admin/calls?limit=25'),
        api.get('/pstn/admin/logs'),
        api.get('/pstn/admin/config'),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.data?.data) setStats(statsRes.value.data.data);
      if (usersRes.status === 'fulfilled' && usersRes.value.data?.data?.users) setUsers(usersRes.value.data.users || usersRes.value.data.data.users);
      if (keysRes.status === 'fulfilled' && keysRes.value.data?.data) setLicenseKeys(keysRes.value.data.data);
      if (callsRes.status === 'fulfilled' && callsRes.value.data?.data?.calls) setRecentCalls(callsRes.value.data.data.calls);
      if (pstnLogsRes.status === 'fulfilled' && pstnLogsRes.value.data?.data) setPstnLogs(pstnLogsRes.value.data.data);
      if (configRes.status === 'fulfilled' && configRes.value.data?.data) setTelecomConfig(configRes.value.data.data);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to fetch admin data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchAllData();
  };

  // ─── USER ACTIONS ──────────────────────────────────────────────────────────

  const handleToggleUserStatus = async (user: any) => {
    try {
      const newStatus = !user.isActive;
      await api.patch(`/admin/users/${user.id}/status`, { isActive: newStatus });
      Alert.alert('Success', `User ${user.username} is now ${newStatus ? 'Active' : 'Suspended'}.`);
      setIsUserActionModalVisible(false);
      fetchAllData();
    } catch (err: any) {
      Alert.alert('Action Failed', err.response?.data?.message || 'Could not update user status.');
    }
  };

  const handleToggleUserRole = async (user: any) => {
    try {
      const newRole = user.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
      await api.patch(`/admin/users/${user.id}/role`, { role: newRole });
      Alert.alert('Role Updated', `User ${user.username} is now ${newRole}.`);
      setIsUserActionModalVisible(false);
      fetchAllData();
    } catch (err: any) {
      Alert.alert('Action Failed', err.response?.data?.message || 'Could not change user role.');
    }
  };

  const handleDeleteUser = (user: any) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete @${user.username}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/users/${user.id}`);
              Alert.alert('Success', `User @${user.username} has been deleted.`);
              setIsUserActionModalVisible(false);
              fetchAllData();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete user.');
            }
          },
        },
      ]
    );
  };

  const handleSaveUserLicense = async () => {
    if (!selectedUser) return;
    try {
      await api.put(`/admin/users/${selectedUser.id}/license`, {
        tier: selectedTierForUser,
        durationDays: selectedDurationDays,
      });
      Alert.alert('Success', `License for @${selectedUser.username} updated to ${selectedTierForUser}.`);
      setIsLicenseModalVisible(false);
      setIsUserActionModalVisible(false);
      fetchAllData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update license.');
    }
  };

  const handleCreateUser = async () => {
    if (!newFullName.trim() || !newUsername.trim() || !newEmail.trim() || !newPassword) {
      Alert.alert('Required Fields', 'Full Name, Username, Email, and Password are required.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Invalid Password', 'Password must be at least 8 characters long.');
      return;
    }
    try {
      setIsCreatingUser(true);
      const res = await api.post('/admin/users', {
        fullName: newFullName.trim(),
        username: newUsername.trim().toLowerCase(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
        tier: newTier,
        phoneNumber: newPhone.trim() || undefined,
      });

      Alert.alert('🎉 User Created', `Account @${res.data?.data?.username || newUsername} successfully provisioned!`);
      setIsCreateUserModalVisible(false);
      setNewFullName('');
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewPhone('');
      fetchAllData();
    } catch (err: any) {
      Alert.alert('Creation Failed', err.response?.data?.message || 'Could not create account.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // ─── LICENSE ACTIONS ───────────────────────────────────────────────────────

  const handleGenerateKeys = async () => {
    try {
      const res = await api.post('/admin/licenses/keys', {
        tier: genTier,
        durationDays: genDurationDays,
        count: genCount,
        notes: genNotes.trim() || undefined,
      });

      const generatedList = res.data?.data?.keys || [];
      const keysString = generatedList.join('\n');
      Clipboard.setString(keysString);

      Alert.alert(
        'Keys Generated Successfully!',
        `Generated ${generatedList.length} key(s) copied to clipboard:\n\n${keysString}`,
        [{ text: 'OK' }]
      );

      setIsGenKeyModalVisible(false);
      setGenNotes('');
      fetchAllData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to generate keys.');
    }
  };

  const handleRevokeKey = (key: LicenseKey) => {
    Alert.alert(
      'Revoke License Key',
      `Delete key ${key.key}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/licenses/keys/${key.id}`);
              fetchAllData();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to revoke key.');
            }
          },
        },
      ]
    );
  };

  // ─── BROADCAST ACTIONS ─────────────────────────────────────────────────────

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      Alert.alert('Missing Info', 'Please enter both a title and announcement message.');
      return;
    }

    try {
      setIsBroadcasting(true);
      await api.post('/admin/broadcast', {
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        priority: 'HIGH',
      });

      Alert.alert('Broadcast Sent', 'Announcement has been dispatched to all active users.');
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send broadcast.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    if (userFilter === 'admins' && u.role !== 'ADMIN') return false;
    if (userFilter === 'members' && u.role === 'ADMIN') return false;
    if (userFilter === 'suspended' && u.isActive) return false;

    if (!userSearch.trim()) return true;
    const term = userSearch.toLowerCase();
    return (
      u.username?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.profile?.displayName?.toLowerCase().includes(term) ||
      u.role?.toLowerCase().includes(term)
    );
  });

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: '#090D16', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 52, marginBottom: 16 }}>🔒</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#F1F5F9', marginBottom: 8, textAlign: 'center' }}>
          Restricted System Area
        </Text>
        <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 28, lineHeight: 22, maxWidth: 320 }}>
          This administration hub is strictly reserved for verified System Administrators. Standard member accounts cannot access this area.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, elevation: 4 }}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>← Return to CallFar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>System Admin Hub</Text>
          <Text style={styles.headerSubtitle}>Master Control & License Center</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* ── Master License Banner ─────────────────────────────────────────── */}
      <View style={styles.masterBanner}>
        <View style={styles.masterBadge}>
          <Text style={styles.masterBadgeText}>🛡️ MASTER ADMIN</Text>
        </View>
        <Text style={styles.masterDesc}>
          All system licenses, unlimited voice/video, TURN relay, and user management privileges unlocked.
        </Text>
      </View>

      {/* ── Navigation Tabs ───────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
        {(['overview', 'users', 'licenses', 'telecom', 'audit'] as AdminTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'overview' && '📊 Stats'}
              {tab === 'users' && `👥 Users (${users.length})`}
              {tab === 'licenses' && `🔑 Keys (${licenseKeys.length})`}
              {tab === 'telecom' && `📶 Telecom (${pstnLogs.length})`}
              {tab === 'audit' && '📡 Broadcast'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Content View ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={styles.loaderText}>Loading system console...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.contentScroll}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={THEME.colors.primary} />}
        >
          {/* ════ TAB 1: OVERVIEW ════ */}
          {activeTab === 'overview' && stats && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionHeading}>Live Platform Overview</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>👥</Text>
                  <Text style={styles.statValue}>{stats.overview.totalUsers}</Text>
                  <Text style={styles.statLabel}>Total Users</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>🟢</Text>
                  <Text style={styles.statValue}>{stats.overview.onlineUsers}</Text>
                  <Text style={styles.statLabel}>Online Now</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>📞</Text>
                  <Text style={styles.statValue}>{stats.calling.totalCalls}</Text>
                  <Text style={styles.statLabel}>Total Calls</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>💬</Text>
                  <Text style={styles.statValue}>{stats.messaging.totalMessages}</Text>
                  <Text style={styles.statLabel}>Messages Sent</Text>
                </View>
              </View>

              <Text style={styles.sectionHeading}>License Tiers Active</Text>
              <View style={styles.licenseCard}>
                <View style={styles.licenseRow}>
                  <Text style={styles.licenseName}>🛡️ Master Admin</Text>
                  <Text style={styles.licenseCount}>{stats.licensing.tiers.MASTER_ADMIN || 0}</Text>
                </View>
                <View style={styles.licenseRow}>
                  <Text style={styles.licenseName}>💎 Enterprise Tier</Text>
                  <Text style={styles.licenseCount}>{stats.licensing.tiers.ENTERPRISE || 0}</Text>
                </View>
                <View style={styles.licenseRow}>
                  <Text style={styles.licenseName}>⚡ Pro Tier</Text>
                  <Text style={styles.licenseCount}>{stats.licensing.tiers.PRO || 0}</Text>
                </View>
                <View style={styles.licenseRow}>
                  <Text style={styles.licenseName}>🌱 Free Tier</Text>
                  <Text style={styles.licenseCount}>{stats.licensing.tiers.FREE || 0}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.licenseRow}>
                  <Text style={styles.licenseName}>🔑 Keys Redeemed</Text>
                  <Text style={styles.licenseHighlight}>
                    {stats.licensing.keysRedeemed} / {stats.licensing.totalKeysGenerated}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionHeading}>System Health & Server</Text>
              <View style={styles.serverCard}>
                <View style={styles.serverRow}>
                  <Text style={styles.serverLabel}>Status:</Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>● {stats.systemHealth.status}</Text>
                  </View>
                </View>
                <View style={styles.serverRow}>
                  <Text style={styles.serverLabel}>Uptime:</Text>
                  <Text style={styles.serverVal}>{stats.systemHealth.uptimeFormatted}</Text>
                </View>
                <View style={styles.serverRow}>
                  <Text style={styles.serverLabel}>Node.js Engine:</Text>
                  <Text style={styles.serverVal}>{stats.systemHealth.nodeVersion}</Text>
                </View>
                <View style={styles.serverRow}>
                  <Text style={styles.serverLabel}>Platform:</Text>
                  <Text style={styles.serverVal}>{stats.systemHealth.platform}</Text>
                </View>
                <View style={styles.serverRow}>
                  <Text style={styles.serverLabel}>Memory RSS:</Text>
                  <Text style={styles.serverVal}>{stats.systemHealth.memoryUsageMB.rss} MB</Text>
                </View>
              </View>
            </View>
          )}

          {/* ════ TAB 2: USERS MANAGEMENT ════ */}
          {activeTab === 'users' && (
            <View style={styles.tabContent}>
              {/* Header with Add Button */}
              <View style={styles.userSectionHeader}>
                <View>
                  <Text style={styles.sectionHeading}>User Directory ({users.length})</Text>
                  <Text style={styles.sectionSub}>Manage accounts, elevate roles, and configure licenses</Text>
                </View>
                <TouchableOpacity
                  style={styles.addUserHeaderBtn}
                  onPress={() => setIsCreateUserModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addUserHeaderBtnText}>+ Add Account</Text>
                </TouchableOpacity>
              </View>

              {/* Filter Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
                <TouchableOpacity
                  style={[styles.filterPill, userFilter === 'all' && styles.filterPillActive]}
                  onPress={() => setUserFilter('all')}
                >
                  <Text style={[styles.filterPillText, userFilter === 'all' && styles.filterPillTextActive]}>
                    All ({users.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, userFilter === 'admins' && styles.filterPillActiveAdmin]}
                  onPress={() => setUserFilter('admins')}
                >
                  <Text style={[styles.filterPillText, userFilter === 'admins' && styles.filterPillTextActiveAdmin]}>
                    🛡️ Admins ({users.filter((u) => u.role === 'ADMIN').length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, userFilter === 'members' && styles.filterPillActive]}
                  onPress={() => setUserFilter('members')}
                >
                  <Text style={[styles.filterPillText, userFilter === 'members' && styles.filterPillTextActive]}>
                    👤 Members ({users.filter((u) => u.role !== 'ADMIN').length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, userFilter === 'suspended' && styles.filterPillActiveDanger]}
                  onPress={() => setUserFilter('suspended')}
                >
                  <Text style={[styles.filterPillText, userFilter === 'suspended' && styles.filterPillTextActiveDanger]}>
                    🚫 Suspended ({users.filter((u) => !u.isActive).length})
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search user by name, email, role..."
                  placeholderTextColor={THEME.colors.textMuted}
                  value={userSearch}
                  onChangeText={setUserSearch}
                />
                {userSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setUserSearch('')}>
                    <Text style={styles.searchClear}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {filteredUsers.map((u) => {
                const isOnline = u.profile?.isOnline;
                const tier = u.license?.tier || 'FREE';
                const isAdmin = u.role === 'ADMIN';

                return (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.userCard, !u.isActive && styles.userCardSuspended]}
                    onPress={() => {
                      setSelectedUser(u);
                      setSelectedTierForUser(tier as LicenseTier);
                      setIsUserActionModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.userCardAvatarWrap}>
                      <Avatar
                        url={u.profile?.avatarUrl}
                        name={u.profile?.displayName || u.username}
                        size={46}
                        isOnline={isOnline}
                      />
                    </View>

                    <View style={styles.userCardInfo}>
                      <View style={styles.userNameRow}>
                        <Text style={styles.userDisplayName} numberOfLines={1}>
                          {u.profile?.displayName || u.username}
                        </Text>
                        {isAdmin && <View style={styles.adminTag}><Text style={styles.adminTagText}>ADMIN</Text></View>}
                      </View>
                      <Text style={styles.userMeta} numberOfLines={1}>
                        @{u.username} • {u.email}
                      </Text>

                      <View style={styles.userBadgeRow}>
                        <View style={[styles.tierBadge, tier === 'MASTER_ADMIN' && styles.tierBadgeMaster, tier === 'PRO' && styles.tierBadgePro, tier === 'ENTERPRISE' && styles.tierBadgeEnt]}>
                          <Text style={styles.tierBadgeText}>{tier}</Text>
                        </View>
                        {!u.isActive && (
                          <View style={styles.suspendedBadge}>
                            <Text style={styles.suspendedBadgeText}>SUSPENDED</Text>
                          </View>
                        )}
                        <Text style={styles.callCountText}>
                          📞 {u._count?.initiatedCalls || 0} calls • 💬 {u._count?.messages || 0} msgs
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.userActionChevron}>⋮</Text>
                  </TouchableOpacity>
                );
              })}

              {filteredUsers.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.emptyText}>No users matched your search.</Text>
                </View>
              )}
            </View>
          )}

          {/* ════ TAB 3: LICENSES & KEYS ════ */}
          {activeTab === 'licenses' && (
            <View style={styles.tabContent}>
              <TouchableOpacity
                style={styles.genKeyBtn}
                onPress={() => setIsGenKeyModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.genKeyBtnText}>+ Generate License Keys</Text>
              </TouchableOpacity>

              <Text style={styles.sectionHeading}>Active & Generated Keys ({licenseKeys.length})</Text>

              {licenseKeys.map((k) => (
                <View key={k.id} style={styles.keyCard}>
                  <View style={styles.keyHeader}>
                    <Text style={styles.keyCode}>{k.key}</Text>
                    <View style={[styles.tierBadge, k.tier === 'ENTERPRISE' ? styles.tierBadgeEnt : styles.tierBadgePro]}>
                      <Text style={styles.tierBadgeText}>{k.tier}</Text>
                    </View>
                  </View>

                  <View style={styles.keyMetaRow}>
                    <Text style={styles.keyDuration}>
                      ⏱ {k.durationDays === -1 ? 'Lifetime' : `${k.durationDays} Days`}
                    </Text>
                    <Text style={k.isRedeemed ? styles.keyRedeemedText : styles.keyAvailableText}>
                      {k.isRedeemed ? `Redeemed by @${k.redeemer?.username || 'User'}` : '🟢 Available'}
                    </Text>
                  </View>

                  {k.notes ? <Text style={styles.keyNotes}>Note: {k.notes}</Text> : null}

                  <View style={styles.keyActionsRow}>
                    <TouchableOpacity
                      style={styles.copyKeyBtn}
                      onPress={() => {
                        Clipboard.setString(k.key);
                        Alert.alert('Copied', `License key ${k.key} copied to clipboard!`);
                      }}
                    >
                      <Text style={styles.copyKeyBtnText}>📋 Copy Key</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.revokeKeyBtn}
                      onPress={() => handleRevokeKey(k)}
                    >
                      <Text style={styles.revokeKeyBtnText}>🗑 Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {licenseKeys.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🔑</Text>
                  <Text style={styles.emptyText}>No license keys generated yet.</Text>
                </View>
              )}
            </View>
          )}

          {/* ════ TAB 4: TELECOM & CELLULAR GATEWAY ════ */}
          {activeTab === 'telecom' && (
            <View style={styles.tabContent}>
              {/* Telecom Gateway Hub Overview */}
              <View style={styles.telecomHubCard}>
                <View style={styles.telecomHubHeader}>
                  <View style={styles.telecomIconBox}>
                    <Text style={styles.telecomIcon}>📶</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.telecomHubTitle}>Cellular PSTN & GSM Gateway</Text>
                    <Text style={styles.telecomHubSub}>
                      Direct telecom interconnect for MTN, Airtel, Tigo & Global Telcos
                    </Text>
                  </View>
                </View>

                <View style={styles.telecomStatusRow}>
                  <View style={styles.telecomStatusBadge}>
                    <Text style={styles.telecomStatusText}>● GATEWAY ONLINE</Text>
                  </View>
                  <Text style={styles.telecomProviderText}>
                    Engine: {telecomConfig?.activeProvider || "Africa's Talking / Twilio"}
                  </Text>
                </View>

                {/* Direct Launch Button */}
                <TouchableOpacity
                  style={styles.telecomLaunchBtn}
                  onPress={() => navigation.navigate('Dialpad' as never)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.telecomLaunchBtnText}>📞 Launch Cellular Dialpad →</Text>
                </TouchableOpacity>
              </View>

              {/* Supported Networks & Routing */}
              <Text style={styles.sectionHeading}>Carrier Routing Matrix</Text>
              <View style={styles.carrierMatrix}>
                <View style={[styles.carrierCard, { borderColor: '#FBBF2460' }]}>
                  <View style={styles.carrierTop}>
                    <Text style={styles.carrierFlag}>🇷🇼</Text>
                    <View style={[styles.carrierPill, { backgroundColor: '#FBBF2425' }]}>
                      <Text style={[styles.carrierPillText, { color: '#FBBF24' }]}>MTN RWANDA</Text>
                    </View>
                  </View>
                  <Text style={styles.carrierPrefixes}>Prefixes: 078, 079, 0788, 0789</Text>
                  <Text style={styles.carrierRate}>Base Rate: $0.045 / min • Direct GSM</Text>
                </View>

                <View style={[styles.carrierCard, { borderColor: '#EF444460' }]}>
                  <View style={styles.carrierTop}>
                    <Text style={styles.carrierFlag}>🇷🇼</Text>
                    <View style={[styles.carrierPill, { backgroundColor: '#EF444425' }]}>
                      <Text style={[styles.carrierPillText, { color: '#EF4444' }]}>AIRTEL-TIGO</Text>
                    </View>
                  </View>
                  <Text style={styles.carrierPrefixes}>Prefixes: 072, 073, 0722, 0730</Text>
                  <Text style={styles.carrierRate}>Base Rate: $0.045 / min • Direct GSM</Text>
                </View>

                <View style={[styles.carrierCard, { borderColor: '#10B98160' }]}>
                  <View style={styles.carrierTop}>
                    <Text style={styles.carrierFlag}>🌍</Text>
                    <View style={[styles.carrierPill, { backgroundColor: '#10B98125' }]}>
                      <Text style={[styles.carrierPillText, { color: '#10B981' }]}>EAST AFRICA</Text>
                    </View>
                  </View>
                  <Text style={styles.carrierPrefixes}>Safaricom Kenya (+254), MTN Uganda (+256)</Text>
                  <Text style={styles.carrierRate}>Regional Trunk: $0.055 - $0.065 / min</Text>
                </View>

                <View style={[styles.carrierCard, { borderColor: '#38BDF860' }]}>
                  <View style={styles.carrierTop}>
                    <Text style={styles.carrierFlag}>🌐</Text>
                    <View style={[styles.carrierPill, { backgroundColor: '#38BDF825' }]}>
                      <Text style={[styles.carrierPillText, { color: '#38BDF8' }]}>INTERNATIONAL</Text>
                    </View>
                  </View>
                  <Text style={styles.carrierPrefixes}>USA, UK, Canada, France, Germany (240+ countries)</Text>
                  <Text style={styles.carrierRate}>Global Tier: From $0.015 / min</Text>
                </View>
              </View>

              {/* PSTN Calls Audit Header */}
              <View style={styles.userSectionHeader}>
                <View>
                  <Text style={styles.sectionHeading}>Cellular Call Logs ({pstnLogs.length})</Text>
                  <Text style={styles.sectionSub}>All cellular numbers dialed across the system</Text>
                </View>
              </View>

              {/* Telecom Filter Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
                <TouchableOpacity
                  style={[styles.filterPill, telecomFilter === 'all' && styles.filterPillActive]}
                  onPress={() => setTelecomFilter('all')}
                >
                  <Text style={[styles.filterPillText, telecomFilter === 'all' && styles.filterPillTextActive]}>
                    All ({pstnLogs.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, telecomFilter === 'rwanda' && styles.filterPillActiveAdmin]}
                  onPress={() => setTelecomFilter('rwanda')}
                >
                  <Text style={[styles.filterPillText, telecomFilter === 'rwanda' && styles.filterPillTextActiveAdmin]}>
                    🇷🇼 Rwanda ({pstnLogs.filter((l) => l.countryName === 'Rwanda').length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, telecomFilter === 'eastafrica' && styles.filterPillActive]}
                  onPress={() => setTelecomFilter('eastafrica')}
                >
                  <Text style={[styles.filterPillText, telecomFilter === 'eastafrica' && styles.filterPillTextActive]}>
                    🌍 East Africa ({pstnLogs.filter((l) => ['Kenya', 'Uganda', 'Tanzania'].includes(l.countryName)).length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, telecomFilter === 'international' && styles.filterPillActive]}
                  onPress={() => setTelecomFilter('international')}
                >
                  <Text style={[styles.filterPillText, telecomFilter === 'international' && styles.filterPillTextActive]}>
                    🌐 Global ({pstnLogs.filter((l) => !['Rwanda', 'Kenya', 'Uganda', 'Tanzania'].includes(l.countryName)).length})
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* PSTN Logs List */}
              {pstnLogs
                .filter((l) => {
                  if (telecomFilter === 'rwanda') return l.countryName === 'Rwanda';
                  if (telecomFilter === 'eastafrica') return ['Kenya', 'Uganda', 'Tanzania'].includes(l.countryName);
                  if (telecomFilter === 'international') return !['Rwanda', 'Kenya', 'Uganda', 'Tanzania'].includes(l.countryName);
                  return true;
                })
                .map((log) => {
                  let carrierBg = '#38BDF825';
                  let carrierFg = '#38BDF8';
                  if (log.carrierBrand === 'MTN') {
                    carrierBg = '#FBBF2425';
                    carrierFg = '#FBBF24';
                  } else if (log.carrierBrand === 'AIRTEL' || log.carrierBrand === 'TIGO') {
                    carrierBg = '#EF444425';
                    carrierFg = '#EF4444';
                  } else if (log.carrierBrand === 'SAFARICOM') {
                    carrierBg = '#10B98125';
                    carrierFg = '#10B981';
                  }

                  return (
                    <View key={log.id} style={styles.pstnAuditCard}>
                      <View style={styles.pstnAuditTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Text style={styles.pstnAuditFlag}>{log.countryFlag || '🌐'}</Text>
                          <View style={{ marginLeft: 10 }}>
                            <Text style={styles.pstnAuditNumber}>{log.destinationNumber}</Text>
                            <Text style={styles.pstnAuditCountry}>{log.countryName}</Text>
                          </View>
                        </View>
                        <View style={[styles.carrierPill, { backgroundColor: carrierBg }]}>
                          <Text style={[styles.carrierPillText, { color: carrierFg }]}>
                            {log.carrierName || log.carrierBrand || 'Cellular'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.pstnAuditDetails}>
                        <Text style={styles.pstnAuditUser}>
                          Caller: <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>@{log.callerUsername || 'User'}</Text>
                        </Text>
                        <Text style={styles.pstnAuditMeta}>
                          {log.durationSeconds}s • ${log.costTotal ? log.costTotal.toFixed(3) : '0.000'} • {log.status}
                        </Text>
                      </View>
                    </View>
                  );
                })}

              {pstnLogs.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📶</Text>
                  <Text style={styles.emptyText}>No cellular calls placed yet.</Text>
                  <TouchableOpacity
                    style={[styles.telecomLaunchBtn, { marginTop: 12, width: 'auto', paddingHorizontal: 20 }]}
                    onPress={() => navigation.navigate('Dialpad' as never)}
                  >
                    <Text style={styles.telecomLaunchBtnText}>📞 Open Cellular Dialpad</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ════ TAB 5: AUDIT & BROADCAST ════ */}
          {activeTab === 'audit' && (
            <View style={styles.tabContent}>
              {/* Broadcast Form */}
              <View style={styles.broadcastCard}>
                <Text style={styles.broadcastTitle}>📢 System Broadcast Announcement</Text>
                <Text style={styles.broadcastSub}>
                  Push a real-time banner notification to all connected users right now.
                </Text>

                <TextInput
                  style={styles.broadcastInput}
                  placeholder="Announcement Title (e.g., Scheduled Maintenance)"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={broadcastTitle}
                  onChangeText={setBroadcastTitle}
                />

                <TextInput
                  style={[styles.broadcastInput, styles.broadcastArea]}
                  placeholder="Message body..."
                  placeholderTextColor={THEME.colors.textMuted}
                  multiline
                  numberOfLines={3}
                  value={broadcastMessage}
                  onChangeText={setBroadcastMessage}
                />

                <TouchableOpacity
                  style={[styles.sendBroadcastBtn, isBroadcasting && { opacity: 0.7 }]}
                  onPress={handleSendBroadcast}
                  disabled={isBroadcasting}
                >
                  {isBroadcasting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.sendBroadcastBtnText}>🚀 Dispatch Announcement</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Call Audit Records */}
              <Text style={styles.sectionHeading}>Global Call Audit Log</Text>
              {recentCalls.map((call) => (
                <View key={call.id} style={styles.callAuditCard}>
                  <View style={styles.callAuditHeader}>
                    <Text style={styles.callAuditType}>
                      {call.callType === 'VIDEO' ? '📹 Video Call' : '📞 Voice Call'}
                    </Text>
                    <View style={[styles.callStatusBadge, call.status === 'COMPLETED' ? styles.callStatusCompleted : styles.callStatusOther]}>
                      <Text style={styles.callStatusBadgeText}>{call.status}</Text>
                    </View>
                  </View>

                  <Text style={styles.callAuditUsers}>
                    Caller: <Text style={{ color: THEME.colors.textPrimary, fontWeight: '700' }}>@{call.initiator?.username}</Text>
                  </Text>
                  <Text style={styles.callAuditMeta}>
                    Duration: {call.durationSeconds}s • Started: {new Date(call.startedAt).toLocaleTimeString()}
                  </Text>
                </View>
              ))}

              {recentCalls.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📞</Text>
                  <Text style={styles.emptyText}>No call activity recorded yet.</Text>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── USER ACTION MODAL ──────────────────────────────────────────────── */}
      <Modal visible={isUserActionModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>User Controls</Text>
              <TouchableOpacity onPress={() => setIsUserActionModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <View style={styles.selectedUserBanner}>
                <Avatar
                  url={selectedUser.profile?.avatarUrl}
                  name={selectedUser.profile?.displayName || selectedUser.username}
                  size={50}
                />
                <View style={{ marginLeft: 14, flex: 1 }}>
                  <Text style={styles.selectedUserName}>{selectedUser.profile?.displayName || selectedUser.username}</Text>
                  <Text style={styles.selectedUserHandle}>@{selectedUser.username} • {selectedUser.email}</Text>
                  <Text style={styles.selectedUserRole}>
                    Role: {selectedUser.role} | Tier: {selectedUser.license?.tier || 'FREE'}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: THEME.colors.primary }]}
                onPress={() => {
                  setIsLicenseModalVisible(true);
                }}
              >
                <Text style={styles.modalBtnText}>🏷️ Modify License Tier</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: selectedUser?.role === 'ADMIN' ? '#64748B' : '#8B5CF6' }]}
                onPress={() => handleToggleUserRole(selectedUser)}
              >
                <Text style={styles.modalBtnText}>
                  {selectedUser?.role === 'ADMIN' ? '⬇️ Demote to Member' : '⬆️ Promote to System Admin'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: selectedUser?.isActive ? '#D97706' : '#10B981' }]}
                onPress={() => handleToggleUserStatus(selectedUser)}
              >
                <Text style={styles.modalBtnText}>
                  {selectedUser?.isActive ? '🚫 Suspend / Ban User' : '✅ Re-activate User'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#EF4444' }]}
                onPress={() => handleDeleteUser(selectedUser)}
              >
                <Text style={styles.modalBtnText}>🗑 Permanently Delete User</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── LICENSE CUSTOMIZER MODAL ──────────────────────────────────────── */}
      <Modal visible={isLicenseModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign License Tier</Text>
              <TouchableOpacity onPress={() => setIsLicenseModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Select Tier:</Text>
            <View style={styles.tierSelectRow}>
              {(['FREE', 'PRO', 'ENTERPRISE', 'MASTER_ADMIN'] as LicenseTier[]).map((tier) => (
                <TouchableOpacity
                  key={tier}
                  style={[styles.tierOption, selectedTierForUser === tier && styles.tierOptionActive]}
                  onPress={() => setSelectedTierForUser(tier)}
                >
                  <Text style={[styles.tierOptionText, selectedTierForUser === tier && styles.tierOptionTextActive]}>
                    {tier}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Duration:</Text>
            <View style={styles.tierSelectRow}>
              {[
                { label: '30 Days', val: 30 },
                { label: '90 Days', val: 90 },
                { label: '1 Year', val: 365 },
                { label: 'Permanent', val: -1 },
              ].map((d) => (
                <TouchableOpacity
                  key={d.val}
                  style={[styles.tierOption, selectedDurationDays === d.val && styles.tierOptionActive]}
                  onPress={() => setSelectedDurationDays(d.val)}
                >
                  <Text style={[styles.tierOptionText, selectedDurationDays === d.val && styles.tierOptionTextActive]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveLicenseBtn} onPress={handleSaveUserLicense}>
              <Text style={styles.saveLicenseBtnText}>Apply License to User</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── GENERATE KEYS MODAL ────────────────────────────────────────────── */}
      <Modal visible={isGenKeyModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate License Keys</Text>
              <TouchableOpacity onPress={() => setIsGenKeyModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Tier to Grant:</Text>
            <View style={styles.tierSelectRow}>
              {(['PRO', 'ENTERPRISE'] as LicenseTier[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tierOption, genTier === t && styles.tierOptionActive]}
                  onPress={() => setGenTier(t)}
                >
                  <Text style={[styles.tierOptionText, genTier === t && styles.tierOptionTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Duration:</Text>
            <View style={styles.tierSelectRow}>
              {[
                { label: '30 Days', val: 30 },
                { label: '90 Days', val: 90 },
                { label: '365 Days', val: 365 },
                { label: 'Lifetime', val: -1 },
              ].map((d) => (
                <TouchableOpacity
                  key={d.val}
                  style={[styles.tierOption, genDurationDays === d.val && styles.tierOptionActive]}
                  onPress={() => setGenDurationDays(d.val)}
                >
                  <Text style={[styles.tierOptionText, genDurationDays === d.val && styles.tierOptionTextActive]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Quantity:</Text>
            <View style={styles.tierSelectRow}>
              {[1, 3, 5, 10].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[styles.tierOption, genCount === num && styles.tierOptionActive]}
                  onPress={() => setGenCount(num)}
                >
                  <Text style={[styles.tierOptionText, genCount === num && styles.tierOptionTextActive]}>
                    {num} Key{num > 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Notes / Purpose (Optional):</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Community Giveaway, VIP Beta Access"
              placeholderTextColor={THEME.colors.textMuted}
              value={genNotes}
              onChangeText={setGenNotes}
            />

            <TouchableOpacity style={styles.saveLicenseBtn} onPress={handleGenerateKeys}>
              <Text style={styles.saveLicenseBtnText}>✨ Generate & Copy Keys</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── CREATE USER / ADMIN MODAL ─────────────────────────────────────── */}
      <Modal visible={isCreateUserModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✨ Provision New Account</Text>
              <TouchableOpacity onPress={() => setIsCreateUserModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Select Account Role:</Text>
              <View style={styles.roleChoiceRow}>
                <TouchableOpacity
                  style={[styles.roleChoiceBtn, newRole === 'MEMBER' && styles.roleChoiceBtnActive]}
                  onPress={() => {
                    setNewRole('MEMBER');
                    if (newTier === 'MASTER_ADMIN') setNewTier('PRO');
                  }}
                >
                  <Text style={[styles.roleChoiceText, newRole === 'MEMBER' && styles.roleChoiceTextActive]}>
                    👤 Standard Member
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleChoiceBtn, newRole === 'ADMIN' && styles.roleChoiceBtnActiveAdmin]}
                  onPress={() => {
                    setNewRole('ADMIN');
                    setNewTier('MASTER_ADMIN');
                  }}
                >
                  <Text style={[styles.roleChoiceText, newRole === 'ADMIN' && styles.roleChoiceTextActiveAdmin]}>
                    🛡️ System Admin
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>License Tier:</Text>
              <View style={styles.tierSelectRow}>
                {(['FREE', 'PRO', 'ENTERPRISE', 'MASTER_ADMIN'] as LicenseTier[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tierOption, newTier === t && styles.tierOptionActive]}
                    onPress={() => setNewTier(t)}
                  >
                    <Text style={[styles.tierOptionText, newTier === t && styles.tierOptionTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Jordan Miller"
                placeholderTextColor={THEME.colors.textMuted}
                value={newFullName}
                onChangeText={setNewFullName}
              />

              <Text style={styles.inputLabel}>Username *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. jordan"
                placeholderTextColor={THEME.colors.textMuted}
                value={newUsername}
                onChangeText={(t) => setNewUsername(t.replace(/[^a-zA-Z0-9_]/g, ''))}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. jordan@callfar.app"
                placeholderTextColor={THEME.colors.textMuted}
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Password *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Min 8 chars, 1 uppercase, 1 digit"
                placeholderTextColor={THEME.colors.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />

              <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. +14155551234"
                placeholderTextColor={THEME.colors.textMuted}
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[styles.saveLicenseBtn, { backgroundColor: newRole === 'ADMIN' ? '#D97706' : '#2563EB' }, isCreatingUser && { opacity: 0.7 }]}
                onPress={handleCreateUser}
                disabled={isCreatingUser}
              >
                {isCreatingUser ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveLicenseBtnText}>
                    {newRole === 'ADMIN' ? '👑 Provision Administrator' : '🚀 Create User Account'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backButton: {
    padding: 6,
    marginRight: 10,
  },
  backButtonText: {
    fontSize: 24,
    color: '#94A3B8',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
  },
  refreshButton: {
    padding: 8,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  refreshIcon: {
    fontSize: 16,
  },
  masterBanner: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  masterBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  masterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  masterDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    marginHorizontal: 3,
  },
  tabButtonActive: {
    backgroundColor: '#2563EB',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contentScroll: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94A3B8',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F1F5F9',
    marginTop: 16,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  licenseCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  licenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  licenseName: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  licenseCount: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: '700',
  },
  licenseHighlight: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 6,
  },
  serverCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  serverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  serverLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  serverVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  statusPill: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    padding: 0,
  },
  searchClear: {
    color: '#94A3B8',
    fontSize: 16,
    paddingHorizontal: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  userCardSuspended: {
    opacity: 0.6,
    borderColor: '#B91C1C',
  },
  userCardAvatarWrap: {
    marginRight: 12,
  },
  userCardInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userDisplayName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginRight: 6,
  },
  adminTag: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  userMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  userBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  tierBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  tierBadgePro: {
    backgroundColor: '#2563EB',
  },
  tierBadgeEnt: {
    backgroundColor: '#D97706',
  },
  tierBadgeMaster: {
    backgroundColor: '#059669',
  },
  tierBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  suspendedBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  suspendedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  callCountText: {
    fontSize: 10,
    color: '#64748B',
  },
  userActionChevron: {
    fontSize: 20,
    color: '#94A3B8',
    paddingLeft: 8,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  genKeyBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  genKeyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  keyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  keyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keyCode: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  keyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  keyDuration: {
    fontSize: 12,
    color: '#94A3B8',
  },
  keyRedeemedText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  keyAvailableText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  keyNotes: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontStyle: 'italic',
  },
  keyActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  copyKeyBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyKeyBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  revokeKeyBtn: {
    backgroundColor: '#450A0A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  revokeKeyBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  broadcastCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  broadcastTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#38BDF8',
  },
  broadcastSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 12,
  },
  broadcastInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  broadcastArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  sendBroadcastBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sendBroadcastBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  callAuditCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  callAuditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  callAuditType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  callStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  callStatusCompleted: {
    backgroundColor: '#065F46',
  },
  callStatusOther: {
    backgroundColor: '#7F1D1D',
  },
  callStatusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  callAuditUsers: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  callAuditMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#94A3B8',
    padding: 4,
  },
  selectedUserBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  selectedUserName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  selectedUserHandle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  selectedUserRole: {
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 4,
    fontWeight: '600',
  },
  modalActionButtons: {
    gap: 10,
  },
  modalBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
    fontWeight: '600',
  },
  tierSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  tierOption: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tierOptionActive: {
    backgroundColor: '#2563EB',
    borderColor: '#38BDF8',
  },
  tierOptionText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  tierOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  saveLicenseBtn: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveLicenseBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  userSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  addUserHeaderBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  addUserHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  filterPillsScroll: {
    paddingBottom: 10,
    gap: 8,
  },
  filterPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#38BDF8',
  },
  filterPillActiveAdmin: {
    backgroundColor: '#D97706',
    borderColor: '#F59E0B',
  },
  filterPillActiveDanger: {
    backgroundColor: '#991B1B',
    borderColor: '#EF4444',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterPillTextActiveAdmin: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterPillTextActiveDanger: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  roleChoiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  roleChoiceBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChoiceBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#38BDF8',
  },
  roleChoiceBtnActiveAdmin: {
    backgroundColor: '#D97706',
    borderColor: '#F59E0B',
  },
  roleChoiceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  roleChoiceTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  roleChoiceTextActiveAdmin: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  telecomHubCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2563EB40',
    marginBottom: 20,
  },
  telecomHubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  telecomIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563EB20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  telecomIcon: {
    fontSize: 22,
  },
  telecomHubTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  telecomHubSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  telecomStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  telecomStatusBadge: {
    backgroundColor: '#10B98125',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  telecomStatusText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },
  telecomProviderText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  telecomLaunchBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  telecomLaunchBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  carrierMatrix: {
    gap: 10,
    marginBottom: 20,
  },
  carrierCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  carrierTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  carrierFlag: {
    fontSize: 20,
  },
  carrierPrefixes: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  carrierRate: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  carrierPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  carrierPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  pstnAuditCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 10,
  },
  pstnAuditTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pstnAuditFlag: {
    fontSize: 24,
  },
  pstnAuditNumber: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  pstnAuditCountry: {
    color: '#94A3B8',
    fontSize: 11,
  },
  pstnAuditDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  pstnAuditUser: {
    color: '#94A3B8',
    fontSize: 12,
  },
  pstnAuditMeta: {
    color: '#64748B',
    fontSize: 11,
  },
});
