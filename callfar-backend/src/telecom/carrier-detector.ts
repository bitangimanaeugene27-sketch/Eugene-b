import { COUNTRIES_DATABASE, CountryInfo } from './countries.js';

export interface DetectedCarrier {
  isValid: boolean;
  rawInput: string;
  e164: string;               // +250788123456
  displayFormat: string;      // +250 788 123 456
  country: CountryInfo;
  carrierName: string;        // "MTN Rwanda", "Airtel-Tigo", etc.
  carrierBrand: 'MTN' | 'AIRTEL' | 'TIGO' | 'SAFARICOM' | 'VODACOM' | 'OTHER';
  carrierColor: string;       // #FFCC00 (MTN), #ED1C24 (Airtel), #003399 (Tigo), etc.
  networkType: 'MOBILE_GSM' | 'LANDLINE' | 'SATELLITE' | 'TOLL_FREE';
  ratePerMinute: number;
  currency: string;
  notes?: string;
}

/**
 * Clean and normalize phone number into standard digits
 */
export function sanitizePhoneNumber(input: string): string {
  if (!input) return '';
  const hasPlus = input.trim().startsWith('+');
  const digitsOnly = input.replace(/\D/g, '');
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Detect country and telecom carrier for any local or international number
 */
export function detectCarrier(input: string, defaultCountryCode: string = 'RW'): DetectedCarrier {
  const sanitized = sanitizePhoneNumber(input);
  let e164 = sanitized;

  // If local Rwanda number starting with 078/079/072/073/025 (9-10 digits)
  if (defaultCountryCode === 'RW' && !sanitized.startsWith('+')) {
    if (sanitized.startsWith('0') && sanitized.length === 10) {
      e164 = `+250${sanitized.substring(1)}`;
    } else if (sanitized.length === 9 && (sanitized.startsWith('7') || sanitized.startsWith('2'))) {
      e164 = `+250${sanitized}`;
    } else {
      e164 = `+${sanitized}`;
    }
  } else if (!e164.startsWith('+')) {
    e164 = `+${e164}`;
  }

  // 1. Identify Country
  let matchedCountry: CountryInfo | undefined;

  // Try matching longest dialCode first (e.g. +250 before +25)
  const sortedCountries = [...COUNTRIES_DATABASE].sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  );

  for (const c of sortedCountries) {
    if (e164.startsWith(c.dialCode)) {
      matchedCountry = c;
      break;
    }
  }

  if (!matchedCountry) {
    matchedCountry = {
      code: 'INTL',
      name: 'International',
      dialCode: '+',
      flag: '🌐',
      ratePerMin: 0.1,
      currency: 'USD',
      primaryCarriers: ['Global PSTN'],
    };
  }

  // 2. Identify Carrier & Network Type
  const localPart = e164.substring(matchedCountry.dialCode.length);
  let carrierName = `${matchedCountry.name} Telecom`;
  let carrierBrand: DetectedCarrier['carrierBrand'] = 'OTHER';
  let carrierColor = '#3B82F6';
  let networkType: DetectedCarrier['networkType'] = 'MOBILE_GSM';

  // ── Specific Carrier Detection Rules ──

  // RWANDA (+250)
  if (matchedCountry.code === 'RW') {
    if (localPart.startsWith('78') || localPart.startsWith('79')) {
      carrierName = 'MTN Rwanda';
      carrierBrand = 'MTN';
      carrierColor = '#FBBF24'; // MTN Yellow
    } else if (localPart.startsWith('72') || localPart.startsWith('73')) {
      carrierName = 'Airtel-Tigo Rwanda';
      carrierBrand = 'AIRTEL';
      carrierColor = '#EF4444'; // Airtel Red
    } else if (localPart.startsWith('25')) {
      carrierName = 'Liquid Telecom Landline';
      networkType = 'LANDLINE';
      carrierColor = '#60A5FA';
    }
  }

  // KENYA (+254)
  else if (matchedCountry.code === 'KE') {
    if (
      localPart.startsWith('70') ||
      localPart.startsWith('71') ||
      localPart.startsWith('72') ||
      localPart.startsWith('79') ||
      localPart.startsWith('74')
    ) {
      carrierName = 'Safaricom (M-Pesa)';
      carrierBrand = 'SAFARICOM';
      carrierColor = '#10B981'; // Safaricom Green
    } else if (localPart.startsWith('73') || localPart.startsWith('78') || localPart.startsWith('75')) {
      carrierName = 'Airtel Kenya';
      carrierBrand = 'AIRTEL';
      carrierColor = '#EF4444';
    } else if (localPart.startsWith('77')) {
      carrierName = 'Telkom Kenya';
      carrierColor = '#0284C7';
    }
  }

  // UGANDA (+256)
  else if (matchedCountry.code === 'UG') {
    if (localPart.startsWith('77') || localPart.startsWith('78') || localPart.startsWith('76')) {
      carrierName = 'MTN Uganda';
      carrierBrand = 'MTN';
      carrierColor = '#FBBF24';
    } else if (localPart.startsWith('70') || localPart.startsWith('75') || localPart.startsWith('74')) {
      carrierName = 'Airtel Uganda';
      carrierBrand = 'AIRTEL';
      carrierColor = '#EF4444';
    } else if (localPart.startsWith('71')) {
      carrierName = 'Uganda Telecom';
      carrierColor = '#065F46';
    }
  }

  // TANZANIA (+255)
  else if (matchedCountry.code === 'TZ') {
    if (localPart.startsWith('74') || localPart.startsWith('75') || localPart.startsWith('76')) {
      carrierName = 'Vodacom Tanzania';
      carrierBrand = 'VODACOM';
      carrierColor = '#DC2626';
    } else if (localPart.startsWith('78') || localPart.startsWith('79')) {
      carrierName = 'Airtel Tanzania';
      carrierBrand = 'AIRTEL';
      carrierColor = '#EF4444';
    } else if (localPart.startsWith('71') || localPart.startsWith('65') || localPart.startsWith('67')) {
      carrierName = 'Tigo Tanzania';
      carrierBrand = 'TIGO';
      carrierColor = '#0284C7';
    } else if (localPart.startsWith('62')) {
      carrierName = 'Halotel';
      carrierColor = '#EA580C';
    }
  }

  // NIGERIA (+234)
  else if (matchedCountry.code === 'NG') {
    if (
      localPart.startsWith('803') ||
      localPart.startsWith('806') ||
      localPart.startsWith('813') ||
      localPart.startsWith('816') ||
      localPart.startsWith('703')
    ) {
      carrierName = 'MTN Nigeria';
      carrierBrand = 'MTN';
      carrierColor = '#FBBF24';
    } else if (
      localPart.startsWith('802') ||
      localPart.startsWith('808') ||
      localPart.startsWith('812') ||
      localPart.startsWith('708')
    ) {
      carrierName = 'Airtel Nigeria';
      carrierBrand = 'AIRTEL';
      carrierColor = '#EF4444';
    } else if (localPart.startsWith('805') || localPart.startsWith('807')) {
      carrierName = 'Glo Mobile Nigeria';
      carrierColor = '#16A34A';
    }
  }

  // GHANA (+233)
  else if (matchedCountry.code === 'GH') {
    if (
      localPart.startsWith('24') ||
      localPart.startsWith('54') ||
      localPart.startsWith('55') ||
      localPart.startsWith('59')
    ) {
      carrierName = 'MTN Ghana';
      carrierBrand = 'MTN';
      carrierColor = '#FBBF24';
    } else if (localPart.startsWith('20') || localPart.startsWith('50')) {
      carrierName = 'Telecel Ghana';
      carrierColor = '#DC2626';
    } else if (localPart.startsWith('27') || localPart.startsWith('57') || localPart.startsWith('26')) {
      carrierName = 'AT (AirtelTigo Ghana)';
      carrierBrand = 'AIRTEL';
      carrierColor = '#EF4444';
    }
  }

  // USA / CANADA (+1)
  else if (matchedCountry.code === 'US' || matchedCountry.code === 'CA') {
    carrierName = matchedCountry.code === 'US' ? 'US Cellular / PSTN' : 'Canada Cellular';
    carrierColor = '#2563EB';
  }

  // UK (+44)
  else if (matchedCountry.code === 'GB') {
    carrierName = 'UK Mobile & Landline';
    carrierColor = '#4338CA';
  }

  // Formatting helper: e.g. +250 788 123 456
  let displayFormat = e164;
  if (localPart.length >= 7) {
    displayFormat = `${matchedCountry.dialCode} ${localPart.substring(0, 3)} ${localPart.substring(3, 6)} ${localPart.substring(6)}`;
  } else if (localPart.length >= 3) {
    displayFormat = `${matchedCountry.dialCode} ${localPart.substring(0, 3)} ${localPart.substring(3)}`;
  }

  const isValid = e164.length >= 8 && e164.length <= 16;

  return {
    isValid,
    rawInput: input,
    e164,
    displayFormat: displayFormat.trim(),
    country: matchedCountry,
    carrierName,
    carrierBrand,
    carrierColor,
    networkType,
    ratePerMinute: matchedCountry.ratePerMin,
    currency: matchedCountry.currency,
  };
}
