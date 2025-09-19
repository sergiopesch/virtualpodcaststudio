// src/lib/realtimeSession.ts
import WebSocket from 'ws';
import { EventEmitter } from "node:events";
import { ApiKeySecurity } from "./apiKeySecurity";
import { SecureEnv } from "./secureEnv";

export type RTSignals = {
  audio: (data: Uint8Array) => void;
  transcript: (text: string) => void;
  user_transcript: (text: string) => void;
  user_transcript_delta: (text: string) => void;
  close: () => void;
  error: (err: unknown) => void;
  ready: () => void;
};

// Secure logging utility that masks sensitive information
const sanitizeForLogging = (obj: Record<string, unknown>): Record<string, unknown> => {
  const sanitized = { ...obj };
  
  // Remove or mask sensitive fields
  if (sanitized.apiKey) {
    sanitized.apiKey = ApiKeySecurity.maskKey(String(sanitized.apiKey));
  }
  if (sanitized.key) {
    sanitized.key = ApiKeySecurity.maskKey(String(sanitized.key));
  }
  if (sanitized.authorization) {
    sanitized.authorization = '[REDACTED]';
  }
  if (sanitized.token) {
    sanitized.token = '[REDACTED]';
  }
  
  return sanitized;
};

const log = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    const safeMeta = meta ? sanitizeForLogging(meta) : undefined;
    console.log(`[INFO] ${msg}`, safeMeta ? JSON.stringify(safeMeta) : '');
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    const safeMeta = meta ? sanitizeForLogging(meta) : undefined;
    console.error(`[ERROR] ${msg}`, safeMeta ? JSON.stringify(safeMeta) : '');
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    const safeMeta = meta ? sanitizeForLogging(meta) : undefined;
    console.warn(`[WARN] ${msg}`, safeMeta ? JSON.stringify(safeMeta) : '');
  },
  debug: (msg: string, meta?: Record<string, unknown>) => {
    const safeMeta = meta ? sanitizeForLogging(meta) : undefined;
    console.debug(`[DEBUG] ${msg}`, safeMeta ? JSON.stringify(safeMeta) : '');
  }
};

interface RealtimeEvent {
  type: string;
  event_id?: string;
  [key: string]: unknown;
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const extractText = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => extractText(item))
      .filter((part): part is string => typeof part === 'string' && part.length > 0);
    if (parts.length > 0) {
      return parts.join('');
    }
    return undefined;
  }

  if (value && typeof value === 'object') {
    const maybeText = (value as { text?: unknown; value?: unknown }).text ?? (value as { text?: unknown; value?: unknown }).value;
    const direct = extractText(maybeText);
    if (direct) {
      return direct;
    }

    const content = (value as { content?: unknown }).content;
    if (content !== undefined) {
      return extractText(content);
    }
  }

  return undefined;
};

const buildErrorMeta = (error: unknown): Record<string, unknown> => ({
  message: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
});

const DEFAULT_OPENAI_REALTIME_MODEL =
  SecureEnv.getWithDefault('OPENAI_REALTIME_MODEL', 'gpt-4o-realtime-preview-2024-10-01');

type SupportedProvider = 'openai' | 'google';

const CONTEXT_LIMITS = {
  id: 200,
  title: 320,
  authors: 280,
  primaryAuthor: 120,
  formattedPublishedDate: 80,
  abstract: 400,
  arxivUrl: 200,
} as const;

const CONTEXT_DETAILS_MAX_LENGTH = 600;

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

interface ProviderConfiguration {
  provider: SupportedProvider;
  apiKey: string;
  model?: string;
  paperContext?: PaperContext | null;
}

class RTManager extends EventEmitter {
  private ws: WebSocket | null = null;
  starting = false;
  sessionId: string;
  private startPromise?: Promise<void>;
  private connectionTimeout?: NodeJS.Timeout;
  private responseInFlight: boolean = false;
  private provider: SupportedProvider = 'openai';
  private apiKey: string | null = SecureEnv.get('OPENAI_API_KEY') || null;
  private model: string = DEFAULT_OPENAI_REALTIME_MODEL;
  private conversationContext: PaperContext | null = null;
  private lastPrimedSummary: string | null = null;

  constructor(sessionId?: string) {
    super();
    this.sessionId = sessionId || 'default';
  }

  configure(config: ProviderConfiguration): boolean {
    let changed = false;
    const normalizedProvider: SupportedProvider =
      config.provider === 'google' ? 'google' : 'openai';

    if (normalizedProvider !== this.provider) {
      this.provider = normalizedProvider;
      changed = true;
    }

    const trimmedKey = (config.apiKey || '').trim();
    const fallbackKey =
      trimmedKey ||
      (normalizedProvider === 'openai' ? SecureEnv.getWithDefault('OPENAI_API_KEY', '') : '');
    const resolvedKey = fallbackKey.trim();

    if (!resolvedKey) {
      if (this.apiKey !== null) {
        this.apiKey = null;
        changed = true;
      }
    } else if (this.apiKey !== resolvedKey) {
      this.apiKey = resolvedKey;
      changed = true;
    }

    const trimmedModel = (config.model || '').trim();
    const resolvedModel = trimmedModel || DEFAULT_OPENAI_REALTIME_MODEL;
    if (resolvedModel !== this.model) {
      this.model = resolvedModel;
      changed = true;
    }

    const normalizedContext = this._normalizeContext(config.paperContext);
    if (!this._contextsEqual(this.conversationContext, normalizedContext)) {
      this.conversationContext = normalizedContext;
      this.lastPrimedSummary = null;
      changed = true;

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this._pushSessionUpdate('context-change');
      }
    }

    return changed;
  }

  getConfiguration() {
    return {
      provider: this.provider,
      hasApiKey: !!this.apiKey,
      model: this.model,
    };
  }

  async start(): Promise<void> {
    log.info(`Starting session`, { sessionId: this.sessionId });
    
    // Fast path – already connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      log.debug(`Session already active`, { sessionId: this.sessionId });
      return;
    }

    // Another request is already bootstrapping the session
    if (this.startPromise) {
      log.debug(`Waiting for existing start promise`, { sessionId: this.sessionId });
      return this.startPromise;
    }

    // First caller – really start it
    this.startPromise = this._doStart();
    return this.startPromise;
  }

  private async _doStart(): Promise<void> {
    this.starting = true;
    log.info(`Beginning session handshake`, { sessionId: this.sessionId });
    
    // Set connection timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      this.connectionTimeout = setTimeout(() => {
        reject(new Error('Session connection timeout after 10 seconds'));
      }, 10000);
    });

    try {
      // Race between connection and timeout
      const sessionPromise = this._establishConnection();
      await Promise.race([sessionPromise, timeoutPromise]);
      
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = undefined;
      }

      this.emit('ready');
      log.info(`Session established successfully`, { sessionId: this.sessionId });
      
    } catch (error) {
      log.error(`Session handshake failed`, { 
        sessionId: this.sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = undefined;
      }
      
      // Clean up failed attempt
      this.startPromise = undefined;
      throw error;
    } finally {
      this.starting = false;
    }
  }

  private async _establishConnection(): Promise<void> {
    const key = (this.apiKey || '').trim();

    if (!key) {
      const providerName = this.provider === 'openai' ? 'OpenAI' : 'Google';
      throw new Error(`${providerName} API key is required to start a realtime session`);
    }

    if (this.provider !== 'openai') {
      throw new Error('Google provider is not supported for realtime audio sessions yet');
    }

    return new Promise((resolve, reject) => {
      log.info(`Creating WebSocket connection`, {
        sessionId: this.sessionId,
        provider: this.provider,
        model: this.model,
        hasApiKey: !!key,
      });

      // First, let's test if we can reach OpenAI API with a simple HTTP request
      fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      }).then(async response => {
        log.info(`OpenAI API test`, {
          sessionId: this.sessionId,
          status: response.status,
          ok: response.ok
        });

        if (!response.ok) {
          let errorMessage = `OpenAI API authentication failed: ${response.status}`;
          
          // Try to get more detailed error information
          try {
            const errorBody = await response.text();
            log.error(`OpenAI API error details`, {
              sessionId: this.sessionId,
              status: response.status,
              body: errorBody
            });
            
            // Parse error response for more helpful messages
            if (response.status === 401) {
              if (errorBody.includes('Invalid API key')) {
                errorMessage = 'Invalid OpenAI API key. Please check your API key in Settings and ensure it starts with "sk-".';
              } else if (errorBody.includes('Incorrect API key')) {
                errorMessage = 'Incorrect OpenAI API key. Please verify your API key in Settings.';
              } else {
                errorMessage = 'OpenAI API key authentication failed. Please check your API key in Settings.';
              }
            } else if (response.status === 429) {
              errorMessage = 'OpenAI API rate limit exceeded. Please try again in a moment.';
            } else if (response.status === 403) {
              errorMessage = 'OpenAI API access forbidden. Please check your account status and billing.';
            }
          } catch (parseError) {
            log.warn(`Failed to parse error response`, {
              sessionId: this.sessionId,
              parseError: parseError instanceof Error ? parseError.message : 'Unknown error'
            });
          }
          
          reject(new Error(errorMessage));
          return;
        }

        // Now try the WebSocket connection
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.model)}`;
        log.info(`Connecting to OpenAI Realtime API`, { sessionId: this.sessionId, url: wsUrl });

        const ws = new WebSocket(wsUrl, {
          headers: {
            'Authorization': `Bearer ${key}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });

        this.ws = ws;
        this._setupWebSocketHandlers(ws, resolve, reject);

      }).catch(error => {
        log.error(`Failed to test OpenAI API connection`, { sessionId: this.sessionId, error: error.message });
        reject(new Error(`Cannot connect to OpenAI API: ${error.message}`));
      });
    });
  }

  private _setupWebSocketHandlers(ws: WebSocket, resolve: () => void, reject: (error: Error) => void) {
    let hasResolved = false;

    ws.on('open', () => {
      log.info(`WebSocket connected to OpenAI Realtime API`, { sessionId: this.sessionId });

      // Send session configuration
      const sessionConfig = this._createSessionUpdatePayload();

      log.info(`Sending session config`, { sessionId: this.sessionId });
      try {
        ws.send(JSON.stringify(sessionConfig));
        log.info(`Session config sent successfully`, { sessionId: this.sessionId });

        this._sendContextPrimingMessage();

        // Don't resolve immediately, wait for session.updated event
        setTimeout(() => {
          if (!hasResolved) {
            log.info(`Session setup completed (timeout fallback)`, { sessionId: this.sessionId });
            hasResolved = true;
            resolve();
          }
        }, 2000);
      } catch (error) {
        log.error(`Failed to send session config`, {
          sessionId: this.sessionId,
          ...buildErrorMeta(error),
        });
        if (!hasResolved) {
          hasResolved = true;
          reject(error instanceof Error ? error : new Error('Failed to send session config'));
        }
      }
    });

    ws.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString()) as RealtimeEvent;
        log.debug(`WebSocket message received`, { sessionId: this.sessionId, type: event.type });
        
        // If we get a session.updated event, the session is ready
        if (event.type === 'session.updated' && !hasResolved) {
          log.info(`Session updated - connection ready`, { sessionId: this.sessionId });
          hasResolved = true;
          resolve();
        }
        
        this._handleEvent(event);
      } catch (error) {
        log.error(`Failed to parse WebSocket message`, {
          sessionId: this.sessionId,
          ...buildErrorMeta(error),
          rawData: data.toString()
        });
      }
    });

    ws.on('error', (error: Error & { code?: number }) => {
      log.error(`WebSocket connection error`, {
        sessionId: this.sessionId,
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      this.emit('error', error);
      if (!hasResolved) {
        hasResolved = true;
        reject(error);
      }
    });

    ws.on('close', (code, reason) => {
      const reasonString = reason.toString();
      log.error(`WebSocket connection closed`, {
        sessionId: this.sessionId,
        code,
        reason: reasonString,
        codeDescription: this._getCloseCodeDescription(code)
      });
      this.ws = null;
      this.lastPrimedSummary = null;
      this.emit('close');

      if (!hasResolved) {
        hasResolved = true;
        reject(new Error(`WebSocket closed before session could be established: ${code} ${reasonString}`));
      }
    });
  }

  private _getCloseCodeDescription(code: number): string {
    switch (code) {
      case 1000: return 'Normal closure';
      case 1001: return 'Going away';
      case 1002: return 'Protocol error';
      case 1003: return 'Unsupported data';
      case 1006: return 'Abnormal closure';
      case 1007: return 'Invalid frame payload data';
      case 1008: return 'Policy violation';
      case 1009: return 'Message too big';
      case 1010: return 'Missing extension';
      case 1011: return 'Internal error';
      case 1012: return 'Service restart';
      case 1013: return 'Try again later';
      case 1014: return 'Bad gateway';
      case 1015: return 'TLS handshake fail';
      default: return `Unknown code: ${code}`;
    }
  }

  private _handleEvent(event: RealtimeEvent) {
    log.debug(`Received event`, { sessionId: this.sessionId, type: event.type });

    switch (event.type) {
      case 'response.audio.delta':
      case 'response.output_audio.delta':
        {
          const payload = event as Record<string, unknown>;
          const deltaValue = asString(payload.delta);
          const audioValue = asString(payload.audio);
          const b64 = deltaValue ?? audioValue;
          if (b64) {
            const audioData = Buffer.from(b64, 'base64');
            log.info(`Audio delta received`, { sessionId: this.sessionId, size: audioData.length });
            this.emit('audio', new Uint8Array(audioData));
          }
        }
        break;

      case 'response.text.delta':
      case 'response.output_text.delta':
        {
          const payload = event as Record<string, unknown>;
          const text = extractText(payload.delta) ?? extractText(payload.text);
          if (text) {
            log.debug(`Text delta received`, { sessionId: this.sessionId, text });
            this.emit('transcript', text);
          }
        }
        break;

      case 'response.audio_transcript.delta':
        {
          const payload = event as Record<string, unknown>;
          const text = extractText(payload.delta) ?? extractText((payload as Record<string, unknown>).transcript);
          log.debug(`Audio transcript delta received`, { sessionId: this.sessionId, text });
          if (text) {
            this.emit('transcript', text);
          }
        }
        break;

      case 'response.created':
        this.responseInFlight = true;
        log.debug(`Response created`, { sessionId: this.sessionId });
        break;

      case 'conversation.item.input_audio_transcription.completed':
        {
          const payload = event as Record<string, unknown>;
          const transcript = extractText(payload.transcript);
          if (transcript) {
            log.info(`User speech transcribed`, { sessionId: this.sessionId, transcript });
            this.emit('user_transcript', transcript);
          }
        }
        // Ensure a response is generated even if server VAD didn't auto-create
        if (!this.responseInFlight) {
          try {
            this._sendEvent({
              type: 'response.create',
              response: { modalities: ['text', 'audio'] }
            });
            this.responseInFlight = true;
            log.debug(`Auto-triggered response after transcription completion`, { sessionId: this.sessionId });
          } catch (error) {
            log.error(`Failed to auto-trigger response`, {
              sessionId: this.sessionId,
              ...buildErrorMeta(error),
            });
          }
        }
        break;

      case 'conversation.item.input_audio_transcription.delta':
        {
          const payload = event as Record<string, unknown>;
          const delta = extractText(payload.delta);
          if (delta) {
            log.debug(`User transcription delta`, { sessionId: this.sessionId, delta });
            this.emit('user_transcript_delta', delta);
          }
        }
        break;

      // Alternate event names (recent API variants)
      case 'input_audio_buffer.transcription.delta':
        {
          const payload = event as Record<string, unknown>;
          const delta = extractText(payload.delta);
          if (delta) {
            log.debug(`User transcription delta (alt)`, { sessionId: this.sessionId, delta });
            this.emit('user_transcript_delta', delta);
          }
        }
        break;
      case 'input_audio_buffer.transcription.completed':
        {
          const payload = event as Record<string, unknown>;
          const transcript = extractText(payload.transcript);
          if (transcript) {
            log.info(`User speech transcribed (alt)`, { sessionId: this.sessionId, transcript });
            this.emit('user_transcript', transcript);
          }
        }
        if (!this.responseInFlight) {
          try {
            this._sendEvent({
              type: 'response.create',
              response: { modalities: ['text', 'audio'] }
            });
            this.responseInFlight = true;
            log.debug(`Auto-triggered response after alt transcription completed`, { sessionId: this.sessionId });
          } catch (error) {
            log.error(`Failed to auto-trigger response (alt)`, {
              sessionId: this.sessionId,
              ...buildErrorMeta(error),
            });
          }
        }
        break;

      case 'input_audio_buffer.speech_stopped':
        // Fallback hook: if speech stopped and no response yet, create one
        if (!this.responseInFlight) {
          try {
            this._sendEvent({
              type: 'response.create',
              response: { modalities: ['text', 'audio'] }
            });
            this.responseInFlight = true;
            log.debug(`Auto-triggered response on speech stop`, { sessionId: this.sessionId });
          } catch (error) {
            log.error(`Failed to trigger response on speech stop`, {
              sessionId: this.sessionId,
              ...buildErrorMeta(error),
            });
          }
        }
        break;

      case 'error':
        log.error(`Realtime API error`, { sessionId: this.sessionId, error: event.error });
        this.emit('error', event.error);
        break;

      case 'session.updated':
        log.debug(`Session updated`, { sessionId: this.sessionId });
        break;

      case 'response.done':
      case 'response.completed':
        log.debug(`Response completed`, { sessionId: this.sessionId });
        this.responseInFlight = false;
        this.emit('assistant_done');
        break;

      default:
        log.debug(`Unhandled event type`, { sessionId: this.sessionId, type: event.type });
        break;
    }
  }

  async stop() {
    log.info(`Stopping session`, { sessionId: this.sessionId });
    
    if (!this.ws) {
      log.debug(`No active session to stop`, { sessionId: this.sessionId });
      return;
    }
    
    try { 
      this.ws.close();
      log.info(`Session stopped successfully`, { sessionId: this.sessionId });
    } catch (error) {
      log.error(`Error closing session`, { 
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    this.ws = null;
    this.startPromise = undefined;
    this.lastPrimedSummary = null;

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = undefined;
    }
  }

  private _sendEvent(event: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Session not ready - WebSocket not connected");
    }

    this.ws.send(JSON.stringify(event));
  }

  private _normalizeContext(context?: PaperContext | null): PaperContext | null {
    if (!context) {
      return null;
    }

    const sanitize = (value?: string, maxLength = 200) => {
      if (typeof value !== 'string') {
        return undefined;
      }
      const normalized = value.replace(/\s+/g, ' ').trim();
      if (!normalized) {
        return undefined;
      }
      return normalized.slice(0, maxLength);
    };

    return {
      id: sanitize(context.id, CONTEXT_LIMITS.id),
      title: sanitize(context.title, CONTEXT_LIMITS.title),
      authors: sanitize(context.authors, CONTEXT_LIMITS.authors),
      primaryAuthor: sanitize(context.primaryAuthor, CONTEXT_LIMITS.primaryAuthor),
      hasAdditionalAuthors: context.hasAdditionalAuthors === true,
      formattedPublishedDate: sanitize(context.formattedPublishedDate, CONTEXT_LIMITS.formattedPublishedDate),
      abstract: sanitize(context.abstract, CONTEXT_LIMITS.abstract),
      arxivUrl: sanitize(context.arxivUrl, CONTEXT_LIMITS.arxivUrl),
    };
  }

  private _contextsEqual(a: PaperContext | null, b: PaperContext | null): boolean {
    if (!a && !b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return (
      a.id === b.id &&
      a.title === b.title &&
      a.authors === b.authors &&
      a.primaryAuthor === b.primaryAuthor &&
      a.hasAdditionalAuthors === b.hasAdditionalAuthors &&
      a.formattedPublishedDate === b.formattedPublishedDate &&
      a.abstract === b.abstract &&
      a.arxivUrl === b.arxivUrl
    );
  }

  private _createSessionUpdatePayload() {
    return {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this._buildInstructions(),
        voice: SecureEnv.getWithDefault('OPENAI_REALTIME_VOICE', 'alloy'),
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800
        },
        tool_choice: 'none',
        temperature: 0.7
      }
    };
  }

  private _buildInstructions(): string {
    const base = [
      'You are Dr. Sarah, an AI scientist appearing as a podcast guest.',
      'Answer conversationally, stay grounded in the provided research, and avoid speculation.',
      'Keep every reply under three concise sentences (≈75 tokens) to limit cost.',
    ];

    const contextDetails = this._formatContextDetails();

    if (!contextDetails) {
      return base.join(' ');
    }

    return `${base.join(' ')} Context: ${contextDetails}`;
  }

  private _formatContextDetails(): string | null {
    if (!this.conversationContext) {
      return null;
    }

    const segments: string[] = [];
    const authorLine = this.conversationContext.primaryAuthor
      ? `${this.conversationContext.primaryAuthor}${this.conversationContext.hasAdditionalAuthors ? ' et al.' : ''}`
      : this.conversationContext.authors;

    if (this.conversationContext.title) {
      segments.push(`Title: ${this.conversationContext.title}`);
    }
    if (authorLine) {
      segments.push(`Authors: ${authorLine}`);
    }
    if (this.conversationContext.formattedPublishedDate) {
      segments.push(`Published: ${this.conversationContext.formattedPublishedDate}`);
    }
    if (this.conversationContext.abstract) {
      segments.push(`Summary: ${this.conversationContext.abstract}`);
    }
    if (this.conversationContext.arxivUrl) {
      segments.push(`URL: ${this.conversationContext.arxivUrl}`);
    }

    if (!segments.length) {
      return null;
    }

    const joined = segments.join('; ');
    if (joined.length <= CONTEXT_DETAILS_MAX_LENGTH) {
      return joined;
    }

    return `${joined.slice(0, CONTEXT_DETAILS_MAX_LENGTH - 1)}…`;
  }

  private _buildContextSummary(): string | null {
    const details = this._formatContextDetails();
    if (!details) {
      return null;
    }

    return `Paper context — ${details}. Keep answers brief and reference the paper when useful.`;
  }

  private _sendContextPrimingMessage() {
    const summary = this._buildContextSummary();
    if (!summary || summary === this.lastPrimedSummary) {
      return;
    }

    try {
      this._sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: summary,
            }
          ]
        }
      });
      log.debug('Sent context priming message', { sessionId: this.sessionId });
      this.lastPrimedSummary = summary;
    } catch (error) {
      log.warn('Failed to send context priming message', {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : 'unknown'
      });
    }
  }

  private _pushSessionUpdate(reason: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const payload = this._createSessionUpdatePayload();
      this.ws.send(JSON.stringify(payload));
      log.info('Pushed session update', { sessionId: this.sessionId, reason });
      this._sendContextPrimingMessage();
    } catch (error) {
      log.warn('Failed to push session update', {
        sessionId: this.sessionId,
        reason,
        error: error instanceof Error ? error.message : 'unknown'
      });
    }
  }

  async sendText(text: string) {
    log.debug(`Sending text`, { sessionId: this.sessionId, textLength: text.length });
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const error = new Error("Session not ready - call start() first");
      log.error(`Send text failed - no session`, { sessionId: this.sessionId });
      throw error;
    }
    
    try {
      // Create a conversation item with the user's text
      const conversationItemEvent = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: text
            }
          ]
        }
      };
      
      this._sendEvent(conversationItemEvent);
      
      // Create a response
      const responseEvent = {
        type: "response.create",
        response: {
          modalities: ["text", "audio"]
        }
      };
      
      this._sendEvent(responseEvent);
      log.debug(`Text sent successfully`, { sessionId: this.sessionId });
    } catch (error) {
      log.error(`Failed to send text`, { 
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async appendPcm16(chunk: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const error = new Error("Session not ready - call start() first");
      log.error(`Append PCM16 failed - no session`, { sessionId: this.sessionId });
      throw error;
    }
    
    try {
      // Convert PCM16 data to base64
      const base64Audio = Buffer.from(chunk).toString('base64');
      
      const event = {
        type: "input_audio_buffer.append",
        audio: base64Audio
      };
      
      this._sendEvent(event);
      log.debug(`PCM16 chunk appended`, { sessionId: this.sessionId, size: chunk.length });
    } catch (error) {
      log.error(`Failed to append PCM16`, { 
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async commitTurn() {
    log.debug(`Committing audio turn`, { sessionId: this.sessionId });
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const error = new Error("Session not ready - call start() first");
      log.error(`Commit turn failed - no session`, { sessionId: this.sessionId });
      throw error;
    }
    
    try {
      // Commit the input audio buffer
      const commitEvent = {
        type: "input_audio_buffer.commit"
      };
      this._sendEvent(commitEvent);
      
      // Create a response
      const responseEvent = {
        type: "response.create",
        response: {
          modalities: ["text", "audio"]
        }
      };
      this._sendEvent(responseEvent);
      
      log.debug(`Audio turn committed successfully`, { sessionId: this.sessionId });
    } catch (error) {
      log.error(`Failed to commit turn`, { 
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  isActive(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  isStarting(): boolean {
    return this.starting;
  }

  getStatus(): 'inactive' | 'starting' | 'active' {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return 'active';
    if (this.starting || this.startPromise) return 'starting';
    return 'inactive';
  }
}

// Multi-user session management
class RTSessionManager {
  private sessions: Map<string, RTManager> = new Map();
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  getSession(sessionId: string): RTManager {
    if (!this.sessions.has(sessionId)) {
      const manager = new RTManager(sessionId);
      this.sessions.set(sessionId, manager);
      
      // Auto-cleanup after 30 minutes of inactivity
      this.resetTimeout(sessionId);
      
      // Clean up when session closes
      manager.once('close', () => {
        this.removeSession(sessionId);
      });
    }
    
    // Reset timeout on access
    this.resetTimeout(sessionId);
    return this.sessions.get(sessionId)!;
  }

  removeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.stop();
      this.sessions.delete(sessionId);
    }
    
    const timeout = this.sessionTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }
  }

  private resetTimeout(sessionId: string) {
    const existingTimeout = this.sessionTimeouts.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeout = setTimeout(() => {
      this.removeSession(sessionId);
    }, 30 * 60 * 1000); // 30 minutes
    
    this.sessionTimeouts.set(sessionId, timeout);
  }

  async cleanup() {
    const promises = Array.from(this.sessions.values()).map(session => session.stop());
    await Promise.all(promises);
    this.sessions.clear();
    
    for (const timeout of this.sessionTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.sessionTimeouts.clear();
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

// Hot-reload safe, versioned singleton with self-heal if shape mismatch
const g = globalThis as typeof globalThis & { [SINGLETON_KEY]?: RTSessionManager };
const SINGLETON_KEY = '__rtSessionManager_v2';

function isValidManager(obj: unknown): obj is RTSessionManager {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'getSession' in obj &&
    typeof (obj as RTSessionManager).getSession === 'function' &&
    'getActiveSessionCount' in obj &&
    typeof (obj as RTSessionManager).getActiveSessionCount === 'function'
  );
}

if (!isValidManager(g[SINGLETON_KEY])) {
  g[SINGLETON_KEY] = new RTSessionManager();
}

export const rtSessionManager = g[SINGLETON_KEY] as RTSessionManager;

// Legacy single-session interface for backward compatibility
export const rt = rtSessionManager.getSession('default');
