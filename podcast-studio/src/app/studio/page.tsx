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
import { useApiConfig } from "@/contexts/api-config-context";
import {
  encodePcm16ChunksToWav,
  saveConversationToSession,
  type StoredConversation,
} from "@/lib/conversationStorage";
import { createZipArchive } from "@/lib/zip";
import {
  Brain,
  Download,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  Mic,
  MicOff,
  Pause,
  Play,
  Radio,
  Sparkles,
  Square,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserSettingsDialog } from "@/components/settings/user-settings-dialog";
import { useVisualAgent } from "@/hooks/useVisualAgent";
import { VisualCard } from "@/components/visual-agent/VisualCard";

interface SelectedPaper {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  arxiv_url?: string;
  primaryAuthor?: string;
  hasAdditionalAuthors?: boolean;
  formattedPublishedDate?: string;
  fullText?: string;
}

// --- Web Speech API Types ---
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

// Extend Window interface to support vendor-prefixed SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: { new(): SpeechRecognition };
    webkitSpeechRecognition?: { new(): SpeechRecognition };
  }
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

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const StudioPage: React.FC = () => {
  const { collapsed, toggleCollapsed } = useSidebar();
  const { apiKeys, videoProvider } = useApiConfig();
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
  const isAiInterruptedRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [visualAgentEnabled, setVisualAgentEnabled] = useState(true);

  // Visual Agent hook - analyzes conversation and generates visual explanations
  // Runs in PARALLEL with AI speaking for faster visual delivery
  // When visual is ready, injects context to AI so it can reference the visual
  const {
    visuals,
    isAnalyzing: isVisualAgentAnalyzing,
    isGenerating: isVisualAgentGenerating,
    analyzeTranscript: analyzeForVisuals,
    removeVisual,
    reset: resetVisualAgent,
  } = useVisualAgent({
    enabled: visualAgentEnabled && phase === "live",
    apiKey: apiKeys.openai, // OpenAI for analysis (always use OpenAI for text analysis)
    sessionId, // Pass sessionId so visual agent can inject context to AI
    minTranscriptLength: 200, // Analyze after 200 chars of AI text
    minSecondsBetweenVisuals: 45, // At most 1 visual per 45 seconds (cost control)
    onlyHighPriority: true, // Only generate for truly complex concepts (cost control)
    // Multi-provider video settings
    videoProvider, // User-selected video provider (Google Veo or OpenAI Sora)
    openaiApiKey: apiKeys.openai, // For Sora & DALL-E fallback
    googleApiKey: apiKeys.google, // For Veo
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const getAudioContext = useCallback(async () => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      return audioContextRef.current;
    }
    
    const AudioContextConstructor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
      throw new Error("Web Audio API is not supported in this browser.");
    }
    
    const ctx = new AudioContextConstructor({ sampleRate: 24000 });
    audioContextRef.current = ctx;
    return ctx;
  }, []);

  const mediaRecorderRef = useRef<{ stop: () => void } | null>(null);
  const aiAudioChunksRef = useRef<Uint8Array[]>([]);
  const hostAudioChunksRef = useRef<Uint8Array[]>([]);
  // Increased to support ~2.5 hours of conversation (2048 bytes per 42ms chunk -> ~85k chunks/hour)
  const MAX_AUDIO_CHUNKS = 250000;
  const hasCapturedAudioRef = useRef(false);
  const latestConversationRef = useRef<StoredConversation | null>(null);
  const aiPlaybackTimeRef = useRef(0);
  const aiPlaybackSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // SSE stream refs
  const audioStreamRef = useRef<EventSource | null>(null);
  const transcriptStreamRef = useRef<EventSource | null>(null);
  const userTranscriptStreamRef = useRef<EventSource | null>(null);

  const entrySequenceRef = useRef(0);
  const hostActiveIdRef = useRef<string | null>(null);
  const lastHostEntryIdRef = useRef<string | null>(null);
  const aiActiveIdRef = useRef<string | null>(null);
  const hostPendingRef = useRef("");
  const aiPendingRef = useRef("");
  const hostTypingIntervalRef = useRef<number | null>(null);
  const aiTypingIntervalRef = useRef<number | null>(null);

  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const [scrollTrigger, setScrollTrigger] = useState(0); // Increment to trigger scroll

  // Optimistic Transcription Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isUsingSpeechRecognitionRef = useRef(false);
  const localTranscriptBufferRef = useRef("");

  // --- Helpers for Transcript Management ---

  const stopTypingInterval = useCallback((speaker: Speaker) => {
    const ref = speaker === "host" ? hostTypingIntervalRef : aiTypingIntervalRef;
    if (ref.current != null) {
      window.clearInterval(ref.current);
      ref.current = null;
    }
  }, []);

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
    // Trigger scroll on every text update
    setScrollTrigger((prev) => prev + 1);
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
      lastHostEntryIdRef.current = id;
    } else {
      aiActiveIdRef.current = id;
    }
    return id;
  }, []);

  const finalizeSegment = useCallback(
    (speaker: Speaker, finalText?: string) => {
      const pendingRef = speaker === "host" ? hostPendingRef : aiPendingRef;
      const activeRef = speaker === "host" ? hostActiveIdRef : aiActiveIdRef;

      // 1. Identify the target ID
      let targetId = activeRef.current;

      // If no active segment, try to rescue the last one (for Host) to fix race conditions where
      // AI interruption closed the bubble before transcript arrived.
      if (!targetId && speaker === "host" && lastHostEntryIdRef.current) {
         targetId = lastHostEntryIdRef.current;
      }

      // If still no target ID...
      if (!targetId) {
         // If we have nothing to write, just bail
         if (!finalText && !pendingRef.current) {
            if (speaker === "host") setIsHostSpeaking(false);
            else setIsAiSpeaking(false);
            return;
         }
         // Otherwise, create a new segment to hold the content
         targetId = startSegment(speaker);
         if (speaker === "host") {
            hostActiveIdRef.current = targetId;
            lastHostEntryIdRef.current = targetId;
            setIsHostSpeaking(true);
         } else {
            aiActiveIdRef.current = targetId;
            setIsAiSpeaking(true);
         }
      }

      // 2. Apply updates to targetId
      if (pendingRef.current) {
        const chunk = pendingRef.current;
        pendingRef.current = "";
        updateEntryText(targetId, (value) => value + chunk);
      }

      if (typeof finalText === "string") {
        // If it's a complete transcript, replace the text (usually empty or partial)
        updateEntryText(targetId, () => finalText);
      }

      // 3. Mark final
      markEntryFinal(targetId);
      
      // 4. Cleanup refs
      if (activeRef.current === targetId) {
        activeRef.current = null;
      }
      pendingRef.current = "";
      stopTypingInterval(speaker);

      if (speaker === "host") {
        setIsHostSpeaking(false);
        // Important: When server finalizes host segment, reset our local optimistic buffer
        // so the next segment starts fresh.
        localTranscriptBufferRef.current = "";
        
        // Restarting recognition ensures we clear any stuck 'interim' state
        if (isUsingSpeechRecognitionRef.current && recognitionRef.current) {
           try {
              recognitionRef.current.abort();
              // onend handler will restart it
           } catch {}
        }

      } else {
        setIsAiSpeaking(false);
      }
    },
    [startSegment, markEntryFinal, stopTypingInterval, updateEntryText],
  );

  const ensureSegment = useCallback((speaker: Speaker) => {
    // Turn-taking logic: If the OTHER speaker is active, finalize them to ensure chronological flow
    if (speaker === "host" && aiActiveIdRef.current) {
      finalizeSegment("ai");
    } else if (speaker === "ai" && hostActiveIdRef.current) {
      finalizeSegment("host");
    }

    if (speaker === "host") {
      if (!hostActiveIdRef.current) {
        const id = startSegment("host");
        setIsHostSpeaking(true);
        // Reset local buffer when starting a new host segment
        localTranscriptBufferRef.current = "";
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
  }, [startSegment, finalizeSegment]);

  const startSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log("[INFO] Web Speech API not supported in this browser");
      return;
    }

    // Cleanup existing
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Echo Cancellation for Visuals:
        // If the AI is currently playing audio, ignore local recognition results.
        // This prevents the "visual echo" where the AI's voice is transcribed as the user's text.
        if (aiPlaybackSourcesRef.current.length > 0) {
          return;
        }

        let interimTranscript = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // If we have a final chunk, commit it to our local buffer
        if (finalChunk) {
           localTranscriptBufferRef.current += finalChunk + " ";
        }

        const display = (localTranscriptBufferRef.current + interimTranscript).trim();

        if (display) {
          // Immediately update the UI
          const activeId = ensureSegment("host");
          updateEntryText(activeId, () => display);
        }
      };

      recognition.onerror = (event: Event & { error?: string }) => {
        // Benign errors like 'no-speech' happen often
        if (event.error !== 'no-speech') {
           console.warn("[WARN] Speech recognition error:", event.error);
        }
      };

      // Auto-restart if it stops unexpectedly while we are 'live'
      recognition.onend = () => {
         if (phaseRef.current === "live" && isUsingSpeechRecognitionRef.current) {
            try {
               recognition.start();
            } catch { /* ignore */ }
         }
      };

      recognition.start();
      recognitionRef.current = recognition;
      isUsingSpeechRecognitionRef.current = true;
      localTranscriptBufferRef.current = ""; // Reset buffer on fresh start
      console.log("[INFO] Optimistic speech recognition started");

    } catch (e) {
      console.error("[ERROR] Failed to start speech recognition", e);
      isUsingSpeechRecognitionRef.current = false;
    }
  }, [ensureSegment, updateEntryText]);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    isUsingSpeechRecognitionRef.current = false;
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
      
      // HOST: Direct update (no typing effect) to reduce latency
      if (speaker === "host") {
        // If host is active, update active
        if (hostActiveIdRef.current) {
          updateEntryText(hostActiveIdRef.current, (value) => value + delta);
          return;
        }
        // If no active host segment, but we have a recent one (e.g. finalized by AI interruption), append to it
        if (lastHostEntryIdRef.current) {
           updateEntryText(lastHostEntryIdRef.current, (value) => value + delta);
           return;
        }
        // Fallback: ensure new segment
        const activeId = ensureSegment("host");
        updateEntryText(activeId, (value) => value + delta);
        return;
      }

      // AI: Use typing effect for smoother reading
      ensureSegment(speaker);
      const pendingRef = aiPendingRef;
      pendingRef.current += delta;
      ensureTypingInterval(speaker);
      drainPending(speaker, false);
    },
    [drainPending, ensureSegment, ensureTypingInterval, updateEntryText],
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
    isAiInterruptedRef.current = false; // Reset interrupt flag on new session
    aiPendingRef.current = "";
    stopTypingInterval("host");
    stopTypingInterval("ai");
    setIsHostSpeaking(false);
    setIsAiSpeaking(false);
    setIsMuted(false); // Reset mute state on new session
    setIsPaused(false); // Reset pause state on new session
    setEntries([]);
    entrySequenceRef.current = 0;
    resetVisualAgent(); // Reset visual agent on new session
  }, [stopTypingInterval, resetVisualAgent]);

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
      if (chunk.length === 0 || isAiInterruptedRef.current) {
        console.log("[DEBUG] Skipping audio chunk - empty or interrupted");
        return;
      }

      if (typeof window === "undefined") {
        return;
      }

      let context: AudioContext;
      try {
        context = await getAudioContext();
        console.log("[DEBUG] Got audio context, state:", context.state);
      } catch (e) {
        console.warn("[WARN] Failed to get audio context for playback", e);
        return;
      }

      const frameCount = Math.floor(chunk.length / 2);
      if (frameCount <= 0) {
        console.log("[DEBUG] Skipping audio chunk - no frames");
        return;
      }

      console.log("[DEBUG] Playing audio chunk:", chunk.length, "bytes,", frameCount, "frames");

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
      console.log("[DEBUG] Audio scheduled at:", startAt, "duration:", audioBuffer.duration);

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
    [getAudioContext],
  );

  // --- SSE Stream Setup ---

  const setupSseStreams = useCallback(() => {
    // Audio stream
    const audioSource = new EventSource(`/api/rt/audio?sessionId=${sessionId}`);
    audioStreamRef.current = audioSource;

    audioSource.onmessage = (event) => {
      if (event.data) {
        try {
          console.log("[DEBUG] Received SSE audio data, length:", event.data.length);
          const bytes = base64ToUint8Array(event.data);
          console.log("[DEBUG] Decoded audio bytes:", bytes.length);
          
      // Reset interrupt flag when we receive audio - the AI is actively responding
      if (isAiInterruptedRef.current) {
        console.log("[DEBUG] Resetting interrupt flag - AI is responding with audio");
        isAiInterruptedRef.current = false;
      }
      
      if (aiAudioChunksRef.current.length < MAX_AUDIO_CHUNKS) {
        aiAudioChunksRef.current.push(bytes);
      }
      
      // Ensure context is running before playing
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch(e => console.warn("[WARN] Failed to resume audio context on chunk", e));
      }
      
      void playAiAudioChunk(bytes);
      setIsAiSpeaking(true);
        } catch (e) {
          console.error("[ERROR] Failed to process AI audio delta", e);
        }
      }
    };

    audioSource.onerror = () => {
      if (phaseRef.current === "live") {
        console.warn("[WARN] Audio stream error");
      }
    };

    // AI transcript stream
    const transcriptSource = new EventSource(`/api/rt/transcripts?sessionId=${sessionId}`);
    transcriptStreamRef.current = transcriptSource;

    transcriptSource.addEventListener("start", () => {
       // New turn started by AI (response.created equivalent)
       console.log("[DEBUG] AI response started - resetting interrupt flag");
       isAiInterruptedRef.current = false;
    });

    transcriptSource.onmessage = (event) => {
      if (event.data) {
        handleAiTranscriptDelta(event.data);
      }
    };

    transcriptSource.addEventListener("done", () => {
      finalizeSegment("ai");
    });

    transcriptSource.onerror = () => {
      if (phaseRef.current === "live") {
        console.warn("[WARN] Transcript stream error");
      }
    };

    // User transcript stream
    const userTranscriptSource = new EventSource(`/api/rt/user-transcripts?sessionId=${sessionId}`);
    userTranscriptStreamRef.current = userTranscriptSource;

    userTranscriptSource.addEventListener("complete", (event: MessageEvent) => {
      if (event.data) {
        handleUserTranscriptionComplete(event.data);
      }
    });

    userTranscriptSource.addEventListener("delta", (event: MessageEvent) => {
      // If we are using optimistic local transcription, ignore server deltas to prevent
      // fighting/duplication. We only accept the 'complete' event to overwrite.
      if (event.data && !isUsingSpeechRecognitionRef.current) {
        appendToSegment("host", event.data);
      }
    });

    userTranscriptSource.addEventListener("speech-started", () => {
      setIsHostSpeaking(true);
      isAiInterruptedRef.current = true; // Mark interruption active
      ensureSegment("host");
      
      // INTERRUPTION FIX: Stop all AI audio immediately when user starts speaking.
      // This handles the client-side "barge-in" so we don't hear the AI talk over us.
      if (audioContextRef.current) {
        const currentTime = audioContextRef.current.currentTime;
        aiPlaybackSourcesRef.current.forEach((source) => {
          try {
            source.stop();
          } catch { /* ignore if already stopped */ }
        });
        aiPlaybackSourcesRef.current = [];
        // Reset playback time so next chunk starts fresh
        aiPlaybackTimeRef.current = currentTime;
        setIsAudioPlaying(false);
        setIsAiSpeaking(false);
      }
    });

    userTranscriptSource.addEventListener("speech-stopped", () => {
      setIsHostSpeaking(false);
      // We don't reset isAiInterruptedRef here immediately; 
      // we wait for the AI to start a new response turn.
    });

    userTranscriptSource.onerror = () => {
      if (phaseRef.current === "live") {
        console.warn("[WARN] User transcript stream error");
      }
    };
  }, [sessionId, base64ToUint8Array, playAiAudioChunk, handleAiTranscriptDelta, finalizeSegment, handleUserTranscriptionComplete, appendToSegment, ensureSegment]);

  const closeSseStreams = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.close();
      audioStreamRef.current = null;
    }
    if (transcriptStreamRef.current) {
      transcriptStreamRef.current.close();
      transcriptStreamRef.current = null;
    }
    if (userTranscriptStreamRef.current) {
      userTranscriptStreamRef.current.close();
      userTranscriptStreamRef.current = null;
    }
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
    const fetchPaperContext = async () => {
      // If no paper, or no URL, or text already loaded, skip
      if (!currentPaper?.arxiv_url || currentPaper.fullText || isContextLoading) {
        return;
      }

      setIsContextLoading(true);
      try {
        console.log("[INFO] Prefetching paper full text...");
        const res = await fetch("/api/papers/fetch-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arxivUrl: currentPaper.arxiv_url }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            setCurrentPaper((prev) => (prev ? { ...prev, fullText: data.text } : null));
            console.log("[INFO] Paper text loaded successfully.");
          } else {
             console.warn("[WARN] Paper text response was empty (likely processing failed gracefully)");
          }
        } else {
          // Gracefully handle 4xx/5xx by just logging and letting the user proceed without text
          console.warn("[WARN] Failed to prefetch paper text:", res.status);
        }
      } catch (err) {
        console.error("[ERROR] Failed to fetch paper context", err);
      } finally {
        setIsContextLoading(false);
      }
    };

    if (currentPaper?.id) {
      fetchPaperContext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPaperContext checks these internally to avoid re-fetching
  }, [currentPaper?.id, currentPaper?.arxiv_url]);

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

    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      const root = transcriptScrollRef.current;
      if (!root) {
        return;
      }
      
      // Find the ScrollArea viewport (Radix UI component)
      const viewport = root.querySelector<HTMLDivElement>('[data-slot="scroll-area-viewport"]');
      if (!viewport) {
        return;
      }

      // Scroll to the very bottom - use instant scroll for real-time updates
      // This ensures the latest message is always visible within the Live Feed component
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      if (maxScroll > 0) {
        viewport.scrollTop = maxScroll;
      }
    });
  }, []);

  useEffect(() => {
    // Scroll immediately
    scrollToLatest();
    // Also scroll after a short delay to catch any late DOM updates
    const timeoutId = setTimeout(scrollToLatest, 100);
    return () => clearTimeout(timeoutId);
  }, [entries, isHostSpeaking, isAiSpeaking, scrollTrigger, scrollToLatest]);

  // Visual Agent: Analyze transcript in real-time as AI generates text
  // This runs in PARALLEL with the AI speaking, so visuals are ready faster
  const lastAnalyzedAiTextRef = useRef<string>("");
  
  useEffect(() => {
    if (!visualAgentEnabled || phase !== "live") return;

    // Get the current AI message being streamed (or most recent final)
    const aiEntries = entries.filter((e) => e.speaker === "ai");
    const currentAiEntry = aiEntries.slice(-1)[0];

    if (!currentAiEntry || !currentAiEntry.text) return;

    const currentText = currentAiEntry.text;
    
    // Only analyze if we have enough new content (at least 100 more chars)
    if (currentText.length - lastAnalyzedAiTextRef.current.length < 100) {
      return;
    }

    // Analyze when we have a substantial chunk of text
    // This happens WHILE the AI is still speaking
    if (currentText.length >= 200) {
      lastAnalyzedAiTextRef.current = currentText;
      const isStillStreaming = currentAiEntry.status === "streaming";

      // Find the user's question that prompted this AI response
      // Look for the most recent host entry before this AI entry
      const currentAiIndex = entries.findIndex((e) => e.id === currentAiEntry.id);
      const hostEntries = entries.slice(0, currentAiIndex).filter((e) => e.speaker === "host");
      const userQuestion = hostEntries.slice(-1)[0]?.text || "";

      // Build conversation history from recent entries
      const recentEntries = entries.slice(-6); // Last 3 exchanges
      const conversationHistory = recentEntries
        .map((e) => `${e.speaker === "host" ? "User" : "AI"}: ${e.text.slice(0, 200)}`)
        .join("\n");

      // Pass full context to the visual agent
      analyzeForVisuals(
        {
          userQuestion,
          aiResponse: currentText,
          conversationHistory,
          paperTitle: currentPaper?.title,
          paperTopic: currentPaper?.abstract?.slice(0, 200),
        },
        isStillStreaming
      );
    }
  }, [entries, phase, visualAgentEnabled, analyzeForVisuals, currentPaper]);

  // Reset the analysis ref when conversation resets
  useEffect(() => {
    if (entries.length === 0) {
      lastAnalyzedAiTextRef.current = "";
    }
  }, [entries.length]);

  const stopMicrophonePipeline = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    stopSpeechRecognition();
    setIsRecording(false);
    mediaStreamRef.current = null;
  }, [stopSpeechRecognition]);

  const toggleMute = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (!stream) {
      console.log("[WARN] No media stream available to mute");
      return;
    }
    
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      // Toggle: if currently enabled (not muted), disable it (mute)
      const willBeMuted = audioTrack.enabled;
      audioTrack.enabled = !willBeMuted;
      setIsMuted(willBeMuted);
      
      // Also stop/start speech recognition to prevent transcript from appearing
      if (willBeMuted) {
        // Muting - stop speech recognition
        stopSpeechRecognition();
        setIsHostSpeaking(false);
      } else {
        // Unmuting - restart speech recognition
        startSpeechRecognition();
      }
      
      console.log(`[INFO] Microphone ${willBeMuted ? 'muted' : 'unmuted'}, track.enabled=${audioTrack.enabled}`);
    } else {
      console.log("[WARN] No audio track found in stream");
    }
  }, [startSpeechRecognition, stopSpeechRecognition]);

  const togglePause = useCallback(() => {
    if (phase !== "live") {
      console.log("[WARN] Cannot pause - session not live");
      return;
    }

    const stream = mediaStreamRef.current;
    
    if (isPaused) {
      // Resume session
      console.log("[INFO] Resuming session...");
      
      // Re-enable audio track
      if (stream) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;
        }
      }
      
      // Restart speech recognition
      startSpeechRecognition();
      
      // Resume audio context if suspended
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      setIsPaused(false);
      setIsMuted(false);
      setStatusMessage("Session resumed");
      
      // Clear status after 2 seconds
      setTimeout(() => setStatusMessage(null), 2000);
    } else {
      // Pause session
      console.log("[INFO] Pausing session...");
      
      // Disable audio track (stop sending audio)
      if (stream) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = false;
        }
      }
      
      // Stop speech recognition
      stopSpeechRecognition();
      setIsHostSpeaking(false);
      
      // Suspend audio context to stop playback
      if (audioContextRef.current?.state === 'running') {
        audioContextRef.current.suspend();
      }
      
      setIsPaused(true);
      setIsMuted(true);
      setStatusMessage("Session paused");
    }
  }, [phase, isPaused, startSpeechRecognition, stopSpeechRecognition]);

  const startMicrophonePipeline = useCallback(async () => {
    try {
      startSpeechRecognition();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true, // Helps normalize volume levels and prevent feedback loops
        },
      });

      // Store the stream reference for muting
      mediaStreamRef.current = stream;
      
      const audioContext = await getAudioContext();

      const source = audioContext.createMediaStreamSource(stream);
      const scriptProcessor = audioContext.createScriptProcessor(1024, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      // Capture mic and send to API
      const bufferAccumulator: Uint8Array[] = [];
      let bufferSize = 0;
      // Accumulate roughly 100ms of audio (24000 * 0.1 = 2400 samples)
      // 1024 * 3 = 3072 samples (~128ms)
      const SEND_THRESHOLD_BYTES = 1024 * 2 * 3; 

      scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        
        const pcm16Buffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcm16Buffer[i] = Math.round(sample * 32767);
        }
        const uint8Array = new Uint8Array(pcm16Buffer.buffer);
        
        // Store for saving (even when muted, for complete recording)
        if (hostAudioChunksRef.current.length < MAX_AUDIO_CHUNKS) {
          hostAudioChunksRef.current.push(new Uint8Array(uint8Array));
        }

        // Accumulate for API
        bufferAccumulator.push(uint8Array);
        bufferSize += uint8Array.length;

        if (bufferSize >= SEND_THRESHOLD_BYTES) {
          const combined = new Uint8Array(bufferSize);
          let offset = 0;
          for (const buf of bufferAccumulator) {
            combined.set(buf, offset);
            offset += buf.length;
          }
          
          // Reset buffer
          bufferAccumulator.length = 0;
          bufferSize = 0;

          // Only send to API if not muted
          // Check the stream tracks to see if muted (more reliable than state)
          const track = mediaStreamRef.current?.getAudioTracks()[0];
          if (track && track.enabled) {
            const base64 = uint8ArrayToBase64(combined);
            fetch('/api/rt/audio-append', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ base64, sessionId }),
            }).catch((err) => {
              console.error("[ERROR] Failed to send audio chunk:", err);
            });
          }
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
      setIsRecording(true);
      return true;
    } catch (error) {
      console.error("[ERROR] Failed to access microphone:", error);
      setStatusMessage(null);
      setError("Failed to access microphone. Please check permissions.");
      return false;
    }
  }, [sessionId, uint8ArrayToBase64, startSpeechRecognition, getAudioContext]);

  const teardownRealtime = useCallback(async () => {
    stopMicrophonePipeline();
    closeSseStreams();

    // Stop the session on the server
    try {
      await fetch('/api/rt/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch (e) {
      console.error("[ERROR] Failed to stop session:", e);
    }

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
  }, [sessionId, stopMicrophonePipeline, closeSseStreams]);

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
    setStatusMessage("Preparing realtime session…");
    setError(null);
    setSessionDuration(0);
    hostAudioChunksRef.current = [];
    aiAudioChunksRef.current = [];
    latestConversationRef.current = null;
    hasCapturedAudioRef.current = false;
    setHasCapturedAudio(false);
    setIsAudioPlaying(false);
    aiPlaybackSourcesRef.current = [];
    aiPlaybackTimeRef.current = 0;

    try {
      // Realtime voice conversations ONLY support OpenAI - always use OpenAI
      // (Video generation uses the separate videoProvider setting)
      const realtimeProvider = "openai" as const;
      const apiKey = apiKeys.openai;
      if (!apiKey) {
        setIsApiKeyMissing(true);
        setError("Please add your OpenAI API key in Settings. (Required for voice conversations)");
        return;
      }
      setIsApiKeyMissing(false);

      // Start the session via API
      console.log("[DEBUG] Starting session with paper:", {
        title: currentPaper?.title,
        hasFullText: !!currentPaper?.fullText,
        fullTextLength: currentPaper?.fullText?.length ?? 0,
        hasAbstract: !!currentPaper?.abstract,
      });
      
      const startTime = performance.now();
      const response = await fetch('/api/rt/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          provider: realtimeProvider,
          apiKey,
          paper: currentPaper,
        }),
      });
      
      const elapsed = Math.round(performance.now() - startTime);
      console.log(`[DEBUG] /api/rt/start responded in ${elapsed}ms with status ${response.status}`);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start session');
      }

      // Set up SSE streams
      setupSseStreams();

      // Start microphone
      const micStarted = await startMicrophonePipeline();
      if (!micStarted) {
        closeSseStreams();
        setPhase("idle");
        setError("Failed to access microphone.");
        return;
      }

      setPhase("live");
      setStatusMessage("Live recording started.");
      isSessionActiveRef.current = true;

    } catch (err) {
      console.error("[ERROR] Failed to start session:", err);
      setError(err instanceof Error ? err.message : "Failed to connect to the realtime server.");
      setPhase("idle");
      closeSseStreams();
    }
  }, [phase, resetConversation, sessionId, currentPaper, setupSseStreams, startMicrophonePipeline, closeSseStreams, apiKeys]);

  const stopSession = useCallback(async () => {
    if (phase === "idle" || phase === "stopping") {
      return;
    }

    setPhase("stopping");
    setStatusMessage("Wrapping up session…");
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

  // Clear API key missing error when OpenAI API key is added (required for realtime)
  useEffect(() => {
    if (isApiKeyMissing && apiKeys.openai) {
      setIsApiKeyMissing(false);
      setError(null);
    }
  }, [apiKeys.openai, isApiKeyMissing]);

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
    <div className="h-screen bg-black text-white overflow-hidden">
      <div className="flex h-full">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          isLiveRecording={phase === "live"}
        />

        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <main id="main-content" tabIndex={-1} className="flex-1 p-4 md:p-6 lg:p-8 overflow-hidden flex flex-col min-h-0">
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 flex-1 min-h-0">
              <div className="lg:col-span-3 xl:col-span-3 2xl:col-span-2 space-y-4 md:space-y-6 overflow-y-auto max-h-full">
                {/* Current Paper Card */}
                <Card className="glass-panel border-white/10">
                  <CardHeader className="pb-3 md:pb-4 border-b border-white/5">
                    <CardTitle className="flex items-center gap-2 md:gap-3 text-white text-sm md:text-base">
                      <div className="size-6 md:size-8 rounded-full bg-white/10 flex items-center justify-center">
                        <FileText className="size-3 md:size-4 text-white" />
                      </div>
                      Current Paper
                    </CardTitle>
                    {isContextLoading && (
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-white/50 animate-pulse">
                        <span className="size-1.5 md:size-2 rounded-full bg-white/50" />
                        Loading context…
                      </div>
                    )}
                    {currentPaper?.fullText && !isContextLoading && (
                      <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs text-green-400/80 font-medium bg-green-900/20 px-2 py-1 rounded-full border border-green-900/30">
                        <span className="size-1.5 rounded-full bg-green-500 shadow-glow-green" />
                        Context Ready
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="pt-4 md:pt-6 space-y-4 md:space-y-6">
                    {paperLoadError ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:p-4 text-white text-xs md:text-sm font-medium">
                        {paperLoadError}
                      </div>
                    ) : currentPaper ? (
                      <div className="space-y-4 md:space-y-6">
                        <div className="space-y-2 md:space-y-3">
                          <h3 className="font-semibold text-base md:text-xl text-white leading-tight">
                            {currentPaper.title}
                          </h3>
                          <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-white/50 uppercase tracking-wider">
                            <span className="bg-white/10 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md text-white">
                              Published {currentPaper.formattedPublishedDate ?? "Unknown"}
                            </span>
                          </div>
                          <p className="text-xs md:text-sm text-white/70 font-medium">
                            {currentPaper.primaryAuthor
                              ? `${currentPaper.primaryAuthor}${currentPaper.hasAdditionalAuthors ? " et al." : ""}`
                              : currentPaper.authors}
                          </p>
                        </div>
                        <p className="text-xs md:text-sm leading-relaxed text-white/60 line-clamp-3 md:line-clamp-4 font-light">
                          {currentPaper.abstract}
                        </p>
                        <div>
                          {currentPaper.arxiv_url ? (
                            <Button asChild variant="outline" className="w-full justify-center h-10 md:h-12 rounded-xl text-xs md:text-sm border-white/20 hover:bg-white/10 hover:text-white hover:border-white/40 transition-all">
                              <a
                                href={currentPaper.arxiv_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="mr-2 size-3.5 md:size-4" />
                                View on arXiv
                              </a>
                            </Button>
                          ) : (
                            <Button variant="outline" className="w-full justify-center h-10 md:h-12 rounded-xl text-xs md:text-sm" disabled>
                              <FileText className="mr-2 size-3.5 md:size-4" />
                              View on arXiv
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 md:space-y-4 text-center py-6 md:py-8">
                        <div className="size-12 md:size-14 rounded-full bg-white/5 mx-auto flex items-center justify-center">
                          <FileText className="size-5 md:size-6 text-white/30" />
                        </div>
                        <div className="space-y-1.5 md:space-y-2">
                          <p className="font-medium text-sm md:text-base text-white">No paper selected</p>
                          <p className="text-xs md:text-sm text-white/50 max-w-[180px] md:max-w-[200px] mx-auto">
                            Select a paper from the Research Hub to start.
                          </p>
                        </div>
                        <Button variant="secondary" className="mt-2 text-xs md:text-sm h-9 md:h-10" onClick={() => router.push("/")}>
                          Go to Research Hub
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Session Controls Card */}
                <Card className="glass-panel border-white/10">
                  <CardHeader className="pb-3 md:pb-4 border-b border-white/5">
                    <CardTitle className="flex items-center gap-2 md:gap-3 text-white text-sm md:text-base">
                      <div className="size-6 md:size-8 rounded-full bg-white/10 flex items-center justify-center">
                        <Mic className="size-3 md:size-4 text-white" />
                      </div>
                      Session Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 md:pt-6 space-y-4 md:space-y-6">
                    {error && (
                      <div className="rounded-lg md:rounded-xl border border-white/10 bg-white/5 p-3 md:p-4 space-y-2 md:space-y-3">
                        <div className="text-xs md:text-sm text-white/90 font-medium">
                          <span className="block mb-1 text-[10px] md:text-xs uppercase tracking-wide opacity-50">Error</span>
                          {error}
                        </div>
                        {isApiKeyMissing && (
                          <Button
                            onClick={() => setSettingsOpen(true)}
                            className="w-full bg-white text-black hover:bg-gray-200 rounded-lg md:rounded-xl h-9 md:h-10 text-xs md:text-sm font-medium"
                          >
                            Open Settings
                          </Button>
                        )}
                      </div>
                    )}
                    {!error && statusMessage && (
                      <div className="rounded-lg md:rounded-xl border border-white/10 bg-white/5 p-3 md:p-4 text-xs md:text-sm text-white/90 font-medium animate-pulse">
                        {statusMessage}
                      </div>
                    )}

                    <div className="space-y-2 md:space-y-3">
                      <Button
                        onClick={startSession}
                        disabled={phase === "preparing" || phase === "live" || isContextLoading}
                        size="lg"
                        className={cn(
                          "w-full justify-center h-12 md:h-14 rounded-2xl text-sm md:text-base font-semibold transition-all duration-300",
                          phase === "preparing"
                            ? "bg-blue-500/20 border border-blue-500/50 text-blue-400"
                            : isContextLoading
                              ? "opacity-40 cursor-not-allowed bg-white/5 text-white/50 border border-white/10"
                              : phase === "live"
                                ? "opacity-30 cursor-not-allowed bg-white/5 text-white/50 border border-white/10"
                                : "bg-white text-black hover:scale-[1.02] hover:bg-gray-100 shadow-glass"
                        )}
                      >
                        {phase === "preparing" ? (
                          <>
                            <span className="size-4 md:size-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mr-2" />
                            Connecting…
                          </>
                        ) : isContextLoading ? (
                          <>
                            <span className="size-4 md:size-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            Loading Context…
                          </>
                        ) : (
                          <>
                            <Mic className="mr-2 size-4 md:size-5" />
                            Start Session
                          </>
                        )}
                      </Button>
                      
                      {/* Pause/Resume Button */}
                      <Button
                        onClick={togglePause}
                        disabled={phase !== "live"}
                        size="lg"
                        className={cn(
                          "w-full justify-center h-12 md:h-14 rounded-2xl text-sm md:text-base font-semibold transition-all duration-300",
                          phase !== "live" 
                            ? "opacity-30 cursor-not-allowed bg-white/5 text-white/50 border border-white/10" 
                            : isPaused 
                              ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30" 
                              : "bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30"
                        )}
                      >
                        {isPaused ? (
                          <>
                            <Play className="mr-2 size-4 md:size-5" />
                            Resume Session
                          </>
                        ) : (
                          <>
                            <Pause className="mr-2 size-4 md:size-5" />
                            Pause Session
                          </>
                        )}
                      </Button>
                      
                      {/* End Session Button */}
                      <Button
                        onClick={stopSession}
                        disabled={phase !== "live"}
                        size="lg"
                        className={cn(
                          "w-full justify-center h-12 md:h-14 rounded-2xl text-sm md:text-base font-semibold transition-all duration-300",
                          phase !== "live"
                            ? "opacity-30 cursor-not-allowed bg-white/5 text-white/50 border border-white/10"
                            : "bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30"
                        )}
                      >
                        <Square className="mr-2 size-4 md:size-5 fill-current" />
                        End Session
                      </Button>
                    </div>

                    <div className="space-y-1.5 md:space-y-2 pt-2">
                      <Button variant="ghost" className="w-full justify-start h-10 md:h-12 rounded-xl text-xs md:text-sm text-white/60 hover:text-white hover:bg-white/10" onClick={handleExportTranscript}>
                        <FileText className="mr-2 md:mr-3 size-3.5 md:size-4" />
                        Export Transcript
                      </Button>
                      <Button variant="ghost" className="w-full justify-start h-10 md:h-12 rounded-xl text-xs md:text-sm text-white/60 hover:text-white hover:bg-white/10" onClick={handleDownloadAudio} disabled={!hasCapturedAudio}>
                        <Download className="mr-2 md:mr-3 size-3.5 md:size-4" />
                        Download Audio
                      </Button>
                      <Button variant="ghost" className="w-full justify-start h-10 md:h-12 rounded-xl text-xs md:text-sm text-white/60 hover:text-white hover:bg-white/10" onClick={handleSendToVideoStudio}>
                        <Video className="mr-2 md:mr-3 size-3.5 md:size-4" />
                        Send to Video Studio
                      </Button>
                    </div>

                    <div className="rounded-xl md:rounded-2xl border border-white/5 bg-white/5 p-3 md:p-5 space-y-2 md:space-y-3">
                      <p className="flex items-center gap-2 text-xs md:text-sm font-semibold text-white">
                        <Radio className="size-3.5 md:size-4 text-white/80" />
                        Pro Tips
                      </p>
                      <ul className="space-y-1.5 md:space-y-2">
                        <li className="text-[10px] md:text-xs text-white/50 flex items-start gap-2 leading-relaxed">
                          <span className="block size-1 rounded-full bg-white/40 mt-1.5 shrink-0" />
                          Speak naturally. The AI listens for context.
                        </li>
                        <li className="text-[10px] md:text-xs text-white/50 flex items-start gap-2 leading-relaxed">
                          <span className="block size-1 rounded-full bg-white/40 mt-1.5 shrink-0" />
                          Feed auto-scrolls to keep you in flow.
                        </li>
                        <li className="text-[10px] md:text-xs text-white/50 flex items-start gap-2 leading-relaxed">
                          <span className="block size-1 rounded-full bg-white/40 mt-1.5 shrink-0" />
                          Don&apos;t forget to download your session assets.
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-9 xl:col-span-9 2xl:col-span-10 min-h-0 flex flex-col">
                <Card className="flex-1 flex flex-col overflow-hidden glass-panel border-white/10 shadow-glass min-h-0">
                  <CardHeader className="border-b border-white/5 bg-white/5 backdrop-blur-xl py-4 px-4 md:px-6 lg:px-8 shrink-0">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <CardTitle className="flex items-center gap-2 md:gap-3 text-white">
                        <div className="size-7 md:size-8 rounded-full bg-white/10 flex items-center justify-center">
                          <Sparkles className="size-4" />
                        </div>
                        <span className="text-base md:text-lg">Live Feed</span>
                      </CardTitle>
                      <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                        {phase !== "idle" && (
                          <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm font-mono bg-black/40 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-white/5 shadow-inner">
                            <div className={`size-2 rounded-full transition-all duration-500 ${phase === "live" ? 'bg-red-500 shadow-glow animate-pulse' : 'bg-yellow-500'}`} />
                            <span className="text-white font-medium tracking-wider">
                              {phase === "live" ? formatTime(sessionDuration) : "CONNECTING"}
                            </span>
                          </div>
                        )}
                        {phase === "live" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={toggleMute}
                              className={cn(
                                "rounded-full size-10 p-0 transition-all duration-300",
                                isMuted 
                                  ? "bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30" 
                                  : "bg-white/10 border border-white/10 text-white hover:bg-white/20"
                              )}
                              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                            >
                              {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setVisualAgentEnabled(!visualAgentEnabled)}
                              className={cn(
                                "rounded-full size-10 p-0 transition-all duration-300",
                                visualAgentEnabled 
                                  ? "bg-purple-500/20 border border-purple-500/50 text-purple-400 hover:bg-purple-500/30" 
                                  : "bg-white/10 border border-white/10 text-white/50 hover:bg-white/20"
                              )}
                              aria-label={visualAgentEnabled ? "Disable visual agent" : "Enable visual agent"}
                              title={visualAgentEnabled ? "Visual Agent: ON" : "Visual Agent: OFF"}
                            >
                              {visualAgentEnabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                            </Button>
                          </>
                        )}
                        <div className="hidden md:flex items-center gap-3 lg:gap-4 text-xs font-medium text-white/60 bg-black/40 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full border border-white/5 shadow-inner">
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
                                 {isAudioPlaying ? "Speaking…" : "Listening"}
                               </>
                            ) : (
                               "Offline"
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col p-0 relative bg-gradient-to-b from-transparent to-black/40 overflow-hidden min-h-0">
                    <ScrollArea ref={transcriptScrollRef} className="flex-1 px-3 md:px-4 lg:px-6 py-4 md:py-6 h-full">
                      <div className="space-y-4 md:space-y-6 w-full">
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

                        {/* Render entries with visuals inline below AI messages */}
                        {entries.map((entry, entryIndex) => {
                            const isHost = entry.speaker === "host";
                            
                            const bubbleClass = isHost
                              ? "bg-white !text-black border border-black/10 rounded-[1.5rem] rounded-tr-sm shadow-glass-sm"
                              : "bg-white/10 border border-white/10 text-white rounded-[1.5rem] rounded-tl-sm backdrop-blur-md";

                            const timestamp = new Date(entry.startedAt).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: false,
                            });

                            // Find visuals that should appear after this AI message
                            // A visual belongs to an AI message if its timestamp is after this message
                            // and before the next message (or if this is the last AI message)
                            const nextEntry = entries[entryIndex + 1];
                            const entryVisuals = !isHost ? visuals.filter(v => {
                              const afterThis = v.timestamp >= entry.startedAt;
                              const beforeNext = !nextEntry || v.timestamp < nextEntry.startedAt;
                              return afterThis && beforeNext;
                            }) : [];

                            return (
                              <div key={entry.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                                <div 
                                  className={cn(
                                    "flex items-end gap-2 md:gap-3 group w-full",
                                    isHost ? "justify-end" : "justify-start"
                                  )}
                                >
                                  {/* Avatar - hidden on mobile for AI, shown on left for AI */}
                                  {!isHost && (
                                    <div className={cn(
                                      "size-8 md:size-10 rounded-full flex items-center justify-center shadow-sm shrink-0 mb-1 transition-transform hover:scale-110 duration-300",
                                      "bg-white/10 text-white border border-white/10"
                                    )}>
                                      <Sparkles className="size-4 md:size-5" />
                                    </div>
                                  )}

                                  <div className={cn(
                                    "flex flex-col",
                                    "max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%] xl:max-w-[65%]",
                                    isHost ? "items-end" : "items-start"
                                  )}>
                                    <div className={cn(
                                      "flex items-center gap-2 md:gap-3 mb-1.5 md:mb-2 px-1 md:px-2 opacity-60 group-hover:opacity-100 transition-opacity",
                                      isHost ? "flex-row-reverse" : "flex-row"
                                    )}>
                                      <span className="text-[10px] md:text-xs font-bold tracking-wide uppercase">
                                        {isHost ? "You" : "Dr. Sarah"}
                                      </span>
                                      <span className="text-[9px] md:text-[10px] font-mono">
                                        {timestamp}
                                      </span>
                                    </div>

                                    <div
                                      className={cn("px-4 md:px-5 lg:px-6 py-3 md:py-4 text-sm md:text-[15px] leading-6 md:leading-7 shadow-sm", bubbleClass)}
                                    >
                                      <span className={cn(isHost ? "text-black" : "text-white")}>
                                        {entry.text || (
                                           <span className="opacity-50 italic text-[10px]">
                                             {entry.status === "streaming" ? "..." : "(empty)"}
                                           </span>
                                        )}
                                      </span>
                                      {entry.status === "streaming" && (
                                        <span className="inline-flex gap-1 md:gap-1.5 ml-1.5 md:ml-2 items-center align-middle">
                                          <span className={cn("size-1 md:size-1.5 rounded-full animate-bounce [animation-delay:-0.3s]", isHost ? "bg-black" : "bg-current")} />
                                          <span className={cn("size-1 md:size-1.5 rounded-full animate-bounce [animation-delay:-0.15s]", isHost ? "bg-black" : "bg-current")} />
                                          <span className={cn("size-1 md:size-1.5 rounded-full animate-bounce", isHost ? "bg-black" : "bg-current")} />
                                        </span>
                                      )}
                                    </div>

                                    {/* Render visuals inline below AI message */}
                                    {entryVisuals.length > 0 && (
                                      <div className="mt-3 space-y-2 w-full max-w-md">
                                        {entryVisuals.map(visual => (
                                          <VisualCard
                                            key={visual.id}
                                            visual={visual}
                                            onDismiss={() => removeVisual(visual.id)}
                                            compact
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Avatar - shown on right for Host */}
                                  {isHost && (
                                    <div className={cn(
                                      "size-8 md:size-10 rounded-full flex items-center justify-center shadow-sm shrink-0 mb-1 transition-transform hover:scale-110 duration-300",
                                      "bg-white text-black"
                                    )}>
                                      <Headphones className="size-4 md:size-5" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                        })}

                        {phase === "live" && (
                          <div className="flex justify-center py-8 sticky bottom-0 z-10 pointer-events-none">
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl px-6 py-3 text-sm font-medium text-white shadow-apple-floating animate-in slide-in-from-bottom-4 fade-in duration-300">
                                <div className="relative flex size-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-30"></span>
                                  <span className="relative inline-flex rounded-full size-3 bg-white"></span>
                                </div>
                                <span>
                                  {isHostSpeaking
                                    ? "Listening…"
                                    : isAiSpeaking
                                      ? "Dr. Sarah is speaking…"
                                      : "Listening…"}
                                </span>
                              </div>
                              {currentPaper && (
                                <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider bg-black/40 px-3 py-1 rounded-full border border-white/5 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
                                  Context: {currentPaper.title.slice(0, 30)}{currentPaper.title.length > 30 ? "…" : ""}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Scroll anchor - always scrolls to keep this in view */}
                        <div ref={scrollAnchorRef} className="h-px" aria-hidden="true" />
                      </div>
                    </ScrollArea>

                    <div className="border-t border-white/5 bg-black/20 backdrop-blur-md px-4 md:px-8 py-3 md:py-4 flex items-center justify-between text-xs font-medium text-white/50">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className={cn("size-2 rounded-full transition-colors duration-500", isRecording ? "bg-white animate-pulse shadow-glow" : "bg-white/20")} />
                          <span className="hidden sm:inline">
                            {phase === "live"
                              ? isRecording
                                ? "Microphone Active"
                                : "Microphone Idle"
                              : "Session Idle"}
                          </span>
                        </div>
                        {visualAgentEnabled && phase === "live" && (
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "size-2 rounded-full transition-colors duration-500",
                              isVisualAgentGenerating
                                ? "bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                                : isVisualAgentAnalyzing 
                                  ? "bg-purple-400 animate-pulse" 
                                  : visuals.length > 0 
                                    ? "bg-purple-400" 
                                    : "bg-purple-500/30"
                            )} />
                            <span className="hidden sm:inline">
                              {isVisualAgentGenerating
                                ? "Generating…"
                                : isVisualAgentAnalyzing 
                                  ? "Analyzing…" 
                                  : visuals.length > 0 
                                    ? `${visuals.length} visual${visuals.length > 1 ? 's' : ''}` 
                                    : "Visual Agent"}
                            </span>
                          </div>
                        )}
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
      <UserSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};

export default StudioPage;
