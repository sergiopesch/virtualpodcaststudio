export const CONVERSATION_STORAGE_KEY = "vps:latestConversation";

export interface StoredPaper {
  id: string;
  title: string;
  authors: string;
  abstract?: string;
  arxiv_url?: string;
  primaryAuthor?: string;
  hasAdditionalAuthors?: boolean;
  formattedPublishedDate?: string;
  storedAt?: number;
}

export interface StoredConversationMessage {
  id: string;
  role: "user" | "expert";
  content: string;
  timestamp: string;
  speaker?: string;
  type: "text" | "audio";
  order?: number;
}

export interface StoredConversationAudioTrack {
  format: "wav";
  sampleRate: number;
  channels: number;
  base64: string;
  durationSeconds: number;
}

export interface StoredConversation {
  version: number;
  createdAt: number;
  paper: StoredPaper;
  transcript: StoredConversationMessage[];
  audio: {
    host: StoredConversationAudioTrack | null;
    ai: StoredConversationAudioTrack | null;
  };
  durationSeconds: number;
}

const isBrowser = typeof window !== "undefined";

const toBase64 = (bytes: Uint8Array): string => {
  if (isBrowser && typeof window.btoa === "function") {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return window.btoa(binary);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  throw new Error("Base64 encoding is not supported in this environment.");
};

const fromBase64 = (base64: string): Uint8Array => {
  const sanitized = base64.replace(/\s+/g, "");

  if (isBrowser && typeof window.atob === "function") {
    const binary = window.atob(sanitized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(sanitized, "base64"));
  }

  throw new Error("Base64 decoding is not supported in this environment.");
};

export function encodePcm16ChunksToWav(
  chunks: Uint8Array[],
  sampleRate: number,
): { base64: string; durationSeconds: number } | null {
  if (!chunks.length) {
    return null;
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (totalLength === 0) {
    return null;
  }

  const pcmBytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    pcmBytes.set(chunk, offset);
    offset += chunk.length;
  }

  const wavBuffer = new ArrayBuffer(44 + pcmBytes.length);
  const view = new DataView(wavBuffer);
  const writeString = (byteOffset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(byteOffset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, pcmBytes.length, true);

  const wavBytes = new Uint8Array(wavBuffer);
  wavBytes.set(pcmBytes, 44);

  const sampleCount = pcmBytes.length / 2;
  return {
    base64: toBase64(wavBytes),
    durationSeconds: sampleCount / sampleRate,
  };
}

export function decodeWavBase64(base64: string) {
  const bytes = fromBase64(base64);
  if (bytes.length < 44) {
    return {
      sampleRate: 24000,
      channels: 1,
      pcm: new Int16Array(),
      durationSeconds: 0,
    };
  }

  const header = new DataView(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 44));
  const channels = header.getUint16(22, true) || 1;
  const sampleRate = header.getUint32(24, true) || 24000;
  const byteRate = header.getUint32(28, true) || sampleRate * channels * 2;
  const declaredDataSize = header.getUint32(40, true);
  const dataStart = 44;
  const available = bytes.byteLength - dataStart;
  const pcmSize = declaredDataSize > 0 ? Math.min(declaredDataSize, available) : available;
  const pcmBytes = bytes.subarray(dataStart, dataStart + pcmSize);
  const sampleCount = pcmBytes.byteLength / 2;
  const pcmView = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, sampleCount);
  const pcmCopy = new Int16Array(sampleCount);
  pcmCopy.set(pcmView);
  const durationSeconds = byteRate > 0 ? pcmBytes.byteLength / byteRate : sampleCount / sampleRate;

  return {
    sampleRate,
    channels,
    pcm: pcmCopy,
    durationSeconds,
  };
}

export function saveConversationToSession(conversation: StoredConversation) {
  if (!isBrowser) {
    return;
  }
  try {
    sessionStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(conversation));
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn("[WARN] Session storage quota exceeded. Attempting to save without audio.");
      try {
        const fallback: StoredConversation = {
          ...conversation,
          audio: { host: null, ai: null },
        };
        sessionStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(fallback));
      } catch (retryError) {
        console.error("[ERROR] Failed to save conversation even without audio", retryError);
      }
    } else {
      console.error("[ERROR] Failed to save conversation to session storage", error);
    }
  }
}

export function loadConversationFromSession(): StoredConversation | null {
  if (!isBrowser) {
    return null;
  }

  const raw = sessionStorage.getItem(CONVERSATION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredConversation;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("Failed to parse stored conversation", error);
    return null;
  }
}

export function clearConversationFromSession() {
  if (!isBrowser) {
    return;
  }
  sessionStorage.removeItem(CONVERSATION_STORAGE_KEY);
}
