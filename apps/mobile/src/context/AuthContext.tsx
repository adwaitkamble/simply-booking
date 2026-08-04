import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { SafeStorage } from '../utils/storage';
import { ApiClient } from '../api/client';
import type { UserDTO, PropertyDTO, LoginPayload, RegisterPayload } from '@hotel-pms/types';

interface AuthContextType {
  user: UserDTO | null;
  property: PropertyDTO | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = '@simply_booking_auth_token';
const USER_KEY = '@simply_booking_user_profile';
const PROPERTY_KEY = '@simply_booking_property_profile';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [property, setProperty] = useState<PropertyDTO | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from SafeStorage on app launch
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = await SafeStorage.getItem(TOKEN_KEY);
        const storedUser = await SafeStorage.getItem(USER_KEY);
        const storedProperty = await SafeStorage.getItem(PROPERTY_KEY);

        if (storedToken) {
          ApiClient.setAuthToken(storedToken);
          setToken(storedToken);

          if (storedUser && storedProperty) {
            try {
              setUser(JSON.parse(storedUser));
              setProperty(JSON.parse(storedProperty));
            } catch (e) {
              // Ignore JSON parse error
            }
          }

          // Verify & re-hydrate in background
          try {
            const meData = await ApiClient.fetchMe();
            if (meData) {
              setUser(meData);
              if (meData.property) {
                setProperty(meData.property);
                await SafeStorage.setItem(PROPERTY_KEY, JSON.stringify(meData.property));
              }
              await SafeStorage.setItem(USER_KEY, JSON.stringify(meData));
            }
          } catch (meErr) {
            console.warn('⚠️ Session token expired or invalid, clearing auth session');
            await clearSession();
          }
        }
      } catch (err) {
        console.warn('Notice restoring session from storage:', err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const clearSession = async () => {
    ApiClient.setAuthToken(null);
    setToken(null);
    setUser(null);
    setProperty(null);
    await Promise.all([
      SafeStorage.removeItem(TOKEN_KEY),
      SafeStorage.removeItem(USER_KEY),
      SafeStorage.removeItem(PROPERTY_KEY),
    ]);
  };

  const login = async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const res = await ApiClient.login(payload);
      ApiClient.setAuthToken(res.token);
      setToken(res.token);
      setUser(res.user);
      setProperty(res.property);

      await SafeStorage.setItem(TOKEN_KEY, res.token);
      await SafeStorage.setItem(USER_KEY, JSON.stringify(res.user));
      await SafeStorage.setItem(PROPERTY_KEY, JSON.stringify(res.property));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const res = await ApiClient.register(payload);
      ApiClient.setAuthToken(res.token);
      setToken(res.token);
      setUser(res.user);
      setProperty(res.property);

      await SafeStorage.setItem(TOKEN_KEY, res.token);
      await SafeStorage.setItem(USER_KEY, JSON.stringify(res.user));
      await SafeStorage.setItem(PROPERTY_KEY, JSON.stringify(res.property));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await clearSession();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        property,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
