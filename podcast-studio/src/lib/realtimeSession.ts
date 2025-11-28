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
  fullText?: string;
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
  private currentTurnPcmChunks: Uint8Array[] = [];

  constructor(sessionId?: string) {
    super();
    this.sessionId = sessionId || "default";
    // Prevent unhandled error events from crashing the process
    this.on("error", (err) => {
      console.error(`[ERROR] RTManager error (handled): ${err instanceof Error ? err.message : err}`);
    });
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
      
      // Log paper context details for debugging
      if (normalizedContext) {
        console.log("[INFO] RTManager.configure: Paper context updated", {
          title: normalizedContext.title,
          hasFullText: !!normalizedContext.fullText,
          fullTextLength: normalizedContext.fullText?.length ?? 0,
          hasAbstract: !!normalizedContext.abstract,
        });
      } else {
        console.log("[INFO] RTManager.configure: Paper context cleared");
      }
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
      let settled = false;

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

      const resolveIfActive = () => {
        if (settled) {
          return;
        }
        if (this.isActive()) {
          settled = true;
          cleanup();
          resolve();
        }
      };

      const handleReady = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve();
      };

      const handleClose = () => {
        if (settled) {
          return;
        }
        settled = true;
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
        if (settled) {
          return;
        }
        settled = true;
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

      resolveIfActive();

      if (!settled && timeoutMs > 0) {
        timer = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
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
    const startTime = Date.now();
    console.log("[INFO] establishConnection: Starting...", {
      provider: this.provider,
      model: this.model,
      hasPaperContext: !!this.paperContext,
      paperTitle: this.paperContext?.title,
    });

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
        console.log("[INFO] Connecting to WebSocket:", wsUrl);
        const ws = new WebSocket(wsUrl, {
          headers: {
            Authorization: `Bearer ${key}`,
            "OpenAI-Beta": "realtime=v1",
          },
        });

        let settled = false;
        const settle = (fn: () => void) => {
          if (!settled) {
            settled = true;
            clearTimeoutIfNeeded();
            fn();
          }
        };

        const clearTimeoutIfNeeded = () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = undefined;
          }
        };

        this.connectionTimeout = setTimeout(() => {
          console.error("[ERROR] Connection timeout after 15 seconds");
          settle(() => {
            ws.terminate();
            reject(
              new RealtimeSessionError(
                "TIMEOUT",
                "Timed out while establishing realtime connection (15s)",
                { status: REALTIME_ERROR_STATUS.TIMEOUT },
              ),
            );
          });
        }, 15_000); // 15 second timeout - connection should be fast now that PDF is pre-fetched

        // Handler for session confirmation or error from OpenAI
        const handleMessage = (data: WebSocket.RawData) => {
          // Reset connection timeout on any activity from server
          clearTimeoutIfNeeded();
          
          try {
            const text = typeof data === "string" ? data : data.toString();
            const payload = JSON.parse(text) as Record<string, unknown>;
            const type = typeof payload.type === "string" ? payload.type : "";

            console.log(`[DEBUG] Connection phase event: ${type}`);

            if (type === "session.created") {
               console.log("[INFO] Session created. Sending configuration update...");
               // Push update IMMEDIATELY after creation to ensure instructions are set before any turn
               let updateSent = false;
               try {
                 this.pushSessionUpdate();
                 updateSent = true;
                 console.log("[INFO] Session update sent, waiting for confirmation...");
               } catch (updateError) {
                 console.error("[ERROR] Failed to push session update after creation:", updateError);
                 // Don't fail the connection - resolve immediately with default instructions
                 const elapsed = Date.now() - startTime;
                 console.warn(`[WARN] Proceeding without custom instructions. Connection established in ${elapsed}ms`);
                 settle(() => {
                   cleanup();
                   this.emit("ready");
                   resolve();
                 });
               }
               
               // If update was sent, set a shorter timeout for the session.updated response
               if (updateSent) {
                 setTimeout(() => {
                   if (!settled) {
                     console.warn("[WARN] No session.updated received within 5s, proceeding anyway...");
                     const elapsed = Date.now() - startTime;
                     console.log(`[INFO] Connection established in ${elapsed}ms (without update confirmation)`);
                     settle(() => {
                       cleanup();
                       this.emit("ready");
                       resolve();
                     });
                   }
                 }, 5000);
               }
               return; 
            }

            if (type === "session.updated") {
              const elapsed = Date.now() - startTime;
              console.log(`[INFO] Session configuration confirmed by OpenAI. Connection established in ${elapsed}ms`);
              settle(() => {
                cleanup();
                this.emit("ready");
                resolve();
              });
              return;
            }

            // Error from OpenAI (e.g., invalid API key)
            if (type === "error" || type === "response.error") {
              const errorObj = payload.error as { code?: string; message?: string } | undefined;
              const errorCode = errorObj?.code || "unknown";
              const errorMessage = errorObj?.message || "OpenAI session error";
              console.error(`[ERROR] OpenAI returned error during connection: ${errorCode} - ${errorMessage}`);

              settle(() => {
                cleanup();
                ws.close();
                this.ws = null;

                // Map OpenAI error codes to our error types
                let code: RealtimeSessionErrorCode = "UPSTREAM_ERROR";
                let status = REALTIME_ERROR_STATUS.UPSTREAM_ERROR;

                if (errorCode === "invalid_api_key") {
                  code = "INVALID_API_KEY";
                  status = REALTIME_ERROR_STATUS.INVALID_API_KEY;
                } else if (errorCode === "rate_limit_exceeded") {
                  code = "RATE_LIMITED";
                  status = REALTIME_ERROR_STATUS.RATE_LIMITED;
                } else if (errorCode === "insufficient_quota") {
                  code = "FORBIDDEN";
                  status = REALTIME_ERROR_STATUS.FORBIDDEN;
                }

                reject(
                  new RealtimeSessionError(code, errorMessage, { status }),
                );
              });
              return;
            }
          } catch (e) {
            console.warn("[WARN] Failed to parse connection phase message:", e);
          }
        };

        ws.on("open", () => {
          console.log("[INFO] WebSocket connected, awaiting session events...");
          this.ws = ws;
          // Add temporary message handler for connection phase
          ws.on("message", handleMessage);
          
          // Use a ping interval to keep the connection alive during heavy processing
          const pingInterval = setInterval(() => {
             if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
             } else {
                clearInterval(pingInterval);
             }
          }, 5000);
          
          // Clean up ping on close
          ws.once("close", () => clearInterval(pingInterval));
          
          this.needsNewAudioBuffer = true;
        });

        // After settlement, remove the temporary handler
        const cleanup = () => {
          ws.off("message", handleMessage);
        };

        ws.on("error", (error: Error & { code?: number }) => {
          settle(() => {
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
        });

        ws.on("close", (code, reason) => {
          const reasonStr = reason?.toString() || "unknown";
          console.log(`[INFO] WebSocket closed: ${code} - ${reasonStr}`);
          settle(() => {
            this.ws = null;
            this.emit("close");
            // If we close before session confirmation, that's an error
            reject(
              new RealtimeSessionError(
                "WEBSOCKET_ERROR",
                `Connection closed before session was established (code: ${code})`,
                { status: REALTIME_ERROR_STATUS.WEBSOCKET_ERROR },
              ),
            );
          });
        });
      });

      // Connection established, now register the full message handlers
      if (this.ws) {
        this.registerMessageHandlers(this.ws);
      }
    } finally {
      this.starting = false;
    }
  }

  private pushSessionUpdate() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WARN] Cannot push session update - WebSocket not ready", {
        hasWs: !!this.ws,
        readyState: this.ws?.readyState
      });
      return;
    }

    try {
      const instructions = this.buildInstructions();
      
      const payload = {
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: {
            model: "whisper-1",
          },
          voice: "alloy",
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
          },
          instructions: instructions,
        },
      };

      console.log("[INFO] Pushing session update...");
      // Safe preview of instructions
      const preview = instructions.length > 200 ? instructions.slice(0, 200) + "..." : instructions;
      console.log(`[DEBUG] Instructions preview: ${preview}`);
      
      this.ws.send(JSON.stringify(payload));
    } catch (e) {
      console.error("[ERROR] Failed to push session update:", e);
      // We don't throw here to avoid crashing the connection flow, 
      // but the session might be in a default state.
    }
  }

  private buildInstructions(): string {
    if (!this.paperContext) {
      return "You are 'Dr. Sarah', an expert researcher and podcast guest. You are here to have a deep, technical, yet accessible conversation about a specific research paper. You should explain complex concepts clearly, answer the host's questions with depth, and treat this as a collaborative deep-dive. Be concise but insightful.";
    }

    const segments = [];
    if (this.paperContext.title) segments.push(`Title: ${this.paperContext.title}`);
    if (this.paperContext.primaryAuthor) {
      segments.push(`Authors: ${this.paperContext.primaryAuthor}${this.paperContext.hasAdditionalAuthors ? " et al." : ""}`);
    } else if (this.paperContext.authors) {
      segments.push(`Authors: ${this.paperContext.authors}`);
    }
    if (this.paperContext.formattedPublishedDate) segments.push(`Published: ${this.paperContext.formattedPublishedDate}`);
    if (this.paperContext.abstract) segments.push(`Abstract: ${this.paperContext.abstract}`);
    if (this.paperContext.arxivUrl) segments.push(`URL: ${this.paperContext.arxivUrl}`);
    if (this.paperContext.fullText) segments.push(`\nFull Paper Text (Excerpt):\n${this.paperContext.fullText}`);

    // Force instructions to include title explicitly at the start
    return `You are 'Dr. Sarah', an expert researcher and podcast guest. You are here to have a deep, technical, yet accessible conversation about the research paper titled "${this.paperContext.title}".

Paper Context:
${segments.join("\n")}

Instructions:
1. Act as a knowledgeable expert who has deeply studied this paper.
2. Engage in a natural, conversational flow. Do not just summarize; answer specific questions and offer insights based on the provided text.
3. Use the full text provided to answer specific questions about methodology, results, and discussion points.
4. Keep your responses concise (1-3 sentences) unless asked to elaborate, to maintain a podcast-like rhythm.
5. Your goal is to help the host (user) unpack the significance of this work.
6. START IMMEDIATELY by briefly acknowledging the paper topic and welcoming the host's first question.`;
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

        // Log all events for debugging with full payload
        console.log(`[DEBUG] Received realtime event: ${type}`, JSON.stringify(payload, null, 2));

        if (type === "session.created" || type === "session.updated") {
          console.log("[INFO] Session ready:", type);
          return;
        }

        if (type === "response.created") {
           // Reset interruption flag or notify client of new turn
           // In a full implementation, we might send a specific event
           this.emit("response_created");
        }

        // Handle AI transcript (text response) - check common event types
        if (
          type === "response.text.delta" ||
          type === "response.output_text.delta" ||
          type === "response.audio_transcript.delta"
        ) {
          const delta =
            typeof payload.delta === "string"
              ? payload.delta
              : typeof (payload as { transcript?: string }).transcript === "string"
                ? (payload as { transcript?: string }).transcript
                : typeof (payload as { text?: string }).text === "string"
                  ? (payload as { text?: string }).text
                  : "";
          if (delta) {
            console.log(`[DEBUG] AI transcript delta received (${type}): "${delta}"`);
            this.emit("transcript", delta);
          }
          return;
        }

        if (
          type === "response.text.done" ||
          type === "response.output_text.done" ||
          type === "response.done" ||
          type === "response.completed" ||
          type === "response.audio_transcript.done"
        ) {
          console.log("[INFO] AI response completed event:", type);
          this.emit("assistant_done");
          return;
        }

        // Handle AI audio (support common event types)
        if (
          type === "response.audio.delta" ||
          type === "response.output_audio.delta"
        ) {
          const audioDelta =
            typeof (payload as { delta?: string }).delta === "string"
              ? (payload as { delta?: string }).delta
              : typeof (payload as { audio?: string }).audio === "string"
                ? (payload as { audio?: string }).audio
                : "";
          if (audioDelta) {
            try {
              const bytes = Buffer.from(audioDelta, "base64");
              console.log(`[DEBUG] AI audio delta received (${type}): ${bytes.length} bytes`);
              this.emit("audio", new Uint8Array(bytes));
            } catch (error) {
              console.error(`[ERROR] Failed to decode audio delta:`, error);
            }
          }
          return;
        }

        // Handle user transcription delta (streaming)
        if (
          type === "conversation.item.input_audio_transcription.delta" ||
          type === "conversation.item.input_audio_transcript.delta" ||
          type === "input_audio_buffer.transcription.delta" ||
          type === "input_audio_buffer.transcript.delta"
        ) {
          // Check multiple fields for the transcript
          const delta =
            typeof (payload as { delta?: string }).delta === "string"
              ? (payload as { delta?: string }).delta
              : typeof (payload as { transcript?: string }).transcript === "string"
                ? (payload as { transcript?: string }).transcript
                : typeof (payload as { text?: string }).text === "string"
                  ? (payload as { text?: string }).text
                  : "";
          if (delta) {
            console.log(`[DEBUG] User transcript delta: "${delta}"`);
            this.emit("user_transcript_delta", delta);
          } else {
             // Debug logging for empty payload on delta
             console.log(`[DEBUG] Received empty delta for ${type}`, payload);
          }
          return;
        }

        // Handle user transcription complete
        if (
          type === "conversation.item.input_audio_transcription.completed" ||
          type === "conversation.item.input_audio_transcript.completed" ||
          type === "input_audio_buffer.transcription.completed" ||
          type === "input_audio_buffer.transcript.completed"
        ) {
          const transcript =
            typeof (payload as { transcript?: string }).transcript === "string"
              ? (payload as { transcript?: string }).transcript
              : typeof (payload as { text?: string }).text === "string"
                ? (payload as { text?: string }).text
                : typeof (payload as { content?: string }).content === "string"
                  ? (payload as { content?: string }).content
                  : "";
          if (transcript) {
            console.log(`[INFO] User transcript completed: "${transcript}"`);
            this.emit("user_transcript", transcript);
          } else {
             console.log(`[DEBUG] Received empty completed transcript for ${type}`, payload);
          }
          return;
        }

        // Fallback: output item payloads may contain text/audio in different shape
        if (type === "response.output_item.added") {
          try {
            const item = (payload as { item?: unknown }).item as Record<string, unknown> | undefined;
            const rawContent = (item && (item as Record<string, unknown>)["content"]) as unknown;
            const content = Array.isArray(rawContent) ? (rawContent as Array<Record<string, unknown>>) : [];
            for (const part of content) {
              const partType = part?.["type"];
              if (partType === "output_text") {
                const text = typeof part?.["text"] === "string" ? (part["text"] as string) : "";
                if (text) {
                  console.log(`[DEBUG] AI transcript (output_item.added): "${text}"`);
                  this.emit("transcript", text);
                }
              }
              if (partType === "output_audio") {
                const audioB64 = typeof part?.["audio"] === "string" ? (part["audio"] as string) : "";
                if (audioB64) {
                  try {
                    const bytes = Buffer.from(audioB64, "base64");
                    console.log(`[DEBUG] AI audio (output_item.added): ${bytes.length} bytes`);
                    this.emit("audio", new Uint8Array(bytes));
                  } catch (e) {
                    console.error("[ERROR] Failed to decode output_item audio", e);
                  }
                }
              }
            }
          } catch (e) {
            console.warn("[WARN] Unable to parse response.output_item.added", e);
          }
          return;
        }

        // Handle speech detection
        if (type === "input_audio_buffer.speech_started") {
          console.log("[INFO] User speech started");
          this.emit("user_speech_started");
          return;
        }

        if (type === "input_audio_buffer.speech_stopped") {
          console.log("[INFO] User speech stopped");
          this.emit("user_speech_stopped");
          return;
        }

        // Fallback: handle conversation.item.created for user messages
        if (type === "conversation.item.created") {
          try {
            const item = (payload as { item?: unknown }).item as Record<string, unknown> | undefined;
            if (item?.role === "user") {
              const content = item.content as Array<{ type: string; text?: string; transcript?: string }>;
              if (Array.isArray(content)) {
                const textPart = content.find((c) => c.type === "input_text" || c.type === "input_audio_transcription");
                const text = textPart?.text ?? textPart?.transcript;
                if (text) {
                  console.log(`[INFO] User text from conversation.item.created: "${text}"`);
                  this.emit("user_transcript", text);
                }
              }
            }
          } catch (e) {
            console.warn("[WARN] Failed to parse conversation.item.created", e);
          }
          return;
        }

        // Handle errors
        if (type === "response.error" || type === "error") {
          const message =
            typeof payload.error === "string"
              ? payload.error
              : typeof payload.message === "string"
                ? payload.message
                : "Realtime session error";
          console.error(`[ERROR] Realtime error: ${message}`);
          this.emit("error", new Error(message));
          return;
        }

        // Log unhandled events for debugging
        console.log(`[DEBUG] Unhandled event type: ${type}`, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to parse realtime event";
        console.error(`[ERROR] Message handler error: ${message}`);
        this.emit("error", new Error(message));
      }
    });
  }

  async appendPcm16(chunk: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const state = this.ws ? this.ws.readyState : "no websocket";
      throw new Error(`Session not ready - WebSocket state: ${state}`);
    }

    const base64Audio = Buffer.from(chunk).toString("base64");
    // Accumulate raw PCM chunks locally so we can create a message explicitly on commit
    // This ensures the model receives the user audio even if buffer semantics change upstream
    this.currentTurnPcmChunks.push(new Uint8Array(chunk));
    
    if (this.needsNewAudioBuffer) {
      try {
        console.log("[INFO] Creating new input audio buffer");
        this.ws.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
        this.needsNewAudioBuffer = false;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to clear audio buffer: ${msg}`);
        throw new Error(`Failed to clear audio buffer: ${msg}`);
      }
    }
    
    const event = {
      type: "input_audio_buffer.append",
      audio: base64Audio,
    };

    console.log(`[DEBUG] Appending ${chunk.length} bytes (${this.currentTurnPcmChunks.length} chunks accumulated)`);
    this.ws.send(JSON.stringify(event));
  }

  async commitTurn() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const state = this.ws ? this.ws.readyState : "no websocket";
      throw new Error(`Session not ready - WebSocket state: ${state}`);
    }

    const chunkCount = this.currentTurnPcmChunks.length;
    const totalBytes = this.currentTurnPcmChunks.reduce((acc, u8) => acc + u8.length, 0);
    
    console.log("[INFO] Committing audio turn", {
      chunkCount,
      totalBytes,
      durationEstimate: `~${(totalBytes / 48000).toFixed(2)}s`
    });
    
    if (chunkCount === 0) {
      console.warn("[WARN] No audio chunks to commit - skipping turn");
      return;
    }
    
    // Commit the audio buffer - this triggers transcription and adds to conversation
    this.ws.send(JSON.stringify({ 
      type: "input_audio_buffer.commit" 
    }));
    console.log("[DEBUG] Sent input_audio_buffer.commit");
    
    // Reset accumulation for next turn
    this.currentTurnPcmChunks = [];
    this.needsNewAudioBuffer = true;
    
    // Small delay to let the commit process before requesting response
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Request AI response with both text and audio
    const responsePayload = { 
      type: "response.create",
      response: { 
        modalities: ["text", "audio"],
        instructions: this.buildInstructions(),
        temperature: 0.8,
        max_output_tokens: null,
        audio: {
          voice: "alloy",
          format: "pcm16",
          sample_rate: 24000
        }
      }
    };
    
    console.log("[INFO] Requesting AI response", responsePayload);
    this.ws.send(JSON.stringify(responsePayload));
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
