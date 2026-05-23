"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clearAuthSession, createAuthSession, fetchAuthSession } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

interface AuthCtx {
  user: AuthUser | null;
  isAuthed: boolean;
  loading: boolean;
  refreshSession: () => Promise<void>;
  signIn: (email?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const session = await fetchAuthSession();
    setUser(session.user);
  }, []);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const session = await fetchAuthSession();
        if (active) {
          setUser(session.user);
        }
      } catch (error) {
        if (active) {
          setUser(null);
        }
        console.error("Unable to load auth session.", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email = "somchai@siamtech.co.th") => {
    const session = await createAuthSession({ email });
    setUser(session.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      const session = await clearAuthSession();
      setUser(session.user);
    } catch (error) {
      setUser(null);
      console.error("Unable to clear auth session cleanly.", error);
      throw error;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthed: !!user,
      loading,
      refreshSession,
      signIn,
      signOut,
    }),
    [loading, refreshSession, signIn, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be inside <AuthProvider>");
  }

  return ctx;
};
