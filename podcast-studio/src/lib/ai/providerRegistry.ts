import { SecureEnv } from "@/lib/secureEnv";

export type SupportedProvider = "openai" | "google";

interface ProviderMetadata {
  defaultModel: string;
  supportsRealtime: boolean;
}

const providers: Record<SupportedProvider, ProviderMetadata> = {
  openai: {
    defaultModel: SecureEnv.getWithDefault("OPENAI_MODEL", "gpt-realtime-mini"),
    supportsRealtime: true,
  },
  google: {
    defaultModel: SecureEnv.getWithDefault("GOOGLE_MODEL", "models/gemini-1.5-flash"),
    supportsRealtime: false,
  },
};

export function getProviderMetadata(provider: SupportedProvider): ProviderMetadata {
  const entry = providers[provider];
  if (!entry) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  return entry;
}
