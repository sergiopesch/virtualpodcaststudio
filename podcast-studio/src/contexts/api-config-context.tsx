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
export type VideoProvider = "openai_sora" | "google_veo";

export const VIDEO_PROVIDER_INFO: Record<VideoProvider, { name: string; description: string; keyProvider: LlmProvider }> = {
  openai_sora: { name: "OpenAI Sora", description: "OpenAI's video generation model", keyProvider: "openai" },
  google_veo: { name: "Google Veo 3", description: "Google's Veo 3 video generation (Recommended, ~10-20s)", keyProvider: "google" },
};

const PROVIDER_DEFAULT_MODELS: Record<LlmProvider, string> = {
  openai: process.env.NEXT_PUBLIC_OPENAI_REALTIME_MODEL ?? "gpt-4o-mini-realtime-preview",
  google: process.env.NEXT_PUBLIC_GOOGLE_MODEL ?? "models/gemini-1.5-flash",
};

const PROVIDER_REALTIME_SUPPORT: Record<LlmProvider, boolean> = {
  openai: true,
  google: false,
};

interface ApiConfigContextValue {
  activeProvider: LlmProvider;
  videoProvider: VideoProvider;
  apiKeys: Record<LlmProvider, string>;
  models: Partial<Record<LlmProvider, string>>;
  defaultModels: Record<LlmProvider, string>;
  setActiveProvider: (provider: LlmProvider) => void;
  setVideoProvider: (provider: VideoProvider) => void;
  setApiKey: (provider: LlmProvider, key: string) => void;
  clearApiKey: (provider: LlmProvider) => void;
  setModel: (provider: LlmProvider, model: string) => void;
  validateApiKey: (provider: LlmProvider, key: string) => { isValid: boolean; message?: string };
  supportsRealtime: (provider: LlmProvider) => boolean;
  getVideoApiKey: () => string;
}

const STORAGE_KEY = "vps:llmConfig";

interface StoredPreferences {
  activeProvider: LlmProvider;
  videoProvider?: VideoProvider;
  models?: Partial<Record<LlmProvider, string>>;
  apiKeys?: Partial<Record<LlmProvider, string>>;
}

const defaultPreferences: StoredPreferences = {
  activeProvider: "openai",
  videoProvider: "google_veo",
  models: {},
};

const ApiConfigContext = createContext<ApiConfigContextValue | undefined>(
  undefined,
);

interface ApiConfigProviderProps {
  children: React.ReactNode;
}

function normalizeProvider(value: unknown): LlmProvider {
  if (value === "google") return "google";
  return "openai";
}

function normalizeVideoProvider(value: unknown): VideoProvider {
  if (value === "openai_sora") return "openai_sora";
  return "google_veo"; // Default to Google Veo (recommended)
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
          videoProvider: normalizeVideoProvider(parsed.videoProvider),
          models: parsed.models ?? {},
        });
        if (parsed.apiKeys) {
          setApiKeys((prev) => ({
            ...prev,
            ...parsed.apiKeys,
          }));
        }
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...preferences,
        apiKeys,
      }));
    } catch (error) {
      console.error("Failed to persist API configuration", error);
    }
  }, [preferences, apiKeys, hasHydrated]);

  const setActiveProvider = useCallback((provider: LlmProvider) => {
    setPreferences((previous) => ({
      ...previous,
      activeProvider: provider,
    }));
  }, []);

  const setVideoProvider = useCallback((provider: VideoProvider) => {
    setPreferences((previous) => ({
      ...previous,
      videoProvider: provider,
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

  const getVideoApiKey = useCallback(() => {
    const videoProvider = preferences.videoProvider || "google_veo";
    const keyProvider = VIDEO_PROVIDER_INFO[videoProvider].keyProvider;
    return apiKeys[keyProvider] || "";
  }, [preferences.videoProvider, apiKeys]);

  const value = useMemo<ApiConfigContextValue>(() => ({
    activeProvider: preferences.activeProvider,
    videoProvider: preferences.videoProvider || "google_veo",
    apiKeys,
    models: preferences.models ?? {},
    defaultModels: PROVIDER_DEFAULT_MODELS,
    setActiveProvider,
    setVideoProvider,
    setApiKey,
    clearApiKey,
    setModel,
    validateApiKey,
    supportsRealtime,
    getVideoApiKey,
  }), [preferences, apiKeys, setActiveProvider, setVideoProvider, setApiKey, clearApiKey, setModel, validateApiKey, supportsRealtime, getVideoApiKey]);

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

