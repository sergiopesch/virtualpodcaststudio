"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSidebar } from "@/contexts/sidebar-context";
import { useRealtimeConversation } from "@/hooks/useRealtimeConversation";
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
  const micFlushIntervalRef = useRef<number | null>(null);
  const aiAudioChunksRef = useRef<Uint8Array[]>([]);
  const hostAudioChunksRef = useRef<Uint8Array[]>([]);
  const MAX_AUDIO_CHUNKS = 10000; // Limit to prevent memory exhaustion (~240MB at 24kHz)
  const hasCapturedAudioRef = useRef(false);
  const latestConversationRef = useRef<StoredConversation | null>(null);
  const aiPlaybackTimeRef = useRef(0);
  const aiPlaybackSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const entrySequenceRef = useRef(0);
  const hostActiveIdRef = useRef<string | null>(null);
  const aiActiveIdRef = useRef<string | null>(null);
  const hostPendingRef = useRef("");
  const aiPendingRef = useRef("");
  const hostTypingIntervalRef = useRef<number | null>(null);
  const aiTypingIntervalRef = useRef<number | null>(null);

  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  // --- Helpers for Transcript Management ---

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

  const handleAiTranscriptDelta = useCallback(
    (delta: string) => {
      appendToSegment("ai", delta);
    },
    [appendToSegment],
  );

  const handleUserTranscriptionComplete = useCallback(
    (transcript: string) => {
      finalizeSegment("host", transcript);
    },
    [finalizeSegment],
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

  // --- Use Realtime Hook ---

  const rt = useRealtimeConversation({
    onAudioDelta: (base64) => {
      try {
        const bytes = base64ToUint8Array(base64);
        if (aiAudioChunksRef.current.length < MAX_AUDIO_CHUNKS) {
          aiAudioChunksRef.current.push(bytes);
        }
        void playAiAudioChunk(bytes);
        setIsAiSpeaking(true);
      } catch (e) {
        console.error("Failed to process AI audio delta", e);
      }
    },
    onAiTranscriptDelta: (text) => {
      handleAiTranscriptDelta(text);
    },
    onUserTranscript: (text) => {
      handleUserTranscriptionComplete(text);
    },
    onSpeechStarted: () => {
      setIsHostSpeaking(true);
      ensureSegment("host");
    },
    onSpeechStopped: () => {
      setIsHostSpeaking(false);
    }
  });

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

  // --- Initialization ---

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

  const stopMicrophonePipeline = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (micFlushIntervalRef.current != null) {
      window.clearInterval(micFlushIntervalRef.current);
      micFlushIntervalRef.current = null;
    }
    setIsRecording(false);
  }, []);

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
        
        const pcm16Buffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcm16Buffer[i] = Math.round(sample * 32767);
        }
        const uint8Array = new Uint8Array(pcm16Buffer.buffer);
        
        // Send to realtime hook immediately
        const base64 = uint8ArrayToBase64(uint8Array);
        rt.sendAudioChunk(base64);

        // Store for saving
        if (hostAudioChunksRef.current.length < MAX_AUDIO_CHUNKS) {
          hostAudioChunksRef.current.push(new Uint8Array(uint8Array));
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
        },
      };

      mediaRecorderRef.current = processor;
      console.log("[INFO] Microphone pipeline started");
      setIsRecording(true);
      return true;
    } catch (error) {
      console.error("[ERROR] Failed to access microphone:", error);
      setStatusMessage(null);
      setError("Failed to access microphone. Please check permissions.");
      return false;
    }
  }, [rt, uint8ArrayToBase64]);

  const teardownRealtime = useCallback(async () => {
    stopMicrophonePipeline();
    rt.disconnect();

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

    hostAudioChunksRef.current = [];
    aiAudioChunksRef.current = [];
    hasCapturedAudioRef.current = false;
    isSessionActiveRef.current = false;
  }, [rt, stopMicrophonePipeline]);

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
      await rt.connect();
      
      // Wait for connection state
      // We'll handle success in a separate effect or check immediately below if sync
    } catch (err) {
      console.error("Failed to start session", err);
      setError("Failed to connect to the realtime server.");
      setPhase("idle");
    }
  }, [phase, resetConversation, rt]);

  // Handle connection state changes
  useEffect(() => {
    if (rt.isConnected && phase === "preparing") {
       console.log("[INFO] Realtime connected!");
       
       // Start mic pipeline
       startMicrophonePipeline().then((started) => {
         if (started) {
           setPhase("live");
           setStatusMessage("Live recording started.");
           isSessionActiveRef.current = true;
         } else {
           setPhase("idle");
           rt.disconnect();
           setError("Failed to access microphone.");
         }
       });
    } else if (rt.error && phase !== "idle" && phase !== "stopping") {
       console.error("[ERROR] Realtime error:", rt.error);
       setError(rt.error);
       setPhase("idle");
       teardownRealtime();
    }
  }, [rt.isConnected, rt.error, phase, startMicrophonePipeline, teardownRealtime, rt]);

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
    setIsHostSpeaking(false);
    setIsAiSpeaking(false);
  }, [buildConversationPayload, phase, stopMicrophonePipeline, teardownRealtime]);

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
            2
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          isLiveRecording={phase === "live"}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <main id="main-content" tabIndex={-1} className="flex-1 p-6 lg:p-10 overflow-y-auto">
            <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-8 h-full">
              <div className="space-y-8">
                {/* Current Paper Card */}
                <Card className="glass-panel border-white/10">
                  <CardHeader className="pb-4 border-b border-white/5">
                    <CardTitle className="flex items-center gap-3 text-white">
                      <div className="size-8 rounded-full bg-white/10 flex items-center justify-center">
                        <FileText className="size-4 text-white" />
                      </div>
                      Current Paper
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {paperLoadError ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white text-sm font-medium">
                        {paperLoadError}
                      </div>
                    ) : currentPaper ? (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <h3 className="font-semibold text-xl text-white leading-tight">
                            {currentPaper.title}
                          </h3>
                          <div className="flex items-center gap-2 text-xs font-bold text-white/50 uppercase tracking-wider">
                            <span className="bg-white/10 px-2.5 py-1 rounded-md text-white">
                              Published {currentPaper.formattedPublishedDate ?? "Unknown"}
                            </span>
                          </div>
                          <p className="text-sm text-white/70 font-medium">
                            {currentPaper.primaryAuthor
                              ? `${currentPaper.primaryAuthor}${currentPaper.hasAdditionalAuthors ? " et al." : ""}`
                              : currentPaper.authors}
                          </p>
                        </div>
                        <p className="text-sm leading-relaxed text-white/60 line-clamp-4 font-light">
                          {currentPaper.abstract}
                        </p>
                        <div>
                          {currentPaper.arxiv_url ? (
                            <Button asChild variant="outline" className="w-full justify-center h-12 rounded-xl border-white/20 hover:bg-white/10 hover:text-white hover:border-white/40 transition-all">
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
                            <Button variant="outline" className="w-full justify-center h-12 rounded-xl" disabled>
                              <FileText className="mr-2 size-4" />
                              View on arXiv
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 text-center py-8">
                        <div className="size-14 rounded-full bg-white/5 mx-auto flex items-center justify-center">
                          <FileText className="size-6 text-white/30" />
                        </div>
                        <div className="space-y-2">
                          <p className="font-medium text-white">No paper selected</p>
                          <p className="text-sm text-white/50 max-w-[200px] mx-auto">
                            Select a paper from the Research Hub to start.
                          </p>
                        </div>
                        <Button variant="secondary" className="mt-2" onClick={() => router.push("/")}>
                          Go to Research Hub
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Session Controls Card */}
                <Card className="glass-panel border-white/10">
                  <CardHeader className="pb-4 border-b border-white/5">
                    <CardTitle className="flex items-center gap-3 text-white">
                      <div className="size-8 rounded-full bg-white/10 flex items-center justify-center">
                        <Mic className="size-4 text-white" />
                      </div>
                      Session Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {error && (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/90 font-medium">
                        <span className="block mb-1 text-xs uppercase tracking-wide opacity-50">Error</span>
                        {error}
                      </div>
                    )}
                    {!error && statusMessage && (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/90 font-medium animate-pulse">
                        {statusMessage}
                      </div>
                    )}

                    <div className="space-y-3">
                      <Button
                        onClick={startSession}
                        disabled={phase === "preparing" || phase === "live"}
                        size="lg"
                        className={cn(
                          "w-full justify-center h-14 rounded-2xl text-base font-semibold shadow-glass transition-all duration-300",
                          phase === "live" ? "opacity-50 cursor-not-allowed bg-white/10" : "bg-white text-black hover:scale-[1.02] hover:bg-gray-100"
                        )}
                      >
                        {phase === "preparing" ? (
                           <>
                             <span className="size-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2"></span>
                             Connecting...
                           </>
                        ) : (
                           <>
                             <Mic className="mr-2 size-5" />
                             Start Live Session
                           </>
                        )}
                      </Button>
                      <Button
                        onClick={stopSession}
                        disabled={phase !== "live"}
                        variant="destructive"
                        size="lg"
                        className={cn(
                           "w-full justify-center h-14 rounded-2xl text-base font-semibold transition-all border-white/10 hover:bg-white/10",
                           phase === "live" ? "opacity-100" : "opacity-50"
                        )}
                      >
                        <MicOff className="mr-2 size-5" />
                        End Session
                      </Button>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Button variant="ghost" className="w-full justify-start h-12 rounded-xl text-white/60 hover:text-white hover:bg-white/10" onClick={handleExportTranscript}>
                        <FileText className="mr-3 size-4" />
                        Export Transcript
                      </Button>
                      <Button variant="ghost" className="w-full justify-start h-12 rounded-xl text-white/60 hover:text-white hover:bg-white/10" onClick={handleDownloadAudio} disabled={!hasCapturedAudio}>
                        <Download className="mr-3 size-4" />
                        Download Audio Bundle
                      </Button>
                      <Button variant="ghost" className="w-full justify-start h-12 rounded-xl text-white/60 hover:text-white hover:bg-white/10" onClick={handleSendToVideoStudio}>
                        <Video className="mr-3 size-4" />
                        Send to Video Studio
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-white/5 p-5 space-y-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Radio className="size-4 text-white/80" />
                        Pro Tips
                      </p>
                      <ul className="space-y-2">
                        <li className="text-xs text-white/50 flex items-start gap-2 leading-relaxed">
                          <span className="block size-1 rounded-full bg-white/40 mt-1.5 shrink-0" />
                          Speak naturally. The AI is listening for context.
                        </li>
                        <li className="text-xs text-white/50 flex items-start gap-2 leading-relaxed">
                          <span className="block size-1 rounded-full bg-white/40 mt-1.5 shrink-0" />
                          The feed auto-scrolls to keep you in the flow.
                        </li>
                        <li className="text-xs text-white/50 flex items-start gap-2 leading-relaxed">
                          <span className="block size-1 rounded-full bg-white/40 mt-1.5 shrink-0" />
                          Don&apos;t forget to download your session assets.
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="xl:col-span-2 h-full min-h-[600px]">
                <Card className="h-full flex flex-col overflow-hidden glass-panel border-white/10 shadow-glass">
                  <CardHeader className="border-b border-white/5 bg-white/5 backdrop-blur-xl py-5 px-8">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-3 text-white">
                        <div className="size-8 rounded-full bg-white/10 flex items-center justify-center">
                          <Sparkles className="size-4 text-white" />
                        </div>
                        Live Feed
                      </CardTitle>
                      <div className="flex items-center gap-4">
                        {phase !== "idle" && (
                          <div className="flex items-center gap-3 text-sm font-mono bg-black/40 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
                            <div className={`size-2 rounded-full transition-all duration-500 ${phase === "live" ? 'bg-red-500 shadow-glow animate-pulse' : 'bg-yellow-500'}`} />
                            <span className="text-white font-medium tracking-wider">
                              {phase === "live" ? formatTime(sessionDuration) : "CONNECTING"}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs font-medium text-white/60 bg-black/40 px-4 py-2 rounded-full border border-white/5 shadow-inner">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-white" /> Host
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-white/40" /> Dr. Sarah
                          </div>
                          <div className="w-px h-3 bg-white/10 mx-1" />
                          <div className="flex items-center gap-2">
                            {phase === "live" ? (
                               <>
                                 {isAudioPlaying ? (
                                   <span className="flex gap-1">
                                      <span className="w-0.5 h-3 bg-white animate-music-bar-1"></span>
                                      <span className="w-0.5 h-3 bg-white animate-music-bar-2"></span>
                                      <span className="w-0.5 h-3 bg-white animate-music-bar-3"></span>
                                   </span>
                                 ) : (
                                   <span className="size-2 bg-white/20 rounded-full"></span>
                                 )}
                                 {isAudioPlaying ? "Speaking..." : "Listening"}
                               </>
                            ) : (
                               "Offline"
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col p-0 relative bg-gradient-to-b from-transparent to-black/40">
                    <ScrollArea ref={transcriptScrollRef} className="flex-1 px-8 py-8">
                      <div className="space-y-8 max-w-4xl mx-auto">
                        {entries.length === 0 && phase !== "live" && (
                          <div className="text-center py-40 space-y-8 opacity-0 animate-in fade-in zoom-in duration-1000 fill-mode-forwards">
                            <div className="size-32 rounded-full bg-gradient-to-br from-white/10 to-transparent mx-auto flex items-center justify-center shadow-glass border border-white/5">
                              <Brain className="size-16 text-white/20" />
                            </div>
                            <div className="space-y-3">
                              <h3 className="text-2xl font-semibold text-white">Ready to capture</h3>
                              <p className="text-white/40 max-w-sm mx-auto font-light text-lg">
                                Start the session and speak naturally. The transcript will appear here instantly.
                              </p>
                            </div>
                          </div>
                        )}

                        {entries.map((entry) => {
                          const isHost = entry.speaker === "host";
                          
                          // Monochrome message bubbles
                          const bubbleClass = isHost
                            ? "bg-white text-black rounded-[1.5rem] rounded-tr-sm shadow-glass-sm"
                            : "bg-white/10 border border-white/10 text-white rounded-[1.5rem] rounded-tl-sm backdrop-blur-md";

                          const containerClass = isHost ? "flex-row-reverse" : "flex-row";

                          const timestamp = new Date(entry.startedAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                          });

                          return (
                            <div key={entry.id} className={cn("flex items-end gap-4 group animate-in fade-in slide-in-from-bottom-4 duration-500", containerClass)}>
                              <div className={cn(
                                "size-10 rounded-full flex items-center justify-center shadow-sm shrink-0 mb-1 transition-transform hover:scale-110 duration-300",
                                isHost ? "bg-white text-black" : "bg-white/10 text-white border border-white/10"
                              )}>
                                {isHost ? <Headphones className="size-5" /> : <Sparkles className="size-5" />}
                              </div>

                              <div className={cn("flex flex-col max-w-[85%]", isHost ? "items-end" : "items-start")}>
                                <div className="flex items-center gap-3 mb-2 px-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <span className="text-xs font-bold tracking-wide uppercase">
                                    {isHost ? "You" : "Dr. Sarah"}
                                  </span>
                                  <span className="text-[10px] font-mono">
                                    {timestamp}
                                  </span>
                                </div>

                                <div className={cn("px-6 py-4 text-[15px] leading-7 shadow-sm", bubbleClass)}>
                                  <span>{entry.text || (entry.status === "streaming" ? "" : "")}</span>
                                  {entry.status === "streaming" && (
                                    <span className="inline-flex gap-1.5 ml-2 items-center align-middle">
                                      <span className="size-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                                      <span className="size-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                                      <span className="size-1.5 bg-current rounded-full animate-bounce" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {phase === "live" && (
                          <div className="flex justify-center py-8 sticky bottom-0 z-10 pointer-events-none">
                            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl px-6 py-3 text-sm font-medium text-white shadow-apple-floating animate-in slide-in-from-bottom-4 fade-in duration-300">
                              <div className="relative flex size-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-30"></span>
                                <span className="relative inline-flex rounded-full size-3 bg-white"></span>
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

                    <div className="border-t border-white/5 bg-black/20 backdrop-blur-md px-8 py-4 flex items-center justify-between text-xs font-medium text-white/50">
                      <div className="flex items-center gap-2">
                        <div className={cn("size-2 rounded-full transition-colors duration-500", isRecording ? "bg-white animate-pulse shadow-glow" : "bg-white/20")} />
                        {phase === "live"
                          ? isRecording
                            ? "Microphone Active"
                            : "Microphone Idle"
                          : "Session Idle"}
                      </div>
                      <div className="font-mono bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-white/80">
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
