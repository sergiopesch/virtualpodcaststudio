import { getProviderMetadata, type SupportedProvider } from "./providerRegistry";
import type { LlmProvider } from "@/contexts/api-config-context";

export function getProviderDefaultModel(provider: LlmProvider): string {
  return getProviderMetadata(provider as SupportedProvider).defaultModel;
}

export function providerSupportsRealtime(provider: LlmProvider): boolean {
  return getProviderMetadata(provider as SupportedProvider).supportsRealtime;
}
