import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { api, getLanPeers } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { useSocket } from '../../context/SocketContext';
import { Contact, ContactRequest } from '../../types';
import { THEME } from '../../styles/theme';
import { Avatar } from '../../components/common/Avatar';
import { NetworkManagerModal } from '../../components/common/NetworkManagerModal';

// ─── Animated Add Button ────────────────────────────────────────────────────
const AddButton = ({ onPress, sent }: { onPress: () => void; sent: boolean }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18 }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={[styles.addBtn, sent && styles.addBtnSent]}
      >
        <Text style={styles.addBtnText}>{sent ? '✓ Sent' : '+ Add'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Professional Search & Discover Result Card ─────────────────────────────
const SearchCard = ({
  item,
  sentIds,
  onAdd,
  onChat,
  onVoice,
  onVideo,
}: {
  item: any;
  sentIds: Set<string>;
  onAdd: (username: string, id: string) => void;
  onChat: (item: any) => void;
  onVoice: (item: any) => void;
  onVideo: (item: any) => void;
}) => {
  const isSent = sentIds.has(item.id);
  const name = item.profile?.displayName || item.username;

  return (
    <View style={styles.searchCard}>
      <Avatar
        name={name}
        url={item.profile?.avatarUrl}
        size={48}
        isOnline={item.profile?.isOnline}
      />
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.cardUsername}>@{item.username}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {item.role === 'ADMIN' || item.username === 'alice' ? (
            <Text style={styles.attendantBadgeText}>⚡ 24/7 AI Attendant</Text>
          ) : item.profile?.isOnline ? (
            <Text style={styles.onlineBadgeText}>🟢 Online</Text>
          ) : (
            <Text style={styles.offlineBadgeText}>CallFar User</Text>
          )}
          {item.isSameNetwork ? (
            <View style={styles.sameLanBadge}>
              <Text style={styles.sameLanBadgeText}>🟢 Same Wi-Fi</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.searchActionGroup}>
        {/* SMS / Chat */}
        <TouchableOpacity
          style={[styles.iconBtn, styles.chatBtn]}
          onPress={() => onChat(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.iconText}>💬</Text>
        </TouchableOpacity>

        {/* Voice Call */}
        <TouchableOpacity
          style={[styles.iconBtn, styles.voiceBtn]}
          onPress={() => onVoice(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.iconText}>📞</Text>
        </TouchableOpacity>

        {/* Video Call */}
        <TouchableOpacity
          style={[styles.iconBtn, styles.videoBtn]}
          onPress={() => onVideo(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.iconText}>📹</Text>
        </TouchableOpacity>

        {/* Add Contact */}
        <AddButton sent={isSent} onPress={() => onAdd(item.username, item.id)} />
      </View>
    </View>
  );
};

// ─── Contact Row ─────────────────────────────────────────────────────────────
const ContactRow = ({
  contact,
  onChat,
  onVoice,
  onVideo,
  onLongPress,
  isSameNetwork,
}: {
  contact: Contact;
  onChat: () => void;
  onVoice: () => void;
  onVideo: () => void;
  onLongPress: () => void;
  isSameNetwork?: boolean;
}) => (
  <TouchableOpacity
    style={styles.contactRow}
    onPress={onChat}
    onLongPress={onLongPress}
    delayLongPress={350}
    activeOpacity={0.75}
  >
    <Avatar
      name={contact.displayName}
      url={contact.avatarUrl}
      size={50}
      isOnline={contact.isOnline}
    />
    <View style={styles.cardInfo}>
      <Text style={styles.cardName}>{contact.displayName}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <Text style={styles.cardUsername}>@{contact.username}</Text>
        {isSameNetwork ? (
          <View style={styles.sameLanBadge}>
            <Text style={styles.sameLanBadgeText}>🟢 Same Wi-Fi</Text>
          </View>
        ) : null}
      </View>
    </View>
    <View style={styles.actionBtns}>
      <TouchableOpacity style={styles.iconBtn} onPress={onChat}>
        <Text style={styles.iconText}>💬</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.iconBtn, styles.voiceBtn]} onPress={onVoice}>
        <Text style={styles.iconText}>📞</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.iconBtn, styles.videoBtn]} onPress={onVideo}>
        <Text style={styles.iconText}>📹</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.iconBtn, { backgroundColor: THEME.colors.surfaceHover }]}
        onPress={onLongPress}
      >
        <Text style={{ fontSize: 16, color: THEME.colors.textMuted }}>⋮</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
);

// ─── Request Row ─────────────────────────────────────────────────────────────
const RequestRow = ({
  req,
  onAccept,
  onReject,
}: {
  req: ContactRequest;
  onAccept: () => void;
  onReject: () => void;
}) => (
  <View style={styles.requestRow}>
    <Avatar
      name={req.sender?.profile?.displayName || req.sender?.username || 'User'}
      url={req.sender?.profile?.avatarUrl}
      size={44}
    />
    <View style={styles.cardInfo}>
      <Text style={styles.cardName}>
        {req.sender?.profile?.displayName || req.sender?.username}
      </Text>
      <Text style={styles.cardUsername}>@{req.sender?.username}</Text>
    </View>
    <View style={styles.requestActions}>
      <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
        <Text style={styles.acceptText}>✓</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
        <Text style={styles.rejectText}>✕</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────
export const ContactsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { startCall } = useCall();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [discoverUsers, setDiscoverUsers] = useState<any[]>([]);
  const [lanPeers, setLanPeers] = useState<any[]>([]);
  const [isScanningLan, setIsScanningLan] = useState(false);
  const [requests, setRequests] = useState<{ received: ContactRequest[]; sent: ContactRequest[] }>({
    received: [],
    sent: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const searchTimer = useRef<any>(null);

  const scanLanNetwork = async () => {
    setIsScanningLan(true);
    try {
      const peers = await getLanPeers();
      setLanPeers(peers || []);
    } catch {
      setLanPeers([]);
    } finally {
      setIsScanningLan(false);
    }
  };

  const fetchContactsAndRequests = useCallback(async () => {
    try {
      const [cRes, rRes, dRes, lanData] = await Promise.all([
        api.get('/contacts'),
        api.get('/contacts/requests'),
        api.get('/users/search?q='),
        getLanPeers(),
      ]);
      setContacts(cRes.data.data || []);
      setRequests(rRes.data.data || { received: [], sent: [] });
      setDiscoverUsers(dRes.data.data || []);
      setLanPeers(lanData || []);
    } catch (e) {
      console.warn('Failed to load contacts:', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchContactsAndRequests();
    const unsub = navigation.addListener('focus', fetchContactsAndRequests);
    return unsub;
  }, [navigation, fetchContactsAndRequests]);

  // ── Debounced Search ───────────────────────────────────────────────────────
  const executeSearch = async (query: string) => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      setSearching(false);
      return;
    }

    try {
      setSearching(true);
      setIsSearching(true);
      const res = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!text.trim()) {
      clearSearch();
      return;
    }

    setIsSearching(true);
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      executeSearch(text);
    }, 280);
  };

  const clearSearch = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    setSearching(false);
  };

  // ── Contact Request ────────────────────────────────────────────────────────
  const sendContactRequest = async (receiverUsername: string, userId: string) => {
    if (sentIds.has(userId)) return;
    try {
      await api.post('/contacts/request', { receiver: receiverUsername });
      setSentIds((prev) => new Set(prev).add(userId));
      fetchContactsAndRequests();
      Alert.alert('Request Sent', `Contact invitation sent to @${receiverUsername}.`);
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Could not send request.';
      Alert.alert('Notice', msg);
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      await api.post(`/contacts/requests/${requestId}/accept`);
      fetchContactsAndRequests();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Could not accept request.');
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await api.post(`/contacts/requests/${requestId}/reject`);
      fetchContactsAndRequests();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Could not reject request.');
    }
  };

  // ── Direct Chat / SMS ──────────────────────────────────────────────────────
  const openChatWithUser = async (targetUser: any) => {
    try {
      const targetUserId = targetUser.contactUserId || targetUser.id;
      const peerName = targetUser.displayName || targetUser.profile?.displayName || targetUser.username;
      const peerAvatar = targetUser.avatarUrl || targetUser.profile?.avatarUrl;

      const res = await api.post('/messages/conversations/direct', {
        targetUserId,
      });

      navigation.navigate('Chat', {
        conversationId: res.data.data.id,
        peerId: targetUserId,
        peerName,
        peerAvatar,
      });
    } catch (e: any) {
      Alert.alert('Chat Notice', e.response?.data?.message || 'Could not start conversation.');
    }
  };

  // ── Direct Calls ───────────────────────────────────────────────────────────
  const startCallWithUser = (targetUser: any, type: 'VOICE' | 'VIDEO') => {
    const targetUserId = targetUser.contactUserId || targetUser.id;
    const name = targetUser.displayName || targetUser.profile?.displayName || targetUser.username;
    const avatar = targetUser.avatarUrl || targetUser.profile?.avatarUrl;
    startCall(targetUserId, name, type, avatar);
  };

  const handleContactOptions = (c: Contact) => {
    Alert.alert(c.displayName, `@${c.username}`, [
      { text: '💬 Send Message', onPress: () => openChatWithUser(c) },
      {
        text: '📞 Voice Call',
        onPress: () => startCall(c.contactUserId, c.displayName, 'VOICE', c.avatarUrl),
      },
      {
        text: '📹 Video Call',
        onPress: () => startCall(c.contactUserId, c.displayName, 'VIDEO', c.avatarUrl),
      },
      {
        text: '🚫 Block User',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Block User',
            `Block ${c.displayName}? They will no longer be able to message or call you.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Block',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await api.post('/contacts/block', { userIdToBlock: c.contactUserId });
                    Alert.alert('Blocked', `${c.displayName} has been blocked.`);
                    fetchContactsAndRequests();
                  } catch (e: any) {
                    Alert.alert('Error', e.response?.data?.message || 'Could not block user.');
                  }
                },
              },
            ]
          );
        },
      },
      {
        text: '🗑️ Remove Contact',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Remove Contact',
            `Remove ${c.displayName} from your contacts?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await api.delete(`/contacts/${c.contactUserId}`);
                    fetchContactsAndRequests();
                  } catch (e: any) {
                    Alert.alert('Error', e.response?.data?.message || 'Could not remove contact.');
                  }
                },
              },
            ]
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const totalPending = requests.received.length;

  return (
    <View style={styles.container}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Contacts</Text>
          <Text style={styles.headerSub}>
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
            {totalPending > 0 ? `  ·  ${totalPending} pending` : ''}
          </Text>
        </View>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search username, name, or phone…"
            placeholderTextColor={THEME.colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={() => executeSearch(searchQuery)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchContactsAndRequests();
            }}
            tintColor={THEME.colors.primary}
          />
        }
      >
        {/* ── Active Search Results ── */}
        {isSearching && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>
                {searching ? 'Searching CallFar Users…' : `Results for "${searchQuery}"`}
              </Text>
              {searching && <ActivityIndicator size="small" color={THEME.colors.primary} />}
            </View>

            {!searching && searchResults.length === 0 ? (
              <View style={styles.emptySmall}>
                <Text style={styles.emptySmallIcon}>🔎</Text>
                <Text style={styles.emptySmallText}>No users found for "{searchQuery}"</Text>
                <Text style={styles.emptySmallHint}>
                  Check spelling or try searching by username or phone number.
                </Text>
              </View>
            ) : (
              searchResults.map((item) => (
                <SearchCard
                  key={item.id}
                  item={item}
                  sentIds={sentIds}
                  onAdd={sendContactRequest}
                  onChat={openChatWithUser}
                  onVoice={(u) => startCallWithUser(u, 'VOICE')}
                  onVideo={(u) => startCallWithUser(u, 'VIDEO')}
                />
              ))
            )}
          </View>
        )}

        {/* ── Same-Network LAN Auto-Scan Radar ── */}
        {!isSearching && (
          <View style={styles.lanRadarCard}>
            <View style={styles.lanRadarHeader}>
              <View style={styles.lanRadarPulse}>
                <Text style={{ fontSize: 18 }}>📡</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.lanRadarTitle}>Auto-Scan Local Network</Text>
                  <View style={styles.lanLiveDot} />
                  <Text style={styles.lanLiveText}>Active</Text>
                </View>
                <Text style={styles.lanRadarSub}>
                  {isScanningLan
                    ? 'Scanning Wi-Fi network for friends…'
                    : lanPeers.length > 0
                    ? `${lanPeers.length} friend${lanPeers.length !== 1 ? 's' : ''} detected on same Wi-Fi (0 KB data)`
                    : 'Auto-detecting friends connected to the same Wi-Fi'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.lanRescanBtn}
                onPress={scanLanNetwork}
                disabled={isScanningLan}
                activeOpacity={0.8}
              >
                {isScanningLan ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.lanRescanText}>🔄 Scan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Friends Discovered on Same Network (Wi-Fi) ── */}
        {!isSearching && lanPeers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: '#10B981', marginBottom: 0 }]}>
                🟢 Friends on Same Network ({lanPeers.length})
              </Text>
              <View style={[styles.badge, { backgroundColor: '#10B981', marginBottom: 0 }]}>
                <Text style={styles.badgeText}>Direct LAN · HD</Text>
              </View>
            </View>
            {lanPeers.map((item) => (
              <SearchCard
                key={`lan-${item.id}`}
                item={{ ...item, isSameNetwork: true }}
                sentIds={sentIds}
                onAdd={sendContactRequest}
                onChat={openChatWithUser}
                onVoice={(u) => startCallWithUser(u, 'VOICE')}
                onVideo={(u) => startCallWithUser(u, 'VIDEO')}
              />
            ))}
          </View>
        )}

        {/* ── Call Yourself / Voice Echo Test ── */}
        {!isSearching && user && (
          <View style={styles.echoCard}>
            <View style={styles.echoIconWrap}>
              <Text style={{ fontSize: 22 }}>🎙️</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.echoTitle}>Voice Echo Test</Text>
              <Text style={styles.echoSub}>
                Test microphone, latency & audio with the AI Voice Assistant
              </Text>
            </View>
            <TouchableOpacity
              style={styles.echoCallBtn}
              onPress={() => startCall(user.id, 'Voice Assistant · Echo Test', 'VOICE')}
              activeOpacity={0.8}
            >
              <Text style={styles.echoCallBtnText}>📞 Call Self</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Pending Requests ── */}
        {requests.received.length > 0 && !isSearching && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Contact Requests</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{requests.received.length}</Text>
              </View>
            </View>
            {requests.received.map((req) => (
              <RequestRow
                key={req.id}
                req={req}
                onAccept={() => acceptRequest(req.id)}
                onReject={() => rejectRequest(req.id)}
              />
            ))}
          </View>
        )}

        {/* ── All Existing Contacts ── */}
        {!isSearching && contacts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>All Contacts ({contacts.length})</Text>
            {contacts.map((c) => {
              const isSameNet = lanPeers.some((p) => p.id === c.contactUserId);
              return (
                <ContactRow
                  key={c.id}
                  contact={c}
                  isSameNetwork={isSameNet}
                  onChat={() => openChatWithUser(c)}
                  onVoice={() => startCall(c.contactUserId, c.displayName, 'VOICE', c.avatarUrl)}
                  onVideo={() => startCall(c.contactUserId, c.displayName, 'VIDEO', c.avatarUrl)}
                  onLongPress={() => handleContactOptions(c)}
                />
              );
            })}
          </View>
        )}

        {/* ── DISCOVER PEOPLE (For New Users with 0 Contacts) ── */}
        {!isSearching && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {contacts.length === 0 ? 'People You Can Call & Message' : 'Discover More People'}
            </Text>
            {discoverUsers.length > 0 ? (
              discoverUsers.map((item) => (
                <SearchCard
                  key={item.id}
                  item={item}
                  sentIds={sentIds}
                  onAdd={sendContactRequest}
                  onChat={openChatWithUser}
                  onVoice={(u) => startCallWithUser(u, 'VOICE')}
                  onVideo={(u) => startCallWithUser(u, 'VIDEO')}
                />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>Find CallFar Users</Text>
                <Text style={styles.emptySub}>
                  Type a username above to search and instantly call or message them.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.xl,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  searchBarWrap: {
    marginHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    height: 46,
  },
  clearBtn: {
    paddingHorizontal: 6,
  },
  clearText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
  },
  section: {
    paddingHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  badge: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginBottom: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Search card with call, message, and add buttons
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  cardUsername: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  onlineBadgeText: {
    fontSize: 11,
    color: THEME.colors.success,
    fontWeight: '600',
    marginTop: 2,
  },
  attendantBadgeText: {
    fontSize: 11,
    color: THEME.colors.accent,
    fontWeight: '700',
    marginTop: 2,
  },
  offlineBadgeText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  searchActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addBtn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 2,
  },
  addBtnSent: {
    backgroundColor: THEME.colors.success,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },

  // Contact row
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  chatBtn: {
    borderColor: THEME.colors.primary + '55',
    backgroundColor: THEME.colors.primary + '18',
  },
  voiceBtn: {
    borderColor: THEME.colors.success + '55',
    backgroundColor: THEME.colors.success + '18',
  },
  videoBtn: {
    borderColor: THEME.colors.accent + '55',
    backgroundColor: THEME.colors.accent + '18',
  },
  iconText: {
    fontSize: 15,
  },

  // Request row
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary + '14',
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.primary + '40',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  rejectBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  rejectText: {
    color: THEME.colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },

  // Empty states
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptySmall: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptySmallIcon: {
    fontSize: 34,
    marginBottom: 6,
  },
  emptySmallText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  emptySmallHint: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },

  // Echo test card
  echoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    marginHorizontal: THEME.spacing.lg,
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.primary + '55',
  },
  echoIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  echoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  echoSub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  echoCallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: THEME.colors.primary + '22',
    borderWidth: 1,
    borderColor: THEME.colors.primary + '66',
  },
  echoCallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryLight,
  },

  // LAN Auto-Scan Radar Card
  lanRadarCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    marginHorizontal: THEME.spacing.lg,
    marginBottom: 14,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  lanRadarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lanRadarPulse: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lanRadarTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  lanLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  lanLiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
    textTransform: 'uppercase',
  },
  lanRadarSub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  lanRescanBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  lanRescanText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sameLanBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  sameLanBadgeText: {
    fontSize: 10,
    color: '#34D399',
    fontWeight: '700',
  },
});

export default ContactsScreen;
