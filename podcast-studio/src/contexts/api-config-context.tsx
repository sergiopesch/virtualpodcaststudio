"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiKeySecurity } from "@/lib/apiKeySecurity";

export type LlmProvider = "openai" | "google";

const PROVIDER_DEFAULT_MODELS: Record<LlmProvider, string> = {
  openai: process.env.NEXT_PUBLIC_OPENAI_REALTIME_MODEL ?? "gpt-4o-realtime-preview-2024-12-17",
  google: process.env.NEXT_PUBLIC_GOOGLE_MODEL ?? "models/gemini-1.5-flash",
};

const PROVIDER_REALTIME_SUPPORT: Record<LlmProvider, boolean> = {
  openai: true,
  google: false,
};

interface ApiConfigContextValue {
  activeProvider: LlmProvider;
  apiKeys: Record<LlmProvider, string>;
  models: Partial<Record<LlmProvider, string>>;
  defaultModels: Record<LlmProvider, string>;
  setActiveProvider: (provider: LlmProvider) => void;
  setApiKey: (provider: LlmProvider, key: string) => void;
  clearApiKey: (provider: LlmProvider) => void;
  setModel: (provider: LlmProvider, model: string) => void;
  validateApiKey: (provider: LlmProvider, key: string) => { isValid: boolean; message?: string };
  supportsRealtime: (provider: LlmProvider) => boolean;
}

const STORAGE_KEY = "vps:llmConfig";

interface StoredPreferences {
  activeProvider: LlmProvider;
  models?: Partial<Record<LlmProvider, string>>;
}

const defaultPreferences: StoredPreferences = {
  activeProvider: "openai",
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
  const [preferences, setPreferences] = useState<StoredPreferences>(defaultPreferences);
  const [apiKeys, setApiKeys] = useState<Record<LlmProvider, string>>({
    openai: "",
    google: "",
  });
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<StoredPreferences>;
        setPreferences({
          activeProvider: normalizeProvider(parsed.activeProvider),
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error("Failed to persist API configuration", error);
    }
  }, [preferences, hasHydrated]);

  const setActiveProvider = useCallback((provider: LlmProvider) => {
    setPreferences((previous) => ({
      ...previous,
      activeProvider: provider,
    }));
  }, []);

  const setApiKey = useCallback((provider: LlmProvider, key: string) => {
    setApiKeys((previous) => ({
      ...previous,
      [provider]: key.trim(),
    }));
  }, []);

  const clearApiKey = useCallback((provider: LlmProvider) => {
    setApiKeys((previous) => ({
      ...previous,
      [provider]: "",
    }));
  }, []);

  const setModel = useCallback((provider: LlmProvider, model: string) => {
    setPreferences((previous) => ({
      ...previous,
      models: {
        ...previous.models,
        [provider]: model,
      },
    }));
  }, []);

  const validateApiKey = useCallback((provider: LlmProvider, key: string) => {
    return ApiKeySecurity.validateKeyFormat(provider, key);
  }, []);

  const supportsRealtime = useCallback((provider: LlmProvider) => {
    return PROVIDER_REALTIME_SUPPORT[provider];
  }, []);

  const value = useMemo<ApiConfigContextValue>(() => ({
    activeProvider: preferences.activeProvider,
    apiKeys,
    models: preferences.models ?? {},
    defaultModels: PROVIDER_DEFAULT_MODELS,
    setActiveProvider,
    setApiKey,
    clearApiKey,
    setModel,
    validateApiKey,
    supportsRealtime,
  }), [preferences, apiKeys, setActiveProvider, setApiKey, clearApiKey, setModel, validateApiKey, supportsRealtime]);

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

