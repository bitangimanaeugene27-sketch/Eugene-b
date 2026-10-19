import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSocket } from '../../context/SocketContext';
import {
  currentActiveHost,
  switchActiveHost,
  pingServer,
  autoDetectServerHost,
  getLanPeers,
  probeHost,
  CANDIDATE_HOSTS,
} from '../../api/client';
import { THEME } from '../../styles/theme';
import { Avatar } from './Avatar';

interface NetworkManagerModalProps {
  visible: boolean;
  onClose: () => void;
  onStartChatWithPeer?: (peer: any) => void;
  onCallPeer?: (peer: any) => void;
}

export const NetworkManagerModal: React.FC<NetworkManagerModalProps> = ({
  visible,
  onClose,
  onStartChatWithPeer,
  onCallPeer,
}) => {
  const { activeHost, latencyMs, isSameNetworkLan, measureLatency, isConnected, reconnectSocket } =
    useSocket();

  const [testingPing, setTestingPing] = useState(false);
  const [currentPing, setCurrentPing] = useState(latencyMs);
  const [customHost, setCustomHost] = useState('');
  const [connectingHost, setConnectingHost] = useState(false);
  const [scanning, setScanning] = useState(false);

  // LAN Peers on same Wi-Fi
  const [lanPeers, setLanPeers] = useState<any[]>([]);
  const [loadingLanPeers, setLoadingLanPeers] = useState(false);

  useEffect(() => {
    if (visible) {
      setCurrentPing(latencyMs);
      fetchLanPeers();
    }
  }, [visible, latencyMs]);

  const fetchLanPeers = async () => {
    try {
      setLoadingLanPeers(true);
      const peers = await getLanPeers();
      setLanPeers(peers);
    } catch {
      setLanPeers([]);
    } finally {
      setLoadingLanPeers(false);
    }
  };

  const handleTestPing = async () => {
    try {
      setTestingPing(true);
      const res = await pingServer();
      if (res.latencyMs >= 0) {
        setCurrentPing(res.latencyMs);
        Alert.alert(
          '⚡ Latency Measured',
          `Round-trip ping: ${res.latencyMs} ms\nRoute: ${
            res.isLocalLan ? 'Direct Local Wi-Fi (LAN)' : 'Remote Cloud Relay (WAN)'
          }\nServer IP: ${res.clientIp || activeHost}`
        );
      } else {
        Alert.alert('Ping Failed', 'Could not reach server. Check your connection.');
      }
    } finally {
      setTestingPing(false);
    }
  };

  const handleSelectPreset = async (host: string) => {
    try {
      setConnectingHost(true);
      const alive = await probeHost(host, 2000);
      if (!alive) {
        Alert.alert('Host Unreachable', `Cannot connect to server at ${host}:5000. Make sure the server is running on this IP.`);
        return;
      }
      await switchActiveHost(host, true);
      reconnectSocket();
      Alert.alert('Connected', `Successfully switched active host to ${host}:5000`);
      fetchLanPeers();
    } finally {
      setConnectingHost(false);
    }
  };

  const handleCustomConnect = async () => {
    const trimmed = customHost.trim().replace('http://', '').replace('https://', '').split(':')[0];
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a valid IP address or hostname.');
      return;
    }

    try {
      setConnectingHost(true);
      const alive = await probeHost(trimmed, 2500);
      if (!alive) {
        Alert.alert(
          'Connection Failed',
          `Cannot reach ${trimmed}:5000. Ensure both devices are on the same Wi-Fi or Hotspot.`
        );
        return;
      }
      await switchActiveHost(trimmed, true);
      setCustomHost('');
      reconnectSocket();
      Alert.alert('Connected', `Switched active server host to ${trimmed}:5000`);
      fetchLanPeers();
    } finally {
      setConnectingHost(false);
    }
  };

  const handleAutoScan = async () => {
    try {
      setScanning(true);
      const found = await autoDetectServerHost();
      if (found) {
        reconnectSocket();
        Alert.alert('🎉 Server Located', `Connected to CallFar Server at ${found}:5000 on this local network!`);
        fetchLanPeers();
      } else {
        Alert.alert(
          'Scan Complete',
          'Could not auto-detect a server on the candidate subnets. You can manually enter the server IP below.'
        );
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>📶 Network & Connectivity</Text>
              <Text style={styles.headerSub}>Same-Network LAN & Remote WAN Routing</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* ── Active Topology Status Card ── */}
            <View
              style={[
                styles.modeCard,
                isSameNetworkLan ? styles.modeCardLan : styles.modeCardWan,
              ]}
            >
              <View style={styles.modeHeaderRow}>
                <Text style={styles.modeIcon}>{isSameNetworkLan ? '🟢' : '🌐'}</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.modeTitle}>
                    {isSameNetworkLan
                      ? 'Local Network Mode (Same Wi-Fi)'
                      : 'Remote Network Mode (Internet WAN)'}
                  </Text>
                  <Text style={styles.modeBadgeText}>
                    {isSameNetworkLan
                      ? 'Direct P2P LAN • Zero Internet Data Usage'
                      : 'Encrypted Cloud Relay & PSTN Cellular Fallback'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    isConnected ? styles.statusPillConnected : styles.statusPillDisconnected,
                  ]}
                >
                  <Text style={styles.statusPillText}>
                    {isConnected ? 'LIVE' : 'DISCONNECTED'}
                  </Text>
                </View>
              </View>

              <Text style={styles.modeDesc}>
                {isSameNetworkLan
                  ? 'You and your friends on this Wi-Fi network communicate directly over the local network with crystal-clear HD audio, video, and instant messaging.'
                  : 'You and your friends on different networks or mobile cellular data communicate seamlessly via secure cloud WebRTC relay and global cellular routing.'}
              </Text>

              {/* Latency and IP row */}
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Ping Latency</Text>
                  <Text
                    style={[
                      styles.statVal,
                      { color: currentPing <= 15 ? '#34D399' : '#38BDF8' },
                    ]}
                  >
                    {currentPing >= 0 ? `${currentPing} ms` : 'Testing…'}
                  </Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Active Server</Text>
                  <Text style={styles.statVal} numberOfLines={1}>
                    {activeHost}:5000
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.testBtn}
                  onPress={handleTestPing}
                  disabled={testingPing}
                  activeOpacity={0.8}
                >
                  {testingPing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.testBtnText}>⚡ Ping</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Friends on Same Wi-Fi Network ── */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  📶 FRIENDS ON SAME LOCAL NETWORK ({lanPeers.length})
                </Text>
                <TouchableOpacity onPress={fetchLanPeers} disabled={loadingLanPeers}>
                  {loadingLanPeers ? (
                    <ActivityIndicator size="small" color="#38BDF8" />
                  ) : (
                    <Text style={styles.refreshText}>🔄 Refresh</Text>
                  )}
                </TouchableOpacity>
              </View>

              {lanPeers.length > 0 ? (
                lanPeers.map((p) => {
                  const pName = p.profile?.displayName || p.username;
                  return (
                    <View key={p.id} style={styles.peerCard}>
                      <Avatar
                        name={pName}
                        url={p.profile?.avatarUrl}
                        size={42}
                        isOnline={p.profile?.isOnline}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.peerName}>{pName}</Text>
                        <Text style={styles.peerSub}>🟢 Same Local Wi-Fi (Direct LAN)</Text>
                      </View>
                      <View style={styles.peerActions}>
                        {onStartChatWithPeer && (
                          <TouchableOpacity
                            style={styles.actionMiniBtn}
                            onPress={() => {
                              onClose();
                              onStartChatWithPeer(p);
                            }}
                          >
                            <Text style={styles.actionMiniText}>💬</Text>
                          </TouchableOpacity>
                        )}
                        {onCallPeer && (
                          <TouchableOpacity
                            style={[styles.actionMiniBtn, styles.callMiniBtn]}
                            onPress={() => {
                              onClose();
                              onCallPeer(p);
                            }}
                          >
                            <Text style={styles.actionMiniText}>📞</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyPeersBox}>
                  <Text style={styles.emptyPeersText}>
                    Any friend connected to this same Wi-Fi will automatically appear here for direct 0-data LAN calling & messaging!
                  </Text>
                </View>
              )}
            </View>

            {/* ── Auto-Detect & Server Switcher ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚙️ SERVER & LOCAL NETWORK HOST</Text>

              {/* Auto Scan Button */}
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={handleAutoScan}
                disabled={scanning}
                activeOpacity={0.8}
              >
                {scanning ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.scanBtnText}>🔍 Auto-Scan Local Network for Server</Text>
                )}
              </TouchableOpacity>

              {/* Candidate Presets */}
              <Text style={styles.presetLabel}>Quick Connect Presets:</Text>
              <View style={styles.presetRow}>
                {CANDIDATE_HOSTS.slice(0, 4).map((host) => {
                  const isActive = activeHost === host;
                  return (
                    <TouchableOpacity
                      key={host}
                      style={[styles.presetChip, isActive && styles.presetChipActive]}
                      onPress={() => handleSelectPreset(host)}
                      disabled={connectingHost}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          isActive && styles.presetChipTextActive,
                        ]}
                      >
                        {host === 'localhost'
                          ? '🔌 USB (localhost)'
                          : host === '192.168.43.1'
                          ? '📱 Hotspot'
                          : host === '10.0.2.2'
                          ? '🤖 Emulator'
                          : `📶 ${host}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Manual Custom IP Input */}
              <Text style={[styles.presetLabel, { marginTop: 14 }]}>
                Connect to Custom Server IP / Friend's Host:
              </Text>
              <View style={styles.customInputRow}>
                <TextInput
                  style={styles.customInput}
                  value={customHost}
                  onChangeText={setCustomHost}
                  placeholder="e.g. 192.168.1.100 or 172.23.224.248"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                />
                <TouchableOpacity
                  style={styles.connectBtn}
                  onPress={handleCustomConnect}
                  disabled={connectingHost || !customHost.trim()}
                  activeOpacity={0.8}
                >
                  {connectingHost ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.connectBtnText}>Connect</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
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
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    paddingHorizontal: 16,
  },
  backdrop: {
    ...(StyleSheet.absoluteFill as any),
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0F172A',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    padding: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 14,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
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
    paddingBottom: 10,
  },
  modeCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 18,
  },
  modeCardLan: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  modeCardWan: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.5)',
  },
  modeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeIcon: {
    fontSize: 22,
  },
  modeTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modeBadgeText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '600',
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillConnected: {
    backgroundColor: '#10B981',
  },
  statusPillDisconnected: {
    backgroundColor: '#EF4444',
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modeDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 10,
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  testBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  testBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  refreshText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  peerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 8,
  },
  peerName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  peerSub: {
    fontSize: 11,
    color: '#34D399',
    marginTop: 2,
  },
  peerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionMiniBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callMiniBtn: {
    backgroundColor: '#10B98125',
    borderColor: '#10B98150',
    borderWidth: 1,
  },
  actionMiniText: {
    fontSize: 14,
  },
  emptyPeersBox: {
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyPeersText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  scanBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  presetLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipActive: {
    backgroundColor: '#0284C730',
    borderColor: '#38BDF8',
  },
  presetChipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    backgroundColor: '#0A0F1D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
  },
  connectBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
