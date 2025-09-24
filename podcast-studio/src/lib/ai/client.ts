import {
  getProviderClient,
  getProviderMetadata,
  type SupportedProvider,
  type ProviderMetadata,
} from "./providerRegistry";
import type { LlmProvider } from "@/contexts/api-config-context";

export function getAiClient(provider: LlmProvider) {
  return getProviderClient(provider as SupportedProvider);
}

export function getProviderDefaultModel(provider: LlmProvider): string {
  return getProviderMetadata(provider as SupportedProvider).defaultModel;
}

export function providerSupportsRealtime(provider: LlmProvider): boolean {
  return getProviderMetadata(provider as SupportedProvider).supportsRealtime;
}

export function getProviderMetadataFor(provider: LlmProvider): ProviderMetadata {
  return getProviderMetadata(provider as SupportedProvider);
}
