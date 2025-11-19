"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSidebar } from "@/contexts/sidebar-context";
import { useApiConfig } from "@/contexts/api-config-context";
import {
  encodePcm16ChunksToWav,
  saveConversationToSession,
  type StoredConversation,
} from "@/lib/conversationStorage";
import {
  Brain,
  Download,
  FileText,
  Headphones,
  Mic,
  MicOff,
  Radio,
  Sparkles,
  Video,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectedPaper {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  arxiv_url?: string;
  primaryAuthor?: string;
  hasAdditionalAuthors?: boolean;
  formattedPublishedDate?: string;
}

type Speaker = "host" | "ai";

type ConnectionPhase = "idle" | "preparing" | "live" | "stopping";

interface TranscriptEntry {
  id: string;
  speaker: Speaker;
  text: string;
  status: "streaming" | "final";
  startedAt: number;
  completedAt?: number;
  updatedAt?: number;
  sequence: number;
}

const nextWordChunk = (text: string): [string, string] => {
  if (!text) {
    return ["", ""];
  }

  const match = text.match(/^[^\s]+\s*/);
  if (match && match[0].length > 0) {
    const chunk = match[0];
    return [chunk, text.slice(chunk.length)];
  }

  return [text.charAt(0), text.slice(1)];
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      if ((value & 1) !== 0) {
        value = 0xedb88320 ^ (value >>> 1);
      } else {
        value >>>= 1;
      }
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0 ^ -1;
  for (let index = 0; index < data.length; index++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[index]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function getDosDateTime(date: Date) {
  let year = date.getFullYear();
  if (year < 1980) {
    year = 1980;
  }
  const dosTime = ((date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)) & 0xffff;
  const dosDate = (((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { time: dosTime, date: dosDate };
}

function createZipArchive(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();

  let totalLocalSize = 0;
  let totalCentralSize = 0;

  const entries = files.map((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);
    const size = data.length;
    const { time, date } = getDosDateTime(new Date());

    totalLocalSize += 30 + nameBytes.length + size;
    totalCentralSize += 46 + nameBytes.length;

    return { nameBytes, data, crc, size, time, date };
  });

  const archive = new Uint8Array(totalLocalSize + totalCentralSize + 22);
  const view = new DataView(archive.buffer);
  let offset = 0;

  const centralEntries: Array<{
    nameBytes: Uint8Array;
    crc: number;
    size: number;
    time: number;
    date: number;
    offset: number;
  }> = [];

  for (const entry of entries) {
    const localHeaderOffset = offset;

    view.setUint32(offset, 0x04034b50, true); offset += 4;
    view.setUint16(offset, 20, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, entry.time, true); offset += 2;
    view.setUint16(offset, entry.date, true); offset += 2;
    view.setUint32(offset, entry.crc >>> 0, true); offset += 4;
    view.setUint32(offset, entry.size >>> 0, true); offset += 4;
    view.setUint32(offset, entry.size >>> 0, true); offset += 4;
    view.setUint16(offset, entry.nameBytes.length, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;

    archive.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;
    archive.set(entry.data, offset);
    offset += entry.size;

    centralEntries.push({
      nameBytes: entry.nameBytes,
      crc: entry.crc,
      size: entry.size,
      time: entry.time,
      date: entry.date,
      offset: localHeaderOffset,
    });
  }

  const centralDirectoryOffset = offset;

  for (const entry of centralEntries) {
    view.setUint32(offset, 0x02014b50, true); offset += 4;
    view.setUint16(offset, 20, true); offset += 2;
    view.setUint16(offset, 20, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, entry.time, true); offset += 2;
    view.setUint16(offset, entry.date, true); offset += 2;
    view.setUint32(offset, entry.crc >>> 0, true); offset += 4;
    view.setUint32(offset, entry.size >>> 0, true); offset += 4;
    view.setUint32(offset, entry.size >>> 0, true); offset += 4;
    view.setUint16(offset, entry.nameBytes.length, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint32(offset, 0, true); offset += 4;
    view.setUint32(offset, entry.offset >>> 0, true); offset += 4;

    archive.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;
  }

  const centralDirectorySize = offset - centralDirectoryOffset;

  view.setUint32(offset, 0x06054b50, true); offset += 4;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, centralEntries.length, true); offset += 2;
  view.setUint16(offset, centralEntries.length, true); offset += 2;
  view.setUint32(offset, centralDirectorySize >>> 0, true); offset += 4;
  view.setUint32(offset, centralDirectoryOffset >>> 0, true); offset += 4;
  view.setUint16(offset, 0, true); offset += 2;

  return archive;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const StudioPage: React.FC = () => {
  const { collapsed, toggleCollapsed } = useSidebar();
  const { activeProvider, apiKeys, defaultModels, models, supportsRealtime } = useApiConfig();
  const activeApiKey = (apiKeys[activeProvider] ?? "").trim();
  const activeModel = (models?.[activeProvider] ?? defaultModels[activeProvider]).trim();
  const router = useRouter();

  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [phase, setPhase] = useState<ConnectionPhase>("idle");
  const phaseRef = useRef<ConnectionPhase>("idle");
  const isSessionActiveRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [currentPaper, setCurrentPaper] = useState<SelectedPaper | null>(null);
  const [paperLoadError, setPaperLoadError] = useState<string | null>(null);
  const [hasCapturedAudio, setHasCapturedAudio] = useState(false);
  const [isHostSpeaking, setIsHostSpeaking] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<{ stop: () => void } | null>(null);
  const micChunkQueueRef = useRef<Uint8Array[]>([]);
  const micFlushIntervalRef = useRef<number | null>(null);
  const isUploadingRef = useRef(false);
  const isCommittingRef = useRef(false);
  const aiAudioChunksRef = useRef<Uint8Array[]>([]);
  const hostAudioChunksRef = useRef<Uint8Array[]>([]);
  const MAX_AUDIO_CHUNKS = 10000; // Limit to prevent memory exhaustion (~240MB at 24kHz)
  const audioEventSourceRef = useRef<EventSource | null>(null);
  const aiTranscriptEventSourceRef = useRef<EventSource | null>(null);
  const userTranscriptEventSourceRef = useRef<EventSource | null>(null);
  const hasAiTranscriptSseRef = useRef(false);
  const hasUserTranscriptSseRef = useRef(false);
  const hasCapturedAudioRef = useRef(false);
  const latestConversationRef = useRef<StoredConversation | null>(null);
  const aiPlaybackTimeRef = useRef(0);
  const aiPlaybackSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const localVadSpeakingRef = useRef(false);
  const lastVoiceActivityAtRef = useRef<number | null>(null);
  const VAD_THRESHOLD = 0.02; // simple RMS proxy threshold for voice activity
  const VAD_SILENCE_MS = 900; // commit after ~0.9s of silence

  const entrySequenceRef = useRef(0);
  const hostActiveIdRef = useRef<string | null>(null);
  const aiActiveIdRef = useRef<string | null>(null);
  const hostPendingRef = useRef("");
  const aiPendingRef = useRef("");
  const hostTypingIntervalRef = useRef<number | null>(null);
  const aiTypingIntervalRef = useRef<number | null>(null);

  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const loadSelectedPaper = () => {
      const stored = sessionStorage.getItem("vps:selectedPaper");

      if (!stored) {
        setCurrentPaper(null);
        setPaperLoadError(null);
        return;
      }

      try {
        const parsed = JSON.parse(stored) as SelectedPaper | null;
        if (!parsed || typeof parsed !== "object" || !("id" in parsed) || !parsed.id) {
          throw new Error("Invalid stored paper payload");
        }
        setCurrentPaper(parsed);
        setPaperLoadError(null);
      } catch (err) {
        console.error("Failed to load stored paper:", err);
        setCurrentPaper(null);
        setPaperLoadError(
          "We couldn't load the selected paper. Return to the Research Hub to pick a paper before recording.",
        );
      }
    };

    loadSelectedPaper();

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea === sessionStorage && event.key === "vps:selectedPaper") {
        loadSelectedPaper();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    let interval: number | undefined;
    if (phase === "live") {
      interval = window.setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [phase]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const scrollToLatest = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      const root = transcriptScrollRef.current;
      if (!root) {
        return;
      }
      const viewport = root.querySelector<HTMLDivElement>('[data-slot="scroll-area-viewport"]');
      if (viewport) {
        const scrollOptions: ScrollToOptions = {
          top: viewport.scrollHeight,
          behavior: "smooth",
        };
        if (typeof viewport.scrollTo === "function") {
          viewport.scrollTo(scrollOptions);
        } else {
          viewport.scrollTop = viewport.scrollHeight;
        }
        return;
      }
      root.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, []);

  useEffect(() => {
    scrollToLatest();
  }, [entries, isHostSpeaking, isAiSpeaking, scrollToLatest]);

  const startSegment = useCallback((speaker: Speaker) => {
    const id = `${speaker}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const startedAt = Date.now();
    const entry: TranscriptEntry = {
      id,
      speaker,
      text: "",
      status: "streaming",
      startedAt,
      updatedAt: startedAt,
      sequence: entrySequenceRef.current++,
    };
    setEntries((prev) => {
      const next = [...prev, entry];
      next.sort((a, b) => a.sequence - b.sequence);
      return next;
    });
    if (speaker === "host") {
      hostActiveIdRef.current = id;
    } else {
      aiActiveIdRef.current = id;
    }
    return id;
  }, []);

  const ensureSegment = useCallback((speaker: Speaker) => {
    if (speaker === "host") {
      if (!hostActiveIdRef.current) {
        const id = startSegment("host");
        setIsHostSpeaking(true);
        return id;
      }
      setIsHostSpeaking(true);
      return hostActiveIdRef.current;
    }
    if (!aiActiveIdRef.current) {
      const id = startSegment("ai");
      setIsAiSpeaking(true);
      return id;
    }
    setIsAiSpeaking(true);
    return aiActiveIdRef.current;
  }, [startSegment]);

  const updateEntryText = useCallback((id: string, updater: (value: string) => string) => {
    const updatedAt = Date.now();
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
            ...entry,
            text: updater(entry.text),
            updatedAt,
          }
          : entry,
      ),
    );
  }, []);

  const markEntryFinal = useCallback((id: string) => {
    const completedAt = Date.now();
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
            ...entry,
            status: "final",
            completedAt,
          }
          : entry,
      ),
    );
  }, []);

  const drainPending = useCallback(
    (speaker: Speaker, flushAll: boolean) => {
      const pendingRef = speaker === "host" ? hostPendingRef : aiPendingRef;
      const pending = pendingRef.current;
      if (!pending) {
        return;
      }

      let activeId: string | null;
      if (speaker === "host") {
        activeId = hostActiveIdRef.current;
        if (!activeId) {
          activeId = ensureSegment("host");
        }
      } else {
        activeId = aiActiveIdRef.current;
        if (!activeId) {
          activeId = ensureSegment("ai");
        }
      }

      if (!activeId) {
        return;
      }

      if (flushAll) {
        const chunk = pending;
        pendingRef.current = "";
        updateEntryText(activeId, (value) => value + chunk);
        return;
      }

      const [chunk, rest] = nextWordChunk(pending);
      if (!chunk) {
        pendingRef.current = rest;
        return;
      }

      pendingRef.current = rest;
      updateEntryText(activeId, (value) => value + chunk);
    },
    [ensureSegment, updateEntryText],
  );

  const stopTypingInterval = useCallback((speaker: Speaker) => {
    const ref = speaker === "host" ? hostTypingIntervalRef : aiTypingIntervalRef;
    if (ref.current != null) {
      window.clearInterval(ref.current);
      ref.current = null;
    }
  }, []);

  const ensureTypingInterval = useCallback(
    (speaker: Speaker) => {
      const ref = speaker === "host" ? hostTypingIntervalRef : aiTypingIntervalRef;
      if (ref.current != null) {
        return;
      }
      const tick = speaker === "host" ? 36 : 28;
      ref.current = window.setInterval(() => {
        drainPending(speaker, false);
      }, tick);
    },
    [drainPending],
  );

  const appendToSegment = useCallback(
    (speaker: Speaker, delta: string) => {
      if (!delta) {
        return;
      }
      console.log(`[DEBUG] Appending to ${speaker} segment:`, delta.substring(0, 30));
      ensureSegment(speaker);
      const pendingRef = speaker === "host" ? hostPendingRef : aiPendingRef;
      pendingRef.current += delta;
      ensureTypingInterval(speaker);
      drainPending(speaker, false);
    },
    [drainPending, ensureSegment, ensureTypingInterval],
  );

  const finalizeSegment = useCallback(
    (speaker: Speaker, finalText?: string) => {
      const pendingRef = speaker === "host" ? hostPendingRef : aiPendingRef;
      const activeRef = speaker === "host" ? hostActiveIdRef : aiActiveIdRef;

      if (!activeRef.current && !pendingRef.current && finalText == null) {
        if (speaker === "host") {
          setIsHostSpeaking(false);
        } else {
          setIsAiSpeaking(false);
        }
        return;
      }

      if (!activeRef.current) {
        ensureSegment(speaker);
      }

      const activeId = activeRef.current;
      if (!activeId) {
        pendingRef.current = "";
        return;
      }

      if (pendingRef.current) {
        const chunk = pendingRef.current;
        pendingRef.current = "";
        updateEntryText(activeId, (value) => value + chunk);
      }

      if (typeof finalText === "string") {
        updateEntryText(activeId, () => finalText);
      }

      markEntryFinal(activeId);
      activeRef.current = null;
      pendingRef.current = "";
      stopTypingInterval(speaker);

      if (speaker === "host") {
        setIsHostSpeaking(false);
      } else {
        setIsAiSpeaking(false);
      }
    },
    [ensureSegment, markEntryFinal, stopTypingInterval, updateEntryText],
  );

  const resetConversation = useCallback(() => {
    hostActiveIdRef.current = null;
    aiActiveIdRef.current = null;
    hostPendingRef.current = "";
    aiPendingRef.current = "";
    stopTypingInterval("host");
    stopTypingInterval("ai");
    setIsHostSpeaking(false);
    setIsAiSpeaking(false);
    setEntries([]);
    entrySequenceRef.current = 0;
  }, [stopTypingInterval]);

  const base64ToUint8Array = useCallback((base64: string): Uint8Array => {
    const sanitized = (base64 || "").replace(/\s+/g, "");

    if (typeof window !== "undefined" && typeof window.atob === "function") {
      const binary = window.atob(sanitized);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    }

    if (typeof Buffer !== "undefined") {
      return Uint8Array.from(Buffer.from(sanitized, "base64"));
    }

    throw new Error("Base64 decoding is not supported in this environment.");
  }, []);

  const uint8ArrayToBase64 = useCallback((bytes: Uint8Array): string => {
    if (typeof window !== "undefined" && typeof window.btoa === "function") {
      let binary = "";
      for (let index = 0; index < bytes.length; index++) {
        binary += String.fromCharCode(bytes[index]);
      }
      return window.btoa(binary);
    }

    if (typeof Buffer !== "undefined") {
      return Buffer.from(bytes).toString("base64");
    }

    throw new Error("Base64 encoding is not supported in this environment.");
  }, []);

  const playAiAudioChunk = useCallback(
    async (chunk: Uint8Array) => {
      if (chunk.length === 0) {
        return;
      }

      if (typeof window === "undefined") {
        return;
      }

      let context = audioContextRef.current;
      if (!context) {
        const AudioContextConstructor =
          window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) {
          console.warn("[WARN] Web Audio API not available for AI playback");
          return;
        }
        context = new AudioContextConstructor({ sampleRate: 24000 });
        audioContextRef.current = context;
        console.log("[INFO] Audio context created for AI playback");
      }

      if (context.state === "suspended") {
        console.log("[INFO] Resuming suspended audio context");
        await context.resume().catch(() => undefined);
      }

      const frameCount = Math.floor(chunk.length / 2);
      if (frameCount <= 0) {
        return;
      }

      const audioBuffer = context.createBuffer(1, frameCount, 24000);
      const channel = audioBuffer.getChannelData(0);
      const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      for (let index = 0; index < frameCount; index++) {
        channel[index] = view.getInt16(index * 2, true) / 32767;
      }

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);

      const startAt = Math.max(context.currentTime, aiPlaybackTimeRef.current);
      source.start(startAt);
      aiPlaybackSourcesRef.current.push(source);
      aiPlaybackTimeRef.current = startAt + audioBuffer.duration;
      setIsAudioPlaying(true);
      console.log("[DEBUG] Playing AI audio chunk, duration:", audioBuffer.duration.toFixed(3), "s");

      source.onended = () => {
        aiPlaybackSourcesRef.current = aiPlaybackSourcesRef.current.filter((node) => node !== source);
        if (aiPlaybackSourcesRef.current.length === 0) {
          const remaining = aiPlaybackTimeRef.current - context!.currentTime;
          if (remaining <= 0.05) {
            setIsAudioPlaying(false);
            aiPlaybackTimeRef.current = context!.currentTime;
          }
        }
      };
    },
    [setIsAudioPlaying],
  );


  const ensureRealtimeSession = useCallback(async () => {
    if (!supportsRealtime(activeProvider)) {
      throw new Error(
        "Realtime studio is not supported for the selected provider. Choose a provider with realtime capabilities in Settings.",
      );
    }

    console.log("[INFO] Starting realtime session with config", {
      sessionId,
      provider: activeProvider,
      model: activeModel,
      hasPaper: !!currentPaper,
      paperTitle: currentPaper?.title
    });

    const payload = {
      sessionId,
      provider: activeProvider,
      apiKey: activeApiKey || undefined,
      model: activeModel || undefined,
      paper: currentPaper,
    };

    const response = await fetch("/api/rt/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = "Failed to start realtime session.";
      let code: string | undefined;
      try {
        const data = (await response.json()) as { error?: string; code?: string };
        if (typeof data.error === "string" && data.error.trim()) {
          message = data.error.trim();
        }
        if (typeof data.code === "string" && data.code.trim()) {
          code = data.code.trim();
        }
      } catch {
        message = await response.text();
      }
      console.error("[ERROR] Failed to start realtime session", { message, code, status: response.status });
      const error = new Error(message || "Failed to start realtime session.");
      if (code) {
        (error as { code?: string }).code = code;
      }
      throw error;
    }

    const result = await response.json().catch(() => ({}));
    console.log("[INFO] Realtime session started successfully", result);
    isSessionActiveRef.current = true;
    return result;
  }, [activeApiKey, activeModel, activeProvider, currentPaper, sessionId, supportsRealtime]);

  const commitAudioTurn = useCallback(async () => {
    if (isCommittingRef.current) {
      console.log("[DEBUG] Skipping commit - already committing");
      return;
    }

    console.log("[INFO] Committing audio turn", {
      sessionId,
      micChunksQueued: micChunkQueueRef.current.length,
      hostAudioChunks: hostAudioChunksRef.current.length
    });
    isCommittingRef.current = true;
    try {
      const response = await fetch("/api/rt/audio-commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const message = await response.text();
        console.error("[ERROR] Commit failed with status", response.status, message);
        throw new Error(message || "Failed to commit audio turn");
      }
      const result = await response.json();
      console.log("[INFO] Audio turn committed successfully", result);
    } catch (err) {
      console.error("[ERROR] Commit turn failed", err);
    } finally {
      isCommittingRef.current = false;
    }
  }, [sessionId]);

  const uploadMicChunks = useCallback(async () => {
    if (micChunkQueueRef.current.length === 0 || isUploadingRef.current || !isSessionActiveRef.current) {
      return;
    }

    const chunks = micChunkQueueRef.current.splice(0, micChunkQueueRef.current.length);
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    isUploadingRef.current = true;
    try {
      const response = await fetch("/api/rt/audio-append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ sessionId, base64: uint8ArrayToBase64(merged) }),
      });

      if (!response.ok) {
        const data = await response.json().catch(async () => ({ error: await response.text() }));
        const message = typeof data.error === "string" && data.error.trim() ? data.error : "Failed to upload audio";

        if (message.includes("Session not ready")) {
          console.warn("[WARN] Session not ready for audio upload, dropping chunk.");
          return;
        }

        throw new Error(message);
      }
    } catch (error) {
      console.error("[ERROR] Failed to upload audio chunk", error);
    } finally {
      isUploadingRef.current = false;
    }
  }, [sessionId, uint8ArrayToBase64]);

  const stopMicrophonePipeline = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (micFlushIntervalRef.current != null) {
      window.clearInterval(micFlushIntervalRef.current);
      micFlushIntervalRef.current = null;
    }
    void uploadMicChunks();
    micChunkQueueRef.current = [];
    isUploadingRef.current = false;
    setIsRecording(false);
  }, [uploadMicChunks]);

  const startMicrophonePipeline = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      if (!audioContextRef.current) {
        const AudioContextConstructor =
          window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) {
          throw new Error("Web Audio API is not supported in this browser.");
        }
        audioContextRef.current = new AudioContextConstructor({ sampleRate: 24000 });
      }

      const audioContext = audioContextRef.current;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const scriptProcessor = audioContext.createScriptProcessor(1024, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      // Capture mic locally for saving the conversation (no uploads)
      scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        // Track simple voice activity using peak magnitude
        let maxAbs = 0;
        for (let i = 0; i < inputData.length; i++) {
          const abs = Math.abs(inputData[i]);
          if (abs > maxAbs) maxAbs = abs;
        }
        if (maxAbs > VAD_THRESHOLD) {
          localVadSpeakingRef.current = true;
          lastVoiceActivityAtRef.current = Date.now();
          setIsHostSpeaking(true);
          // Ensure we have a segment ready while speaking
          try {
            ensureSegment("host");
          } catch { }
        }
        const pcm16Buffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcm16Buffer[i] = Math.round(sample * 32767);
        }
        const uint8Array = new Uint8Array(pcm16Buffer.buffer);
        micChunkQueueRef.current.push(new Uint8Array(uint8Array));

        // Prevent memory exhaustion by limiting chunk storage
        if (hostAudioChunksRef.current.length < MAX_AUDIO_CHUNKS) {
          hostAudioChunksRef.current.push(new Uint8Array(uint8Array));
        } else {
          console.warn("[WARN] Maximum audio chunk limit reached. Oldest chunks will be dropped.");
        }

        if (!hasCapturedAudioRef.current) {
          hasCapturedAudioRef.current = true;
          setHasCapturedAudio(true);
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      const processor = {
        stop: () => {
          try {
            source.disconnect();
          } catch { }
          try {
            scriptProcessor.disconnect();
          } catch { }
          try {
            silentGain.disconnect();
          } catch { }
          stream.getTracks().forEach((track) => track.stop());
          if (micFlushIntervalRef.current != null) {
            window.clearInterval(micFlushIntervalRef.current);
            micFlushIntervalRef.current = null;
          }
          void uploadMicChunks();
        },
      };

      mediaRecorderRef.current = processor;
      console.log("[INFO] Microphone pipeline started, beginning audio capture");
      micFlushIntervalRef.current = window.setInterval(() => {
        void (async () => {
          await uploadMicChunks();
          // Fallback commit if server-side VAD events don't arrive
          const now = Date.now();
          if (
            localVadSpeakingRef.current &&
            hasCapturedAudioRef.current &&
            lastVoiceActivityAtRef.current != null &&
            now - lastVoiceActivityAtRef.current > VAD_SILENCE_MS &&
            !isCommittingRef.current
          ) {
            try {
              localVadSpeakingRef.current = false;
              setIsHostSpeaking(false);
              await uploadMicChunks();
              await commitAudioTurn();
            } catch (e) {
              console.error("[ERROR] Fallback commit failed", e);
            }
          }
        })();
      }, 200);
      setIsRecording(true);
      return true;
    } catch (error) {
      console.error("[ERROR] Failed to access microphone:", error);
      setStatusMessage(null);
      setError("Failed to access microphone. Please check permissions.");
      return false;
    }
  }, [uploadMicChunks, ensureSegment, commitAudioTurn]);

  const teardownRealtime = useCallback(async () => {
    stopMicrophonePipeline();

    if (audioEventSourceRef.current) {
      audioEventSourceRef.current.close();
      audioEventSourceRef.current = null;
    }
    if (userTranscriptEventSourceRef.current) {
      userTranscriptEventSourceRef.current.close();
      userTranscriptEventSourceRef.current = null;
    }
    if (aiTranscriptEventSourceRef.current) {
      aiTranscriptEventSourceRef.current.close();
      aiTranscriptEventSourceRef.current = null;
    }
    hasUserTranscriptSseRef.current = false;
    hasAiTranscriptSseRef.current = false;
    setIsAiSpeaking(false);
    setIsHostSpeaking(false);

    aiPlaybackSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch { }
    });
    aiPlaybackSourcesRef.current = [];
    aiPlaybackTimeRef.current = 0;
    setIsAudioPlaying(false);

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }

    micChunkQueueRef.current = [];
    hostAudioChunksRef.current = [];
    aiAudioChunksRef.current = [];
    isUploadingRef.current = false;
    hasCapturedAudioRef.current = false;
    isSessionActiveRef.current = false;
    try {
      await fetch("/api/rt/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      console.debug("[DEBUG] Failed to notify realtime stop", error);
    }
  }, [sessionId, stopMicrophonePipeline]);

  const buildConversationPayload = useCallback((): StoredConversation | null => {
    if (!currentPaper || entries.length === 0) {
      return null;
    }

    const sampleRate = Math.round(audioContextRef.current?.sampleRate ?? 24000);
    const hostAudio = encodePcm16ChunksToWav(hostAudioChunksRef.current, sampleRate);
    const aiAudio = encodePcm16ChunksToWav(aiAudioChunksRef.current, 24000);

    const orderedEntries = [...entries].sort((a, b) => a.sequence - b.sequence);

    const transcript = orderedEntries.map((entry, index) => ({
      id: entry.id,
      role: entry.speaker === "host" ? "user" as const : "expert" as const,
      content: entry.text.trim(),
      timestamp: new Date(entry.startedAt).toISOString(),
      speaker: entry.speaker === "host" ? "Host (You)" : "Dr. Sarah (AI Expert)",
      type: "text" as const,
      order: index,
    }));

    const first = orderedEntries[0];
    const last = orderedEntries[orderedEntries.length - 1];
    const timelineDuration = first && last
      ? Math.max(0, Math.round(((last.completedAt ?? last.updatedAt ?? last.startedAt) - first.startedAt) / 1000))
      : 0;

    const durationSeconds = Math.max(
      hostAudio?.durationSeconds ?? 0,
      aiAudio?.durationSeconds ?? 0,
      sessionDuration,
      timelineDuration,
    );

    return {
      version: 1,
      createdAt: Date.now(),
      paper: { ...currentPaper },
      transcript,
      audio: {
        host: hostAudio
          ? {
            format: "wav",
            sampleRate,
            channels: 1,
            base64: hostAudio.base64,
            durationSeconds: hostAudio.durationSeconds,
          }
          : null,
        ai: aiAudio
          ? {
            format: "wav",
            sampleRate: 24000,
            channels: 1,
            base64: aiAudio.base64,
            durationSeconds: aiAudio.durationSeconds,
          }
          : null,
      },
      durationSeconds,
    };
  }, [currentPaper, entries, sessionDuration]);

  useEffect(() => {
    if (phase === "live") {
      void ensureRealtimeSession();
    }
  }, [ensureRealtimeSession, phase]);

  const handleUserTranscriptionDelta = useCallback(
    (delta: string) => {
      appendToSegment("host", delta);
    },
    [appendToSegment],
  );

  const handleUserTranscriptionComplete = useCallback(
    (transcript: string) => {
      finalizeSegment("host", transcript);
    },
    [finalizeSegment],
  );

  const handleAiTranscriptDelta = useCallback(
    (delta: string) => {
      appendToSegment("ai", delta);
    },
    [appendToSegment],
  );

  const attachRealtimeStreams = useCallback(() => {
    const params = new URLSearchParams({ sessionId });

    if (aiTranscriptEventSourceRef.current) {
      aiTranscriptEventSourceRef.current.close();
      aiTranscriptEventSourceRef.current = null;
    }
    if (userTranscriptEventSourceRef.current) {
      userTranscriptEventSourceRef.current.close();
      userTranscriptEventSourceRef.current = null;
    }
    if (audioEventSourceRef.current) {
      audioEventSourceRef.current.close();
      audioEventSourceRef.current = null;
    }

    const transcriptSource = new EventSource(`/api/rt/transcripts?${params.toString()}`);
    console.log("[INFO] AI transcript EventSource created, waiting for events...");

    transcriptSource.onopen = () => {
      console.log("[INFO] AI transcript stream connected successfully");
    };

    transcriptSource.onmessage = (event) => {
      const text = event.data ?? "";
      if (text) {
        // console.log("[DEBUG] AI transcript delta received:", text.substring(0, 50));
        handleAiTranscriptDelta(text);
      }
    };
    transcriptSource.addEventListener("done", () => {
      console.log("[INFO] AI response complete - finalizing segment");
      finalizeSegment("ai");
      setIsAiSpeaking(false);
    });
    transcriptSource.onerror = (error) => {
      // Only log errors if the stream is in a failed state
      if (transcriptSource.readyState === EventSource.CLOSED) {
        console.error("[ERROR] AI transcript stream closed unexpectedly", error);
      } else if (transcriptSource.readyState === EventSource.CONNECTING) {
        console.log("[INFO] AI transcript stream reconnecting...");
      }
    };
    aiTranscriptEventSourceRef.current = transcriptSource;
    hasAiTranscriptSseRef.current = true;

    const userSource = new EventSource(`/api/rt/user-transcripts?${params.toString()}`);
    console.log("[INFO] User transcript EventSource created, waiting for events...");

    userSource.onopen = () => {
      console.log("[INFO] User transcript stream connected successfully");
    };

    userSource.addEventListener("delta", (event) => {
      const text = (event as MessageEvent).data ?? "";
      if (text) {
        // console.log("[DEBUG] User transcript delta received:", text.substring(0, 50));
        handleUserTranscriptionDelta(text);
      }
    });
    userSource.addEventListener("complete", (event) => {
      const text = (event as MessageEvent).data ?? "";
      console.log("[INFO] User transcript complete:", text);
      handleUserTranscriptionComplete(text);
    });
    userSource.addEventListener("speech-started", () => {
      console.log("[INFO] User speech started - creating transcript segment");
      setIsHostSpeaking(true);
      // Ensure a segment is ready when user starts speaking
      ensureSegment("host");
    });
    userSource.addEventListener("speech-stopped", () => {
      console.log("[INFO] Speech stopped detected - uploading chunks and committing turn");
      setIsHostSpeaking(false);
      void (async () => {
        await uploadMicChunks();
        await commitAudioTurn();
      })();
    });
    userSource.onerror = (error) => {
      // Only log errors if the stream is in a failed state
      if (userSource.readyState === EventSource.CLOSED) {
        console.error("[ERROR] User transcript stream closed unexpectedly", error);
      } else if (userSource.readyState === EventSource.CONNECTING) {
        console.log("[INFO] User transcript stream reconnecting...");
      }
    };
    userTranscriptEventSourceRef.current = userSource;
    hasUserTranscriptSseRef.current = true;

    const audioSource = new EventSource(`/api/rt/audio?${params.toString()}`);
    console.log("[INFO] AI audio EventSource created, waiting for events...");

    audioSource.onopen = () => {
      console.log("[INFO] AI audio stream connected successfully");
    };

    audioSource.onmessage = (event) => {
      const base64 = event.data ?? "";
      if (!base64) {
        return;
      }
      try {
        console.log("[DEBUG] AI audio chunk received, size:", base64.length);
        const bytes = base64ToUint8Array(base64);

        // Prevent memory exhaustion by limiting AI audio chunk storage
        if (aiAudioChunksRef.current.length < MAX_AUDIO_CHUNKS) {
          aiAudioChunksRef.current.push(bytes);
        } else {
          console.warn("[WARN] Maximum AI audio chunk limit reached. Oldest chunks will be dropped.");
        }

        void playAiAudioChunk(bytes);
        setIsAiSpeaking(true);
      } catch (error) {
        console.error("[ERROR] Failed to process AI audio chunk", error);
      }
    };
    audioSource.onerror = (error) => {
      // Only log errors if the stream is in a failed state
      if (audioSource.readyState === EventSource.CLOSED) {
        console.error("[ERROR] AI audio stream closed unexpectedly", error);
      } else if (audioSource.readyState === EventSource.CONNECTING) {
        console.log("[INFO] AI audio stream reconnecting...");
      }
    };
    audioEventSourceRef.current = audioSource;
  }, [
    base64ToUint8Array,
    commitAudioTurn,
    ensureSegment,
    finalizeSegment,
    handleAiTranscriptDelta,
    handleUserTranscriptionComplete,
    handleUserTranscriptionDelta,
    playAiAudioChunk,
    sessionId,
    uploadMicChunks,
  ]);


  const startSession = useCallback(async () => {
    if (phase === "preparing" || phase === "live") {
      return;
    }

    resetConversation();
    setPhase("preparing");
    setStatusMessage("Preparing realtime session...");
    setError(null);
    setSessionDuration(0);
    hostAudioChunksRef.current = [];
    aiAudioChunksRef.current = [];
    latestConversationRef.current = null;
    hasCapturedAudioRef.current = false;
    setHasCapturedAudio(false);
    setIsAudioPlaying(false);

    try {
      console.log("[INFO] Starting session...");
      await ensureRealtimeSession();
      console.log("[INFO] Session started successfully");

      // Brief delay to ensure backend WebSocket is fully established
      await new Promise(resolve => setTimeout(resolve, 300));

      console.log("[INFO] Attaching realtime streams...");
      attachRealtimeStreams();
      console.log("[INFO] Streams attached");

      console.log("[INFO] Starting microphone pipeline...");
      const micStarted = await startMicrophonePipeline();
      if (!micStarted) {
        throw new Error("Microphone access required to record the conversation.");
      }
      console.log("[INFO] Microphone started");

      setPhase("live");
      setStatusMessage("Live recording started.");
      console.log("[INFO] Session is now LIVE");
    } catch (err) {
      console.error("[ERROR] Connection failed:", err);
      setStatusMessage(null);

      const errorCode =
        err && typeof err === "object" && "code" in err && typeof (err as { code?: string }).code === "string"
          ? (err as { code?: string }).code
          : undefined;

      let friendlyMessage = err instanceof Error ? err.message : "Failed to connect to AI";

      switch (errorCode) {
        case "MISSING_API_KEY":
          friendlyMessage = "Add an OpenAI API key in Settings before starting a live session.";
          break;
        case "INVALID_API_KEY":
          friendlyMessage = "The OpenAI API key looks invalid. Double-check the value in Settings and try again.";
          break;
        case "UNSUPPORTED_PROVIDER":
          friendlyMessage = "Realtime studio is unavailable for the selected provider. Choose a provider with realtime capabilities in Settings.";
          break;
        case "RATE_LIMITED":
          friendlyMessage = "OpenAI is rate limiting requests right now. Please wait a few moments and try again.";
          break;
        case "FORBIDDEN":
          friendlyMessage = "OpenAI denied access to the realtime API. Verify your account has billing enabled.";
          break;
        case "NETWORK_ERROR":
          friendlyMessage = "Unable to reach OpenAI. Check your network connection and try again.";
          break;
        case "INVALID_REQUEST":
          friendlyMessage = "OpenAI rejected the realtime request. Please try again or verify your configuration.";
          break;
        case "TIMEOUT":
          friendlyMessage = "Timed out while connecting to the realtime service. Please retry in a moment.";
          break;
        case "WEBSOCKET_ERROR":
          friendlyMessage = "Realtime connection closed unexpectedly. Please try starting the session again.";
          break;
        default:
          break;
      }

      setError(friendlyMessage);
      await teardownRealtime();
      setPhase("idle");
      setIsRecording(false);
    }
  }, [attachRealtimeStreams, ensureRealtimeSession, phase, resetConversation, startMicrophonePipeline, teardownRealtime]);

  const stopSession = useCallback(async () => {
    if (phase === "idle" || phase === "stopping") {
      return;
    }

    setPhase("stopping");
    setStatusMessage("Wrapping up session...");
    setError(null);

    try {
      stopMicrophonePipeline();
      await uploadMicChunks();
      const payload = buildConversationPayload();
      if (payload) {
        latestConversationRef.current = payload;
        saveConversationToSession(payload);
        const hasAudio = Boolean(payload.audio.host || payload.audio.ai);
        hasCapturedAudioRef.current = hasAudio;
        setHasCapturedAudio(hasAudio);
        setStatusMessage("Conversation saved for the Video Studio.");
      } else {
        latestConversationRef.current = null;
        hasCapturedAudioRef.current = false;
        setHasCapturedAudio(false);
        setStatusMessage(null);
      }
    } catch (error) {
      console.error("Failed to persist conversation", error);
      setStatusMessage(null);
    }

    await teardownRealtime();

    setPhase("idle");
    setIsRecording(false);
    setIsAudioPlaying(false);
    setIsHostSpeaking(false);
    setIsAiSpeaking(false);
  }, [buildConversationPayload, phase, stopMicrophonePipeline, teardownRealtime, uploadMicChunks]);

  const stopSessionRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    stopSessionRef.current = stopSession;
  }, [stopSession]);

  useEffect(() => {
    return () => {
      const latestStop = stopSessionRef.current;
      if (latestStop) {
        latestStop().catch(() => { });
      }
    };
  }, []);

  const handleSendToVideoStudio = useCallback(async () => {
    try {
      const payload = buildConversationPayload() ?? latestConversationRef.current;
      if (!payload) {
        setError("Capture a conversation before sending it to the Video Studio.");
        setStatusMessage(null);
        return;
      }
      latestConversationRef.current = payload;
      saveConversationToSession(payload);
      const hasAudio = Boolean(payload.audio.host || payload.audio.ai);
      hasCapturedAudioRef.current = hasAudio;
      setHasCapturedAudio(hasAudio);
      setError(null);
      setStatusMessage("Conversation handed off to the Video Studio.");
      router.push("/video-studio");
    } catch (error) {
      console.error("[ERROR] Failed to prepare conversation for Video Studio", error);
      setStatusMessage(null);
      setError(error instanceof Error ? error.message : "Failed to prepare conversation for Video Studio");
    }
  }, [buildConversationPayload, router]);

  const handleExportTranscript = useCallback(() => {
    if (entries.length === 0) {
      setError("Record a conversation before exporting the transcript.");
      setStatusMessage(null);
      return;
    }
    const transcriptText = entries
      .map((entry) => {
        const timestamp = new Date(entry.startedAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        const speakerLabel = entry.speaker === "host" ? "Host (You)" : "Dr. Sarah";
        return `[${timestamp}] ${speakerLabel}: ${entry.text}`;
      })
      .join("\n\n");

    const blob = new Blob([transcriptText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "podcast-transcript.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [entries]);

  const handleDownloadAudio = useCallback(async () => {
    try {
      let payload = buildConversationPayload();
      if (!payload) {
        payload = latestConversationRef.current;
      }
      if (!payload || (!payload.audio.host && !payload.audio.ai)) {
        setError("Capture a conversation with audio before downloading.");
        setStatusMessage(null);
        return;
      }

      latestConversationRef.current = payload;

      const files: Array<{ name: string; data: Uint8Array }> = [];

      if (payload.audio.host) {
        const hostBytes = base64ToUint8Array(payload.audio.host.base64);
        files.push({ name: "host-track.wav", data: hostBytes });
      }
      if (payload.audio.ai) {
        const aiBytes = base64ToUint8Array(payload.audio.ai.base64);
        files.push({ name: "ai-track.wav", data: aiBytes });
      }

      const transcriptText = payload.transcript
        .map((entry) => {
          const timestamp = new Date(entry.timestamp).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });
          const speakerLabel = entry.speaker || (entry.role === "user" ? "Host" : "Dr. Sarah");
          return `[${timestamp}] ${speakerLabel}: ${entry.content}`;
        })
        .join("\n\n");

      const encoder = new TextEncoder();
      files.push({ name: "transcript.txt", data: encoder.encode(transcriptText) });
      files.push({
        name: "metadata.json",
        data: encoder.encode(
          JSON.stringify(
            {
              paper: payload.paper,
              durationSeconds: payload.durationSeconds,
              createdAt: payload.createdAt,
            },
            null,
            2,
          ),
        ),
      });

      const archiveBytes = createZipArchive(files);
      const buffer = new ArrayBuffer(archiveBytes.byteLength);
      new Uint8Array(buffer).set(archiveBytes);
      const blob = new Blob([buffer], { type: "application/zip" });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `podcast-session-${sessionId}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);

      setError(null);
      setStatusMessage("Audio bundle downloaded successfully.");
    } catch (error) {
      console.error("[ERROR] Failed to export audio bundle", error);
      setStatusMessage(null);
      setError(error instanceof Error ? error.message : "Failed to download audio bundle");
    }
  }, [base64ToUint8Array, buildConversationPayload, sessionId]);

  const headerStatus = useMemo(() => {
    switch (phase) {
      case "preparing":
        return { label: "CONNECTING", color: "yellow" as const, active: false };
      case "live":
        return { label: "LIVE", color: "red" as const, active: true };
      case "stopping":
        return { label: "SAVING", color: "yellow" as const, active: false };
      default:
        return { label: "IDLE", color: "gray" as const, active: false };
    }
  }, [phase]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          isLiveRecording={phase === "live"}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Header
            title="Audio Studio"
            description="Capture a realtime podcast between you and an AI expert."
            status={headerStatus}
            timer={{ duration: sessionDuration, format: formatTime }}
          />

          <main id="main-content" tabIndex={-1} className="flex-1 p-6 lg:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-8 h-full">
              <div className="space-y-8">
                {/* Current Paper Card */}
                <Card className="glass-panel border-border/50 shadow-apple-card">
                  <CardHeader className="pb-4 border-b border-border/50">
                    <CardTitle className="flex items-center gap-3 text-foreground">
                      <div className="size-8 rounded-full bg-secondary flex items-center justify-center">
                        <FileText className="size-4 text-foreground" />
                      </div>
                      Current Paper
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {paperLoadError ? (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-destructive text-sm font-medium">
                        {paperLoadError}
                      </div>
                    ) : currentPaper ? (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <h3 className="font-semibold text-lg text-foreground leading-tight">
                            {currentPaper.title}
                          </h3>
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <span className="bg-secondary px-2 py-1 rounded-md">
                              Published {currentPaper.formattedPublishedDate ?? "Unknown"}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground font-medium">
                            {currentPaper.primaryAuthor
                              ? `${currentPaper.primaryAuthor}${currentPaper.hasAdditionalAuthors ? " et al." : ""}`
                              : currentPaper.authors}
                          </p>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground/90 line-clamp-4">
                          {currentPaper.abstract}
                        </p>
                        <div>
                          {currentPaper.arxiv_url ? (
                            <Button asChild variant="outline" className="w-full justify-center h-10 rounded-xl border-border/50 hover:bg-secondary hover:text-foreground transition-all">
                              <a
                                href={currentPaper.arxiv_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="mr-2 size-4" />
                                View on arXiv
                              </a>
                            </Button>
                          ) : (
                            <Button variant="outline" className="w-full justify-center h-10 rounded-xl" disabled>
                              <FileText className="mr-2 size-4" />
                              View on arXiv
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 text-center py-6">
                        <div className="size-12 rounded-full bg-secondary mx-auto flex items-center justify-center">
                          <FileText className="size-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">No paper selected</p>
                          <p className="text-sm text-muted-foreground">
                            Select a paper from the Research Hub to start.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Session Controls Card */}
                <Card className="glass-panel border-border/50 shadow-apple-card">
                  <CardHeader className="pb-4 border-b border-border/50">
                    <CardTitle className="flex items-center gap-3 text-foreground">
                      <div className="size-8 rounded-full bg-secondary flex items-center justify-center">
                        <Mic className="size-4 text-foreground" />
                      </div>
                      Session Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {error && (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive font-medium">
                        {error}
                      </div>
                    )}
                    {!error && statusMessage && (
                      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 text-sm text-accent font-medium">
                        {statusMessage}
                      </div>
                    )}

                    <div className="space-y-3">
                      <Button
                        onClick={startSession}
                        disabled={phase === "preparing" || phase === "live"}
                        size="lg"
                        className={cn(
                          "w-full justify-center h-12 rounded-xl text-base font-semibold shadow-lg transition-all duration-300",
                          phase === "live" ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02]"
                        )}
                      >
                        <Mic className="mr-2 size-5" />
                        {phase === "preparing" ? "Connecting..." : "Start Live Session"}
                      </Button>
                      <Button
                        onClick={stopSession}
                        disabled={phase !== "live"}
                        variant="destructive"
                        size="lg"
                        className="w-full justify-center h-12 rounded-xl text-base font-semibold shadow-sm hover:bg-destructive/90 transition-all"
                      >
                        <MicOff className="mr-2 size-5" />
                        End Session
                      </Button>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Button variant="ghost" className="w-full justify-start h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={handleExportTranscript}>
                        <FileText className="mr-2 size-4" />
                        Export Transcript
                      </Button>
                      <Button variant="ghost" className="w-full justify-start h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={handleDownloadAudio} disabled={!hasCapturedAudio}>
                        <Download className="mr-2 size-4" />
                        Download Audio Bundle
                      </Button>
                      <Button variant="ghost" className="w-full justify-start h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={handleSendToVideoStudio}>
                        <Video className="mr-2 size-4" />
                        Send to Video Studio
                      </Button>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-secondary/30 p-4 space-y-2">
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Radio className="size-4 text-primary" />
                        Live Session Tips
                      </p>
                      <ul className="space-y-1.5">
                        <li className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="block size-1 rounded-full bg-muted-foreground mt-1.5" />
                          Speak naturally and pause briefly when finished.
                        </li>
                        <li className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="block size-1 rounded-full bg-muted-foreground mt-1.5" />
                          The feed scrolls automatically to the latest message.
                        </li>
                        <li className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="block size-1 rounded-full bg-muted-foreground mt-1.5" />
                          Download or hand off the conversation after ending.
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="xl:col-span-2 h-full min-h-[600px]">
                <Card className="h-full flex flex-col overflow-hidden glass-panel border-border/50 shadow-apple-card">
                  <CardHeader className="border-b border-border/50 bg-white/50 backdrop-blur-md py-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-3 text-foreground">
                        <div className="size-8 rounded-full bg-secondary flex items-center justify-center">
                          <Sparkles className="size-4 text-foreground" />
                        </div>
                        Live Conversation Feed
                      </CardTitle>
                      <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full border border-border/50">
                        <div className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-foreground" /> Host
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-primary" /> Dr. Sarah
                        </div>
                        <div className="w-px h-3 bg-border" />
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="size-3.5" />
                          {phase === "live"
                            ? isAudioPlaying
                              ? <span className="text-accent animate-pulse">AI Speaking</span>
                              : "Waiting..."
                            : "Idle"}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col p-0 relative bg-gradient-to-b from-transparent to-secondary/10">
                    <ScrollArea ref={transcriptScrollRef} className="flex-1 px-8 py-6">
                      <div className="space-y-6 max-w-4xl mx-auto">
                        {entries.length === 0 && phase !== "live" && (
                          <div className="text-center py-32 space-y-6">
                            <div className="size-24 rounded-full bg-secondary mx-auto flex items-center justify-center shadow-inner">
                              <Brain className="size-12 text-muted-foreground/50" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-xl font-semibold text-foreground">Ready to capture</h3>
                              <p className="text-muted-foreground max-w-sm mx-auto">
                                Start the session and speak naturally. The transcript will appear here instantly.
                              </p>
                            </div>
                          </div>
                        )}

                        {entries.map((entry) => {
                          const isHost = entry.speaker === "host";
                          const bubbleClass = isHost
                            ? "bg-foreground text-background rounded-tr-sm shadow-md"
                            : "bg-white border border-border/50 text-foreground rounded-tl-sm shadow-sm";

                          const containerClass = isHost ? "flex-row-reverse" : "flex-row";

                          const timestamp = new Date(entry.startedAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                          });

                          return (
                            <div key={entry.id} className={cn("flex items-end gap-3 group", containerClass)}>
                              <div className={cn(
                                "size-8 rounded-full flex items-center justify-center shadow-sm shrink-0 mb-1",
                                isHost ? "bg-foreground text-background" : "bg-primary text-primary-foreground"
                              )}>
                                {isHost ? <Headphones className="size-4" /> : <Sparkles className="size-4" />}
                              </div>

                              <div className={cn("flex flex-col max-w-[80%]", isHost ? "items-end" : "items-start")}>
                                <div className="flex items-center gap-2 mb-1 px-1">
                                  <span className="text-xs font-semibold text-muted-foreground">
                                    {isHost ? "You" : "Dr. Sarah"}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/70 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                                    {timestamp}
                                  </span>
                                </div>

                                <div className={cn("px-5 py-3.5 text-sm leading-relaxed rounded-2xl transition-all duration-200", bubbleClass)}>
                                  <span>{entry.text || (entry.status === "streaming" ? "" : "")}</span>
                                  {entry.status === "streaming" && (
                                    <span className="inline-flex gap-1 ml-1 items-center">
                                      <span className="size-1 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                                      <span className="size-1 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                                      <span className="size-1 bg-current rounded-full animate-bounce" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {phase === "live" && (
                          <div className="flex justify-center py-4 sticky bottom-0 z-10">
                            <div className="flex items-center gap-3 rounded-full border border-border/50 bg-white/90 backdrop-blur-md px-5 py-2.5 text-sm font-medium text-foreground shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-300">
                              <div className="relative flex size-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full size-3 bg-red-500"></span>
                              </div>
                              <span>
                                {isHostSpeaking
                                  ? "Listening..."
                                  : isAiSpeaking
                                    ? "Dr. Sarah is speaking..."
                                    : "Listening..."}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    <div className="border-t border-border/50 bg-white/50 backdrop-blur-md px-6 py-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className={cn("size-2 rounded-full", isRecording ? "bg-red-500 animate-pulse" : "bg-muted-foreground")} />
                        {phase === "live"
                          ? isRecording
                            ? "Microphone Active"
                            : "Microphone Idle"
                          : "Session Idle"}
                      </div>
                      <div className="font-mono bg-secondary/50 px-2 py-1 rounded-md border border-border/50">
                        {formatTime(sessionDuration)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default StudioPage;


