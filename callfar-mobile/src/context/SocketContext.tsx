import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSocketUrl,
  currentActiveHost,
  onHostChange,
  onTokenChange,
  getMemoryAuthToken,
  pingServer,
} from '../api/client';
import { useAuth } from './AuthContext';

export type NetworkMode = 'SAME_NETWORK_LAN' | 'REMOTE_NETWORK_WAN';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  activeHost: string;
  latencyMs: number;
  isSameNetworkLan: boolean;
  networkMode: NetworkMode;
  reconnectSocket: () => void;
  measureLatency: () => Promise<number>;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  activeHost: currentActiveHost,
  latencyMs: -1,
  isSameNetworkLan: true,
  networkMode: 'SAME_NETWORK_LAN',
  reconnectSocket: () => {},
  measureLatency: async () => -1,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeHost, setActiveHost] = useState(currentActiveHost);
  const [latencyMs, setLatencyMs] = useState<number>(3);
  const [isSameNetworkLan, setIsSameNetworkLan] = useState<boolean>(true);

  const socketRef = useRef<Socket | null>(null);
  const activeTokenRef = useRef<string | null>(token);
  activeTokenRef.current = token;

  const measureLatency = useCallback(async (): Promise<number> => {
    const res = await pingServer();
    if (res.latencyMs >= 0) {
      setLatencyMs(res.latencyMs);
      setIsSameNetworkLan(res.isLocalLan);
      return res.latencyMs;
    }
    return -1;
  }, []);

  const connectToHost = useCallback(
    (host: string, currentToken: string) => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const url = getSocketUrl(host);
      console.log(`[Socket] Connecting to ${url} ...`);

      const socketInstance = io(url, {
        auth: { token: currentToken },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 30,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      socketInstance.on('connect', () => {
        console.log(`[Socket Connected] id: ${socketInstance.id} on ${host}`);
        setIsConnected(true);
        measureLatency();
      });

      socketInstance.on('disconnect', (reason) => {
        console.log('[Socket Disconnected]:', reason);
        setIsConnected(false);
      });

      socketInstance.on('connect_error', async (err) => {
        console.warn('[Socket Connection Error]:', err.message);
        setIsConnected(false);

        // Auto-recover if auth token was refreshed or stale
        const fresh = getMemoryAuthToken() || (await AsyncStorage.getItem('callfar_access_token'));
        if (fresh && fresh !== currentToken) {
          console.log('[Socket] Reconnecting with fresh auth token...');
          socketInstance.auth = { token: fresh };
          socketInstance.connect();
        }
      });

      socketRef.current = socketInstance;
      setSocket(socketInstance);
    },
    [measureLatency]
  );

  const reconnectSocket = useCallback(async () => {
    const activeToken = getMemoryAuthToken() || activeTokenRef.current || (await AsyncStorage.getItem('callfar_access_token'));
    if (activeToken) {
      connectToHost(currentActiveHost, activeToken);
    }
  }, [connectToHost]);

  // Handle Auth state changes
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const currentToken = getMemoryAuthToken() || token;
    if (currentToken) {
      connectToHost(currentActiveHost, currentToken);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [token, user?.id, connectToHost]);

  // Keep socket in sync when access token refreshes
  useEffect(() => {
    const unsub = onTokenChange((newToken) => {
      if (newToken && socketRef.current) {
        socketRef.current.auth = { token: newToken };
        if (!socketRef.current.connected) {
          socketRef.current.connect();
        }
      } else if (newToken && !socketRef.current) {
        connectToHost(currentActiveHost, newToken);
      }
    });
    return unsub;
  }, [connectToHost]);

  // Listen for dynamic host switches (e.g. Wi-Fi <-> USB failover or manual switch)
  useEffect(() => {
    const unsub = onHostChange(async (newHost) => {
      setActiveHost(newHost);
      const activeToken = getMemoryAuthToken() || token || (await AsyncStorage.getItem('callfar_access_token'));
      if (activeToken) {
        connectToHost(newHost, activeToken);
      }
    });
    return unsub;
  }, [token, connectToHost]);

  // Periodic latency measurement (every 25 seconds)
  useEffect(() => {
    if (!isConnected) return;
    measureLatency();
    const interval = setInterval(measureLatency, 25000);
    return () => clearInterval(interval);
  }, [isConnected, measureLatency]);

  const networkMode: NetworkMode = isSameNetworkLan ? 'SAME_NETWORK_LAN' : 'REMOTE_NETWORK_WAN';

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        activeHost,
        latencyMs,
        isSameNetworkLan,
        networkMode,
        reconnectSocket,
        measureLatency,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
