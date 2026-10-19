import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Platform,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../api/client';
import { Conversation } from '../../types';
import { THEME } from '../../styles/theme';
import { Avatar } from '../../components/common/Avatar';
import { ProfileModal } from '../../components/common/ProfileModal';
import { NetworkManagerModal } from '../../components/common/NetworkManagerModal';

const formatRelativeTime = (iso: string) => {
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const HomeScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { startCall } = useCall();
  const { socket, isSameNetworkLan, latencyMs } = useSocket();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConvos, setFilteredConvos] = useState<Conversation[]>([]);
  const [globalUsers, setGlobalUsers] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNetworkModal, setShowNetworkModal] = useState(false);

  const searchTimer = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Fetch Conversations and Suggested Users ──────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [convRes, userRes] = await Promise.all([
        api.get('/messages/conversations'),
        api.get('/users/search?q='),
      ]);

      const convData: Conversation[] = convRes.data.data || [];
      const usersData: any[] = userRes.data.data || [];

      setConversations(convData);
      setFilteredConvos(convData);
      setSuggestedUsers(usersData);

      // Unread count map
      const unread: Record<string, number> = {};
      convData.forEach((c) => {
        if (c.lastMessage && c.lastMessage.status !== 'READ' && c.lastMessage.senderId !== user?.id) {
          unread[c.id] = 1;
        }
      });
      setUnreadMap((prev) => ({ ...prev, ...unread }));
    } catch (e) {
      console.warn('[HomeScreen] Data fetch notice:', e);
    } finally {
      setRefreshing(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [user]);

  useEffect(() => {
    fetchData();
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  // Real-time: update on new message
  useEffect(() => {
    if (!socket) return;
    const onNewMsg = (data: { conversationId: string; message: any }) => {
      if (data.message?.senderId !== user?.id) {
        setUnreadMap((prev) => ({
          ...prev,
          [data.conversationId]: (prev[data.conversationId] || 0) + 1,
        }));
      }
      fetchData();
    };
    socket.on('chat:new_message', onNewMsg);
    return () => {
      socket.off('chat:new_message', onNewMsg);
    };
  }, [socket, user, fetchData]);

  // ── Search handler (Local conversations + Global server user search) ─────
  const handleSearchChange = (text: string) => {
    setSearch(text);

    if (!text.trim()) {
      setFilteredConvos(conversations);
      setGlobalUsers([]);
      setIsSearchingUsers(false);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      return;
    }

    const q = text.toLowerCase();
    setFilteredConvos(
      conversations.filter((c) => {
        const name = c.peer?.displayName || c.peer?.username || c.title || '';
        return name.toLowerCase().includes(q);
      })
    );

    // Debounced query to search all users across CallFar
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length >= 2) {
      setIsSearchingUsers(true);
      searchTimer.current = setTimeout(async () => {
        try {
          const res = await api.get(`/users/search?q=${encodeURIComponent(text.trim())}`);
          setGlobalUsers(res.data.data || []);
        } catch {
          setGlobalUsers([]);
        } finally {
          setIsSearchingUsers(false);
        }
      }, 300);
    } else {
      setGlobalUsers([]);
      setIsSearchingUsers(false);
    }
  };

  // ── Open or Start Direct Conversation with any User ──────────────────────
  const openChatWithUser = async (targetUser: any) => {
    try {
      const res = await api.post('/messages/conversations/direct', {
        targetUserId: targetUser.id,
      });
      const conv = res.data.data;
      const peerName = targetUser.profile?.displayName || targetUser.username;
      const peerAvatar = targetUser.profile?.avatarUrl;

      setUnreadMap((prev) => {
        const n = { ...prev };
        delete n[conv.id];
        return n;
      });

      navigation.navigate('Chat', {
        conversationId: conv.id,
        peerId: targetUser.id,
        peerName,
        peerAvatar,
      });
    } catch (e: any) {
      Alert.alert('Chat Notice', e.response?.data?.message || 'Could not start conversation.');
    }
  };

  const openConversation = (c: Conversation) => {
    setUnreadMap((prev) => {
      const n = { ...prev };
      delete n[c.id];
      return n;
    });
    navigation.navigate('Chat', {
      conversationId: c.id,
      peerId: c.peer?.id,
      peerName: c.peer?.displayName || c.title || 'Chat',
      peerAvatar: c.peer?.avatarUrl,
    });
  };

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sortedConvos = [...filteredConvos].sort((a, b) => {
    const aPin = pinnedIds.has(a.id) ? 1 : 0;
    const bPin = pinnedIds.has(b.id) ? 1 : 0;
    return bPin - aPin;
  });

  const totalUnread = Object.values(unreadMap).reduce((s, v) => s + v, 0);

  // ── Render Global User Result Card ─────────────────────────────────────────
  const renderUserCard = (u: any) => {
    const name = u.profile?.displayName || u.username;
    return (
      <View key={u.id} style={s.userCard}>
        <Avatar name={name} url={u.profile?.avatarUrl} size={48} isOnline={u.profile?.isOnline} />
        <View style={s.userInfo}>
          <Text style={s.userName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={s.userHandle}>@{u.username}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            {u.profile?.isOnline ? (
              <Text style={s.onlineText}>🟢 Online now</Text>
            ) : (
              <Text style={s.offlineText}>Active on CallFar</Text>
            )}
            {u.isSameNetwork ? (
              <View style={s.sameLanBadgeSmall}>
                <Text style={s.sameLanBadgeTextSmall}>🟢 Same Wi-Fi</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={s.actionRow}>
          {/* SMS / Message Button */}
          <TouchableOpacity
            style={[s.actionIconBtn, s.chatActionBtn]}
            onPress={() => openChatWithUser(u)}
            activeOpacity={0.7}
          >
            <Text style={s.actionBtnEmoji}>💬</Text>
          </TouchableOpacity>

          {/* Voice Call Button */}
          <TouchableOpacity
            style={[s.actionIconBtn, s.voiceActionBtn]}
            onPress={() => startCall(u.id, name, 'VOICE', u.profile?.avatarUrl)}
            activeOpacity={0.7}
          >
            <Text style={s.actionBtnEmoji}>📞</Text>
          </TouchableOpacity>

          {/* Video Call Button */}
          <TouchableOpacity
            style={[s.actionIconBtn, s.videoActionBtn]}
            onPress={() => startCall(u.id, name, 'VIDEO', u.profile?.avatarUrl)}
            activeOpacity={0.7}
          >
            <Text style={s.actionBtnEmoji}>📹</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── Render Conversation Item ───────────────────────────────────────────────
  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const peer = item.peer;
    const name = peer?.displayName || item.title || 'Chat';
    const lastMsg = item.lastMessage;
    const unread = unreadMap[item.id] || 0;
    const isPinned = pinnedIds.has(item.id);

    return (
      <TouchableOpacity
        style={[s.convCard, isPinned && s.pinnedCard, unread > 0 && s.unreadCard]}
        onPress={() => openConversation(item)}
        onLongPress={() => togglePin(item.id)}
        activeOpacity={0.75}
      >
        {isPinned && <Text style={s.pinIcon}>📌</Text>}
        <Avatar name={name} url={peer?.avatarUrl} size={52} isOnline={peer?.isOnline} />

        <View style={s.convInfo}>
          <View style={s.convRow}>
            <Text style={[s.convName, unread > 0 && s.convNameUnread]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={s.convTime}>
              {lastMsg ? formatRelativeTime(lastMsg.createdAt) : ''}
            </Text>
          </View>
          <View style={s.convRow}>
            <Text style={[s.lastMsg, unread > 0 && s.lastMsgUnread]} numberOfLines={1}>
              {lastMsg
                ? `${lastMsg.senderId === user?.id ? 'You: ' : ''}${lastMsg.content}`
                : 'Tap to start conversation…'}
            </Text>
            {unread > 0 && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Call Actions */}
        {peer && (
          <View style={s.quickCallRow}>
            <TouchableOpacity
              style={s.quickBtn}
              onPress={() => startCall(peer.id, name, 'VOICE', peer.avatarUrl)}
              activeOpacity={0.7}
            >
              <Text style={s.quickBtnText}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.quickBtn, s.quickVideoBtn]}
              onPress={() => startCall(peer.id, name, 'VIDEO', peer.avatarUrl)}
              activeOpacity={0.7}
            >
              <Text style={s.quickBtnText}>📹</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      {/* ── Top Header ── */}
      <View style={s.header}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.headerTitle}>Messages</Text>
            <TouchableOpacity
              style={[
                s.networkHeaderPill,
                isSameNetworkLan ? s.networkPillLan : s.networkPillWan,
              ]}
              onPress={() => setShowNetworkModal(true)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 9 }}>{isSameNetworkLan ? '🟢' : '🌐'}</Text>
              <Text
                style={[
                  s.networkPillText,
                  isSameNetworkLan ? s.networkPillTextLan : s.networkPillTextWan,
                ]}
              >
                {isSameNetworkLan ? 'Same Wi-Fi' : 'Remote'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={s.headerSub} numberOfLines={1}>
            Hi, {user?.profile?.displayName || user?.username} 👋
            {totalUnread > 0 ? `  ·  ${totalUnread} unread` : ''}
          </Text>
        </View>

        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.newChatBtn}
            onPress={() => navigation.navigate('ContactsTab')}
            activeOpacity={0.8}
          >
            <Text style={s.newChatText}>＋ Search</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.profileCornerBtn}
            onPress={() => setShowProfileModal(true)}
            activeOpacity={0.8}
          >
            <Avatar
              name={user?.profile?.displayName || user?.username || 'U'}
              url={user?.profile?.avatarUrl}
              size={38}
              isOnline={user?.profile?.isOnline ?? true}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Universal Search Bar ── */}
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search people to call or text…"
          placeholderTextColor={THEME.colors.textMuted}
          value={search}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearchChange('')} style={s.clearBtn}>
            <Text style={s.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={THEME.colors.primary}
          />
        }
      >
        {/* ── SEARCH MODE: Show Global People Results ── */}
        {search.trim().length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>People on CallFar</Text>
              {isSearchingUsers && <ActivityIndicator size="small" color={THEME.colors.primary} />}
            </View>

            {globalUsers.length > 0 ? (
              globalUsers.map(renderUserCard)
            ) : !isSearchingUsers ? (
              <View style={s.emptyMini}>
                <Text style={s.emptyMiniText}>No users matched "{search}".</Text>
                <Text style={s.emptyMiniSub}>Try searching by username or display name.</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── SEARCH MODE: Show Existing Conversations Results ── */}
        {search.trim().length > 0 && sortedConvos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Existing Conversations</Text>
            {sortedConvos.map((c) => (
              <View key={c.id}>{renderConversationItem({ item: c })}</View>
            ))}
          </View>
        )}

        {/* ── NORMAL MODE: List of Conversations ── */}
        {search.trim().length === 0 && sortedConvos.length > 0 && (
          <View style={s.section}>
            {sortedConvos.map((c) => (
              <View key={c.id}>{renderConversationItem({ item: c })}</View>
            ))}
          </View>
        )}

        {/* ── BRAND NEW USER STATE (0 Conversations): Discover Active People ── */}
        {search.trim().length === 0 && conversations.length === 0 && (
          <View style={s.welcomeCard}>
            <View style={s.welcomeIconWrap}>
              <Text style={{ fontSize: 32 }}>🚀</Text>
            </View>
            <Text style={s.welcomeTitle}>Welcome to CallFar!</Text>
            <Text style={s.welcomeDesc}>
              Search for anyone to start voice calls, video calls, and instant messaging.
            </Text>

            {/* Voice Echo Test quick button */}
            <TouchableOpacity
              style={s.echoTestCard}
              onPress={() => startCall(user?.id || '', 'Voice Assistant · Echo Test', 'VOICE')}
              activeOpacity={0.8}
            >
              <View style={s.echoIconBox}>
                <Text style={{ fontSize: 22 }}>🎙️</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.echoCardTitle}>Test Your Voice & Microphone</Text>
                <Text style={s.echoCardSub}>Call yourself to test audio quality with AI Echo Bot</Text>
              </View>
              <Text style={s.echoCardAction}>📞 Call Self</Text>
            </TouchableOpacity>

            {/* Discover Users List */}
            {suggestedUsers.length > 0 && (
              <View style={s.suggestedWrap}>
                <Text style={s.suggestedLabel}>PEOPLE YOU CAN CALL & MESSAGE</Text>
                {suggestedUsers.map(renderUserCard)}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Profile & Session Logout Modal ── */}
      <ProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onEditProfile={() => navigation.navigate('SettingsTab')}
      />

      {/* ── Network & LAN/WAN Topology Manager Modal ── */}
      <NetworkManagerModal
        visible={showNetworkModal}
        onClose={() => setShowNetworkModal(false)}
        onStartChatWithPeer={openChatWithUser}
        onCallPeer={(u) => startCall(u.id, u.profile?.displayName || u.username, 'VOICE')}
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: Platform.OS === 'android' ? 44 : THEME.spacing.xl,
    paddingBottom: 12,
  },
  networkHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  networkPillLan: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  networkPillWan: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.5)',
  },
  networkPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  networkPillTextLan: {
    color: '#34D399',
  },
  networkPillTextWan: {
    color: '#38BDF8',
  },
  sameLanBadgeSmall: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  sameLanBadgeTextSmall: {
    fontSize: 9,
    color: '#34D399',
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileCornerBtn: {
    padding: 2,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    backgroundColor: '#1E293B',
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
  newChatBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: THEME.borderRadius.full,
  },
  newChatText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    marginHorizontal: THEME.spacing.lg,
    marginBottom: 12,
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
    padding: 4,
  },
  clearText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
  },
  section: {
    paddingHorizontal: THEME.spacing.md,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginHorizontal: 4,
  },

  // User Card (Search & Discover)
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  userHandle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  onlineText: {
    fontSize: 11,
    color: THEME.colors.success,
    fontWeight: '600',
    marginTop: 2,
  },
  offlineText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chatActionBtn: {
    backgroundColor: THEME.colors.primary + '18',
    borderColor: THEME.colors.primary + '55',
  },
  voiceActionBtn: {
    backgroundColor: THEME.colors.success + '18',
    borderColor: THEME.colors.success + '55',
  },
  videoActionBtn: {
    backgroundColor: THEME.colors.accent + '18',
    borderColor: THEME.colors.accent + '55',
  },
  actionBtnEmoji: {
    fontSize: 15,
  },

  // Conversation Item
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  pinnedCard: {
    borderColor: THEME.colors.primary + '50',
    backgroundColor: THEME.colors.primary + '0A',
  },
  unreadCard: {
    borderColor: THEME.colors.primary + '40',
  },
  pinIcon: {
    fontSize: 13,
    position: 'absolute',
    top: 8,
    right: 8,
  },
  convInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  convRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convName: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  convNameUnread: {
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  convTime: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  lastMsg: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    flex: 1,
    marginRight: 6,
  },
  lastMsgUnread: {
    color: THEME.colors.textPrimary,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  quickCallRow: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 4,
  },
  quickBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  quickVideoBtn: {
    backgroundColor: THEME.colors.accent + '15',
    borderColor: THEME.colors.accent + '44',
  },
  quickBtnText: {
    fontSize: 14,
  },

  // Welcome / First Time User State
  welcomeCard: {
    paddingHorizontal: THEME.spacing.md,
    paddingTop: 10,
    paddingBottom: 30,
  },
  welcomeIconWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  welcomeDesc: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  echoTestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.primary + '55',
    marginBottom: 20,
  },
  echoIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  echoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  echoCardSub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  echoCardAction: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: THEME.colors.primary + '20',
    borderRadius: 10,
  },
  suggestedWrap: {
    marginTop: 4,
  },
  suggestedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
    marginHorizontal: 4,
  },
  emptyMini: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyMiniText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  emptyMiniSub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 4,
  },
});

export default HomeScreen;
