import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { api, setUnauthorizedHandler, type Trainer } from './api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthValue {
  status: AuthStatus;
  trainer: Trainer | null;
  notice: string | null;
  showNotice: (message: string) => void;
  clearNotice: () => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .me(true)
      .then((data) => {
        if (cancelled) return;
        setTrainer(data.trainer);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setTrainer(null);
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setTrainer(null);
      setStatus('anonymous');
      setNotice('Sesi berakhir. Silakan login lagi.');
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const login = useCallback(async (username: string, password: string) => {
    await api.login(username, password);
    const data = await api.me(true);
    setTrainer(data.trainer);
    setStatus('authenticated');
    setNotice(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // tetap reset state lokal walau jaringan gagal
    }
    setTrainer(null);
    setStatus('anonymous');
  }, []);

  const showNotice = useCallback((message: string) => setNotice(message), []);
  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<AuthValue>(
    () => ({ status, trainer, notice, showNotice, clearNotice, login, logout }),
    [status, trainer, notice, showNotice, clearNotice, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
