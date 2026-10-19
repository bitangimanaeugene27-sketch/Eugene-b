import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import {
  currentActiveHost,
  switchActiveHost,
  autoDetectServerHost,
  probeHost,
  onHostChange,
  isCloudServer,
  normalizeServerTarget,
} from '../../api/client';
import { THEME } from '../../styles/theme';

export const ServerStatusBar = () => {
  const [activeHost, setActiveHost] = useState(currentActiveHost);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customIp, setCustomIp] = useState('');

  // Check connection status
  const checkStatus = async (hostToTest = activeHost) => {
    const alive = await probeHost(hostToTest, 2000);
    setIsOnline(alive);
  };

  useEffect(() => {
    checkStatus();
    const unsub = onHostChange((newHost) => {
      setActiveHost(newHost);
      checkStatus(newHost);
    });

    const interval = setInterval(() => {
      checkStatus();
    }, 6000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [activeHost]);

  const handleAutoScan = async () => {
    setScanning(true);
    try {
      const found = await autoDetectServerHost();
      if (found) {
        setActiveHost(found);
        setIsOnline(true);
        const isCloud = isCloudServer(found);
        Alert.alert(
          'Server Connected! 📡',
          isCloud
            ? `Connected to online cloud server at ${found}`
            : `Connected to CallFar server on local Wi-Fi at ${found}:5000`
        );
      } else {
        setIsOnline(false);
        Alert.alert(
          'Scan Finished',
          'Could not find a local CallFar server automatically. You can enter an online Cloud HTTPS URL or local Wi-Fi IP in Server Settings (⚙️).'
        );
      }
    } catch {
      setIsOnline(false);
    } finally {
      setScanning(false);
    }
  };

  const handleApplyCustomIp = async () => {
    const raw = customIp.trim();
    if (!raw) return;

    // Properly normalize: keep full http/https if present; if domain with dots treat as HTTPS; else treat as local host
    const clean = raw.startsWith('http://') || raw.startsWith('https://')
      ? raw
      : raw.includes('.') && !/^[0-9.]+$/.test(raw)
      ? `https://${raw}`
      : raw.replace(/^https?:\/\//, '').replace(/:[0-9]+$/, '');

    setScanning(true);
    const alive = await probeHost(clean, 2500);
    setScanning(false);

    if (alive) {
      await switchActiveHost(clean, true);
      setActiveHost(clean);
      setIsOnline(true);
      setShowCustomInput(false);
      Alert.alert('✅ Connected', `CallFar connected to: ${clean}`);
    } else {
      Alert.alert(
        'Unreachable',
        `No CallFar server responded at ${clean}. Check the address or make sure your server is online.`
      );
    }
  };

  const target = normalizeServerTarget(activeHost);
  const displayLabel = target.isCloud
    ? `Cloud: ${target.displayHost}`
    : `Wi-Fi: ${target.displayHost}:5000`;

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <View style={styles.statusIndicator}>
          <View
            style={[
              styles.dot,
              isOnline === true
                ? styles.dotOnline
                : isOnline === false
                ? styles.dotOffline
                : styles.dotChecking,
            ]}
          />
          <Text style={styles.statusText} numberOfLines={1}>
            {isOnline === true
              ? displayLabel
              : isOnline === false
              ? 'Server: Offline'
              : 'Connecting…'}
          </Text>
        </View>

        <View style={styles.btnRow}>
          {/* Auto Scan Network */}
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={handleAutoScan}
            disabled={scanning}
            activeOpacity={0.8}
          >
            {scanning ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.scanBtnText}>📡 Auto-Scan</Text>
            )}
          </TouchableOpacity>

          {/* Edit / Custom IP */}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setShowCustomInput((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Text style={styles.editBtnText}>{showCustomInput ? '✕' : '⚙️'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Custom IP input drawer */}
      {showCustomInput && (
        <View style={styles.customIpDrawer}>
          <Text style={styles.drawerLabel}>Connect to Online Cloud Server or Local Wi-Fi:</Text>
          <View style={styles.quickPresetRow}>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => setCustomIp('https://')}
              activeOpacity={0.8}
            >
              <Text style={styles.presetChipText}>🌐 Cloud HTTPS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => setCustomIp('172.23.224.248')}
              activeOpacity={0.8}
            >
              <Text style={styles.presetChipText}>🏠 Local Wi-Fi</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. https://... or 172.23.224.248"
              placeholderTextColor={THEME.colors.textMuted}
              value={customIp}
              onChangeText={setCustomIp}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={handleApplyCustomIp}
              activeOpacity={0.8}
            >
              <Text style={styles.connectBtnText}>Connect</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(21, 29, 48, 0.85)',
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 8,
  },
  dotOnline: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowRadius: 6,
    shadowOpacity: 0.8,
  },
  dotOffline: {
    backgroundColor: '#EF4444',
  },
  dotChecking: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  editBtn: {
    backgroundColor: THEME.colors.surfaceHover,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.sm,
  },
  editBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
  },
  customIpDrawer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  drawerLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginBottom: 8,
  },
  quickPresetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  presetChip: {
    backgroundColor: THEME.colors.surfaceHover,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  presetChipText: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: THEME.colors.textPrimary,
    fontSize: 13,
  },
  connectBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.sm,
  },
  connectBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
