import { createAI, type AI } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { SecureEnv } from "@/lib/secureEnv";
import { ApiKeySecurity } from "@/lib/apiKeySecurity";

export type SupportedProvider = "openai" | "google";

interface ProviderMetadata {
  defaultModel: string;
  supportsRealtime: boolean;
}

interface RegisteredProvider {
  metadata: ProviderMetadata;
  factory: () => AI;
}

const providers: Record<SupportedProvider, RegisteredProvider> = {
  openai: {
    metadata: {
      defaultModel: SecureEnv.getWithDefault("OPENAI_MODEL", "gpt-4o-realtime-preview-2024-10-01"),
      supportsRealtime: true,
    },
    factory: () => {
      const apiKey = SecureEnv.getWithDefault("OPENAI_API_KEY", "").trim();
      if (!apiKey) {
        throw new Error("Missing OpenAI API key.");
      }
      ApiKeySecurity.validateKeyOrThrow("openai", apiKey);
      const openai = createOpenAI({ apiKey });
      return createAI({ provider: openai });
    },
  },
  google: {
    metadata: {
      defaultModel: SecureEnv.getWithDefault("GOOGLE_MODEL", "models/gemini-1.5-flash"),
      supportsRealtime: false,
    },
    factory: () => {
      const apiKey = SecureEnv.getWithDefault("GOOGLE_API_KEY", "").trim();
      if (!apiKey) {
        throw new Error("Missing Google API key.");
      }
      ApiKeySecurity.validateKeyOrThrow("google", apiKey);
      const google = createGoogleGenerativeAI({ apiKey });
      return createAI({ provider: google });
    },
  },
};

const singletonCache = new Map<SupportedProvider, AI>();

export function getProviderClient(provider: SupportedProvider): AI {
  if (singletonCache.has(provider)) {
    return singletonCache.get(provider)!;
  }
  const entry = providers[provider];
  if (!entry) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  const client = entry.factory();
  singletonCache.set(provider, client);
  return client;
}

export function getProviderMetadata(provider: SupportedProvider): ProviderMetadata {
  const entry = providers[provider];
  if (!entry) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  return entry.metadata;
}
