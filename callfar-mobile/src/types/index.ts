export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  isOnline: boolean;
  lastSeen: string;
}

export interface UserSettings {
  id: string;
  theme: string;
  allowIncomingCalls: boolean;
  allowReadReceipts: boolean;
  callRingtone: string;
  notificationsEnabled: boolean;
}

export type LicenseTier = 'FREE' | 'PRO' | 'ENTERPRISE' | 'MASTER_ADMIN';
export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';

export interface UserLicense {
  id: string;
  userId: string;
  tier: LicenseTier;
  status: LicenseStatus;
  maxCallDurationMinutes: number; // -1 for unlimited
  canVideoCall: boolean;
  canHdAudio: boolean;
  canScreenShare: boolean;
  canRecordCalls: boolean;
  priorityTurn: boolean;
  expiresAt?: string | null;
  licenseKey?: string | null;
  issuedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LicenseKey {
  id: string;
  key: string;
  tier: LicenseTier;
  durationDays: number;
  isRedeemed: boolean;
  redeemedById?: string | null;
  redeemedAt?: string | null;
  createdById: string;
  notes?: string | null;
  createdAt: string;
  creator?: {
    id: string;
    username: string;
    profile?: { displayName: string };
  };
  redeemer?: {
    id: string;
    username: string;
    email: string;
    profile?: { displayName: string };
  };
}

export interface SystemStats {
  overview: {
    totalUsers: number;
    activeUsers: number;
    onlineUsers: number;
    adminCount: number;
    memberCount: number;
  };
  calling: {
    totalCalls: number;
    completedCalls: number;
    activeCalls: number;
    totalDurationMinutes: number;
  };
  messaging: {
    totalMessages: number;
  };
  licensing: {
    tiers: Record<string, number>;
    totalKeysGenerated: number;
    keysRedeemed: number;
    keysAvailable: number;
  };
  systemHealth: {
    status: string;
    uptimeSeconds: number;
    uptimeFormatted: string;
    nodeVersion: string;
    platform: string;
    memoryUsageMB: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
    };
  };
}

export interface User {
  id: string;
  email: string;
  username: string;
  phoneNumber?: string | null;
  role?: 'ADMIN' | 'MEMBER';
  isActive?: boolean;
  profile: UserProfile;
  settings: UserSettings;
  license?: UserLicense;
}

export interface Contact {
  id: string;
  contactUserId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  isOnline: boolean;
  lastSeen: string;
}

export interface ContactRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  sender?: {
    id: string;
    username: string;
    profile: { displayName: string; avatarUrl?: string | null };
  };
  receiver?: {
    id: string;
    username: string;
    profile: { displayName: string; avatarUrl?: string | null };
  };
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  createdAt: string;
  sender?: {
    id: string;
    username: string;
    profile: { displayName: string; avatarUrl?: string | null };
  };
}

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string;
  peer?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    isOnline: boolean;
    lastSeen: string;
  } | null;
  lastMessage?: Message | null;
  updatedAt: string;
}

export interface CallRecord {
  id: string;
  callType: 'VOICE' | 'VIDEO';
  status: 'INITIATED' | 'RINGING' | 'ONGOING' | 'COMPLETED' | 'REJECTED' | 'MISSED' | 'FAILED';
  isOutgoing: boolean;
  peer: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
  startedAt: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds: number;
}

export interface CountryInfo {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  ratePerMin: number;
  currency: string;
  primaryCarriers: string[];
}

export interface DetectedCarrier {
  isValid: boolean;
  rawInput: string;
  e164: string;
  displayFormat: string;
  country: CountryInfo;
  carrierName: string;
  carrierBrand: 'MTN' | 'AIRTEL' | 'TIGO' | 'SAFARICOM' | 'VODACOM' | 'OTHER';
  carrierColor: string;
  networkType: 'MOBILE_GSM' | 'LANDLINE' | 'SATELLITE' | 'TOLL_FREE';
  ratePerMinute: number;
  currency: string;
}

export interface PstnCallRecord {
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
