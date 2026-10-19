import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Backend Host Configuration with Automatic Multi-Host Detection & Cloud Routing:
 * - Online Cloud Server: Supports any HTTPS URL or domain (e.g., https://callfar.onrender.com or api.callfar.com)
 * - Local Wi-Fi / LAN: 172.23.224.248 (Wi-Fi IP directly reachable on same local network)
 * - Fallback: localhost (USB adb reverse mode)
 * - Android Hotspot: 192.168.43.1 (default Android tethering gateway)
 * - Android Emulator: 10.0.2.2
 */
export const PRIMARY_HOST = process.env.EXPO_PUBLIC_SERVER_URL || '172.23.224.248';
export const FALLBACK_HOST = 'localhost';

export const CANDIDATE_HOSTS = [
  PRIMARY_HOST,
  FALLBACK_HOST,
  '192.168.43.1', // Android Wi-Fi hotspot gateway
  '10.0.2.2',     // Android emulator gateway
  '192.168.1.1',  // Home Wi-Fi gateway
  '192.168.0.1',
];

export let currentActiveHost = PRIMARY_HOST;

/**
 * Normalizes any server host or URL into its API Base URL, WebSocket URL, and Health check URL.
 * Handles:
 * - Full HTTPS URLs (e.g., https://callfar.onrender.com, https://api.callfar.com)
 * - Full HTTP URLs (e.g., http://192.168.1.50:5000)
 * - Domain names without protocol (e.g., callfar.onrender.com) -> defaults to https
 * - IP addresses and localhost (e.g., 172.23.224.248, localhost, 10.0.2.2) -> defaults to http on port 5000
 */
export const normalizeServerTarget = (hostOrUrl: string) => {
  const raw = (hostOrUrl || '').trim();
  if (!raw) {
    return {
      apiUrl: `http://${FALLBACK_HOST}:5000/api/v1`,
      socketUrl: `http://${FALLBACK_HOST}:5000`,
      healthUrl: `http://${FALLBACK_HOST}:5000/health`,
      isCloud: false,
      displayHost: FALLBACK_HOST,
    };
  }

  const hasProtocol = raw.startsWith('http://') || raw.startsWith('https://');
  const isLocalIpOrHost = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(
    raw.replace(/^https?:\/\//i, '').split(':')[0]
  );

  let origin: string;
  let isCloud: boolean;

  if (hasProtocol) {
    origin = raw.replace(/\/+$/, '');
    isCloud = origin.startsWith('https://') || !isLocalIpOrHost;
  } else if (!isLocalIpOrHost && raw.includes('.')) {
    // Cloud domain without protocol -> treat as secure HTTPS cloud server
    origin = `https://${raw.replace(/\/+$/, '')}`;
    isCloud = true;
  } else {
    // Local LAN IP, USB localhost, or Emulator gateway
    const portPart = raw.includes(':') ? '' : ':5000';
    origin = `http://${raw.replace(/\/+$/, '')}${portPart}`;
    isCloud = false;
  }

  // If URL already ends with /api/v1, preserve it; otherwise append /api/v1 for REST
  const apiUrl = origin.endsWith('/api/v1') ? origin : `${origin}/api/v1`;
  const cleanOrigin = origin.replace(/\/api\/v1$/, '');

  return {
    apiUrl,
    socketUrl: cleanOrigin,
    healthUrl: `${cleanOrigin}/health`,
    isCloud,
    displayHost: cleanOrigin.replace(/^https?:\/\//i, ''),
  };
};

export const getApiBaseUrl = (host: string = currentActiveHost) => normalizeServerTarget(host).apiUrl;
export const getSocketUrl = (host: string = currentActiveHost) => normalizeServerTarget(host).socketUrl;
export const getHealthUrl = (host: string = currentActiveHost) => normalizeServerTarget(host).healthUrl;
export const isCloudServer = (host: string = currentActiveHost) => normalizeServerTarget(host).isCloud;

export const API_BASE_URL = getApiBaseUrl(PRIMARY_HOST);
export const SOCKET_URL = getSocketUrl(PRIMARY_HOST);

// In-Memory Token Cache to prevent async token retrieval drops
let inMemoryAuthToken: string | null = null;
type TokenChangeListener = (newToken: string | null) => void;
const tokenChangeListeners: TokenChangeListener[] = [];

export const onTokenChange = (listener: TokenChangeListener) => {
  tokenChangeListeners.push(listener);
  return () => {
    const idx = tokenChangeListeners.indexOf(listener);
    if (idx !== -1) tokenChangeListeners.splice(idx, 1);
  };
};

export const setMemoryAuthToken = (token: string | null) => {
  inMemoryAuthToken = token;
  tokenChangeListeners.forEach((cb) => {
    try {
      cb(token);
    } catch (e) {
      console.warn('[TokenListener error]:', e);
    }
  });
};

export const getMemoryAuthToken = (): string | null => inMemoryAuthToken;

// Host Change Listeners
type HostChangeListener = (newHost: string) => void;
const hostChangeListeners: HostChangeListener[] = [];

export const onHostChange = (listener: HostChangeListener) => {
  hostChangeListeners.push(listener);
  return () => {
    const idx = hostChangeListeners.indexOf(listener);
    if (idx !== -1) hostChangeListeners.splice(idx, 1);
  };
};

const notifyHostChange = (newHost: string) => {
  hostChangeListeners.forEach((cb) => {
    try {
      cb(newHost);
    } catch (e) {
      console.warn('[HostListener error]:', e);
    }
  });
};

/**
 * Switch active backend server host dynamically and optionally persist in AsyncStorage
 */
export const switchActiveHost = async (newHost: string, persist = true) => {
  if (!newHost || newHost === currentActiveHost) return;
  const oldHost = currentActiveHost;
  currentActiveHost = newHost;
  api.defaults.baseURL = getApiBaseUrl(newHost);

  if (persist) {
    try {
      await AsyncStorage.setItem('callfar_server_host', newHost);
    } catch {}
  }

  console.log(`[Host Switch] Changed backend host from ${oldHost} to ${newHost} (Cloud: ${isCloudServer(newHost)})`);
  notifyHostChange(newHost);
};

// Initialize saved host from storage
AsyncStorage.getItem('callfar_server_host').then((saved) => {
  if (saved && saved.trim()) {
    switchActiveHost(saved.trim(), false);
  }
}).catch(() => {});

/**
 * Probe a candidate host with a short timeout to see if CallFar server is reachable
 */
export const probeHost = async (host: string, timeoutMs = 2000): Promise<boolean> => {
  try {
    const healthUrl = getHealthUrl(host);
    const res = await axios.get(healthUrl, { timeout: timeoutMs });
    return res.data?.status === 'UP' || res.data?.status === 'DEGRADED';
  } catch {
    return false;
  }
};

/**
 * Auto-detect the best reachable CallFar server
 * Prioritizes custom saved host / cloud host first, then falls back to local candidates
 */
export const autoDetectServerHost = async (): Promise<string | null> => {
  // Check stored custom host first
  const stored = await AsyncStorage.getItem('callfar_server_host');
  if (stored && isCloudServer(stored)) {
    const isAlive = await probeHost(stored, 2500);
    if (isAlive) {
      await switchActiveHost(stored, false);
      return stored;
    }
  }

  const primaryCandidates = Array.from(new Set(stored ? [stored, ...CANDIDATE_HOSTS] : CANDIDATE_HOSTS));

  // Step 1: Probe priority candidates in parallel with 1500ms timeout
  const priorityChecks = primaryCandidates.map(async (host) => {
    const isAlive = await probeHost(host, 1500);
    return isAlive ? host : null;
  });

  const priorityResults = await Promise.all(priorityChecks);
  const foundPriority = priorityResults.find((h) => Boolean(h));
  if (foundPriority) {
    await switchActiveHost(foundPriority, true);
    return foundPriority;
  }

  // Step 2: If on cloud host, do not perform local subnet sweep
  if (isCloudServer(currentActiveHost)) {
    return null;
  }

  // Step 2: Fast subnet scan across common local Wi-Fi / Hotspot ranges
  // Focus on 172.23.224.x, 192.168.43.x (hotspot), and 192.168.1.x
  const subnetPrefixes = ['172.23.224', '192.168.43', '192.168.1', '192.168.0'];
  const targets: string[] = [];

  for (const prefix of subnetPrefixes) {
    // Add common server host machine assignments (1..30, and high ranges like 240..254)
    for (let i = 1; i <= 25; i++) {
      targets.push(`${prefix}.${i}`);
    }
    targets.push(`${prefix}.248`);
    targets.push(`${prefix}.100`);
    targets.push(`${prefix}.101`);
    targets.push(`${prefix}.102`);
  }

  const uniqueTargets = Array.from(new Set(targets)).filter((h) => !primaryCandidates.includes(h));

  // Probe in concurrent chunks of 15 hosts with 600ms timeout
  const chunkSize = 15;
  for (let i = 0; i < uniqueTargets.length; i += chunkSize) {
    const chunk = uniqueTargets.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(async (host) => {
      const isAlive = await probeHost(host, 700);
      return isAlive ? host : null;
    });

    const chunkResults = await Promise.all(chunkPromises);
    const found = chunkResults.find((h) => Boolean(h));
    if (found) {
      await switchActiveHost(found, true);
      return found;
    }
  }

  return null;
};

// Automatic startup health check & server discovery
setTimeout(async () => {
  const isCurrentAlive = await probeHost(currentActiveHost, 1500);
  if (!isCurrentAlive && !isCloudServer(currentActiveHost)) {
    console.log('[Host Auto-Detect] Current host unreachable, auto-scanning local network...');
    await autoDetectServerHost();
  }
}, 500);

/**
 * Measure real-time round-trip latency to active backend server
 */
export const pingServer = async (): Promise<{ latencyMs: number; clientIp?: string; isLocalLan: boolean }> => {
  const start = Date.now();
  try {
    const res = await api.post('/network/ping', {}, { timeout: 3500 });
    const latencyMs = Date.now() - start;
    const clientIp = res.data?.clientIp;
    const isLocalLan = !isCloudServer(currentActiveHost) && (latencyMs <= 15 || currentActiveHost.startsWith('172.') || currentActiveHost.startsWith('192.168.') || currentActiveHost === 'localhost');
    return { latencyMs, clientIp, isLocalLan };
  } catch (err) {
    return { latencyMs: -1, isLocalLan: false };
  }
};

/**
 * Fetch server and network diagnostics
 */
export const getNetworkDiagnostics = async () => {
  try {
    const res = await api.get('/network/diagnostics', { timeout: 4000 });
    return res.data?.data;
  } catch {
    return null;
  }
};

/**
 * Fetch relation between current user and target friend
 */
export const getPeerNetworkStatus = async (peerId: string) => {
  try {
    const res = await api.get(`/network/peer-status/${peerId}`, { timeout: 4000 });
    return res.data?.data;
  } catch {
    return null;
  }
};

/**
 * Fetch friends currently active on the SAME local network / Wi-Fi
 */
export const getLanPeers = async () => {
  try {
    const res = await api.get('/network/lan-peers', { timeout: 4000 });
    return res.data?.data?.peers || [];
  } catch {
    return [];
  }
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 8000,
});

// Request Interceptor: Attach Access Token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = inMemoryAuthToken || (await AsyncStorage.getItem('callfar_access_token'));
      if (token) {
        if (config.headers && typeof (config.headers as any).set === 'function') {
          (config.headers as any).set('Authorization', `Bearer ${token}`);
          (config.headers as any).set('x-access-token', token);
        } else {
          config.headers['Authorization'] = `Bearer ${token}`;
          config.headers['x-access-token'] = token;
        }
      }
    } catch {
      // Fallback if AsyncStorage throws
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Dual-Host Failover + Token Refresh
api.interceptors.response.use(
  (response) => {
    // Lock in the successfully responding host
    if (response.config.baseURL && response.config.baseURL.includes(FALLBACK_HOST)) {
      if (currentActiveHost !== FALLBACK_HOST) {
        currentActiveHost = FALLBACK_HOST;
        api.defaults.baseURL = getApiBaseUrl(FALLBACK_HOST);
        notifyHostChange(FALLBACK_HOST);
      }
    } else if (response.config.baseURL && response.config.baseURL.includes(PRIMARY_HOST)) {
      if (currentActiveHost !== PRIMARY_HOST) {
        currentActiveHost = PRIMARY_HOST;
        api.defaults.baseURL = getApiBaseUrl(PRIMARY_HOST);
        notifyHostChange(PRIMARY_HOST);
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 1. Dual-Host Failover on Network Error (only for local Wi-Fi / USB transition, not on cloud)
    if (!error.response && originalRequest && !originalRequest._hostRetried && !isCloudServer(currentActiveHost)) {
      originalRequest._hostRetried = true;
      const currentBase: string = originalRequest.baseURL || api.defaults.baseURL || API_BASE_URL;

      const newHost = currentBase.includes(PRIMARY_HOST) ? FALLBACK_HOST : PRIMARY_HOST;
      const oldHost = currentBase.includes(PRIMARY_HOST) ? PRIMARY_HOST : FALLBACK_HOST;

      currentActiveHost = newHost;
      api.defaults.baseURL = getApiBaseUrl(newHost);
      notifyHostChange(newHost);

      originalRequest.baseURL = currentBase.replace(oldHost, newHost);
      if (originalRequest.url && originalRequest.url.includes(oldHost)) {
        originalRequest.url = originalRequest.url.replace(oldHost, newHost);
      }

      console.log(`[API Failover] Switched to host: ${newHost}`);
      return api(originalRequest);
    }

    // 2. Token Expiration and Refresh (401)
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('callfar_refresh_token');
        if (!refreshToken) {
          return Promise.reject(error);
        }

        // Use active working host for token refresh
        const refreshBase = getApiBaseUrl(currentActiveHost);
        const res = await axios.post(`${refreshBase}/auth/refresh`, { refreshToken }, { timeout: 8000 });
        const { accessToken, refreshToken: newRefreshToken } = res.data?.data || {};

        if (accessToken) {
          setMemoryAuthToken(accessToken);
          await AsyncStorage.setItem('callfar_access_token', accessToken);
          if (newRefreshToken) {
            await AsyncStorage.setItem('callfar_refresh_token', newRefreshToken);
          }

          if (originalRequest.headers && typeof (originalRequest.headers as any).set === 'function') {
            (originalRequest.headers as any).set('Authorization', `Bearer ${accessToken}`);
            (originalRequest.headers as any).set('x-access-token', accessToken);
          } else {
            originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
            originalRequest.headers['x-access-token'] = accessToken;
          }

          return api(originalRequest);
        }
      } catch (refreshErr: any) {
        // ONLY clear stored session if backend explicitly rejected refresh token with 401/403
        if (refreshErr.response?.status === 401 || refreshErr.response?.status === 403) {
          setMemoryAuthToken(null);
          await AsyncStorage.multiRemove(['callfar_access_token', 'callfar_refresh_token', 'callfar_user']);
        }
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
