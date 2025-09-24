// src/lib/realtimeSession.ts
import WebSocket from 'ws';
import { EventEmitter } from "node:events";
import { providerSupportsRealtime, getProviderDefaultModel } from "./ai/client";
import { ApiKeySecurity } from "./apiKeySecurity";
import { SecureEnv } from "./secureEnv";

export type SupportedProvider = "openai" | "google";

export interface RealtimeSdpExchangeResult {
  answerSdp: string;
  provider: SupportedProvider;
  model: string;
}

interface RealtimeSdpExchangeOptions {
  request: Request;
  sdpOffer: string;
}

export type RealtimeSessionErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "UNSUPPORTED_PROVIDER"
  | "NETWORK_ERROR"
  | "UPSTREAM_ERROR"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "TIMEOUT"
  | "INVALID_REQUEST"
  | "WEBSOCKET_ERROR"
  | "UNKNOWN";

interface RealtimeSessionErrorOptions {
  status?: number;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class RealtimeSessionError extends Error {
  code: RealtimeSessionErrorCode;
  status?: number;
  details?: Record<string, unknown>;

  constructor(code: RealtimeSessionErrorCode, message: string, options: RealtimeSessionErrorOptions = {}) {
    super(message);
    this.name = "RealtimeSessionError";
    this.code = code;
    this.status = options.status;
    this.details = options.details;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export const REALTIME_ERROR_STATUS: Record<RealtimeSessionErrorCode, number> = {
  MISSING_API_KEY: 400,
  INVALID_API_KEY: 401,
  UNSUPPORTED_PROVIDER: 501,
  NETWORK_ERROR: 502,
  UPSTREAM_ERROR: 502,
  RATE_LIMITED: 429,
  FORBIDDEN: 403,
  TIMEOUT: 504,
  INVALID_REQUEST: 400,
  WEBSOCKET_ERROR: 502,
  UNKNOWN: 500,
};

export function resolveRealtimeHttpStatus(error: RealtimeSessionError): number {
  return error.status ?? REALTIME_ERROR_STATUS[error.code] ?? 500;
}

export function isRealtimeSessionError(error: unknown): error is RealtimeSessionError {
  return error instanceof RealtimeSessionError;
}

const sanitizeUpstreamMessage = (message?: string) => {
  if (!message) {
    return undefined;
  }
  return message.replace(/sk-[a-zA-Z0-9]{10,}/g, (match) => ApiKeySecurity.maskKey(match));
};

export function interpretOpenAiHttpError(status: number, bodyText: string): RealtimeSessionError {
  let code: RealtimeSessionErrorCode = "UPSTREAM_ERROR";
  let message = `OpenAI request failed with status ${status}.`;
  let upstreamMessage: string | undefined;

  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
    upstreamMessage = sanitizeUpstreamMessage(parsed?.error?.message);
  } catch {
    upstreamMessage = sanitizeUpstreamMessage(bodyText);
  }

  const hasDetail = Boolean(upstreamMessage && upstreamMessage.trim().length > 0);

  switch (status) {
    case 400:
      code = "INVALID_REQUEST";
      message = hasDetail
        ? upstreamMessage!
        : "OpenAI rejected the request payload. Please retry or contact support if the problem persists.";
      break;
    case 401:
      code = "INVALID_API_KEY";
      message = hasDetail && upstreamMessage!.toLowerCase().includes("invalid api key")
        ? "Invalid OpenAI API key. Please double-check your key in Settings and ensure it starts with 'sk-'."
        : "OpenAI could not authenticate your API key. Please verify it in Settings.";
      break;
    case 403:
      code = "FORBIDDEN";
      message = hasDetail
        ? upstreamMessage!
        : "OpenAI denied access to the realtime API. Confirm that your account has access and billing enabled.";
      break;
    case 429:
      code = "RATE_LIMITED";
      message = hasDetail
        ? upstreamMessage!
        : "OpenAI rate limit exceeded. Please wait a moment before trying again.";
      break;
    default:
      if (status >= 500) {
        code = "UPSTREAM_ERROR";
        message = hasDetail
          ? upstreamMessage!
          : "OpenAI realtime service is temporarily unavailable. Please try again shortly.";
      } else if (hasDetail) {
        message = upstreamMessage!;
      }
  }

  return new RealtimeSessionError(code, message, {
    status,
    details: hasDetail ? { upstreamMessage } : { status },
  });
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

function resolveProviderFromRequest(request: Request): SupportedProvider {
  const header = request.headers.get("x-llm-provider")?.toLowerCase();
  if (header === "google") {
    return "google";
  }
  return "openai";
}

function resolveModelFromRequest(request: Request, provider: SupportedProvider, fallback: string): string {
  const headerModel = request.headers.get("x-llm-model");
  if (headerModel && headerModel.trim()) {
    return headerModel.trim();
  }

  try {
    const url = new URL(request.url);
    const paramModel = url.searchParams.get("model");
    if (paramModel && paramModel.trim()) {
      return paramModel.trim();
    }
  } catch {
    // ignored
  }

  return fallback;
}

function resolveApiKeyForProvider(provider: SupportedProvider, explicitKey: string | null): string {
  const fallback = SecureEnv.getWithDefault(
    provider === "openai" ? "OPENAI_API_KEY" : "GOOGLE_API_KEY",
    "",
  );
  return (explicitKey ?? fallback).trim();
}

export async function handleRealtimeSdpExchange(options: RealtimeSdpExchangeOptions): Promise<RealtimeSdpExchangeResult> {
  const { request, sdpOffer } = options;

  if (!sdpOffer || !sdpOffer.includes("v=0")) {
    throw new RealtimeSessionError("INVALID_REQUEST", "Invalid SDP offer", { status: 400 });
  }

  const provider = resolveProviderFromRequest(request);
  if (!providerSupportsRealtime(provider)) {
    throw new RealtimeSessionError(
      "UNSUPPORTED_PROVIDER",
      "Realtime conversations are not supported for the selected provider.",
      { status: REALTIME_ERROR_STATUS.UNSUPPORTED_PROVIDER },
    );
  }

  const defaultModel = getProviderDefaultModel(provider);
  const model = resolveModelFromRequest(request, provider, defaultModel);

  const headerKey = request.headers.get("x-llm-api-key");
  const resolvedKey = resolveApiKeyForProvider(provider, headerKey);

  if (!resolvedKey) {
    const label = provider === "openai" ? "OpenAI" : "Google";
    throw new RealtimeSessionError(
      "MISSING_API_KEY",
      `Missing API key for ${label}`,
      { status: REALTIME_ERROR_STATUS.MISSING_API_KEY },
    );
  }

  if (provider !== "openai") {
    throw new RealtimeSessionError(
      "UNSUPPORTED_PROVIDER",
      "Realtime conversations for this provider are not implemented yet.",
      { status: REALTIME_ERROR_STATUS.UNSUPPORTED_PROVIDER },
    );
  }

  const response = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolvedKey}`,
      "Content-Type": "application/sdp",
      Accept: "application/sdp",
      "OpenAI-Beta": "realtime=v1",
    },
    body: sdpOffer,
  });

  const answerSdp = await response.text();
  if (!response.ok) {
    throw interpretOpenAiHttpError(response.status, answerSdp);
  }

  return {
    answerSdp,
    provider,
    model,
  };
}
