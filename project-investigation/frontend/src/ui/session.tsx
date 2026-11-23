import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export interface SessionUser {
  id: string;
  email: string;
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface SessionState {
  user: SessionUser | null;
  status: SessionStatus;
}

export interface UseSessionResult {
  session: SessionState;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (email: string, password: string, betaAccessCode?: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface AuthResponse {
  id?: string;
  email?: string;
  error?: string;
}

async function postJson<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

function toUser(data: AuthResponse | null, fallbackEmail?: string): SessionUser {
  return {
    id: String(data?.id ?? ''),
    email: String(data?.email ?? fallbackEmail ?? ''),
  };
}

export function useSessionState(): UseSessionResult {
  const [session, setSession] = useState<SessionState>({ user: null, status: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as AuthResponse;
        setSession({ user: toUser(data), status: 'authenticated' });
      } else {
        setSession({ user: null, status: 'unauthenticated' });
      }
    } catch {
      setSession({ user: null, status: 'unauthenticated' });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string): Promise<SessionUser> => {
    const { ok, status, data } = await postJson<AuthResponse>('/api/login', { email, password });
    if (!ok) throw new Error(data?.error || `Login failed (${status})`);
    const user = toUser(data, email);
    setSession({ user, status: 'authenticated' });
    return user;
  }, []);

  const register = useCallback(async (
    email: string,
    password: string,
    betaAccessCode?: string,
  ): Promise<SessionUser> => {
    const { ok, status, data } = await postJson<AuthResponse>('/api/register', {
      email,
      password,
      ...(betaAccessCode ? { betaAccessCode } : {}),
    });
    if (!ok) throw new Error(data?.error || `Registration failed (${status})`);
    const user = toUser(data, email);
    setSession({ user, status: 'authenticated' });
    return user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await postJson('/api/logout', {});
    } finally {
      setSession({ user: null, status: 'unauthenticated' });
    }
  }, []);

  return { session, login, register, logout, refresh };
}

const SessionContext = createContext<UseSessionResult | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const value = useSessionState();
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): UseSessionResult {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}
