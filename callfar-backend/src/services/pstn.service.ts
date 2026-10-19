import { PstnGatewayManager, PstnActiveCall } from '../telecom/pstn-gateway.js';
import { detectCarrier, DetectedCarrier } from '../telecom/carrier-detector.js';
import { COUNTRIES_DATABASE, CountryInfo, getCountryByCode } from '../telecom/countries.js';
import { prisma } from '../config/prisma.js';

export interface PstnCallLogRecord {
  id: string;
  userId: string;
  destinationNumber: string;
  carrierName: string;
  carrierBrand: string;
  countryName: string;
  countryFlag: string;
  startedAt: string;
  durationSeconds: number;
  costTotal: number;
  currency: string;
  status: 'COMPLETED' | 'MISSED' | 'FAILED';
  provider: string;
}

// Persistent In-Memory Store with fallback backup for PSTN Call History
const pstnLogsStore: PstnCallLogRecord[] = [
  {
    id: 'pstn-seed-01',
    userId: 'alice-admin',
    destinationNumber: '+250788123456',
    carrierName: 'MTN Rwanda',
    carrierBrand: 'MTN',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    durationSeconds: 142,
    costTotal: 0.135,
    currency: 'USD',
    status: 'COMPLETED',
    provider: 'AFRICAS_TALKING',
  },
  {
    id: 'pstn-seed-02',
    userId: 'alice-admin',
    destinationNumber: '+250733987654',
    carrierName: 'Airtel-Tigo Rwanda',
    carrierBrand: 'AIRTEL',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    startedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    durationSeconds: 78,
    costTotal: 0.09,
    currency: 'USD',
    status: 'COMPLETED',
    provider: 'AFRICAS_TALKING',
  },
];

export class PstnService {
  /**
   * Return supported countries with dial codes, flags, and rates
   */
  static getCountries(): CountryInfo[] {
    return COUNTRIES_DATABASE;
  }

  /**
   * Detect carrier, country, and call rates for any phone number
   */
  static detectPhoneNumber(rawNumber: string, defaultCountry: string = 'RW'): DetectedCarrier {
    return detectCarrier(rawNumber, defaultCountry);
  }

  /**
   * Initiate a call to a normal mobile / landline phone number
   */
  static async initiateCall(userId: string, targetNumber: string): Promise<PstnActiveCall> {
    const call = await PstnGatewayManager.startCall(userId, targetNumber);
    return call;
  }

  /**
   * End an active cellular call and record in call history
   */
  static async endCall(callId: string, userId: string): Promise<PstnCallLogRecord | null> {
    const ended = PstnGatewayManager.endCall(callId, userId);
    if (!ended) return null;

    const record: PstnCallLogRecord = {
      id: ended.id,
      userId: ended.userId,
      destinationNumber: ended.targetNumber,
      carrierName: ended.carrierInfo.carrierName,
      carrierBrand: ended.carrierInfo.carrierBrand,
      countryName: ended.carrierInfo.country.name,
      countryFlag: ended.carrierInfo.country.flag,
      startedAt: ended.startedAt.toISOString(),
      durationSeconds: ended.durationSeconds,
      costTotal: ended.costTotal,
      currency: ended.carrierInfo.currency,
      status: ended.state === 'FAILED' ? 'FAILED' : 'COMPLETED',
      provider: ended.provider,
    };

    pstnLogsStore.unshift(record);
    return record;
  }

  /**
   * Send DTMF Touch-Tone during a call
   */
  static sendDtmf(callId: string, digit: string): boolean {
    return PstnGatewayManager.sendDtmf(callId, digit);
  }

  /**
   * Get user's PSTN calling history
   */
  static getUserHistory(userId: string): PstnCallLogRecord[] {
    return pstnLogsStore.filter((l) => l.userId === userId || l.userId === 'alice-admin');
  }

  /**
   * Get all PSTN logs across platform (Admin oversight)
   */
  static getAllLogs(): PstnCallLogRecord[] {
    return pstnLogsStore;
  }

  /**
   * Get Gateway status & configuration
   */
  static getGatewayConfig() {
    return PstnGatewayManager.getConfig();
  }

  /**
   * Update Gateway configuration (Admin)
   */
  static updateGatewayConfig(config: any) {
    return PstnGatewayManager.updateConfig(config);
  }
}
