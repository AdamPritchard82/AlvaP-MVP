import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, User } from '../lib/api';

interface AuthContextType {
  user: User | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.setToken(token);
      // In a real app, you'd validate the token with the backend
      // For now, we'll assume it's valid if it exists
      setUser({ id: '1', email: 'consultant@door10.com', name: 'Consultant', role: 'consultant' });
    }
    setLoading(false);
  }, []);

  const login = async (email: string) => {
    try {
      const { token } = await api.login(email);
      localStorage.setItem('token', token);
      api.setToken(token);
      // In a real app, you'd get user data from the backend
      setUser({ id: '1', email, name: 'Consultant', role: 'consultant' });
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    api.setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}







