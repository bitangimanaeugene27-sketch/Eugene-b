import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Vibration,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getMemoryAuthToken } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { THEME } from '../../styles/theme';
import { CountryInfo, DetectedCarrier } from '../../types';

interface KeypadButtonProps {
  digit: string;
  sub?: string;
  onPress: (digit: string) => void;
  onLongPress?: (digit: string) => void;
}

const KeypadBtn: React.FC<KeypadButtonProps> = ({ digit, sub, onPress, onLongPress }) => (
  <TouchableOpacity
    style={styles.keypadBtn}
    onPress={() => {
      if (Platform.OS !== 'web') Vibration.vibrate(10);
      onPress(digit);
    }}
    onLongPress={() => onLongPress && onLongPress(digit)}
    activeOpacity={0.65}
    delayLongPress={450}
  >
    <Text style={styles.keypadDigit}>{digit}</Text>
    {sub ? <Text style={styles.keypadSub}>{sub}</Text> : null}
  </TouchableOpacity>
);

export const DialpadScreen = ({ navigation, route }: any) => {
  const { token } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState(route?.params?.initialNumber || '');
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>({
    code: 'RW',
    name: 'Rwanda',
    dialCode: '+250',
    flag: '🇷🇼',
    ratePerMin: 0.045,
    currency: 'USD',
    primaryCarriers: ['MTN Rwanda', 'Airtel Rwanda'],
  });
  const [detectedCarrier, setDetectedCarrier] = useState<DetectedCarrier | null>(null);
  const [isCountryModalVisible, setIsCountryModalVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [isDialing, setIsDialing] = useState(false);

  // Sync initial number if passed via navigation
  useEffect(() => {
    if (route?.params?.initialNumber) {
      setPhoneNumber(route.params.initialNumber);
    }
  }, [route?.params?.initialNumber]);

  // Load countries database from backend
  useEffect(() => {
    api
      .get('/pstn/countries')
      .then((res) => {
        if (res.data?.data) {
          setCountries(res.data.data);
          const rw = res.data.data.find((c: CountryInfo) => c.code === 'RW');
          if (rw) setSelectedCountry(rw);
        }
      })
      .catch(() => {});
  }, []);

  // Live Carrier Recognition as user types
  useEffect(() => {
    if (!phoneNumber.trim()) {
      setDetectedCarrier(null);
      return;
    }

    const fullNumber = phoneNumber.startsWith('+')
      ? phoneNumber
      : `${selectedCountry.dialCode}${phoneNumber.startsWith('0') ? phoneNumber.substring(1) : phoneNumber}`;

    const timer = setTimeout(() => {
      api
        .get(`/pstn/detect?phoneNumber=${encodeURIComponent(fullNumber)}&country=${selectedCountry.code}`)
        .then((res) => {
          if (res.data?.data) {
            setDetectedCarrier(res.data.data);
          }
        })
        .catch(() => {});
    }, 150);

    return () => clearTimeout(timer);
  }, [phoneNumber, selectedCountry]);

  const handleDigitPress = (digit: string) => {
    setPhoneNumber((prev: string) => prev + digit);
  };

  const handleZeroLongPress = () => {
    setPhoneNumber((prev: string) => prev + '+');
  };

  const handleBackspace = () => {
    setPhoneNumber((prev: string) => (prev.length > 0 ? prev.slice(0, -1) : ''));
  };

  const handleClearAll = () => {
    setPhoneNumber('');
  };

  const handleInitiateCall = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Enter Number', 'Please enter a mobile or international phone number to call.');
      return;
    }

    const target = phoneNumber.startsWith('+')
      ? phoneNumber
      : `${selectedCountry.dialCode}${phoneNumber.startsWith('0') ? phoneNumber.substring(1) : phoneNumber}`;

    try {
      setIsDialing(true);
      const authToken = token || getMemoryAuthToken() || (await AsyncStorage.getItem('callfar_access_token'));
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        headers['x-access-token'] = authToken;
      }

      const res = await api.post(
        '/pstn/call',
        { phoneNumber: target },
        { headers: Object.keys(headers).length > 0 ? headers : undefined }
      );
      const callData = res.data?.data;

      // Navigate to active PSTN calling screen
      navigation.navigate('ActivePstnCall', {
        callId: callData.id,
        targetNumber: callData.targetNumber,
        carrierInfo: callData.carrierInfo,
      });
    } catch (err: any) {
      Alert.alert(
        'Call Notice',
        err.response?.data?.message || 'Could not connect to telecom carrier gateway.'
      );
    } finally {
      setIsDialing(false);
    }
  };

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries;
    const term = countrySearch.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.dialCode.includes(term) ||
        c.code.toLowerCase().includes(term)
    );
  }, [countries, countrySearch]);

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Cellular & International Dialpad</Text>
          <Text style={styles.headerSub}>Call MTN, Airtel, Tigo & Global Networks</Text>
        </View>
      </View>

      {/* ── Country Selector & Number Input ── */}
      <View style={styles.dialDisplayCard}>
        <TouchableOpacity
          style={styles.countryPickerBtn}
          onPress={() => setIsCountryModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.countryFlagText}>{selectedCountry.flag}</Text>
          <Text style={styles.countryDialText}>{selectedCountry.dialCode}</Text>
          <Text style={styles.countryChevron}>▾</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.numberInput}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="Enter phone number..."
          placeholderTextColor="#475569"
          keyboardType="phone-pad"
          selectionColor="#38BDF8"
        />

        {phoneNumber.length > 0 && (
          <TouchableOpacity
            style={styles.backspaceBtn}
            onPress={handleBackspace}
            onLongPress={handleClearAll}
          >
            <Text style={styles.backspaceText}>⌫</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Live Carrier Recognition Badge ── */}
      {detectedCarrier && detectedCarrier.carrierName ? (
        <View style={[styles.carrierBanner, { borderColor: detectedCarrier.carrierColor + '60' }]}>
          <View style={[styles.carrierDot, { backgroundColor: detectedCarrier.carrierColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.carrierNameText}>
              {detectedCarrier.carrierName} ({detectedCarrier.country.name})
            </Text>
            <Text style={styles.carrierSubText}>
              Rate: ~${detectedCarrier.ratePerMinute.toFixed(3)}/min • {detectedCarrier.networkType}
            </Text>
          </View>
          <Text style={styles.carrierFlag}>{detectedCarrier.country.flag}</Text>
        </View>
      ) : (
        <View style={styles.presetRow}>
          <Text style={styles.presetLabel}>Quick Prefix:</Text>
          {['078', '079', '073', '072'].map((prefix) => (
            <TouchableOpacity
              key={prefix}
              style={[
                styles.prefixPill,
                prefix.startsWith('078') || prefix.startsWith('079')
                  ? styles.prefixPillMtn
                  : styles.prefixPillAirtel,
              ]}
              onPress={() => setPhoneNumber(prefix)}
            >
              <Text
                style={[
                  styles.prefixPillText,
                  prefix.startsWith('078') || prefix.startsWith('079')
                    ? { color: '#FCD34D' }
                    : { color: '#FCA5A5' },
                ]}
              >
                {prefix} ({prefix.startsWith('078') || prefix.startsWith('079') ? 'MTN' : 'Airtel'})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Keypad Grid (1-9, *, 0, #) ── */}
      <View style={styles.keypadContainer}>
        <View style={styles.keypadRow}>
          <KeypadBtn digit="1" sub="Voicemail" onPress={handleDigitPress} />
          <KeypadBtn digit="2" sub="A B C" onPress={handleDigitPress} />
          <KeypadBtn digit="3" sub="D E F" onPress={handleDigitPress} />
        </View>

        <View style={styles.keypadRow}>
          <KeypadBtn digit="4" sub="G H I" onPress={handleDigitPress} />
          <KeypadBtn digit="5" sub="J K L" onPress={handleDigitPress} />
          <KeypadBtn digit="6" sub="M N O" onPress={handleDigitPress} />
        </View>

        <View style={styles.keypadRow}>
          <KeypadBtn digit="7" sub="P Q R S" onPress={handleDigitPress} />
          <KeypadBtn digit="8" sub="T U V" onPress={handleDigitPress} />
          <KeypadBtn digit="9" sub="W X Y Z" onPress={handleDigitPress} />
        </View>

        <View style={styles.keypadRow}>
          <KeypadBtn digit="*" sub="" onPress={handleDigitPress} />
          <KeypadBtn digit="0" sub="+" onPress={handleDigitPress} onLongPress={handleZeroLongPress} />
          <KeypadBtn digit="#" sub="" onPress={handleDigitPress} />
        </View>
      </View>

      {/* ── Call Action Button ── */}
      <View style={styles.callActionRow}>
        <TouchableOpacity
          style={[styles.callBtn, isDialing && { opacity: 0.7 }]}
          onPress={handleInitiateCall}
          disabled={isDialing}
          activeOpacity={0.8}
        >
          {isDialing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.callBtnContent}>
              <Text style={styles.callBtnIcon}>📞</Text>
              <Text style={styles.callBtnText}>
                {detectedCarrier?.carrierName
                  ? `Dial on ${detectedCarrier.carrierBrand || 'Cellular'}`
                  : 'Start Cellular Call'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Country Picker Modal ── */}
      <Modal visible={isCountryModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Destination Country</Text>
              <TouchableOpacity onPress={() => setIsCountryModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalSearch}
              placeholder="Search country name or code..."
              placeholderTextColor="#94A3B8"
              value={countrySearch}
              onChangeText={setCountrySearch}
            />

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    selectedCountry.code === item.code && styles.countryItemActive,
                  ]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setIsCountryModalVisible(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={styles.itemFlag}>{item.flag}</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCarriers}>{item.primaryCarriers.join(' • ')}</Text>
                  </View>
                  <Text style={styles.itemDial}>{item.dialCode}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070B14',
    paddingHorizontal: 20,
    paddingTop: 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 24,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },

  // Display Box
  dialDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F293D',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  countryPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 10,
  },
  countryFlagText: {
    fontSize: 20,
    marginRight: 6,
  },
  countryDialText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  countryChevron: {
    color: '#94A3B8',
    fontSize: 12,
    marginLeft: 4,
  },
  numberInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  backspaceBtn: {
    padding: 8,
  },
  backspaceText: {
    color: '#EF4444',
    fontSize: 22,
  },

  // Carrier Banner
  carrierBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101B2E',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  carrierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  carrierNameText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  carrierSubText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  carrierFlag: {
    fontSize: 24,
    marginLeft: 8,
  },

  // Quick Prefix Pills
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 6,
  },
  presetLabel: {
    color: '#64748B',
    fontSize: 11.5,
    marginRight: 4,
  },
  prefixPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  prefixPillMtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
  },
  prefixPillAirtel: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  prefixPillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Keypad
  keypadContainer: {
    marginVertical: 4,
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  keypadBtn: {
    width: 82,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1F293D',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  keypadDigit: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  keypadSub: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: -2,
    letterSpacing: 1,
  },

  // Call Button
  callActionRow: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  callBtn: {
    width: '80%',
    backgroundColor: '#10B981',
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  callBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callBtnIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  // Country Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  modalClose: {
    color: '#94A3B8',
    fontSize: 18,
    padding: 4,
  },
  modalSearch: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 14,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  countryItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderRadius: 8,
  },
  itemFlag: {
    fontSize: 26,
  },
  itemName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  itemCarriers: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  itemDial: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default DialpadScreen;
