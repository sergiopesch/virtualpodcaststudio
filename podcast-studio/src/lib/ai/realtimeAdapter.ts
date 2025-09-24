import { EventEmitter } from "node:events";
import { providerSupportsRealtime, getProviderDefaultModel } from "./providerRegistry";
import type { SupportedProvider } from "./providerRegistry";
import { ApiKeySecurity } from "@/lib/apiKeySecurity";
import { SecureEnv } from "@/lib/secureEnv";
import {
  interpretOpenAiHttpError,
  RealtimeSessionError,
  type RealtimeSessionErrorCode,
  REALTIME_ERROR_STATUS,
} from "@/lib/realtimeSession";

export interface RealtimeAdapterOptions {
  provider: SupportedProvider;
  apiKey?: string;
  model?: string;
}

export interface RealtimeSessionHandle {
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  close: () => void;
}

export interface RealtimeAdapter {
  readonly provider: SupportedProvider;
  readonly model: string;
  start(options: RealtimeAdapterOptions): Promise<RealtimeSessionHandle>;
  exchangeSdp(options: {
    provider: SupportedProvider;
    apiKey?: string;
    model?: string;
    sdpOffer: string;
  }): Promise<{ answerSdp: string; provider: SupportedProvider; model: string }>;
  supportsRealtime(provider: SupportedProvider): boolean;
}

interface OpenAiSdpExchangeOptions {
  sdpOffer: string;
  model: string;
  apiKey: string;
}

class OpenAiRealtimeAdapter implements RealtimeAdapter {
  private _provider: SupportedProvider = "openai";
  private _model: string;

  constructor() {
    this._model = getProviderDefaultModel(this._provider);
  }

  get provider(): SupportedProvider {
    return this._provider;
  }

  get model(): string {
    return this._model;
  }

  supportsRealtime(provider: SupportedProvider): boolean {
    return providerSupportsRealtime(provider);
  }

  async start(options: RealtimeAdapterOptions): Promise<RealtimeSessionHandle> {
    const provider = options.provider ?? this._provider;
    if (provider !== "openai") {
      throw new RealtimeSessionError(
        "UNSUPPORTED_PROVIDER",
        "Realtime adapter currently supports only the OpenAI provider.",
        { status: REALTIME_ERROR_STATUS.UNSUPPORTED_PROVIDER },
      );
    }

    const resolvedModel = options.model?.trim() || this._model;
    const resolvedKey = this.resolveApiKey(provider, options.apiKey);

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });

    const dataChannel = pc.createDataChannel("oai-events");

    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);

    const answer = await this.exchangeSdp({
      provider,
      model: resolvedModel,
      apiKey: resolvedKey,
      sdpOffer: pc.localDescription?.sdp ?? "",
    });

    await pc.setRemoteDescription({ type: "answer", sdp: answer.answerSdp });

    return {
      connection: pc,
      dataChannel,
      close: () => {
        try {
          dataChannel.close();
        } catch {}
        try {
          pc.close();
        } catch {}
      },
    };
  }

  async exchangeSdp(options: {
    provider: SupportedProvider;
    apiKey?: string;
    model?: string;
    sdpOffer: string;
  }): Promise<{ answerSdp: string; provider: SupportedProvider; model: string }> {
    const provider = options.provider ?? "openai";
    if (provider !== "openai") {
      throw new RealtimeSessionError(
        "UNSUPPORTED_PROVIDER",
        "Realtime conversations for this provider are not implemented yet.",
        { status: REALTIME_ERROR_STATUS.UNSUPPORTED_PROVIDER },
      );
    }

    const model = options.model?.trim() || this._model;
    const apiKey = this.resolveApiKey(provider, options.apiKey);

    const answer = await this.performSdpExchange({
      sdpOffer: options.sdpOffer,
      model,
      apiKey,
    });

    this._model = model;

    return {
      answerSdp: answer.answerSdp,
      provider,
      model,
    };
  }

  private resolveApiKey(provider: SupportedProvider, explicitKey?: string): string {
    const fallback = SecureEnv.getWithDefault(
      provider === "openai" ? "OPENAI_API_KEY" : "GOOGLE_API_KEY",
      "",
    );
    const resolved = (explicitKey ?? fallback).trim();
    if (!resolved) {
      const label = provider === "openai" ? "OpenAI" : "Google";
      throw new RealtimeSessionError(
        "MISSING_API_KEY",
        `Missing API key for ${label}`,
        { status: REALTIME_ERROR_STATUS.MISSING_API_KEY },
      );
    }

    ApiKeySecurity.validateKeyOrThrow(provider, resolved);
    return resolved;
  }

  private async performSdpExchange(options: OpenAiSdpExchangeOptions): Promise<{ answerSdp: string }> {
    if (!options.sdpOffer || !options.sdpOffer.includes("v=0")) {
      throw new RealtimeSessionError("INVALID_REQUEST", "Invalid SDP offer", { status: 400 });
    }

    const response = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(options.model)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/sdp",
        Accept: "application/sdp",
        "OpenAI-Beta": "realtime=v1",
      },
      body: options.sdpOffer,
    });

    const answerSdp = await response.text();
    if (!response.ok) {
      throw interpretOpenAiHttpError(response.status, answerSdp);
    }

    return { answerSdp };
  }
}

class RealtimeAdapterRegistry {
  private adapters = new Map<SupportedProvider, RealtimeAdapter>();

  constructor() {
    this.register("openai", new OpenAiRealtimeAdapter());
  }

  register(provider: SupportedProvider, adapter: RealtimeAdapter) {
    this.adapters.set(provider, adapter);
  }

  get(provider: SupportedProvider): RealtimeAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new RealtimeSessionError(
        "UNSUPPORTED_PROVIDER",
        `No realtime adapter registered for provider ${provider}.`,
        { status: REALTIME_ERROR_STATUS.UNSUPPORTED_PROVIDER },
      );
    }
    return adapter;
  }
}

const registry = new RealtimeAdapterRegistry();

export function getRealtimeAdapter(provider: SupportedProvider): RealtimeAdapter {
  return registry.get(provider);
}

export function registerRealtimeAdapter(provider: SupportedProvider, adapter: RealtimeAdapter) {
  registry.register(provider, adapter);
}

export function realtimeErrorToHttpResponse(error: unknown): Response {
  if (isRealtimeSessionError(error)) {
    return new Response(
      JSON.stringify({
        error: error.message,
        code: error.code,
        upstream: error.details,
      }),
      {
        status: resolveRealtimeHttpStatus(error),
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const message = error instanceof Error ? error.message : "Failed to complete realtime exchange";
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    },
  );
}

