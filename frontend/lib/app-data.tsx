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
import { fetchBootstrapData } from "@/lib/api";
import type { AppData } from "@/lib/types";

interface AppDataContextValue {
  data: AppData;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export const AppDataProvider = ({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData: AppData;
}) => {
  const [data, setData] = useState<AppData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const nextData = await fetchBootstrapData();
      setData(nextData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load application data.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [initialData, load]);

  const value = useMemo(
    () => ({
      data,
      loading,
      error,
      refresh: async () => load(false),
    }),
    [data, error, load, loading]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export const useAppData = () => {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData must be used inside <AppDataProvider>");
  }

  return context;
};
