// src/lib/realtimeSession.ts
import WebSocket from 'ws';
import { EventEmitter } from "node:events";

export type RTSignals = {
  audio: (data: Uint8Array) => void;
  transcript: (text: string) => void;
  user_transcript: (text: string) => void;
  user_transcript_delta: (text: string) => void;
  close: () => void;
  error: (err: unknown) => void;
  ready: () => void;
};

// Simple logging utility
const log = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta ? JSON.stringify(meta) : ''),
  error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta) : ''),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta ? JSON.stringify(meta) : ''),
  debug: (msg: string, meta?: any) => console.debug(`[DEBUG] ${msg}`, meta ? JSON.stringify(meta) : '')
};

interface RealtimeEvent {
  type: string;
  event_id?: string;
  [key: string]: any;
}

const DEFAULT_OPENAI_REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-10-01';

type SupportedProvider = 'openai' | 'google';

interface ProviderConfiguration {
  provider: SupportedProvider;
  apiKey: string;
  model?: string;
}

class RTManager extends EventEmitter {
  private ws: WebSocket | null = null;
  starting = false;
  sessionId: string;
  private startPromise?: Promise<void>;
  private connectionTimeout?: NodeJS.Timeout;
  private responseInFlight: boolean = false;
  private provider: SupportedProvider = 'openai';
  private apiKey: string | null = process.env.OPENAI_API_KEY || null;
  private model: string = DEFAULT_OPENAI_REALTIME_MODEL;

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
      (normalizedProvider === 'openai' ? process.env.OPENAI_API_KEY || '' : '');
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
      });

      // First, let's test if we can reach OpenAI API with a simple HTTP request
      fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      }).then(response => {
        log.info(`OpenAI API test`, {
          sessionId: this.sessionId,
          status: response.status,
          ok: response.ok
        });

        if (!response.ok) {
          reject(new Error(`OpenAI API authentication failed: ${response.status}`));
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
      const sessionConfig = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: "You are an AI podcast host named Dr. Sarah. Have natural, engaging conversations about research topics. Wait for the human to finish speaking before responding. Keep responses concise and conversational. Ask follow-up questions to encourage discussion.",
            voice: process.env.OPENAI_REALTIME_VOICE || 'alloy',
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
      
      log.info(`Sending session config`, { sessionId: this.sessionId });
      try {
        ws.send(JSON.stringify(sessionConfig));
        log.info(`Session config sent successfully`, { sessionId: this.sessionId });
        
        // Don't resolve immediately, wait for session.updated event
        setTimeout(() => {
          if (!hasResolved) {
            log.info(`Session setup completed (timeout fallback)`, { sessionId: this.sessionId });
            hasResolved = true;
            resolve();
          }
        }, 2000);
      } catch (error) {
        log.error(`Failed to send session config`, { sessionId: this.sessionId, error });
        if (!hasResolved) {
          hasResolved = true;
          reject(error as Error);
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
          error: error instanceof Error ? error.message : 'Unknown error',
          rawData: data.toString()
        });
      }
    });

    ws.on('error', (error) => {
      log.error(`WebSocket connection error`, { 
        sessionId: this.sessionId, 
        error: error.message,
        stack: error.stack,
        code: (error as any).code
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
          const b64 = (event as any).delta || (event as any).audio;
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
          const text = (event as any).delta || (event as any).text;
          if (text) {
            log.debug(`Text delta received`, { sessionId: this.sessionId, text });
            this.emit('transcript', text);
          }
        }
        break;

      case 'response.audio_transcript.delta':
        if ((event as any).delta) {
          const text = (event as any).delta as string;
          log.debug(`Audio transcript delta received`, { sessionId: this.sessionId, text });
          this.emit('transcript', text);
        }
        break;

      case 'response.created':
        this.responseInFlight = true;
        log.debug(`Response created`, { sessionId: this.sessionId });
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          log.info(`User speech transcribed`, { sessionId: this.sessionId, transcript: event.transcript });
          this.emit('user_transcript', event.transcript);
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
          } catch (e) {
            log.error(`Failed to auto-trigger response`, { sessionId: this.sessionId, error: (e as any)?.message });
          }
        }
        break;

      case 'conversation.item.input_audio_transcription.delta':
        if (event.delta) {
          log.debug(`User transcription delta`, { sessionId: this.sessionId, delta: event.delta });
          this.emit('user_transcript_delta', event.delta);
        }
        break;

      // Alternate event names (recent API variants)
      case 'input_audio_buffer.transcription.delta':
        if (event.delta) {
          log.debug(`User transcription delta (alt)`, { sessionId: this.sessionId, delta: event.delta });
          this.emit('user_transcript_delta', event.delta);
        }
        break;
      case 'input_audio_buffer.transcription.completed':
        if (event.transcript) {
          log.info(`User speech transcribed (alt)`, { sessionId: this.sessionId, transcript: event.transcript });
          this.emit('user_transcript', event.transcript);
        }
        if (!this.responseInFlight) {
          try {
            this._sendEvent({
              type: 'response.create',
              response: { modalities: ['text', 'audio'] }
            });
            this.responseInFlight = true;
            log.debug(`Auto-triggered response after alt transcription completed`, { sessionId: this.sessionId });
          } catch (e) {
            log.error(`Failed to auto-trigger response (alt)`, { sessionId: this.sessionId, error: (e as any)?.message });
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
          } catch (e) {
            log.error(`Failed to trigger response on speech stop`, { sessionId: this.sessionId, error: (e as any)?.message });
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
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = undefined;
    }
  }

  private _sendEvent(event: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Session not ready - WebSocket not connected");
    }
    
    this.ws.send(JSON.stringify(event));
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
const g = globalThis as any;
const SINGLETON_KEY = '__rtSessionManager_v2';

function isValidManager(obj: any): obj is RTSessionManager {
  return obj && typeof obj.getSession === 'function' && typeof obj.getActiveSessionCount === 'function';
}

if (!isValidManager(g[SINGLETON_KEY])) {
  g[SINGLETON_KEY] = new RTSessionManager();
}

export const rtSessionManager = g[SINGLETON_KEY] as RTSessionManager;

// Legacy single-session interface for backward compatibility
export const rt = rtSessionManager.getSession('default');
