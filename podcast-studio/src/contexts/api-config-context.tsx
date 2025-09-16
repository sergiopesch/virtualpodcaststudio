"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type LlmProvider = "openai" | "google";

interface StoredApiConfig {
  activeProvider: LlmProvider;
  apiKeys: Record<LlmProvider, string>;
  models?: Partial<Record<LlmProvider, string>>;
}

interface ApiConfigContextValue {
  activeProvider: LlmProvider;
  apiKeys: Record<LlmProvider, string>;
  models: Partial<Record<LlmProvider, string>>;
  setActiveProvider: (provider: LlmProvider) => void;
  setApiKey: (provider: LlmProvider, key: string) => void;
  clearApiKey: (provider: LlmProvider) => void;
  setModel: (provider: LlmProvider, model: string) => void;
}

const STORAGE_KEY = "vps:llmConfig";

const defaultState: StoredApiConfig = {
  activeProvider: "openai",
  apiKeys: {
    openai: "",
    google: "",
  },
  models: {},
};

const ApiConfigContext = createContext<ApiConfigContextValue | undefined>(
  undefined,
);

interface ApiConfigProviderProps {
  children: React.ReactNode;
}

function normalizeProvider(value: unknown): LlmProvider {
  return value === "google" ? "google" : "openai";
}

export function ApiConfigProvider({ children }: ApiConfigProviderProps) {
  const [state, setState] = useState<StoredApiConfig>(defaultState);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<StoredApiConfig>;
        setState({
          activeProvider: normalizeProvider(parsed.activeProvider),
          apiKeys: {
            openai: parsed.apiKeys?.openai ?? "",
            google: parsed.apiKeys?.google ?? "",
          },
          models: parsed.models ?? {},
        });
      }
    } catch (error) {
      console.error("Failed to hydrate API configuration", error);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to persist API configuration", error);
    }
  }, [state, hasHydrated]);

  const setActiveProvider = useCallback((provider: LlmProvider) => {
    setState((previous) => ({
      ...previous,
      activeProvider: provider,
    }));
  }, []);

  const setApiKey = useCallback((provider: LlmProvider, key: string) => {
    setState((previous) => ({
      ...previous,
      apiKeys: {
        ...previous.apiKeys,
        [provider]: key,
      },
    }));
  }, []);

  const clearApiKey = useCallback((provider: LlmProvider) => {
    setApiKey(provider, "");
  }, [setApiKey]);

  const setModel = useCallback((provider: LlmProvider, model: string) => {
    setState((previous) => ({
      ...previous,
      models: {
        ...previous.models,
        [provider]: model,
      },
    }));
  }, []);

  const value = useMemo<ApiConfigContextValue>(() => ({
    activeProvider: state.activeProvider,
    apiKeys: state.apiKeys,
    models: state.models ?? {},
    setActiveProvider,
    setApiKey,
    clearApiKey,
    setModel,
  }), [state, setActiveProvider, setApiKey, clearApiKey, setModel]);

  return (
    <ApiConfigContext.Provider value={value}>
      {children}
    </ApiConfigContext.Provider>
  );
}

export function useApiConfig() {
  const context = useContext(ApiConfigContext);
  if (context === undefined) {
    throw new Error("useApiConfig must be used within an ApiConfigProvider");
  }
  return context;
}

