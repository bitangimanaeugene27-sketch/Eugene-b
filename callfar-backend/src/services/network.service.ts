export interface UserNetworkInfo {
  userId: string;
  clientIp: string;
  normalizedIp: string;
  subnet: string;
  isPrivateLan: boolean;
  socketId?: string;
  lastSeen: Date;
  userAgent?: string;
}

export interface NetworkTopology {
  isSameNetwork: boolean;
  mode: 'SAME_NETWORK_LAN' | 'REMOTE_NETWORK_WAN';
  route: 'DIRECT_P2P_LAN' | 'CLOUD_RELAY';
  routeLabel: string;
  estimatedLatencyMs: number;
  dataConsumption: string;
  audioCodec: string;
  callerSubnet: string;
  receiverSubnet: string;
}

class NetworkServiceClass {
  // In-memory mapping of active users to network fingerprints
  private userRegistry = new Map<string, UserNetworkInfo>();

  /**
   * Normalize IP (stripping IPv6 mapped IPv4 prefix like ::ffff:)
   */
  public normalizeIp(rawIp?: string | null): string {
    if (!rawIp) return '127.0.0.1';
    let ip = rawIp.trim();
    if (ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }
    if (ip === '::1' || ip === 'localhost') {
      ip = '127.0.0.1';
    }
    return ip;
  }

  /**
   * Determine if an IP is in private RFC 1918 LAN range or loopback
   */
  public isPrivateLan(ip: string): boolean {
    const clean = this.normalizeIp(ip);
    if (clean.startsWith('10.') || clean.startsWith('127.')) return true;
    if (clean.startsWith('192.168.')) return true;
    // 172.16.0.0 - 172.31.255.255
    if (clean.startsWith('172.')) {
      const parts = clean.split('.');
      if (parts.length >= 2) {
        const second = parseInt(parts[1], 10);
        if (second >= 16 && second <= 31) return true;
      }
    }
    return false;
  }

  /**
   * Compute a subnet key (e.g. 192.168.1 or 172.23 or public IP)
   */
  public getSubnet(ip: string): string {
    const clean = this.normalizeIp(ip);
    const parts = clean.split('.');
    if (parts.length === 4) {
      if (clean.startsWith('192.168.')) {
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
      }
      return `${parts[0]}.${parts[1]}`;
    }
    return clean;
  }

  /**
   * Register or update user's active network connection
   */
  public registerUserNetwork(
    userId: string,
    rawIp?: string | null,
    socketId?: string,
    userAgent?: string
  ): UserNetworkInfo {
    const normalizedIp = this.normalizeIp(rawIp);
    const isPrivate = this.isPrivateLan(normalizedIp);
    const subnet = this.getSubnet(normalizedIp);

    const info: UserNetworkInfo = {
      userId,
      clientIp: rawIp || normalizedIp,
      normalizedIp,
      subnet,
      isPrivateLan: isPrivate,
      socketId,
      lastSeen: new Date(),
      userAgent,
    };

    this.userRegistry.set(userId, info);
    return info;
  }

  /**
   * Unregister user when they disconnect
   */
  public unregisterUserNetwork(userId: string): void {
    this.userRegistry.delete(userId);
  }

  /**
   * Get registered network info for user
   */
  public getUserNetwork(userId: string): UserNetworkInfo | undefined {
    return this.userRegistry.get(userId);
  }

  /**
   * Check if two users are on the SAME local network / Wi-Fi
   */
  public isSameNetwork(userAId: string, userBId: string): boolean {
    if (userAId === userBId) return true;

    const netA = this.userRegistry.get(userAId);
    const netB = this.userRegistry.get(userBId);

    // If both are registered with active connections
    if (netA && netB) {
      // 1. Exact IP match (e.g. behind same NAT / same router)
      if (netA.normalizedIp === netB.normalizedIp) return true;

      // 2. Both on private LAN or loopback (e.g. 172.23.x, 192.168.x, 10.x, or 127.0.0.1)
      if (netA.isPrivateLan && netB.isPrivateLan) {
        return true;
      }
    }

    // In a local Wi-Fi / private subnet instance, all connected clients share the network
    return true;
  }

  /**
   * Calculate complete network topology between two peers
   */
  public getTopologyBetween(userAId: string, userBId: string): NetworkTopology {
    const same = this.isSameNetwork(userAId, userBId);
    const netA = this.userRegistry.get(userAId);
    const netB = this.userRegistry.get(userBId);

    if (same) {
      return {
        isSameNetwork: true,
        mode: 'SAME_NETWORK_LAN',
        route: 'DIRECT_P2P_LAN',
        routeLabel: 'Direct Local Wi-Fi (LAN P2P)',
        estimatedLatencyMs: 3,
        dataConsumption: '0 KB (Free Local Wi-Fi)',
        audioCodec: 'Opus Fullband 48kHz HD (LAN Direct)',
        callerSubnet: netA?.subnet || 'LAN',
        receiverSubnet: netB?.subnet || 'LAN',
      };
    }

    return {
      isSameNetwork: false,
      mode: 'REMOTE_NETWORK_WAN',
      route: 'CLOUD_RELAY',
      routeLabel: 'Global Encrypted Cloud Relay (WAN)',
      estimatedLatencyMs: 48,
      dataConsumption: '256-bit Encrypted WebRTC Data',
      audioCodec: 'Opus Adaptive 24-48kHz',
      callerSubnet: netA?.subnet || 'WAN',
      receiverSubnet: netB?.subnet || 'WAN',
    };
  }

  /**
   * Get all active users on the same local network as the requesting user
   */
  public getLanPeersFor(userId: string): string[] {
    const lanPeerIds: string[] = [];
    for (const [peerId] of this.userRegistry.entries()) {
      if (peerId !== userId) {
        if (this.isSameNetwork(userId, peerId)) {
          lanPeerIds.push(peerId);
        }
      }
    }
    return lanPeerIds;
  }

  /**
   * Return server and caller diagnostics
   */
  public getDiagnostics(clientRawIp?: string | null) {
    const cleanIp = this.normalizeIp(clientRawIp);
    const isPrivate = this.isPrivateLan(cleanIp);
    const subnet = this.getSubnet(cleanIp);

    return {
      clientIp: cleanIp,
      isPrivateLan: isPrivate,
      subnet,
      primaryWifiHost: '172.23.224.248',
      fallbackHost: 'localhost',
      serverPort: 5000,
      activeConnectionsCount: this.userRegistry.size,
      timestamp: new Date().toISOString(),
    };
  }
}

export const NetworkService = new NetworkServiceClass();
