import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/auth';
import { authApi } from '../lib/authApi';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('access_token');
      console.log('AuthContext: Checking auth status, token exists:', !!token);
      if (token) {
        const userData = await authApi.getCurrentUser();
        console.log('AuthContext: Auth check successful, user:', userData.username);
        setUser(userData);
      } else {
        console.log('AuthContext: No token found');
        setUser(null);
      }
    } catch (error) {
      console.warn('AuthContext: Auth check failed, token may be expired:', error);
      // Don't immediately remove token on auth check failure
      // Let individual API calls handle 401 errors
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      console.log('AuthContext: Attempting login for user:', username);
      const response = await authApi.login({ username, password });
      console.log('AuthContext: Login successful, storing token');
      console.log('AuthContext: Response structure:', response);
      localStorage.setItem('access_token', response.access_token);
      setUser(response.user);
      console.log('AuthContext: Login completed, user set:', response.user.username);
      return response.user;
    } catch (error) {
      console.error('AuthContext: Login failed:', error);
      console.error('AuthContext: Error type:', typeof error);
      console.error('AuthContext: Error properties:', Object.keys(error));
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      console.log('AuthContext: Attempting registration for user:', username);
      const userData = await authApi.register({ username, email, password });
      console.log('AuthContext: Registration successful, auto-login');
      // After registration, automatically log in the user
      const response = await authApi.login({ username, password });
      localStorage.setItem('access_token', response.access_token);
      setUser(response.user);
      return response.user;
    } catch (error) {
      console.error('AuthContext: Registration failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('AuthContext: Attempting logout');
      await authApi.logout();
      console.log('AuthContext: Logout API call successful');
    } catch (error) {
      console.error('AuthContext: Logout error:', error);
    } finally {
      console.log('AuthContext: Removing token and clearing user state');
      localStorage.removeItem('access_token');
      setUser(null);
    }
  };

  const isAuthenticated = user !== null;

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    register,
    isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
