import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setMemoryAuthToken } from '../api/client';
import { User, UserLicense } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  role: 'ADMIN' | 'MEMBER';
  license?: UserLicense;
  login: (identifier: string, password: string) => Promise<void>;
  register: (
    fullName: string,
    username: string,
    email: string,
    password: string,
    phoneNumber?: string,
    role?: 'ADMIN' | 'MEMBER',
    adminPasscode?: string
  ) => Promise<void>;
  elevateToAdmin: (adminPasscode: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => void;
  refreshProfile: () => Promise<void>;
  redeemLicenseKey: (key: string) => Promise<UserLicense>;
  forgotPassword: (email: string) => Promise<any>;
  resetPassword: (tokenOrCode: string, newPassword: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('callfar_access_token');
      const storedUser = await AsyncStorage.getItem('callfar_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setMemoryAuthToken(storedToken);
        setUser(JSON.parse(storedUser));

        // Background profile refresh
        api.get('/users/profile')
          .then((res) => {
            if (res.data.data) {
              setUser(res.data.data);
              AsyncStorage.setItem('callfar_user', JSON.stringify(res.data.data));
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error('Session restoration failed:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (identifier: string, password: string) => {
    const res = await api.post('/auth/login', { identifier, password });
    const { user: loggedInUser, tokens } = res.data.data;

    await AsyncStorage.setItem('callfar_access_token', tokens.accessToken);
    await AsyncStorage.setItem('callfar_refresh_token', tokens.refreshToken);
    await AsyncStorage.setItem('callfar_user', JSON.stringify(loggedInUser));

    setMemoryAuthToken(tokens.accessToken);
    setToken(tokens.accessToken);
    setUser(loggedInUser);
  };

  const register = async (
    fullName: string,
    username: string,
    email: string,
    password: string,
    phoneNumber?: string,
    role?: 'ADMIN' | 'MEMBER',
    adminPasscode?: string
  ) => {
    const res = await api.post('/auth/register', {
      fullName,
      username,
      email,
      password,
      phoneNumber: phoneNumber || undefined,
      role: role || 'MEMBER',
      adminPasscode: adminPasscode || undefined,
    });
    const { user: registeredUser, tokens } = res.data.data;

    await AsyncStorage.setItem('callfar_access_token', tokens.accessToken);
    await AsyncStorage.setItem('callfar_refresh_token', tokens.refreshToken);
    await AsyncStorage.setItem('callfar_user', JSON.stringify(registeredUser));

    setMemoryAuthToken(tokens.accessToken);
    setToken(tokens.accessToken);
    setUser(registeredUser);
  };

  const elevateToAdmin = async (adminPasscode: string) => {
    const res = await api.post('/auth/elevate-admin', { adminPasscode });
    const { user: elevatedUser, tokens } = res.data.data;

    if (tokens?.accessToken) {
      await AsyncStorage.setItem('callfar_access_token', tokens.accessToken);
      setMemoryAuthToken(tokens.accessToken);
      setToken(tokens.accessToken);
    }
    if (tokens?.refreshToken) {
      await AsyncStorage.setItem('callfar_refresh_token', tokens.refreshToken);
    }
    if (elevatedUser) {
      await AsyncStorage.setItem('callfar_user', JSON.stringify(elevatedUser));
      setUser(elevatedUser);
    }
  };

  const logout = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('callfar_refresh_token');
      await api.post('/auth/logout', { refreshToken });
    } catch {}

    setMemoryAuthToken(null);
    await AsyncStorage.multiRemove(['callfar_access_token', 'callfar_refresh_token', 'callfar_user']);
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const merged = { ...prev, ...updatedUser };
      AsyncStorage.setItem('callfar_user', JSON.stringify(merged));
      return merged;
    });
  };

  const refreshProfile = async () => {
    try {
      const res = await api.get('/users/profile');
      if (res.data?.data) {
        setUser(res.data.data);
        await AsyncStorage.setItem('callfar_user', JSON.stringify(res.data.data));
      }
    } catch (e) {
      console.error('Failed to refresh profile:', e);
    }
  };

  const redeemLicenseKey = async (key: string): Promise<UserLicense> => {
    const res = await api.post('/licenses/redeem', { key });
    const updatedLicense: UserLicense = res.data.data;
    setUser((prev) => {
      if (!prev) return null;
      const merged = { ...prev, license: updatedLicense };
      AsyncStorage.setItem('callfar_user', JSON.stringify(merged));
      return merged;
    });
    return updatedLicense;
  };

  const forgotPassword = async (email: string) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  };

  const resetPassword = async (tokenOrCode: string, newPassword: string) => {
    const res = await api.post('/auth/reset-password', { tokenOrCode, newPassword });
    return res.data;
  };

  const role = user?.role || 'MEMBER';
  const isAdmin = role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAdmin,
        role,
        license: user?.license,
        login,
        register,
        elevateToAdmin,
        logout,
        updateUser,
        refreshProfile,
        redeemLicenseKey,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
