// src/app/api/rt/start/route.ts
import { NextResponse } from "next/server";
import {
  rtSessionManager,
  isRealtimeSessionError,
  resolveRealtimeHttpStatus,
  RealtimeSessionError,
  REALTIME_ERROR_STATUS,
  type RealtimeSessionErrorCode,
  type SupportedProvider,
} from "@/lib/realtimeSession";
import { ApiKeySecurity } from "@/lib/apiKeySecurity";
import { SecureEnv } from "@/lib/secureEnv";
import { getProviderDefaultModel, providerSupportsRealtime } from "@/lib/ai/client";

export const runtime = "nodejs";

type NormalizedError = {
  message: string;
  status: number;
  code?: RealtimeSessionErrorCode;
  stack?: string;
  details?: unknown;
};

function normalizeStartError(error: unknown): NormalizedError {
  if (isRealtimeSessionError(error)) {
    return {
      message: error.message,
      status: resolveRealtimeHttpStatus(error),
      code: error.code,
      stack: error.stack,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    const lowered = error.message.toLowerCase();
    if (lowered.includes("timeout")) {
      return {
        message: error.message,
        status: 504,
        code: "TIMEOUT",
        stack: error.stack,
      };
    }
    return {
      message: error.message,
      status: 500,
      stack: error.stack,
    };
  }

  return {
    message: "Failed to start realtime session",
    status: 500,
  };
}

export async function POST(req: Request) {
  const startTime = Date.now();
  let sessionId = "default";

  try {
    const rawBody = await req.json().catch((error) => {
      throw new RealtimeSessionError(
        "INVALID_REQUEST",
        "Request body must be valid JSON.",
        { status: 400, cause: error },
      );
    });

    const parsed = parseStartRequest(rawBody, req);
    sessionId = parsed.sessionId;

    const manager = rtSessionManager.getSession(sessionId);
    const currentStatus = manager.getStatus();

    if (!providerSupportsRealtime(parsed.provider)) {
      throw new RealtimeSessionError(
        "UNSUPPORTED_PROVIDER",
        "Realtime conversations are not supported for the selected provider.",
        { status: REALTIME_ERROR_STATUS.UNSUPPORTED_PROVIDER },
      );
    }

    const resolvedModel = (parsed.model ?? getProviderDefaultModel(parsed.provider)).trim();
    const resolvedKey = resolveApiKey(parsed.provider, parsed.apiKey);
    const paperContext = parsed.paperContext ?? null;

    // Log paper context status - we rely on frontend pre-fetching the PDF text
    if (paperContext) {
      console.log(`[INFO] Paper context received:`, {
        title: paperContext.title,
        hasFullText: !!paperContext.fullText,
        fullTextLength: paperContext.fullText?.length ?? 0,
        hasAbstract: !!paperContext.abstract,
        abstractLength: paperContext.abstract?.length ?? 0,
      });
    } else {
      console.log(`[INFO] No paper context provided - session will use default instructions`);
    }

    const paperContextFields = paperContext
      ? Object.entries(paperContext).filter(([, value]) =>
          typeof value === "boolean" ? value : value != null && value !== "",
        ).length
      : 0;

    const configChanged = manager.configure({
      provider: parsed.provider,
      apiKey: resolvedKey,
      model: resolvedModel,
      paperContext,
    });

    logSessionEvent("config", {
      sessionId,
      provider: parsed.provider,
      status: currentStatus,
      configChanged,
      model: resolvedModel,
      hasPaperContext: paperContextFields > 0,
      paperContextTitle: paperContext?.title, // Log title to verify propagation
      paperContextFields,
    });

    if (currentStatus === "active" && !configChanged) {
      logSessionEvent("active-noop", {
        sessionId,
        provider: parsed.provider,
      });
      return NextResponse.json({
        ok: true,
        sessionId,
        status: "active",
        message: "Session already active",
        provider: parsed.provider,
        model: resolvedModel,
      });
    }

    if (currentStatus === "active" && configChanged) {
      logSessionEvent("restart", { sessionId, provider: parsed.provider });
      await manager.stop();
    }

    if (manager.getStatus() === "starting") {
      logSessionEvent("await-start", { sessionId, provider: parsed.provider });
    }

    await manager.start();

    const duration = Date.now() - startTime;
    logSessionEvent("started", {
      sessionId,
      duration,
      provider: parsed.provider,
      model: resolvedModel,
      apiKeyPreview: ApiKeySecurity.maskKey(resolvedKey),
      paperContextFields,
    });

    return NextResponse.json({
      ok: true,
      sessionId,
      status: "active",
      duration,
      provider: parsed.provider,
      model: resolvedModel,
      message: "Realtime session started successfully",
    });

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const normalized = normalizeStartError(error);

    console.error(`[ERROR] Failed to start session`, {
      sessionId,
      duration,
      error: normalized.message,
      code: normalized.code,
      details: normalized.details,
      stack: normalized.stack,
    });

    return NextResponse.json({
      error: normalized.message,
      sessionId,
      duration,
      code: normalized.code,
      details: normalized.details,
    }, { status: normalized.status });
  }
}

function logSessionEvent(event: string, details: Record<string, unknown>) {
  console.info(`[INFO] [realtime:${event}]`, details);
}

const SESSION_ID_PATTERN = /^[a-zA-Z0-9:_-]+$/;

interface ParsedPaperContext {
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

interface ParsedStartRequest {
  sessionId: string;
  provider: SupportedProvider;
  apiKey?: string;
  model?: string;
  paperContext?: ParsedPaperContext;
}

function parseStartRequest(body: unknown, req: Request): ParsedStartRequest {
  if (!body || typeof body !== "object") {
    throw new RealtimeSessionError(
      "INVALID_REQUEST",
      "Request payload must be an object.",
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;
  const headerSessionId = req.headers.get("x-rt-session-id");
  const rawSessionId =
    typeof payload.sessionId === "string" && payload.sessionId.trim().length > 0
      ? payload.sessionId
      : headerSessionId ?? "";
  const sessionId = rawSessionId ? sanitizeSessionId(rawSessionId) : "default";

  const headerProvider = req.headers.get("x-llm-provider");
  const rawProvider =
    typeof payload.provider === "string" && payload.provider.trim().length > 0
      ? payload.provider
      : headerProvider ?? "";
  const provider = normalizeProvider(rawProvider);

  const headerApiKey = req.headers.get("x-llm-api-key");
  const rawApiKey =
    typeof payload.apiKey === "string" && payload.apiKey.trim().length > 0
      ? payload.apiKey
      : headerApiKey ?? undefined;

  const headerModel = req.headers.get("x-llm-model");
  const rawModel =
    typeof payload.model === "string" && payload.model.trim().length > 0
      ? payload.model
      : headerModel ?? "";

  const paperContext = parsePaperContext(payload);

  return {
    sessionId,
    provider,
    apiKey: sanitizeApiKey(rawApiKey),
    model: sanitizeOptionalString(rawModel, { maxLength: 128 }),
    paperContext,
  };
}

function sanitizeSessionId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "default";
  }
  if (trimmed.length > 128) {
    throw new RealtimeSessionError(
      "INVALID_REQUEST",
      "Session ID is too long.",
      { status: 400, details: { field: "sessionId" } },
    );
  }
  if (!SESSION_ID_PATTERN.test(trimmed)) {
    throw new RealtimeSessionError(
      "INVALID_REQUEST",
      "Session ID contains invalid characters.",
      { status: 400, details: { field: "sessionId" } },
    );
  }
  return trimmed;
}

function normalizeProvider(value: unknown): SupportedProvider {
  if (typeof value !== "string") {
    return "openai";
  }

  const lowered = value.trim().toLowerCase();
  if (!lowered) {
    return "openai";
  }

  if (lowered === "openai") {
    return "openai";
  }

  if (lowered === "google") {
    return "google";
  }

  throw new RealtimeSessionError(
    "INVALID_REQUEST",
    "Unsupported provider specified.",
    { status: 400, details: { field: "provider" } },
  );
}

function sanitizeApiKey(rawKey?: string): string | undefined {
  if (typeof rawKey !== "string") {
    return undefined;
  }

  const trimmed = rawKey.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

interface SanitizeStringOptions {
  maxLength?: number;
  collapseWhitespace?: boolean;
}

function sanitizeOptionalString(value: unknown, options: SanitizeStringOptions = {}): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const collapseWhitespace = options.collapseWhitespace ?? true;
  const collapsed = collapseWhitespace ? value.replace(/\s+/g, " ") : value;
  let trimmed = collapsed.trim();
  if (!trimmed) {
    return undefined;
  }

  if (options.maxLength && trimmed.length > options.maxLength) {
    trimmed = trimmed.slice(0, options.maxLength).trimEnd();
  }

  return trimmed;
}

const PAPER_FIELD_LIMITS = {
  id: 120,
  title: 400,
  authors: 400,
  abstract: 1500,
  primaryAuthor: 200,
  formattedPublishedDate: 120,
  arxivUrl: 500,
  fullText: 50000,
} as const;

function parsePaperContext(payload: Record<string, unknown>): ParsedPaperContext | undefined {
  const candidate = (payload.paper ?? payload.paperContext) as unknown;
  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }

  const source = candidate as Record<string, unknown>;
  const parsed: ParsedPaperContext = {
    id: sanitizeOptionalString(source.id, { maxLength: PAPER_FIELD_LIMITS.id, collapseWhitespace: false }),
    title: sanitizeOptionalString(source.title, { maxLength: PAPER_FIELD_LIMITS.title }),
    authors: sanitizeOptionalString(source.authors, { maxLength: PAPER_FIELD_LIMITS.authors }),
    primaryAuthor: sanitizeOptionalString(source.primaryAuthor, {
      maxLength: PAPER_FIELD_LIMITS.primaryAuthor,
    }),
    hasAdditionalAuthors: source.hasAdditionalAuthors === true,
    formattedPublishedDate: sanitizeOptionalString(source.formattedPublishedDate, {
      maxLength: PAPER_FIELD_LIMITS.formattedPublishedDate,
    }),
    abstract: sanitizeOptionalString(source.abstract, { maxLength: PAPER_FIELD_LIMITS.abstract }),
    arxivUrl:
      sanitizeOptionalString(source.arxiv_url, {
        maxLength: PAPER_FIELD_LIMITS.arxivUrl,
        collapseWhitespace: false,
      }) ??
      sanitizeOptionalString(source.arxivUrl, {
        maxLength: PAPER_FIELD_LIMITS.arxivUrl,
        collapseWhitespace: false,
      }),
    fullText: sanitizeOptionalString(source.fullText, {
      maxLength: PAPER_FIELD_LIMITS.fullText,
      collapseWhitespace: true,
    }),
  };

  const hasAnyContext = Boolean(
    parsed.id ||
      parsed.title ||
      parsed.authors ||
      parsed.primaryAuthor ||
      parsed.formattedPublishedDate ||
      parsed.abstract ||
      parsed.arxivUrl ||
      parsed.fullText ||
      parsed.hasAdditionalAuthors,
  );

  return hasAnyContext ? parsed : undefined;
}

function resolveApiKey(provider: SupportedProvider, incomingKey?: string): string {
  const fallback = SecureEnv.getWithDefault(
    provider === "openai" ? "OPENAI_API_KEY" : "GOOGLE_API_KEY",
    "",
  );
  const resolved = (incomingKey ?? fallback).trim();

  if (!resolved) {
    const label = provider === "openai" ? "OpenAI" : "Google";
    throw new RealtimeSessionError(
      "MISSING_API_KEY",
      `Missing API key for ${label}`,
      { status: REALTIME_ERROR_STATUS.MISSING_API_KEY },
    );
  }

  try {
    ApiKeySecurity.validateKeyOrThrow(provider, resolved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid API key";
    throw new RealtimeSessionError(
      "INVALID_API_KEY",
      message,
      { status: REALTIME_ERROR_STATUS.INVALID_API_KEY, cause: error },
    );
  }

  return resolved;
}
