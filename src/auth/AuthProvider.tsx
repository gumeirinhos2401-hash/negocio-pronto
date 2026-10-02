import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiFailure } from '../api/client';

export interface User { id: string; email: string; emailVerified: boolean }

interface Auth {
  // undefined while the first check is running, null when nobody is signed in.
  user: User | null | undefined;
  startError: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  sessionEnded(): void;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [startError, setStartError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setUser((await api<{ user: User }>('GET', '/api/me')).user);
      setStartError(null);
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 401) setUser(null);
      else {
        setUser(null);
        setStartError(error instanceof ApiFailure ? error.message : null);
      }
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<Auth>(() => ({
    user,
    startError,
    refresh,
    async signIn(email, password) {
      setUser((await api<{ user: User }>('POST', '/api/auth/login', { email, password })).user);
    },
    async signUp(email, password) {
      setUser((await api<{ user: User }>('POST', '/api/auth/register', { email, password })).user);
    },
    async signOut() {
      await api('POST', '/api/auth/logout').catch(() => undefined);
      setUser(null);
    },
    sessionEnded: () => setUser(null),
  }), [user, startError, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth needs an AuthProvider above it.');
  return auth;
}
