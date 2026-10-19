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
} from 'react-native';
import { api } from '../../api/client';
import { useCall } from '../../context/CallContext';
import { CallRecord, PstnCallRecord } from '../../types';
import { THEME } from '../../styles/theme';
import { Avatar } from '../../components/common/Avatar';

type Filter = 'ALL' | 'CELLULAR' | 'VOIP' | 'MISSED';

interface TabItem {
  label: string;
  value: Filter;
  icon: string;
}

const TABS: TabItem[] = [
  { label: 'All', value: 'ALL', icon: '📋' },
  { label: 'Cellular', value: 'CELLULAR', icon: '📶' },
  { label: 'VoIP', value: 'VOIP', icon: '💻' },
  { label: 'Missed', value: 'MISSED', icon: '📵' },
];

type UnifiedCall =
  | { kind: 'VOIP'; id: string; startedAt: string; voip: CallRecord }
  | { kind: 'PSTN'; id: string; startedAt: string; pstn: PstnCallRecord };

const formatDuration = (sec: number) => {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const groupByDate = (calls: UnifiedCall[]) => {
  const groups: { title: string; data: UnifiedCall[] }[] = [];
  const seen: Record<string, number> = {};

  calls.forEach((c) => {
    const d = new Date(c.startedAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    let label: string;

    if (d.toDateString() === today.toDateString()) {
      label = 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = 'Yesterday';
    } else {
      label = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    }

    if (seen[label] === undefined) {
      seen[label] = groups.length;
      groups.push({ title: label, data: [] });
    }
    groups[seen[label]].data.push(c);
  });

  return groups;
};

export const CallHistoryScreen = ({ navigation }: any) => {
  const { startCall } = useCall();
  const [voipHistory, setVoipHistory] = useState<CallRecord[]>([]);
  const [pstnHistory, setPstnHistory] = useState<PstnCallRecord[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchHistory = useCallback(async () => {
    try {
      const [voipRes, pstnRes] = await Promise.allSettled([
        api.get('/calls/history'),
        api.get('/pstn/history'),
      ]);

      if (voipRes.status === 'fulfilled' && voipRes.value.data?.data) {
        setVoipHistory(voipRes.value.data.data);
      }
      if (pstnRes.status === 'fulfilled' && pstnRes.value.data?.data) {
        setPstnHistory(pstnRes.value.data.data);
      }
    } catch (e) {
      console.warn('Call history error:', e);
    } finally {
      setRefreshing(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }
  }, [fadeAnim]);

  useEffect(() => {
    fetchHistory();
    const unsub = navigation.addListener('focus', fetchHistory);
    return unsub;
  }, [navigation, fetchHistory]);

  // Combine and sort chronologically descending
  const unifiedList: UnifiedCall[] = [
    ...voipHistory.map((v) => ({ kind: 'VOIP' as const, id: `voip-${v.id}`, startedAt: v.startedAt, voip: v })),
    ...pstnHistory.map((p) => ({ kind: 'PSTN' as const, id: `pstn-${p.id}`, startedAt: p.startedAt, pstn: p })),
  ].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  // Filter items
  const filtered = unifiedList.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'CELLULAR') return item.kind === 'PSTN';
    if (filter === 'VOIP') return item.kind === 'VOIP';
    if (filter === 'MISSED') {
      if (item.kind === 'VOIP') {
        return item.voip.status === 'MISSED' || item.voip.status === 'REJECTED';
      }
      return item.pstn.status === 'MISSED' || item.pstn.status === 'FAILED';
    }
    return true;
  });

  const grouped = groupByDate(filtered);

  // Render VoIP Call Card
  const renderVoipCall = (item: CallRecord) => {
    const peerName = item.peer?.displayName || item.peer?.username || 'Unknown';
    const isMissed = item.status === 'MISSED' || item.status === 'REJECTED';
    const icon = isMissed ? '↙' : item.isOutgoing ? '↗' : '↙';
    const iconColor = isMissed ? THEME.colors.danger : THEME.colors.success;

    return (
      <TouchableOpacity
        key={`voip-${item.id}`}
        style={[styles.card, isMissed && styles.missedCard]}
        onPress={() => item.peer && startCall(item.peer.id, peerName, item.callType, item.peer.avatarUrl)}
        activeOpacity={0.75}
      >
        <Avatar name={peerName} url={item.peer?.avatarUrl} size={48} />
        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={[styles.name, isMissed && styles.missedName]} numberOfLines={1}>
              {peerName}
            </Text>
            <View style={styles.voipPill}>
              <Text style={styles.voipPillText}>App VoIP</Text>
            </View>
          </View>
          <View style={styles.meta}>
            <Text style={[styles.arrow, { color: iconColor }]}>{icon}</Text>
            <Text style={styles.metaText}>
              {item.callType === 'VIDEO' ? '📹' : '📞'} {item.callType} • {item.status.toLowerCase()}
              {item.durationSeconds > 0 ? `  ·  ${formatDuration(item.durationSeconds)}` : ''}
            </Text>
          </View>
          <Text style={styles.time}>
            {new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.callBackBtn,
            { backgroundColor: item.callType === 'VIDEO' ? THEME.colors.accent + '20' : THEME.colors.success + '20' },
          ]}
          onPress={() => item.peer && startCall(item.peer.id, peerName, item.callType, item.peer.avatarUrl)}
        >
          <Text style={styles.callBackIcon}>{item.callType === 'VIDEO' ? '📹' : '📞'}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Render Cellular PSTN Call Card
  const renderPstnCall = (item: PstnCallRecord) => {
    const isFailed = item.status === 'FAILED' || item.status === 'MISSED';
    let carrierBg = '#38BDF820';
    let carrierFg = '#38BDF8';

    if (item.carrierBrand === 'MTN') {
      carrierBg = '#FBBF2425';
      carrierFg = '#FBBF24';
    } else if (item.carrierBrand === 'AIRTEL' || item.carrierBrand === 'TIGO') {
      carrierBg = '#EF444425';
      carrierFg = '#EF4444';
    } else if (item.carrierBrand === 'SAFARICOM') {
      carrierBg = '#10B98125';
      carrierFg = '#10B981';
    }

    return (
      <TouchableOpacity
        key={`pstn-${item.id}`}
        style={[styles.card, isFailed && styles.missedCard]}
        onPress={() => navigation.navigate('Dialpad', { initialNumber: item.destinationNumber })}
        activeOpacity={0.75}
      >
        <View style={styles.pstnAvatar}>
          <Text style={styles.pstnFlag}>{item.countryFlag || '🌐'}</Text>
          <Text style={styles.pstnSimIcon}>📶</Text>
        </View>

        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={[styles.name, isFailed && styles.missedName]} numberOfLines={1}>
              {item.destinationNumber}
            </Text>
            <View style={[styles.carrierPill, { backgroundColor: carrierBg }]}>
              <Text style={[styles.carrierPillText, { color: carrierFg }]}>
                {item.carrierName || 'Cellular'}
              </Text>
            </View>
          </View>

          <View style={styles.meta}>
            <Text style={[styles.arrow, { color: isFailed ? THEME.colors.danger : THEME.colors.success }]}>
              {isFailed ? '✕' : '↗'}
            </Text>
            <Text style={styles.metaText}>
              {item.countryName} • {item.durationSeconds > 0 ? formatDuration(item.durationSeconds) : item.status.toLowerCase()}
              {item.costTotal > 0 ? `  ·  $${item.costTotal.toFixed(3)}` : ''}
            </Text>
          </View>

          <Text style={styles.time}>
            {new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.callBackBtn, { backgroundColor: '#10B98125' }]}
          onPress={() => navigation.navigate('Dialpad', { initialNumber: item.destinationNumber })}
        >
          <Text style={styles.callBackIcon}>📞</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Call Log</Text>
          <Text style={styles.sub}>{filtered.length} total call{filtered.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerDialpadBtn}
          onPress={() => navigation.navigate('Dialpad')}
          activeOpacity={0.8}
        >
          <Text style={styles.headerDialpadText}>⌨️ Dialpad</Text>
        </TouchableOpacity>
      </View>

      {/* ── Quick Dial Hero Banner ── */}
      <TouchableOpacity
        style={styles.heroBanner}
        onPress={() => navigation.navigate('Dialpad')}
        activeOpacity={0.85}
      >
        <View style={styles.heroIconBox}>
          <Text style={styles.heroIcon}>🌍</Text>
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>Cellular & Global Calling</Text>
          <Text style={styles.heroSubtitle}>Dial MTN, Airtel, Tigo & 240+ international networks</Text>
        </View>
        <View style={styles.heroArrowBox}>
          <Text style={styles.heroArrow}>→</Text>
        </View>
      </TouchableOpacity>

      {/* ── Filter Tabs ── */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = filter === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => setFilter(tab.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Grouped Call List ── */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={grouped}
          keyExtractor={(group) => group.title}
          renderItem={({ item: group }) => (
            <View>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {group.data.map((c) =>
                c.kind === 'VOIP' ? renderVoipCall(c.voip) : renderPstnCall(c.pstn)
              )}
            </View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchHistory();
              }}
              tintColor={THEME.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{filter === 'MISSED' ? '📵' : '📞'}</Text>
              <Text style={styles.emptyTitle}>
                No {filter !== 'ALL' ? filter.toLowerCase() : ''} calls yet
              </Text>
              <Text style={styles.emptySub}>
                Your VoIP and cellular phone records will appear here.
              </Text>
              <TouchableOpacity
                style={styles.emptyDialBtn}
                onPress={() => navigation.navigate('Dialpad')}
              >
                <Text style={styles.emptyDialBtnText}>📞 Open Cellular Dialpad</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </Animated.View>

      {/* ── Floating Dialpad Action Button ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Dialpad')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>📞</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070B14',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? 44 : 52,
    paddingBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  headerDialpadBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerDialpadText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2563EB40',
  },
  heroIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2563EB20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  heroIcon: {
    fontSize: 20,
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  heroArrowBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  heroArrow: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  activeTab: {
    backgroundColor: '#2563EB',
  },
  tabIcon: {
    fontSize: 12,
  },
  tabLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  activeTabLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  missedCard: {
    borderColor: '#EF444440',
    backgroundColor: '#EF44440C',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
  },
  missedName: {
    color: '#EF4444',
  },
  voipPill: {
    backgroundColor: '#38BDF820',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  voipPillText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  carrierPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  carrierPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  pstnAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pstnFlag: {
    fontSize: 22,
  },
  pstnSimIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    fontSize: 12,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  arrow: {
    fontSize: 14,
    fontWeight: '800',
  },
  metaText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  time: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  callBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  callBackIcon: {
    fontSize: 16,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 30,
    marginBottom: 18,
  },
  emptyDialBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  emptyDialBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabIcon: {
    fontSize: 26,
    color: '#FFFFFF',
  },
});

export default CallHistoryScreen;
