import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { trpc } from '@/lib/trpc';

interface User {
  id: number;
  username: string;
  brandName: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
  brandName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (authQuery.isSuccess) {
      setUser(authQuery.data ?? null);
    }
  }, [authQuery.data, authQuery.isSuccess]);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
  };

  const brandName = user?.brandName || '';

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      loading: authQuery.isLoading,
      login,
      logout,
      brandName,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useLocalAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useLocalAuth must be used within an AuthProvider');
  }
  return context;
}
