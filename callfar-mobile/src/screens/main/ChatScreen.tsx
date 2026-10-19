import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Animated, Pressable, ScrollView,
  Modal, Alert, StatusBar,
} from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useCall } from '../../context/CallContext';
import { Message } from '../../types';
import { THEME } from '../../styles/theme';
import { Avatar } from '../../components/common/Avatar';

// ── Emoji quick-pick panel ────────────────────────────────────────────────────
const EMOJIS = ['😀','😂','❤️','👍','👎','😮','😢','😡','🔥','🎉','✅','🙏','💯','👏','😍','🤔','😎','🥳','💪','🤝'];
const REACTIONS = ['❤️','😂','👍','😮','😢','🔥'];

// ── Typing indicator dots ─────────────────────────────────────────────────────
const TypingIndicator = () => {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: -5, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(400),
      ])).start();
    dots.forEach((d, i) => anim(d, i * 150));
    return () => dots.forEach((d) => d.stopAnimation());
  }, []);
  return (
    <View style={td.wrap}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[td.dot, { transform: [{ translateY: d }] }]} />
      ))}
    </View>
  );
};
const td = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: THEME.colors.textMuted },
});

// ── Read receipt status ───────────────────────────────────────────────────────
const ReadStatus = ({ status }: { status: string }) => {
  if (status === 'READ') return <Text style={{ fontSize: 11, color: '#60A5FA' }}>✓✓</Text>;
  if (status === 'DELIVERED') return <Text style={{ fontSize: 11, color: THEME.colors.textMuted }}>✓✓</Text>;
  return <Text style={{ fontSize: 11, color: THEME.colors.textMuted }}>✓</Text>;
};

// ── Reply preview banner ──────────────────────────────────────────────────────
const ReplyBanner = ({ msg, onCancel }: { msg: Message | null; onCancel: () => void }) => {
  if (!msg) return null;
  return (
    <View style={rb.wrap}>
      <View style={rb.bar} />
      <View style={rb.content}>
        <Text style={rb.label}>Replying to</Text>
        <Text style={rb.preview} numberOfLines={1}>{msg.content}</Text>
      </View>
      <TouchableOpacity onPress={onCancel} style={rb.closeBtn}>
        <Text style={rb.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};
const rb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.surface, borderTopWidth: 1, borderTopColor: THEME.colors.border, paddingHorizontal: 12, paddingVertical: 8 },
  bar: { width: 3, height: 36, backgroundColor: THEME.colors.primary, borderRadius: 2, marginRight: 10 },
  content: { flex: 1 },
  label: { fontSize: 11, color: THEME.colors.primaryLight, fontWeight: '700' },
  preview: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 1 },
  closeBtn: { padding: 6 },
  closeText: { color: THEME.colors.textMuted, fontSize: 14 },
});

// ── Main ChatScreen ───────────────────────────────────────────────────────────
export const ChatScreen = ({ route, navigation }: any) => {
  const { conversationId, peerId, peerName, peerAvatar } = route.params;
  const { user } = useAuth();
  const { socket } = useSocket();
  const { startCall } = useCall();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  const [selectedMsg, setSelectedMsg] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);

  // ── Load messages ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/messages/conversations/${conversationId}/messages`);
        setMessages(res.data.data);
        api.post(`/messages/conversations/${conversationId}/read`).catch(() => {});
      } catch (e) { console.warn('Load messages error:', e); }
      finally { setIsLoading(false); }
    };
    load();
  }, [conversationId]);

  // ── Socket events ──
  useEffect(() => {
    if (!socket) return;
    const onNewMsg = (data: { conversationId: string; message: Message }) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => [...prev, data.message]);
        api.post(`/messages/conversations/${conversationId}/read`).catch(() => {});
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
      }
    };
    const onTyping = (data: { userId: string; isTyping: boolean }) => {
      if (data.userId === peerId) setIsPeerTyping(data.isTyping);
    };
    socket.on('chat:new_message', onNewMsg);
    socket.on('chat:user_typing', onTyping);
    return () => { socket.off('chat:new_message', onNewMsg); socket.off('chat:user_typing', onTyping); };
  }, [socket, conversationId, peerId]);

  // ── Typing indicator emit ──
  const emitTyping = useCallback((isTyping: boolean) => {
    socket?.emit('chat:typing', { conversationId, targetUserId: peerId, isTyping });
  }, [socket, conversationId, peerId]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    emitTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => emitTyping(false), 1500);
  };

  // ── Send message ──
  const sendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setInputText('');
    setShowEmoji(false);
    emitTyping(false);
    const replyRef = replyTo;
    setReplyTo(null);

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: user!.id,
      content: trimmed,
      status: 'SENT',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    if (socket) {
      socket.emit('chat:send', { conversationId, targetUserId: peerId, content: trimmed, replyToId: replyRef?.id });
    } else {
      try {
        const res = await api.post(`/messages/conversations/${conversationId}/messages`, { content: trimmed });
        setMessages(prev => prev.map(m => m.id === optimistic.id ? res.data.data : m));
      } catch (e) { console.warn('Send error:', e); }
    }
  };

  // ── Add emoji to input ──
  const addEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    inputRef.current?.focus();
  };

  // ── React to message ──
  const addReaction = (msgId: string, emoji: string) => {
    setReactions(prev => {
      const existing = prev[msgId] || [];
      const updated = existing.includes(emoji) ? existing.filter(e => e !== emoji) : [...existing, emoji];
      return { ...prev, [msgId]: updated };
    });
    setShowReactionPicker(null);
    setSelectedMsg(null);
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDateSeparator = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  // ── Render message ──
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === user?.id;
    const prev = index > 0 ? messages[index - 1] : null;
    const showDateSep = !prev || new Date(item.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
    const msgReactions = reactions[item.id] || [];
    const isSelected = selectedMsg === item.id;

    return (
      <View>
        {/* Date separator */}
        {showDateSep && (
          <View style={s.dateSepRow}>
            <View style={s.dateSepLine} />
            <Text style={s.dateSepText}>{formatDateSeparator(item.createdAt)}</Text>
            <View style={s.dateSepLine} />
          </View>
        )}

        {/* Reaction picker popup */}
        {showReactionPicker === item.id && (
          <View style={[s.reactionPickerRow, isMe ? s.reactionPickerRight : s.reactionPickerLeft]}>
            {REACTIONS.map(emoji => (
              <TouchableOpacity key={emoji} onPress={() => addReaction(item.id, emoji)} style={s.reactionPickerBtn}>
                <Text style={s.reactionPickerEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Pressable
          onLongPress={() => { setSelectedMsg(item.id); setShowReactionPicker(item.id); }}
          onPress={() => { setSelectedMsg(null); setShowReactionPicker(null); }}
          style={[s.bubbleRow, isMe ? s.bubbleRowRight : s.bubbleRowLeft]}
        >
          {/* Context highlight */}
          {isSelected && <View style={s.highlightOverlay} />}

          {/* Avatar for peer messages */}
          {!isMe && <Avatar name={peerName} url={peerAvatar} size={28} />}

          <View style={[s.bubble, isMe ? s.myBubble : s.peerBubble, isSelected && s.bubbleSelected]}>
            {/* Reply preview inside bubble */}
            {(item as any).replyTo && (
              <View style={[s.replyInBubble, isMe ? s.replyInBubbleMe : s.replyInBubblePeer]}>
                <Text style={s.replyInBubbleText} numberOfLines={1}>{(item as any).replyTo.content}</Text>
              </View>
            )}
            <Text style={[s.bubbleText, isMe ? s.myBubbleText : s.peerBubbleText]}>{item.content}</Text>
            <View style={s.bubbleMeta}>
              <Text style={[s.timeText, isMe ? s.myTime : s.peerTime]}>{formatTime(item.createdAt)}</Text>
              {isMe && <ReadStatus status={item.status} />}
            </View>
          </View>

          {/* Reply button (shown on selection) */}
          {isSelected && (
            <TouchableOpacity
              style={[s.replyBtn, isMe ? s.replyBtnLeft : s.replyBtnRight]}
              onPress={() => { setReplyTo(item); setSelectedMsg(null); setShowReactionPicker(null); inputRef.current?.focus(); }}
            >
              <Text style={s.replyBtnText}>↩</Text>
            </TouchableOpacity>
          )}
        </Pressable>

        {/* Reaction bubbles */}
        {msgReactions.length > 0 && (
          <View style={[s.reactionsRow, isMe ? s.reactionsRight : s.reactionsLeft]}>
            {msgReactions.map((e, i) => (
              <TouchableOpacity key={i} onPress={() => addReaction(item.id, e)} style={s.reactionChip}>
                <Text style={s.reactionChipText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={s.container}
    >
      <StatusBar barStyle="light-content" />

      {/* ── Top Bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.peerInfo} activeOpacity={0.7}>
          <Avatar name={peerName} url={peerAvatar} size={38} isOnline />
          <View style={s.peerText}>
            <Text style={s.peerName} numberOfLines={1}>{peerName}</Text>
            <Text style={[s.peerStatus, isPeerTyping && s.typingStatus]}>
              {isPeerTyping ? 'typing...' : 'online'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={s.topActions}>
          <TouchableOpacity style={s.topBtn} onPress={() => startCall(peerId, peerName, 'VOICE', peerAvatar)}>
            <Text style={s.topBtnIcon}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.topBtn, s.videoTopBtn]} onPress={() => startCall(peerId, peerName, 'VIDEO', peerAvatar)}>
            <Text style={s.topBtnIcon}>📹</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Messages ── */}
      {isLoading ? (
        <View style={s.loadingState}>
          <Text style={s.loadingText}>Loading messages…</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={s.msgList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyChat}>
              <Text style={s.emptyChatIcon}>👋</Text>
              <Text style={s.emptyChatText}>Say hello to {peerName}!</Text>
              <Text style={s.emptyChatSub}>Messages are end-to-end encrypted.</Text>
            </View>
          }
        />
      )}

      {/* ── Typing indicator ── */}
      {isPeerTyping && (
        <View style={s.typingRow}>
          <Avatar name={peerName} url={peerAvatar} size={24} />
          <View style={s.typingBubble}>
            <TypingIndicator />
          </View>
        </View>
      )}

      {/* ── Reply banner ── */}
      <ReplyBanner msg={replyTo} onCancel={() => setReplyTo(null)} />

      {/* ── Emoji panel ── */}
      {showEmoji && (
        <View style={s.emojiPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.emojiGrid}>
              {EMOJIS.map(e => (
                <TouchableOpacity key={e} onPress={() => addEmoji(e)} style={s.emojiBtn}>
                  <Text style={s.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* ── Input bar ── */}
      <View style={s.inputBar}>
        <TouchableOpacity onPress={() => setShowEmoji(v => !v)} style={s.emojiToggleBtn}>
          <Text style={s.emojiToggleIcon}>{showEmoji ? '⌨️' : '😊'}</Text>
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={s.input}
          placeholder="Message…"
          placeholderTextColor={THEME.colors.textMuted}
          value={inputText}
          onChangeText={handleInputChange}
          multiline
          maxLength={2000}
        />

        <TouchableOpacity
          style={[s.sendBtn, !inputText.trim() && s.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim()}
        >
          <Text style={s.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: THEME.colors.border,
  },
  backBtn: { paddingRight: 6, paddingLeft: 2 },
  backIcon: { fontSize: 30, color: THEME.colors.primaryLight, lineHeight: 32 },
  peerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  peerText: { flex: 1 },
  peerName: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary },
  peerStatus: { fontSize: 11, color: THEME.colors.success, marginTop: 1 },
  typingStatus: { color: THEME.colors.primaryLight },
  topActions: { flexDirection: 'row', gap: 8 },
  topBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: THEME.colors.surfaceHover,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: THEME.colors.border,
  },
  videoTopBtn: { borderColor: THEME.colors.accent + '60', backgroundColor: THEME.colors.accent + '18' },
  topBtnIcon: { fontSize: 16 },

  // Messages
  msgList: { padding: 12, paddingBottom: 8 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: THEME.colors.textMuted, fontSize: 14 },

  // Date separator
  dateSepRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 8 },
  dateSepLine: { flex: 1, height: 1, backgroundColor: THEME.colors.border },
  dateSepText: { fontSize: 11, color: THEME.colors.textMuted, fontWeight: '600' },

  // Bubble
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 2, gap: 8, position: 'relative' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  highlightOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: THEME.colors.primary + '10', borderRadius: 12 },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  myBubble: { backgroundColor: THEME.colors.primary, borderBottomRightRadius: 4 },
  peerBubble: { backgroundColor: THEME.colors.surface, borderWidth: 1, borderColor: THEME.colors.border, borderBottomLeftRadius: 4 },
  bubbleSelected: { opacity: 0.85 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  myBubbleText: { color: '#fff' },
  peerBubbleText: { color: THEME.colors.textPrimary },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  timeText: { fontSize: 10 },
  myTime: { color: 'rgba(255,255,255,0.65)' },
  peerTime: { color: THEME.colors.textMuted },

  // Reply inside bubble
  replyInBubble: { borderRadius: 8, padding: 6, marginBottom: 6, borderLeftWidth: 2 },
  replyInBubbleMe: { backgroundColor: 'rgba(255,255,255,0.15)', borderLeftColor: '#fff' },
  replyInBubblePeer: { backgroundColor: THEME.colors.surfaceHover, borderLeftColor: THEME.colors.primary },
  replyInBubbleText: { fontSize: 12, color: THEME.colors.textSecondary },

  // Reply button
  replyBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: THEME.colors.surfaceHover,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: THEME.colors.border,
  },
  replyBtnLeft: { marginLeft: 4 },
  replyBtnRight: { marginRight: 4 },
  replyBtnText: { fontSize: 15, color: THEME.colors.primaryLight },

  // Reactions
  reactionPickerRow: {
    flexDirection: 'row', gap: 6,
    backgroundColor: THEME.colors.surface,
    borderRadius: 20, padding: 8, marginBottom: 4,
    borderWidth: 1, borderColor: THEME.colors.border,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
  reactionPickerRight: { alignSelf: 'flex-end', marginRight: 12 },
  reactionPickerLeft: { alignSelf: 'flex-start', marginLeft: 42 },
  reactionPickerBtn: { padding: 4 },
  reactionPickerEmoji: { fontSize: 22 },
  reactionsRow: { flexDirection: 'row', gap: 4, marginBottom: 4, flexWrap: 'wrap' },
  reactionsRight: { justifyContent: 'flex-end', paddingRight: 12 },
  reactionsLeft: { justifyContent: 'flex-start', paddingLeft: 42 },
  reactionChip: {
    backgroundColor: THEME.colors.surface, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: THEME.colors.border,
  },
  reactionChipText: { fontSize: 14 },

  // Typing row
  typingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 4 },
  typingBubble: {
    backgroundColor: THEME.colors.surface, borderRadius: 18, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: THEME.colors.border,
  },

  // Empty chat
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyChatIcon: { fontSize: 48, marginBottom: 12 },
  emptyChatText: { fontSize: 18, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 4 },
  emptyChatSub: { fontSize: 13, color: THEME.colors.textMuted },

  // Emoji panel
  emojiPanel: {
    backgroundColor: THEME.colors.surface, borderTopWidth: 1, borderTopColor: THEME.colors.border, paddingVertical: 8,
  },
  emojiGrid: { flexDirection: 'row', paddingHorizontal: 8, gap: 2 },
  emojiBtn: { padding: 6, borderRadius: 8 },
  emojiText: { fontSize: 26 },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1, borderTopColor: THEME.colors.border,
    padding: 8, paddingHorizontal: 12,
  },
  emojiToggleBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  emojiToggleIcon: { fontSize: 22 },
  input: {
    flex: 1, minHeight: 40, maxHeight: 110,
    backgroundColor: THEME.colors.background,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    color: THEME.colors.textPrimary, fontSize: 15,
    borderWidth: 1, borderColor: THEME.colors.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: THEME.colors.border },
  sendIcon: { color: '#fff', fontSize: 16, marginLeft: 2 },
});

export default ChatScreen;
