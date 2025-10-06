// src/lib/realtimeSession.ts
import WebSocket from "ws";
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

function resolveSessionIdFromRequest(request: Request): string {
  const headerSession = request.headers.get("x-rt-session-id");
  if (headerSession && headerSession.trim()) {
    return headerSession.trim();
  }

  try {
    const url = new URL(request.url);
    const paramSessionId = url.searchParams.get("sessionId");
    if (paramSessionId && paramSessionId.trim()) {
      return paramSessionId.trim();
    }
  } catch {
    // ignored
  }

  return "default";
}

function resolveApiKeyForProvider(provider: SupportedProvider, explicitKey: string | null): string {
  const fallback = SecureEnv.getWithDefault(
    provider === "openai" ? "OPENAI_API_KEY" : "GOOGLE_API_KEY",
    "",
  );
  const resolved = (explicitKey ?? fallback).trim();

  if (!resolved) {
    return "";
  }

  try {
    ApiKeySecurity.validateKeyOrThrow(provider, resolved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid API key";
    throw new RealtimeSessionError("INVALID_API_KEY", message, {
      status: REALTIME_ERROR_STATUS.INVALID_API_KEY,
      cause: error,
    });
  }

  return resolved;
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

  const sessionId = resolveSessionIdFromRequest(request);
  const manager = rtSessionManager.getExistingSession(sessionId);
  const sessionKey = manager?.getResolvedApiKey() ?? null;
  const headerKey = request.headers.get("x-llm-api-key");
  const resolvedKey = resolveApiKeyForProvider(provider, headerKey ?? sessionKey);

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

interface PaperContext {
  id?: string;
  title?: string;
  authors?: string;
  primaryAuthor?: string;
  hasAdditionalAuthors?: boolean;
  formattedPublishedDate?: string;
  abstract?: string;
  arxivUrl?: string;
}

class RTManager extends EventEmitter {
  private ws: WebSocket | null = null;
  starting = false;
  sessionId: string;
  private startPromise?: Promise<void>;
  private connectionTimeout?: NodeJS.Timeout;
  private provider: SupportedProvider = "openai";
  private apiKey: string | null = SecureEnv.get("OPENAI_API_KEY") || null;
  private model: string = getProviderDefaultModel("openai");
  private paperContext: PaperContext | null = null;
  private needsNewAudioBuffer = true;

  constructor(sessionId?: string) {
    super();
    this.sessionId = sessionId || "default";
  }

  getStatus(): "inactive" | "starting" | "active" {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return "active";
    if (this.starting || this.startPromise) return "starting";
    return "inactive";
  }

  getResolvedApiKey(): string {
    return (this.apiKey ?? "").trim();
  }

  configure(options: { provider: SupportedProvider; apiKey: string; model?: string; paperContext?: PaperContext | null }): boolean {
    let changed = false;
    const nextProvider = options.provider;
    if (nextProvider !== this.provider) {
      this.provider = nextProvider;
      changed = true;
    }

    const trimmedKey = options.apiKey.trim();
    if (trimmedKey !== this.apiKey) {
      this.apiKey = trimmedKey;
      changed = true;
    }

    const nextModel = (options.model ?? getProviderDefaultModel(nextProvider)).trim();
    if (nextModel !== this.model) {
      this.model = nextModel;
      changed = true;
    }

    const normalizedContext = options.paperContext ?? null;
    const currentContext = this.paperContext ? JSON.stringify(this.paperContext) : null;
    const nextContext = normalizedContext ? JSON.stringify(normalizedContext) : null;
    if (currentContext !== nextContext) {
      this.paperContext = normalizedContext;
      changed = true;
    }

    if (changed && this.isActive()) {
      this.pushSessionUpdate();
    }

    return changed;
  }

  async start(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.establishConnection();
    return this.startPromise.finally(() => {
      this.startPromise = undefined;
    });
  }

  async waitUntilReady(timeoutMs = 5_000): Promise<void> {
    if (this.isActive()) {
      return;
    }

    const status = this.getStatus();
    if (status === "inactive") {
      throw new RealtimeSessionError(
        "INVALID_REQUEST",
        "Realtime session has not been started yet.",
        { status: REALTIME_ERROR_STATUS.INVALID_REQUEST },
      );
    }

    await new Promise<void>((resolve, reject) => {
      const listeners: Array<[string, (...args: unknown[]) => void]> = [];
      let timer: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        for (const [event, handler] of listeners) {
          this.off(event, handler);
        }
        listeners.length = 0;
      };

      const handleReady = () => {
        cleanup();
        resolve();
      };

      const handleClose = () => {
        cleanup();
        reject(
          new RealtimeSessionError(
            "WEBSOCKET_ERROR",
            "Realtime session closed before it became ready.",
            { status: REALTIME_ERROR_STATUS.WEBSOCKET_ERROR },
          ),
        );
      };

      const handleError = (error: unknown) => {
        cleanup();
        if (isRealtimeSessionError(error)) {
          reject(error);
          return;
        }

        const message = error instanceof Error ? error.message : "Realtime session failed before becoming ready.";
        reject(
          new RealtimeSessionError(
            "UPSTREAM_ERROR",
            message,
            { status: REALTIME_ERROR_STATUS.UPSTREAM_ERROR, cause: error },
          ),
        );
      };

      listeners.push(["ready", handleReady], ["close", handleClose], ["error", handleError]);
      for (const [event, handler] of listeners) {
        this.on(event, handler);
      }

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          cleanup();
          reject(
            new RealtimeSessionError(
              "TIMEOUT",
              "Timed out waiting for realtime session to become ready.",
              { status: REALTIME_ERROR_STATUS.TIMEOUT },
            ),
          );
        }, timeoutMs);
      }
    });
  }

  private async establishConnection(): Promise<void> {
    const key = (this.apiKey || "").trim();
    if (!key) {
      throw new RealtimeSessionError(
        "MISSING_API_KEY",
        "Missing API key for realtime session",
        { status: REALTIME_ERROR_STATUS.MISSING_API_KEY },
      );
    }

    if (!providerSupportsRealtime(this.provider)) {
      throw new RealtimeSessionError(
        "UNSUPPORTED_PROVIDER",
        "Realtime session unsupported for this provider",
        { status: REALTIME_ERROR_STATUS.UNSUPPORTED_PROVIDER },
      );
    }

    this.starting = true;
    try {
      await new Promise<void>((resolve, reject) => {
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.model)}`;
        const ws = new WebSocket(wsUrl, {
          headers: {
            Authorization: `Bearer ${key}`,
            "OpenAI-Beta": "realtime=v1",
          },
        });

        const clearTimeoutIfNeeded = () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = undefined;
          }
        };

        this.connectionTimeout = setTimeout(() => {
          ws.terminate();
          reject(
            new RealtimeSessionError(
              "TIMEOUT",
              "Timed out while establishing realtime connection",
              { status: REALTIME_ERROR_STATUS.TIMEOUT },
            ),
          );
        }, 10_000);

        ws.on("open", () => {
          clearTimeoutIfNeeded();
          this.ws = ws;
          this.registerMessageHandlers(ws);
          this.pushSessionUpdate();
          this.needsNewAudioBuffer = true;
          this.emit("ready");
          resolve();
        });

        ws.on("error", (error: Error & { code?: number }) => {
          clearTimeoutIfNeeded();
          try {
            ws.terminate();
          } catch {
            // ignored
          }
          reject(
            new RealtimeSessionError(
              "WEBSOCKET_ERROR",
              `WebSocket connection error: ${error.message}`,
              { status: REALTIME_ERROR_STATUS.WEBSOCKET_ERROR, cause: error },
            ),
          );
        });

        ws.on("close", () => {
          clearTimeoutIfNeeded();
          this.ws = null;
          this.emit("close");
        });
      });
    } finally {
      this.starting = false;
    }
  }

  private pushSessionUpdate() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const payload = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800,
        },
        instructions: this.buildInstructions(),
      },
    };

    this.ws.send(JSON.stringify(payload));
  }

  private buildInstructions(): string {
    if (!this.paperContext) {
      return "You are assisting with a podcast conversation.";
    }

    const segments = [];
    if (this.paperContext.title) segments.push(`Title: ${this.paperContext.title}`);
    if (this.paperContext.primaryAuthor) {
      segments.push(`Authors: ${this.paperContext.primaryAuthor}${this.paperContext.hasAdditionalAuthors ? " et al." : ""}`);
    } else if (this.paperContext.authors) {
      segments.push(`Authors: ${this.paperContext.authors}`);
    }
    if (this.paperContext.formattedPublishedDate) segments.push(`Published: ${this.paperContext.formattedPublishedDate}`);
    if (this.paperContext.abstract) segments.push(`Summary: ${this.paperContext.abstract}`);
    if (this.paperContext.arxivUrl) segments.push(`URL: ${this.paperContext.arxivUrl}`);

    const context = segments.join("; ");
    return context
      ? `You are assisting with a podcast conversation. Context: ${context}`
      : "You are assisting with a podcast conversation.";
  }

  private registerMessageHandlers(ws: WebSocket) {
    ws.on("message", (data: WebSocket.RawData) => {
      try {
        const text = typeof data === "string" ? data : data.toString();
        const payload = JSON.parse(text) as Record<string, unknown>;
        const type = typeof payload.type === "string" ? payload.type : "";
        if (!type) {
          return;
        }

        if (type === "session.created" || type === "session.updated") {
          return;
        }

        if (type === "response.output_text.delta" || type === "response.text.delta") {
          const delta =
            typeof payload.delta === "string"
              ? payload.delta
              : typeof payload.text === "string"
                ? payload.text
                : "";
          if (delta) {
            this.emit("transcript", delta);
          }
          return;
        }

        if (type === "response.output_text.done" || type === "response.done" || type === "response.completed") {
          this.emit("assistant_done");
          return;
        }

        if (type === "response.audio.delta" || type === "response.output_audio.delta") {
          const audioDelta =
            typeof payload.delta === "string"
              ? payload.delta
              : typeof payload.delta === "object" && payload.delta !== null && typeof (payload.delta as { audio?: string }).audio === "string"
                ? (payload.delta as { audio?: string }).audio ?? ""
                : typeof payload.audio === "string"
                  ? payload.audio
                  : "";
          if (audioDelta) {
            const bytes = Buffer.from(audioDelta, "base64");
            this.emit("audio", new Uint8Array(bytes));
          }
          return;
        }

        if (
          type === "conversation.item.input_audio_transcription.delta" ||
          type === "input_audio_buffer.transcription.delta"
        ) {
          const delta =
            typeof payload.delta === "string"
              ? payload.delta
              : typeof payload.transcript === "string"
                ? payload.transcript
                : "";
          if (delta) {
            this.emit("user_transcript_delta", delta);
          }
          return;
        }

        if (
          type === "conversation.item.input_audio_transcription.completed" ||
          type === "input_audio_buffer.transcription.completed"
        ) {
          const transcript =
            typeof payload.transcript === "string"
              ? payload.transcript
              : typeof payload.text === "string"
                ? payload.text
                : "";
          if (transcript) {
            this.emit("user_transcript", transcript);
          }
          return;
        }

        if (type === "input_audio_buffer.speech_started") {
          this.emit("user_speech_started");
          return;
        }

        if (type === "input_audio_buffer.speech_stopped") {
          this.emit("user_speech_stopped");
          return;
        }

        if (type === "response.error" || type === "error") {
          const message =
            typeof payload.error === "string"
              ? payload.error
              : typeof payload.message === "string"
                ? payload.message
                : "Realtime session error";
          this.emit("error", new Error(message));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to parse realtime event";
        this.emit("error", new Error(message));
      }
    });
  }

  async appendPcm16(chunk: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Session not ready - call start() first");
    }

    const base64Audio = Buffer.from(chunk).toString("base64");
    if (this.needsNewAudioBuffer) {
      try {
        this.ws.send(JSON.stringify({ type: "input_audio_buffer.create" }));
      } catch (error) {
        throw new Error(`Failed to create audio buffer: ${error instanceof Error ? error.message : String(error)}`);
      }
      this.needsNewAudioBuffer = false;
    }
    const event = {
      type: "input_audio_buffer.append",
      audio: base64Audio,
    };

    this.ws.send(JSON.stringify(event));
  }

  async commitTurn() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Session not ready - call start() first");
    }

    const events = [
      { type: "input_audio_buffer.commit" },
      { type: "response.create", response: { modalities: ["text", "audio"] } },
    ];

    for (const event of events) {
      this.ws.send(JSON.stringify(event));
    }

    this.needsNewAudioBuffer = true;
  }

  async sendText(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Session not ready - call start() first");
    }

    const messageEvent = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text,
          },
        ],
      },
    };

    const responseEvent = {
      type: "response.create",
      response: { modalities: ["text", "audio"] },
    };

    this.ws.send(JSON.stringify(messageEvent));
    this.ws.send(JSON.stringify(responseEvent));
  }

  stop() {
    if (!this.ws) {
      return;
    }
    try {
      this.ws.close();
    } catch {}
    this.ws = null;
    this.emit("close");
    this.needsNewAudioBuffer = true;
  }

  getConfiguration() {
    return {
      provider: this.provider,
      hasApiKey: !!(this.apiKey && this.apiKey.length > 0),
      model: this.model,
      paperContext: this.paperContext,
    };
  }

  isActive(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  isStarting(): boolean {
    return this.starting || !!this.startPromise;
  }
}

class RTSessionManager {
  private sessions = new Map<string, RTManager>();

  getSession(sessionId: string): RTManager {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new RTManager(sessionId));
    }
    return this.sessions.get(sessionId)!;
  }

  getExistingSession(sessionId: string): RTManager | null {
    return this.sessions.get(sessionId) ?? null;
  }

  removeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.stop();
      this.sessions.delete(sessionId);
    }
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

const globalManager = globalThis as typeof globalThis & { __rtManager?: RTSessionManager };
if (!globalManager.__rtManager) {
  globalManager.__rtManager = new RTSessionManager();
}

export const rtSessionManager = globalManager.__rtManager;
