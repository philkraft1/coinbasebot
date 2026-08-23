import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchMe, fetchPreferences, login as apiLogin, logout as apiLogout, savePreferences, signup as apiSignup, type AuthUser } from "./api";
import { loadLocalPrefs, normalizeChartPrefs, saveLocalPrefs, type ChartPrefs } from "./prefs";

type AuthContextValue = {
  ready: boolean;
  user: AuthUser | null;
  prefs: ChartPrefs;
  setPrefs: (partial: Partial<ChartPrefs>) => void;
  signup: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [prefs, setPrefsState] = useState<ChartPrefs>(loadLocalPrefs);
  const userRef = useRef<AuthUser | null>(null);
  const prefsRef = useRef(prefs);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  userRef.current = user;
  prefsRef.current = prefs;

  const persistRemote = useCallback((next: ChartPrefs) => {
    if (!userRef.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      savePreferences(next).catch(() => {
        // keep local copy if the API is down
      });
    }, 400);
  }, []);

  const setPrefs = useCallback(
    (partial: Partial<ChartPrefs>) => {
      setPrefsState((prev) => {
        const next = normalizeChartPrefs({
          ...prev,
          ...partial,
          studies: { ...prev.studies, ...(partial.studies || {}) },
        });
        saveLocalPrefs(next);
        persistRemote(next);
        return next;
      });
    },
    [persistRemote],
  );

  const adoptSession = useCallback(async (nextUser: AuthUser) => {
    setUser(nextUser);
    userRef.current = nextUser;
    try {
      const { prefs: remote } = await fetchPreferences();
      if (remote) {
        const next = normalizeChartPrefs(remote);
        setPrefsState(next);
        saveLocalPrefs(next);
        return;
      }
      await savePreferences(prefsRef.current);
    } catch {
      // stay on local prefs
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then(async ({ user: nextUser }) => {
        if (cancelled) return;
        await adoptSession(nextUser);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [adoptSession]);

  const signup = useCallback(
    async (username: string, password: string) => {
      const { user: nextUser } = await apiSignup(username, password);
      await adoptSession(nextUser);
    },
    [adoptSession],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const { user: nextUser } = await apiLogin(username, password);
      await adoptSession(nextUser);
    },
    [adoptSession],
  );

  const logout = useCallback(async () => {
    await apiLogout().catch(() => undefined);
    setUser(null);
    userRef.current = null;
  }, []);

  const value = useMemo(
    () => ({ ready, user, prefs, setPrefs, signup, login, logout }),
    [ready, user, prefs, setPrefs, signup, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
