import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  preferences: Record<string, any>;
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  updateUserPreferences: (preferences: Record<string, any>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        // Call your authentication API
        const response = await fetch('/api/auth/session');
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (err) {
        console.error('Authentication check failed', err);
        setError(err instanceof Error ? err : new Error('Authentication failed'));
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Call your login API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const userData = await response.json();
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Login failed'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Call your logout API
      await fetch('/api/auth/logout', { method: 'POST' });
      
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Logout failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserPreferences = async (preferences: Record<string, any>) => {
    if (!user) return;

    try {
      // Update preferences in API
      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      // Update local state
      setUser(prev => prev ? { 
        ...prev, 
        preferences: { ...prev.preferences, ...preferences } 
      } : null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update preferences'));
    }
  };

  const value = {
    user,
    isLoading,
    error,
    login,
    logout,
    updateUserPreferences
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
