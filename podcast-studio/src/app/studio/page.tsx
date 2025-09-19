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
}

const AI_BASE_INSTRUCTION_LINES = [
  "You are Dr. Sarah, an AI scientist joining a podcast conversation.",
  "Respond conversationally, stay grounded in the selected research, and avoid speculation.",
  "Keep every reply under three concise sentences (about 75 tokens) to control cost.",
];

const MAX_ABSTRACT_SNIPPET = 400;

const sanitizeInstructionText = (value?: string | null) => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length <= MAX_ABSTRACT_SNIPPET) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_ABSTRACT_SNIPPET)}…`;
};

const buildConversationInstructionsFromPaper = (paper: SelectedPaper | null): string => {
  const base = AI_BASE_INSTRUCTION_LINES.join(" ");

  if (!paper) {
    return base;
  }

  const details: string[] = [];
  const title = sanitizeInstructionText(paper.title);
  const formattedDate = sanitizeInstructionText(paper.formattedPublishedDate);
  const abstractSnippet = sanitizeInstructionText(paper.abstract);
  const arxivUrl = sanitizeInstructionText(paper.arxiv_url);
  const authorLine = sanitizeInstructionText(
    paper.primaryAuthor
      ? `${paper.primaryAuthor}${paper.hasAdditionalAuthors ? " et al." : ""}`
      : paper.authors,
  );

  const contextParts: string[] = [];
  if (title) {
    contextParts.push(`Title: ${title}`);
  }
  if (authorLine) {
    contextParts.push(`Authors: ${authorLine}`);
  }
  if (formattedDate) {
    contextParts.push(`Published: ${formattedDate}`);
  }
  if (abstractSnippet) {
    contextParts.push(`Summary: ${abstractSnippet}`);
  }
  if (arxivUrl) {
    contextParts.push(`URL: ${arxivUrl}`);
  }

  if (contextParts.length > 0) {
    details.push(`Context: ${contextParts.join("; ")}`);
  }

  details.push(
    "Answer briefly, relate insights back to the paper, and avoid repeating this context verbatim.",
  );

  return `${base} ${details.join(" ")}`.trim();
};

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
  const { activeProvider, apiKeys } = useApiConfig();
  const activeApiKey = (apiKeys[activeProvider] ?? "").trim();
  const router = useRouter();

  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [phase, setPhase] = useState<ConnectionPhase>("idle");
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<{ stop: () => void } | null>(null);
  const micChunkQueueRef = useRef<Uint8Array[]>([]);
  const micFlushIntervalRef = useRef<number | null>(null);
  const isUploadingRef = useRef(false);
  const isCommittingRef = useRef(false);
  const aiTrackRef = useRef<MediaStreamTrack | null>(null);
  const aiAudioChunksRef = useRef<Uint8Array[]>([]);
  const hostAudioChunksRef = useRef<Uint8Array[]>([]);
  const audioEventSourceRef = useRef<EventSource | null>(null);
  const aiTranscriptEventSourceRef = useRef<EventSource | null>(null);
  const userTranscriptEventSourceRef = useRef<EventSource | null>(null);
  const hasAiTranscriptSseRef = useRef(false);
  const hasUserTranscriptSseRef = useRef(false);
  const hasCapturedAudioRef = useRef(false);
  const latestConversationRef = useRef<StoredConversation | null>(null);

  const hostActiveIdRef = useRef<string | null>(null);
  const aiActiveIdRef = useRef<string | null>(null);
  const hostPendingRef = useRef("");
  const aiPendingRef = useRef("");
  const hostTypingIntervalRef = useRef<number | null>(null);
  const aiTypingIntervalRef = useRef<number | null>(null);

  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  const paperPayload = useMemo(() => {
    if (!currentPaper) {
      return null;
    }

    return {
      id: currentPaper.id,
      title: currentPaper.title,
      authors: currentPaper.authors,
      primaryAuthor: currentPaper.primaryAuthor,
      hasAdditionalAuthors: currentPaper.hasAdditionalAuthors,
      formattedPublishedDate: currentPaper.formattedPublishedDate,
      abstract: currentPaper.abstract,
      arxiv_url: currentPaper.arxiv_url ?? undefined,
    };
  }, [currentPaper]);

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
    setEntries((prev) => [
      ...prev,
      {
        id,
        speaker,
        text: "",
        status: "streaming",
        startedAt,
        updatedAt: startedAt,
      },
    ]);
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
      if (!activeRef.current && !pendingRef.current && !finalText) {
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

      if (finalText) {
        pendingRef.current += finalText;
      }

      drainPending(speaker, true);

      const activeId = activeRef.current;
      if (activeId) {
        markEntryFinal(activeId);
      }
      activeRef.current = null;
      pendingRef.current = "";
      stopTypingInterval(speaker);

      if (speaker === "host") {
        setIsHostSpeaking(false);
      } else {
        setIsAiSpeaking(false);
      }
    },
    [drainPending, ensureSegment, markEntryFinal, stopTypingInterval],
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

  const ensureRealtimeSession = useCallback(async () => {
    if (activeProvider === "google") {
      throw new Error(
        "Realtime studio currently supports only OpenAI sessions. Switch your active provider in Settings to continue.",
      );
    }

    // Validate API key format before making the request (only if key exists)
    if (activeProvider === "openai" && activeApiKey && activeApiKey.trim() && !activeApiKey.startsWith("sk-")) {
      throw new Error(
        "Invalid OpenAI API key format. OpenAI API keys should start with 'sk-'. Please check your API key in Settings.",
      );
    }
    const payload: Record<string, unknown> = {
      sessionId,
      provider: activeProvider,
    };

    if (activeApiKey) {
      payload.apiKey = activeApiKey;
    }

    if (paperPayload) {
      payload.paper = paperPayload;
    }

    const response = await fetch("/api/rt/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    let payload: { error?: string } | null = null;
    try {
      payload = (await response.json()) as { error?: string };
    } catch {
      payload = null;
    }

    if (!response.ok || (payload && payload.error)) {
      const message = payload?.error || `Failed to start realtime session (${response.status})`;
      throw new Error(message);
    }
  }, [activeApiKey, activeProvider, paperPayload, sessionId]);

  const commitAudioTurn = useCallback(async () => {
    if (phase !== "live") {
      return;
    }
    if (isCommittingRef.current) {
      return;
    }
    isCommittingRef.current = true;
    try {
      const response = await fetch("/api/rt/audio-commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.error === "string" ? payload.error : "Failed to commit audio turn";
        console.warn("[WARN] Audio commit request failed", { message, status: response.status });
      }
    } catch (err) {
      console.error("[ERROR] Audio commit request failed", err);
    } finally {
      isCommittingRef.current = false;
    }
  }, [phase, sessionId]);

  const stopMicrophonePipeline = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (micFlushIntervalRef.current != null) {
      window.clearInterval(micFlushIntervalRef.current);
      micFlushIntervalRef.current = null;
    }
    micChunkQueueRef.current = [];
    isUploadingRef.current = false;
    setIsRecording(false);
  }, []);

  const startMicrophonePipeline = useCallback(async () => {
    try {
      await ensureRealtimeSession();
    } catch (err) {
      setStatusMessage(null);
      setError(err instanceof Error ? err.message : "Failed to start realtime session.");
      return false;
    }

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

      scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcm16Buffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcm16Buffer[i] = Math.round(sample * 32767);
        }
        const uint8Array = new Uint8Array(pcm16Buffer.buffer);
        micChunkQueueRef.current.push(uint8Array);
        hostAudioChunksRef.current.push(new Uint8Array(uint8Array));
        if (!hasCapturedAudioRef.current) {
          hasCapturedAudioRef.current = true;
          setHasCapturedAudio(true);
        }
      };

      source.connect(scriptProcessor);

      const flush = async () => {
        if (isUploadingRef.current) return;
        if (micChunkQueueRef.current.length === 0) return;
        isUploadingRef.current = true;
        try {
          const totalLength = micChunkQueueRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
          const combined = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of micChunkQueueRef.current) {
            combined.set(chunk, offset);
            offset += chunk.length;
          }
          micChunkQueueRef.current = [];
          let binary = "";
          const CHUNK_SIZE = 0x8000;
          for (let i = 0; i < combined.length; i += CHUNK_SIZE) {
            const chunk = combined.subarray(i, i + CHUNK_SIZE);
            binary += String.fromCharCode(...chunk);
          }
          const base64 = btoa(binary);
          const response = await fetch("/api/rt/audio-append", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64, sessionId }),
          });
          if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            console.error("[ERROR] Failed to send batched audio:", errJson);
          }
        } catch (e) {
          console.error("[ERROR] Mic flush failed:", e);
        } finally {
          isUploadingRef.current = false;
        }
      };

      if (micFlushIntervalRef.current == null) {
        micFlushIntervalRef.current = window.setInterval(flush, 50);
      }

      const processor = {
        stop: () => {
          source.disconnect();
          scriptProcessor.disconnect();
          stream.getTracks().forEach((track) => track.stop());
          if (micFlushIntervalRef.current != null) {
            window.clearInterval(micFlushIntervalRef.current);
            micFlushIntervalRef.current = null;
          }
        },
      };

      mediaRecorderRef.current = processor;
      setIsRecording(true);
      return true;
    } catch (error) {
      console.error("[ERROR] Failed to access microphone:", error);
      setStatusMessage(null);
      setError("Failed to access microphone. Please check permissions.");
      return false;
    }
  }, [ensureRealtimeSession, sessionId]);

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

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current.src = "";
    }

    if (dcRef.current) {
      try {
        dcRef.current.close();
      } catch (err) {
        console.debug("[DEBUG] Failed to close data channel", err);
      }
      dcRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.getSenders().forEach((sender) => sender.track?.stop());
      } catch (err) {
        console.debug("[DEBUG] Failed to stop senders", err);
      }
      pcRef.current.close();
      pcRef.current = null;
    }

    if (aiTrackRef.current) {
      try {
        aiTrackRef.current.stop();
      } catch {}
      aiTrackRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    await fetch("/api/rt/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      cache: "no-store",
    }).catch(() => {});

    micChunkQueueRef.current = [];
    hostAudioChunksRef.current = [];
    aiAudioChunksRef.current = [];
    isUploadingRef.current = false;
    hasCapturedAudioRef.current = false;
  }, [sessionId, stopMicrophonePipeline]);

  const buildConversationPayload = useCallback((): StoredConversation | null => {
    if (!currentPaper || entries.length === 0) {
      return null;
    }

    const sampleRate = Math.round(audioContextRef.current?.sampleRate ?? 24000);
    const hostAudio = encodePcm16ChunksToWav(hostAudioChunksRef.current, sampleRate);
    const aiAudio = encodePcm16ChunksToWav(aiAudioChunksRef.current, 24000);

    const transcript = entries.map((entry, index) => ({
      id: entry.id,
      role: entry.speaker === "host" ? "user" as const : "expert" as const,
      content: entry.text.trim(),
      timestamp: new Date(entry.startedAt).toISOString(),
      speaker: entry.speaker === "host" ? "Host (You)" : "Dr. Sarah (AI Expert)",
      type: "text" as const,
      order: index,
    }));

    const first = entries[0];
    const last = entries[entries.length - 1];
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

  const sendDataChannelSessionUpdate = useCallback(() => {
    const channel = dcRef.current;
    if (!channel || channel.readyState !== "open") {
      return;
    }

    try {
      const instructions = buildConversationInstructionsFromPaper(currentPaper);
      channel.send(
        JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            voice: "alloy",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 800,
            },
            instructions,
          },
        }),
      );
    } catch (err) {
      console.error("[ERROR] Failed to send session update over data channel:", err);
    }
  }, [currentPaper]);

  const handleUserTranscriptionDelta = useCallback(
    (delta: string) => {
      appendToSegment("host", delta);
    },
    [appendToSegment],
  );

  const handleUserTranscriptionComplete = useCallback(
    (transcript: string) => {
      finalizeSegment("host", transcript);
      void commitAudioTurn();
    },
    [commitAudioTurn, finalizeSegment],
  );

  const handleAiTranscriptDelta = useCallback(
    (delta: string) => {
      appendToSegment("ai", delta);
    },
    [appendToSegment],
  );

  const handleDcMessage = useCallback(
    (data: unknown) => {
      if (typeof data !== "string") {
        return;
      }

      try {
        const msg = JSON.parse(data) as Record<string, unknown>;
        const type = typeof msg.type === "string" ? msg.type : "";
        if (!type) {
          return;
        }

        if (
          !hasAiTranscriptSseRef.current &&
          (type === "response.output_text.delta" || type === "response.text.delta" || type === "response.audio_transcript.delta")
        ) {
          const deltaText = typeof msg.delta === "string" ? msg.delta : "";
          const responseText = typeof msg.text === "string" ? msg.text : "";
          const text = deltaText || responseText;
          if (text) {
            handleAiTranscriptDelta(text);
          }
        }

        if (type === "response.done" || type === "response.completed" || type === "response.output_text.done") {
          finalizeSegment("ai");
        }

        if (
          !hasUserTranscriptSseRef.current &&
          (type === "conversation.item.input_audio_transcription.delta" || type === "input_audio_buffer.transcription.delta")
        ) {
          const delta = typeof msg.delta === "string" ? msg.delta : "";
          if (delta) {
            handleUserTranscriptionDelta(delta);
          }
        }

        if (
          !hasUserTranscriptSseRef.current &&
          (type === "conversation.item.input_audio_transcription.completed" || type === "input_audio_buffer.transcription.completed")
        ) {
          const transcript = typeof msg.transcript === "string" ? msg.transcript : "";
          handleUserTranscriptionComplete(transcript);
        }

        if (type === "conversation.item.input_audio_transcription.started" || type === "input_audio_buffer.transcription.started") {
          ensureSegment("host");
        }

        if (type === "input_audio_buffer.speech_started") {
          ensureSegment("host");
        }

        if (type === "input_audio_buffer.speech_stopped") {
          void commitAudioTurn();
        }

        if (type === "response.error") {
          const message = typeof msg.error === "string" ? msg.error : "Realtime session error";
          setStatusMessage(null);
          setError(message);
        }
      } catch (err) {
        console.debug("[DEBUG] Failed to parse data channel message", err);
      }
    },
    [commitAudioTurn, ensureSegment, finalizeSegment, handleAiTranscriptDelta, handleUserTranscriptionComplete, handleUserTranscriptionDelta],
  );

  useEffect(() => {
    sendDataChannelSessionUpdate();
  }, [sendDataChannelSessionUpdate]);

  useEffect(() => {
    if (phase !== "live") {
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
      return;
    }

    if (!audioEventSourceRef.current) {
      try {
        const source = new EventSource(`/api/rt/audio?sessionId=${sessionId}`);
        audioEventSourceRef.current = source;
        source.addEventListener("connected", () => {
          console.log("[INFO] Connected to AI audio stream");
        });
        source.onmessage = (event) => {
          const payload = (event.data || "").trim();
          if (!payload || payload === "Audio stream ready") {
            return;
          }
          try {
            const binary = atob(payload);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            aiAudioChunksRef.current.push(bytes);
            if (!hasCapturedAudioRef.current) {
              hasCapturedAudioRef.current = true;
              setHasCapturedAudio(true);
            }
          } catch (error) {
            console.error("[ERROR] Failed to capture AI audio chunk", error);
          }
        };
        source.addEventListener("error", (event) => {
          console.error("[ERROR] AI audio SSE stream error", event);
        });
      } catch (error) {
        console.error("[ERROR] Unable to open AI audio SSE stream", error);
      }
    }

    if (!aiTranscriptEventSourceRef.current) {
      try {
        const source = new EventSource(`/api/rt/transcripts?sessionId=${sessionId}`);
        aiTranscriptEventSourceRef.current = source;
        hasAiTranscriptSseRef.current = true;
        source.onmessage = (event) => {
          const data = (event.data || "").trim();
          if (!data || data === "Connected to AI transcript stream") {
            return;
          }
          handleAiTranscriptDelta(data);
        };
        source.addEventListener("done", () => {
          finalizeSegment("ai");
        });
        source.addEventListener("error", (event) => {
          console.error("[ERROR] AI transcript SSE stream error", event);
          hasAiTranscriptSseRef.current = false;
          if (aiTranscriptEventSourceRef.current === source) {
            source.close();
            aiTranscriptEventSourceRef.current = null;
          }
        });
      } catch (error) {
        console.error("[ERROR] Unable to open AI transcript SSE stream", error);
        hasAiTranscriptSseRef.current = false;
      }
    }

    if (!userTranscriptEventSourceRef.current) {
      try {
        const source = new EventSource(`/api/rt/user-transcripts?sessionId=${sessionId}`);
        userTranscriptEventSourceRef.current = source;
        hasUserTranscriptSseRef.current = true;

        const handleComplete = (event: MessageEvent) => {
          const data = (event.data || "").trim();
          if (!data || data === "Connected to user transcript stream") {
            if (!data) {
              finalizeSegment("host");
            }
            return;
          }
          handleUserTranscriptionComplete(data);
        };

        const handleDelta = (event: MessageEvent) => {
          const data = (event.data || "").trim();
          if (!data || data === "Connected to user transcript stream") {
            return;
          }
          handleUserTranscriptionDelta(data);
        };

        source.addEventListener("complete", handleComplete);
        source.addEventListener("delta", handleDelta);
        source.addEventListener("error", (event) => {
          console.error("[ERROR] User transcript SSE stream error", event);
          hasUserTranscriptSseRef.current = false;
          if (userTranscriptEventSourceRef.current === source) {
            source.close();
            userTranscriptEventSourceRef.current = null;
          }
        });
      } catch (error) {
        console.error("[ERROR] Unable to open user transcript SSE stream", error);
        hasUserTranscriptSseRef.current = false;
      }
    }
  }, [finalizeSegment, handleAiTranscriptDelta, handleUserTranscriptionComplete, handleUserTranscriptionDelta, phase, sessionId]);

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

    let pc: RTCPeerConnection | null = null;
    let localStream: MediaStream | null = null;

    try {
      await ensureRealtimeSession();

      pc = new RTCPeerConnection({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
      });

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        const audioElement = audioRef.current;
        if (audioElement) {
          audioElement.srcObject = remoteStream;
          const playPromise = audioElement.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn("[WARN] Autoplay prevented for remote audio:", err);
            });
          }
        } else {
          const fallback = new Audio();
          fallback.srcObject = remoteStream;
          fallback.autoplay = true;
          fallback.play().catch(() => {});
        }

        const track = event.track;
        aiTrackRef.current = track;
        track.onunmute = () => {
          setIsAiSpeaking(true);
        };
        track.onmute = () => {
          setIsAiSpeaking(false);
        };
        track.onended = () => {
          setIsAiSpeaking(false);
        };
      };

      pc.ondatachannel = (ev) => {
        const dc = ev.channel;
        dcRef.current = dc;
        dc.onmessage = (e) => handleDcMessage(e.data);
        dc.onopen = () => sendDataChannelSessionUpdate();
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      localStream = stream;
      localStream.getAudioTracks().forEach((track) => pc!.addTrack(track, localStream!));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (e) => handleDcMessage(e.data);
      dc.onopen = () => sendDataChannelSessionUpdate();

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);

      const webrtcHeaders: Record<string, string> = {
        "Content-Type": "application/sdp",
        "X-LLM-Provider": activeProvider,
        "X-LLM-Model": "gpt-4o-realtime-preview-2024-10-01",
      };

      if (activeApiKey) {
        webrtcHeaders["X-LLM-Api-Key"] = activeApiKey;
      }

      const resp = await fetch("/api/rt/webrtc?model=gpt-4o-realtime-preview-2024-10-01", {
        method: "POST",
        body: pc.localDescription?.sdp || "",
        cache: "no-store",
        headers: webrtcHeaders,
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`SDP exchange failed: ${resp.status} ${text}`);
      }
      const answerSdp = await resp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      pcRef.current = pc;

      if (audioRef.current) {
        const el = audioRef.current;
        el.onplay = () => {
          setIsAudioPlaying(true);
        };
        el.onpause = () => {
          setIsAudioPlaying(false);
        };
        el.onended = () => {
          setIsAudioPlaying(false);
        };
      }

      setPhase("live");
      setStatusMessage("Live recording started.");

      const micStarted = await startMicrophonePipeline();
      if (!micStarted) {
        throw new Error("Microphone access required to record the conversation.");
      }

      sendDataChannelSessionUpdate();
    } catch (err) {
      console.error("[ERROR] Connection failed:", err);
      setStatusMessage(null);
      setError(err instanceof Error ? err.message : "Failed to connect to AI");
      if (pc) {
        try {
          pc.getSenders().forEach((sender) => sender.track?.stop());
        } catch {}
        pc.close();
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (pcRef.current) {
        try {
          pcRef.current.getSenders().forEach((sender) => sender.track?.stop());
        } catch {}
        pcRef.current.close();
        pcRef.current = null;
      }
      if (dcRef.current) {
        try {
          dcRef.current.close();
        } catch {}
        dcRef.current = null;
      }
      if (aiTrackRef.current) {
        try {
          aiTrackRef.current.stop();
        } catch {}
        aiTrackRef.current = null;
      }
      setPhase("idle");
      setIsRecording(false);
    }
  }, [activeApiKey, activeProvider, ensureRealtimeSession, handleDcMessage, phase, resetConversation, sendDataChannelSessionUpdate, startMicrophonePipeline]);

  const stopSession = useCallback(async () => {
    if (phase === "idle" || phase === "stopping") {
      return;
    }

    setPhase("stopping");
    setStatusMessage("Wrapping up session...");
    setError(null);

    try {
      stopMicrophonePipeline();
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
  }, [buildConversationPayload, phase, stopMicrophonePipeline, teardownRealtime]);

  useEffect(() => {
    return () => {
      stopSession().catch(() => {});
    };
  }, [stopSession]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/40">
      <div className="flex">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          isLiveRecording={phase === "live"}
        />

        <div className="flex-1">
          <Header
            title="Audio Studio"
            description="Capture a realtime podcast between you and an AI expert."
            status={headerStatus}
            timer={{ duration: sessionDuration, format: formatTime }}
          />

          <main className="p-6 space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="space-y-6">
                <Card className="shadow-sm border border-slate-200/70 backdrop-blur-sm bg-white/80">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                      <FileText className="w-5 h-5 text-purple-500" />
                      Current Paper
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-slate-600">
                    {paperLoadError ? (
                      <div className="rounded-lg border border-red-200 bg-red-50/80 p-3 text-red-600">
                        {paperLoadError}
                      </div>
                    ) : currentPaper ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h3 className="font-semibold text-slate-900 leading-tight">
                            {currentPaper.title}
                          </h3>
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            Published {currentPaper.formattedPublishedDate ?? "(date unavailable)"}
                          </p>
                          <p className="text-sm text-slate-600">
                            {currentPaper.primaryAuthor
                              ? `${currentPaper.primaryAuthor}${currentPaper.hasAdditionalAuthors ? " et al." : ""}`
                              : currentPaper.authors}
                          </p>
                        </div>
                        <p className="leading-relaxed text-slate-600/90">
                          {currentPaper.abstract}
                        </p>
                        <div className="flex flex-col gap-2">
                          {currentPaper.arxiv_url ? (
                            <Button asChild variant="outline" className="w-full">
                              <a
                                href={currentPaper.arxiv_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                View on arXiv
                              </a>
                            </Button>
                          ) : (
                            <Button variant="outline" className="w-full" disabled>
                              <FileText className="mr-2 h-4 w-4" />
                              View on arXiv
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-slate-600">
                        <p className="font-medium text-slate-800">
                          Select a paper from the Research Hub to pre-load conversation context.
                        </p>
                        <p className="text-sm text-slate-500">
                          Paper details populate automatically when you start the studio from a selected card.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm border border-slate-200/70 backdrop-blur-sm bg-white/80">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                      <Mic className="w-5 h-5 text-red-500" />
                      Session Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {error && (
                      <div className="rounded-lg border border-red-200 bg-red-50/80 p-3 text-sm text-red-600">
                        {error}
                      </div>
                    )}
                    {!error && statusMessage && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-600">
                        {statusMessage}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={startSession}
                        disabled={phase === "preparing" || phase === "live"}
                        size="lg"
                        className="w-full justify-center"
                      >
                        <Mic className="mr-2 h-4 w-4" />
                        {phase === "preparing" ? "Connecting…" : "Start Live Session"}
                      </Button>
                      <Button
                        onClick={stopSession}
                        disabled={phase !== "live"}
                        variant="outline"
                        size="lg"
                        className="w-full justify-center"
                      >
                        <MicOff className="mr-2 h-4 w-4" />
                        End Session
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <Button variant="ghost" className="justify-start" onClick={handleExportTranscript}>
                        <FileText className="mr-2 h-4 w-4" />
                        Export Transcript
                      </Button>
                      <Button variant="ghost" className="justify-start" onClick={handleDownloadAudio} disabled={!hasCapturedAudio}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Audio Bundle
                      </Button>
                      <Button variant="ghost" className="justify-start" onClick={handleSendToVideoStudio}>
                        <Video className="mr-2 h-4 w-4" />
                        Send to Video Studio
                      </Button>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-500 space-y-1">
                      <p className="flex items-center gap-2 font-medium text-slate-700">
                        <Radio className="h-3.5 w-3.5 text-emerald-500" />
                        Live session tips
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Speak naturally and pause briefly when finished—turn detection is automatic.</li>
                        <li>The feed scrolls to the latest utterance so you never lose the live moment.</li>
                        <li>Download or hand off the conversation after ending the session.</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="xl:col-span-2">
                <Card className="h-[640px] flex flex-col overflow-hidden shadow-lg border border-slate-200/70 backdrop-blur bg-white/70">
                  <CardHeader className="border-b border-slate-200/60 bg-white/70">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-slate-800">
                        <Sparkles className="h-5 w-5 text-indigo-500" />
                        Live Conversation Feed
                      </CardTitle>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <span className="inline-flex h-2 w-2 rounded-full bg-purple-500" /> Host
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" /> Dr. Sarah
                        </div>
                        <div className="flex items-center gap-1">
                          <Volume2 className="h-3 w-3" />
                          {phase === "live"
                            ? isAudioPlaying
                              ? "AI audio streaming"
                              : "Waiting for response"
                            : "Session idle"}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col p-0">
                    <ScrollArea ref={transcriptScrollRef} className="flex-1 px-6 py-4">
                      <div className="space-y-4">
                        {entries.length === 0 && phase !== "live" && (
                          <div className="text-center text-slate-500 py-16 space-y-3">
                            <Brain className="mx-auto h-12 w-12 opacity-50" />
                            <p className="font-medium text-slate-700">Ready to capture your next conversation.</p>
                            <p className="text-sm text-slate-500">Start the session and speak naturally—the transcript will appear instantly.</p>
                          </div>
                        )}

                        {entries.map((entry) => {
                          const isHost = entry.speaker === "host";
                          const bubbleClass = isHost
                            ? "bg-gradient-to-r from-purple-50 to-purple-100/60 border border-purple-200/70"
                            : "bg-gradient-to-r from-blue-50 to-blue-100/60 border border-blue-200/70";
                          const avatarClass = isHost
                            ? "bg-purple-100 text-purple-600 border border-purple-200"
                            : "bg-blue-100 text-blue-600 border border-blue-200";
                          const speakerLabel = isHost ? "Host (You)" : "Dr. Sarah";
                          const timestamp = new Date(entry.startedAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                          });

                          return (
                            <div key={entry.id} className="flex items-start gap-3">
                              <div className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-sm ${avatarClass}`}>
                                {isHost ? <Headphones className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                              </div>
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-800">{speakerLabel}</span>
                                  <span className="text-xs font-mono text-slate-500 bg-white/70 border border-slate-200 px-2 py-0.5 rounded-md">
                                    {timestamp}
                                  </span>
                                </div>
                                <div className={`rounded-2xl px-4 py-3 text-sm text-slate-800 shadow-sm ${bubbleClass}`}>
                                  <span>{entry.text || (entry.status === "streaming" ? "…" : "")}</span>
                                  {entry.status === "streaming" && (
                                    <span className="ml-1 inline-block h-3 w-1.5 animate-pulse rounded bg-slate-500/70 align-middle" />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {phase === "live" && (
                          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700 shadow-sm">
                            <Radio className="h-4 w-4" />
                            <span>
                              {isHostSpeaking
                                ? "Recording your voice…"
                                : isAiSpeaking
                                  ? "Dr. Sarah is responding…"
                                  : "Session is listening for the next speaker."}
                            </span>
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    <div className="border-t border-slate-200/70 bg-white/70 px-6 py-4 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4" />
                        {phase === "live"
                          ? isRecording
                            ? "Microphone streaming in realtime"
                            : "Microphone idle"
                          : "Session idle"}
                      </div>
                      <div className="font-mono text-sm text-slate-600">
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

