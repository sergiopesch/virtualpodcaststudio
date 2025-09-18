"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebar } from "@/contexts/sidebar-context";
import { useApiConfig } from "@/contexts/api-config-context";
import { useRouter } from "next/navigation";
import {
  encodePcm16ChunksToWav,
  saveConversationToSession,
  type StoredConversation,
} from "@/lib/conversationStorage";
import {
  Mic,
  BookOpen,
  Brain,
  Play,
  FileText,
  Headphones,
  Download,
  RotateCcw,
  Volume2,
  Send,
  MicOff,
  Pause,
  Video,
} from "lucide-react";

interface ConversationMessage {
  id: string;
  role: 'user' | 'expert';
  content: string;
  timestamp: Date;
  type: 'text' | 'audio';
  speaker?: string;
  order: number;
}

type MicrophoneProcessor = {
  stop: () => void;
};

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

const AI_BASE_INSTRUCTION_LINES = [
  'You are Dr. Sarah, an AI scientist joining a podcast conversation.',
  'Respond conversationally, stay grounded in the selected research, and avoid speculation.',
  'Keep every reply under three concise sentences (about 75 tokens) to control cost.',
];

const MAX_ABSTRACT_SNIPPET = 400;

const sanitizeInstructionText = (value?: string | null) => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length <= MAX_ABSTRACT_SNIPPET) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_ABSTRACT_SNIPPET)}…`;
};

const buildConversationInstructionsFromPaper = (paper: SelectedPaper | null): string => {
  const base = AI_BASE_INSTRUCTION_LINES.join(' ');

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
      ? `${paper.primaryAuthor}${paper.hasAdditionalAuthors ? ' et al.' : ''}`
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
    details.push(`Context: ${contextParts.join('; ')}`);
  }

  details.push('Answer briefly, relate insights back to the paper, and avoid repeating this context verbatim.');

  return `${base} ${details.join(' ')}`.trim();
};

const nextWordChunk = (text: string): [string, string] => {
  if (!text) {
    return ['', ''];
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

export default function Studio() {
  const { collapsed, toggleCollapsed } = useSidebar();
  const { activeProvider, apiKeys } = useApiConfig();
  const activeApiKey = (apiKeys[activeProvider] ?? "").trim();
  const providerLabel = activeProvider === "openai" ? "OpenAI" : "Google";
  const router = useRouter();

  // State for the realtime studio
  const [isConnected, setIsConnected] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [userTranscriptionDisplay, setUserTranscriptionDisplay] = useState('');
  const [textInput, setTextInput] = useState("");
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [currentPaper, setCurrentPaper] = useState<SelectedPaper | null>(null);
  const [paperLoadError, setPaperLoadError] = useState<string | null>(null);
  const [hasCapturedAudio, setHasCapturedAudio] = useState(false);
  const [activeAiMessageId, setActiveAiMessageId] = useState<string | null>(null);

  // Refs for real-time functionality
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MicrophoneProcessor | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micChunkQueueRef = useRef<Uint8Array[]>([]);
  const micFlushIntervalRef = useRef<number | null>(null);
  const isUploadingRef = useRef<boolean>(false);
  const hostAudioChunksRef = useRef<Uint8Array[]>([]);
  const aiAudioChunksRef = useRef<Uint8Array[]>([]);
  const audioEventSourceRef = useRef<EventSource | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const lastAiMessageIdRef = useRef<string | null>(null);
  const aiTrackRef = useRef<MediaStreamTrack | null>(null);
  const aiAudioStartedRef = useRef<boolean>(false);
  const aiTextBufferRef = useRef<string>("");
  const aiTypingIntervalRef = useRef<number | null>(null);
  const messageSequenceRef = useRef(0);
  const hasCapturedAudioRef = useRef(false);
  const latestConversationRef = useRef<StoredConversation | null>(null);
  const currentUserMessageRef = useRef<{ id: string; order: number } | null>(null);

  const userPendingTextRef = useRef('');
  const userTypingIntervalRef = useRef<number | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const userTranscriptEventSourceRef = useRef<EventSource | null>(null);
  const aiTranscriptEventSourceRef = useRef<EventSource | null>(null);
  const hasUserTranscriptSseRef = useRef(false);
  const hasAiTranscriptSseRef = useRef(false);
  const isCommittingRef = useRef(false);
  const isUserSpeakingRef = useRef(false);

  const sortMessages = useCallback((list: ConversationMessage[]) => {
    return [...list].sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }, []);

  const updateIsUserSpeaking = useCallback((value: boolean) => {
    isUserSpeakingRef.current = value;
    setIsUserSpeaking(value);
  }, []);

  const appendMessage = useCallback((message: ConversationMessage) => {
    setMessages((previous) => sortMessages([...previous, message]));
  }, [sortMessages]);

  const updateMessageContent = useCallback((id: string, updater: (message: ConversationMessage) => ConversationMessage) => {
    setMessages((previous) => sortMessages(previous.map((message) => {
      if (message.id !== id) {
        return message;
      }
      return updater(message);
    })));
  }, [sortMessages]);

  const base64ToUint8Array = useCallback((base64: string): Uint8Array => {
    const sanitized = (base64 || '').replace(/\s+/g, '');

    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      const binary = window.atob(sanitized);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    }

    if (typeof Buffer !== 'undefined') {
      return Uint8Array.from(Buffer.from(sanitized, 'base64'));
    }

    throw new Error('Base64 decoding is not supported in this environment.');
  }, []);

  const stopUserTyping = useCallback(() => {
    if (userTypingIntervalRef.current != null) {
      window.clearInterval(userTypingIntervalRef.current);
      userTypingIntervalRef.current = null;
    }
  }, []);

  const resetUserTranscriptionState = useCallback(() => {
    userPendingTextRef.current = '';
    setUserTranscriptionDisplay('');
    stopUserTyping();
    updateIsUserSpeaking(false);
    setIsTranscribing(false);
    currentUserMessageRef.current = null;
  }, [stopUserTyping, updateIsUserSpeaking]);

  const startUserTyping = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (userTypingIntervalRef.current != null) {
      return;
    }

    userTypingIntervalRef.current = window.setInterval(() => {
      if (!userPendingTextRef.current) {
        return;
      }

      const [chunk, rest] = nextWordChunk(userPendingTextRef.current);
      if (!chunk) {
        userPendingTextRef.current = rest;
        return;
      }

      userPendingTextRef.current = rest;
      setUserTranscriptionDisplay((previous) => previous + chunk);

      const activeMessage = currentUserMessageRef.current;
      if (activeMessage) {
        updateMessageContent(activeMessage.id, (message) => ({
          ...message,
          content: message.content + chunk,
        }));
      }
    }, 32);
  }, [updateMessageContent]);

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
      } catch (error) {
        console.error("Failed to load stored paper:", error);
        setCurrentPaper(null);
        setPaperLoadError(
          "We couldn't load the selected paper. Please return to the Research Hub and choose a paper before starting the Audio Studio.",
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
    return () => {
      resetUserTranscriptionState();
    };
  }, [resetUserTranscriptionState]);

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

  // Timer for session duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const scrollToLatest = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      const root = transcriptScrollRef.current;
      if (!root) {
        return;
      }

      const viewport = root.querySelector<HTMLDivElement>('[data-slot="scroll-area-viewport"]');
      if (viewport) {
        if (typeof viewport.scrollTo === 'function') {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
        } else {
          viewport.scrollTop = viewport.scrollHeight;
        }
        return;
      }

      if (transcriptEndRef.current) {
        transcriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    });
  }, []);

  const sendDataChannelSessionUpdate = useCallback(() => {
    const channel = dcRef.current;
    if (!channel || channel.readyState !== 'open') {
      return;
    }

    try {
      const instructions = buildConversationInstructionsFromPaper(currentPaper);
      channel.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          voice: 'alloy',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 800 },
          instructions,
        },
      }));
    } catch (err) {
      console.error('[ERROR] Failed to send session update over data channel:', err);
    }
  }, [currentPaper]);

  useEffect(() => {
    scrollToLatest();
  }, [messages, userTranscriptionDisplay, isTranscribing, scrollToLatest]);

  useEffect(() => {
    sendDataChannelSessionUpdate();
  }, [sendDataChannelSessionUpdate]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!isConnected) {
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

    if (audioEventSourceRef.current) {
      return;
    }

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

      return () => {
        source.close();
        if (audioEventSourceRef.current === source) {
          audioEventSourceRef.current = null;
        }
      };
    } catch (error) {
      console.error("[ERROR] Unable to open AI audio SSE stream", error);
    }
  }, [isConnected, sessionId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!isConnected) {
      if (aiTranscriptEventSourceRef.current) {
        aiTranscriptEventSourceRef.current.close();
        aiTranscriptEventSourceRef.current = null;
      }
      hasAiTranscriptSseRef.current = false;
      return;
    }

    if (aiTranscriptEventSourceRef.current) {
      return;
    }

    try {
      const source = new EventSource(`/api/rt/transcripts?sessionId=${sessionId}`);
      aiTranscriptEventSourceRef.current = source;
      hasAiTranscriptSseRef.current = true;

      source.onmessage = (event) => {
        const data = (event.data || '').trim();
        if (!data || data === 'Connected to AI transcript stream') {
          return;
        }
        handleAiTranscriptDelta(data);
      };

      source.addEventListener('done', () => {
        flushAiTyping(true);
      });

      source.addEventListener('error', (event) => {
        console.error('[ERROR] AI transcript SSE stream error', event);
        hasAiTranscriptSseRef.current = false;
        if (aiTranscriptEventSourceRef.current === source) {
          source.close();
          aiTranscriptEventSourceRef.current = null;
        }
      });

      return () => {
        source.close();
        if (aiTranscriptEventSourceRef.current === source) {
          aiTranscriptEventSourceRef.current = null;
        }
        hasAiTranscriptSseRef.current = false;
      };
    } catch (error) {
      console.error('[ERROR] Unable to open AI transcript SSE stream', error);
      hasAiTranscriptSseRef.current = false;
    }
  }, [flushAiTyping, handleAiTranscriptDelta, isConnected, sessionId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const ensureRealtimeSession = useCallback(async () => {
    const friendlyProvider = activeProvider === "openai" ? "OpenAI" : "Google";

    if (!activeApiKey) {
      throw new Error(`Add your ${friendlyProvider} API key in Settings before connecting.`);
    }

    if (activeProvider === "google") {
      throw new Error("Realtime studio currently supports only OpenAI sessions. Switch your active provider in Settings to continue.");
    }

    const response = await fetch('/api/rt/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        provider: activeProvider,
        apiKey: activeApiKey,
        paper: paperPayload ?? undefined,
      }),
      cache: 'no-store'
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

  // Fast typing animation helpers for AI transcript
  const startAiTyping = useCallback(() => {
    if (aiTypingIntervalRef.current != null) {
      return;
    }

    aiTypingIntervalRef.current = window.setInterval(() => {
      if (!aiAudioStartedRef.current && aiTextBufferRef.current.length === 0) {
        clearInterval(aiTypingIntervalRef.current!);
        aiTypingIntervalRef.current = null;
        setActiveAiMessageId(null);
        return;
      }

      if (aiTextBufferRef.current.length === 0) {
        return;
      }

      if (!lastAiMessageIdRef.current) {
        const id = `ai_${Date.now()}`;
        lastAiMessageIdRef.current = id;
        const order = ++messageSequenceRef.current;
        appendMessage({
          id,
          role: 'expert',
          content: '',
          timestamp: new Date(),
          type: 'text',
          speaker: 'Dr. Sarah (AI Expert)',
          order,
        });
        setActiveAiMessageId(id);
      }

      const maxPerTick = Math.min(64, Math.max(2, Math.floor(aiTextBufferRef.current.length / 8)));
      const chunk = aiTextBufferRef.current.slice(0, maxPerTick);
      aiTextBufferRef.current = aiTextBufferRef.current.slice(maxPerTick);

      if (lastAiMessageIdRef.current) {
        const targetId = lastAiMessageIdRef.current;
        updateMessageContent(targetId, (message) => ({ ...message, content: message.content + chunk }));
      }
    }, 16);
  }, [appendMessage, updateMessageContent]);

  const flushAiTyping = useCallback((stop: boolean) => {
    if (aiTextBufferRef.current.length > 0 && lastAiMessageIdRef.current) {
      const chunk = aiTextBufferRef.current;
      aiTextBufferRef.current = '';
      const targetId = lastAiMessageIdRef.current;
      updateMessageContent(targetId, (message) => ({ ...message, content: message.content + chunk }));
    }

    if (stop && aiTypingIntervalRef.current != null) {
      clearInterval(aiTypingIntervalRef.current);
      aiTypingIntervalRef.current = null;
    }

    if (stop) {
      setActiveAiMessageId(null);
    }
  }, [updateMessageContent]);

  const handleAiTranscriptDelta = useCallback((text: string) => {
    if (!text) {
      return;
    }

    aiTextBufferRef.current += text;
    startAiTyping();
  }, [startAiTyping]);

  const handleUserTranscriptionStarted = useCallback(() => {
    if (!isUserSpeakingRef.current) {
      userPendingTextRef.current = '';
      setUserTranscriptionDisplay('');
    }

    if (!currentUserMessageRef.current) {
      const id = `user_${Date.now()}`;
      const order = ++messageSequenceRef.current;
      currentUserMessageRef.current = { id, order };
      appendMessage({
        id,
        role: 'user',
        content: '',
        timestamp: new Date(),
        type: 'text',
        speaker: 'Host (You)',
        order,
      });
    }

    stopUserTyping();
    updateIsUserSpeaking(true);
    setIsTranscribing(true);
  }, [appendMessage, stopUserTyping, updateIsUserSpeaking]);

  const handleUserTranscriptionDelta = useCallback((delta: string) => {
    if (!delta) {
      return;
    }

    if (!isUserSpeakingRef.current) {
      handleUserTranscriptionStarted();
    } else {
      updateIsUserSpeaking(true);
      setIsTranscribing(true);
    }

    userPendingTextRef.current += delta;
    startUserTyping();
  }, [handleUserTranscriptionStarted, startUserTyping, updateIsUserSpeaking]);

  const commitAudioTurn = useCallback(async () => {
    if (!isConnected || !isSessionReady) {
      return;
    }

    if (isCommittingRef.current) {
      return;
    }

    isCommittingRef.current = true;
    try {
      const response = await fetch('/api/rt/audio-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        cache: 'no-store'
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to commit audio turn';
        console.warn('[WARN] Audio commit request failed', { message, status: response.status });
      }
    } catch (error) {
      console.error('[ERROR] Audio commit request failed', error);
    } finally {
      isCommittingRef.current = false;
    }
  }, [isConnected, isSessionReady, sessionId]);

  const handleUserTranscriptionComplete = useCallback((transcript: string) => {
    const finalTranscript = transcript.trim();
    if (finalTranscript) {
      const activeMessage = currentUserMessageRef.current;
      if (activeMessage) {
        updateMessageContent(activeMessage.id, (message) => ({
          ...message,
          content: finalTranscript,
          timestamp: new Date(),
        }));
      } else {
        const order = ++messageSequenceRef.current;
        appendMessage({
          id: `user_${Date.now()}`,
          role: 'user',
          content: finalTranscript,
          timestamp: new Date(),
          type: 'text',
          speaker: 'Host (You)',
          order,
        });
      }
    }

    resetUserTranscriptionState();
    void commitAudioTurn();
  }, [appendMessage, commitAudioTurn, resetUserTranscriptionState, updateMessageContent]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!isConnected) {
      if (userTranscriptEventSourceRef.current) {
        userTranscriptEventSourceRef.current.close();
        userTranscriptEventSourceRef.current = null;
      }
      hasUserTranscriptSseRef.current = false;
      return;
    }

    if (userTranscriptEventSourceRef.current) {
      return;
    }

    try {
      const source = new EventSource(`/api/rt/user-transcripts?sessionId=${sessionId}`);
      userTranscriptEventSourceRef.current = source;
      hasUserTranscriptSseRef.current = true;

      const handleComplete = (event: MessageEvent) => {
        const data = (event.data || '').trim();
        if (!data || data === 'Connected to user transcript stream') {
          if (!data) {
            resetUserTranscriptionState();
          }
          return;
        }

        handleUserTranscriptionComplete(data);
      };

      const handleDelta = (event: MessageEvent) => {
        const data = (event.data || '').trim();
        if (!data || data === 'Connected to user transcript stream') {
          return;
        }
        handleUserTranscriptionDelta(data);
      };

      source.addEventListener('complete', handleComplete);
      source.addEventListener('delta', handleDelta);
      source.addEventListener('error', (event) => {
        console.error('[ERROR] User transcript SSE stream error', event);
        hasUserTranscriptSseRef.current = false;
        if (userTranscriptEventSourceRef.current === source) {
          source.close();
          userTranscriptEventSourceRef.current = null;
        }
      });

      return () => {
        source.removeEventListener('complete', handleComplete);
        source.removeEventListener('delta', handleDelta);
        source.close();
        if (userTranscriptEventSourceRef.current === source) {
          userTranscriptEventSourceRef.current = null;
        }
        hasUserTranscriptSseRef.current = false;
      };
    } catch (error) {
      console.error('[ERROR] Unable to open user transcript SSE stream', error);
      hasUserTranscriptSseRef.current = false;
    }
  }, [handleUserTranscriptionComplete, handleUserTranscriptionDelta, isConnected, resetUserTranscriptionState, sessionId]);

  const handleSendText = async () => {
    const trimmed = textInput.trim();
    if (!trimmed) {
      return;
    }

    if (!isConnected || !isSessionReady) {
      setStatusMessage(null);
      setError('Connect to the AI session before sending a message.');
      return;
    }

    try {
      setError(null);
      await ensureRealtimeSession();

      const order = ++messageSequenceRef.current;
      const userMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
        type: 'text',
        speaker: 'Host (You)',
        order,
      };

      appendMessage(userMessage);
      setTextInput("");

      const response = await fetch('/api/rt/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, sessionId }),
        cache: 'no-store'
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to send text to AI');
      }
    } catch (error) {
      console.error('Error sending text:', error);
      setStatusMessage(null);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  const startMicrophoneRecording = async () => {
    try {
      await ensureRealtimeSession();
    } catch (error) {
      console.error('[ERROR] Realtime session not ready for microphone recording:', error);
      setStatusMessage(null);
      setError(error instanceof Error ? error.message : 'Failed to start realtime session.');
      return false;
    }

    try {
      console.log('[INFO] Starting microphone recording', { sessionId });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      console.log('[DEBUG] Microphone access granted');
      
      // Create AudioContext for proper PCM16 conversion - MUST match input sample rate
      if (!audioContextRef.current) {
        const AudioContextConstructor =
          window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) {
          throw new Error('Web Audio API is not supported in this browser.');
        }
        audioContextRef.current = new AudioContextConstructor({ sampleRate: 24000 });
      }
      
      const audioContext = audioContextRef.current;
      
      // Resume context if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const source = audioContext.createMediaStreamSource(stream);
      
      // Use smaller buffer for lower latency
      const scriptProcessor = audioContext.createScriptProcessor(1024, 1, 1);
      
      scriptProcessor.onaudioprocess = async (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // Convert Float32 to PCM16 with better precision
        const pcm16Buffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Clamp to [-1, 1] and convert to 16-bit integer
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcm16Buffer[i] = Math.round(sample * 32767);
        }

        // Queue chunk for batched upload
        const uint8Array = new Uint8Array(pcm16Buffer.buffer);
        micChunkQueueRef.current.push(uint8Array);
        hostAudioChunksRef.current.push(new Uint8Array(uint8Array));
        if (!hasCapturedAudioRef.current) {
          hasCapturedAudioRef.current = true;
          setHasCapturedAudio(true);
        }
      };
      
      source.connect(scriptProcessor);
      // Do NOT connect to destination to avoid echo/feedback
      
      // Start a fast flush loop to batch-send queued chunks
      const flush = async () => {
        if (isUploadingRef.current) return;
        if (micChunkQueueRef.current.length === 0) return;
        isUploadingRef.current = true;
        try {
          // Concatenate queued chunks
          const totalLength = micChunkQueueRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
          const combined = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of micChunkQueueRef.current) {
            combined.set(chunk, offset);
            offset += chunk.length;
          }
          micChunkQueueRef.current = [];
          // Base64 encode safely
          let binary = '';
          const CHUNK_SIZE = 0x8000;
          for (let i = 0; i < combined.length; i += CHUNK_SIZE) {
            const chunk = combined.subarray(i, i + CHUNK_SIZE);
            binary += String.fromCharCode(...chunk);
          }
          const base64 = btoa(binary);
          const response = await fetch('/api/rt/audio-append', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, sessionId })
          });
          if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            console.error('[ERROR] Failed to send batched audio:', errJson);
          }
        } catch (e) {
          console.error('[ERROR] Mic flush failed:', e);
        } finally {
          isUploadingRef.current = false;
        }
      };
      if (micFlushIntervalRef.current == null) {
        micFlushIntervalRef.current = window.setInterval(flush, 50);
      }

      // Store references for cleanup
      const processor: MicrophoneProcessor = {
        stop: () => {
          console.log('[INFO] Stopping audio processing');
          source.disconnect();
          scriptProcessor.disconnect();
          stream.getTracks().forEach(track => track.stop());
          if (micFlushIntervalRef.current != null) {
            clearInterval(micFlushIntervalRef.current);
            micFlushIntervalRef.current = null;
          }
        }
      };
      mediaRecorderRef.current = processor;

      // Don't manually commit - let server VAD handle turn detection
      console.log('[DEBUG] Real-time PCM16 audio processing started - server VAD will detect turn endings');
      return true;
    } catch (error) {
      console.error('[ERROR] Failed to access microphone:', error);
      setStatusMessage(null);
      setError('Failed to access microphone. Please check permissions.');
      return false;
    }
  };

  const handleStartRecording = async () => {
    if (!isConnected) {
      setStatusMessage(null);
      setError('Please connect to AI first');
      return;
    }

    setError(null);
    setStatusMessage(null);
    const success = await startMicrophoneRecording();
    if (success) {
      setIsRecording(true);
    }
  };

  const handleStopRecording = async () => {
    console.log('[INFO] Stopping recording manually - server VAD will handle the rest');
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop(); // Don't await, just stop immediately
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  };

  const handleConnect = async () => {
    if (isConnecting) {
      return;
    }

    setIsConnecting(true);
    setError(null);
    setStatusMessage(null);
    setIsConnected(false);
    setIsSessionReady(false);
    setIsAudioPlaying(false);
    hostAudioChunksRef.current = [];
    aiAudioChunksRef.current = [];
    audioEventSourceRef.current?.close();
    audioEventSourceRef.current = null;
    latestConversationRef.current = null;
    hasCapturedAudioRef.current = false;
    setHasCapturedAudio(false);
    messageSequenceRef.current = 0;
    setActiveAiMessageId(null);
    resetUserTranscriptionState();

    let pc: RTCPeerConnection | null = null;
    let localStream: MediaStream | null = null;

    try {
      if (!activeApiKey) {
        setStatusMessage(null);
        setError(`Add your ${providerLabel} API key in Settings before connecting.`);
        setIsConnecting(false);
        return;
      }

      if (activeProvider === "google") {
        setStatusMessage(null);
        setError("Google's Gemini APIs do not support realtime audio in this studio yet. Switch to OpenAI to continue.");
        setIsConnecting(false);
        return;
      }

      await ensureRealtimeSession();

      console.log('[INFO] Starting WebRTC connection process', { sessionId });

      if (pcRef.current) {
        try {
          pcRef.current.getSenders().forEach(sender => sender.track?.stop());
        } catch {}
        pcRef.current.close();
        pcRef.current = null;
      }

      if (dcRef.current) {
        try { dcRef.current.close(); } catch {}
        dcRef.current = null;
      }

      pc = new RTCPeerConnection({
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302'] }
        ]
      });

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        const audioElement = audioRef.current;

        if (audioElement) {
          audioElement.srcObject = remoteStream;
          const playPromise = audioElement.play();
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              console.warn('[WARN] Autoplay prevented for remote audio:', err);
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
          aiAudioStartedRef.current = true;
          startAiTyping();
        };
        track.onmute = () => {
          aiAudioStartedRef.current = false;
        };
        track.onended = () => {
          aiAudioStartedRef.current = false;
        };
      };

      const handleDcMessage = (data: unknown) => {
        if (typeof data !== 'string') {
          return;
        }

        try {
          const msg = JSON.parse(data) as Record<string, unknown>;
          const type = typeof msg.type === 'string' ? msg.type : '';
          if (!type) {
            return;
          }

          if (!hasAiTranscriptSseRef.current && (type === 'response.output_text.delta' || type === 'response.text.delta' || type === 'response.audio_transcript.delta')) {
            const deltaText = typeof msg.delta === 'string' ? msg.delta : '';
            const responseText = typeof msg.text === 'string' ? msg.text : '';
            const text = deltaText || responseText;
            if (text) {
              handleAiTranscriptDelta(text);
            }
          }

          if (type === 'response.done' || type === 'response.completed' || type === 'response.output_text.done') {
            flushAiTyping(true);
            lastAiMessageIdRef.current = null;
          }

          if (!hasUserTranscriptSseRef.current && (type === 'conversation.item.input_audio_transcription.started' || type === 'input_audio_buffer.transcription.started')) {
            handleUserTranscriptionStarted();
          }

          if (!hasUserTranscriptSseRef.current && (type === 'conversation.item.input_audio_transcription.delta' || type === 'input_audio_buffer.transcription.delta')) {
            const delta = typeof msg.delta === 'string' ? msg.delta : '';
            if (delta) {
              handleUserTranscriptionDelta(delta);
            }
          }

          if (!hasUserTranscriptSseRef.current && (type === 'conversation.item.input_audio_transcription.completed' || type === 'input_audio_buffer.transcription.completed')) {
            const transcript = typeof msg.transcript === 'string' ? msg.transcript : '';
            handleUserTranscriptionComplete(transcript);
          }

          if (type === 'input_audio_buffer.speech_started') {
            handleUserTranscriptionStarted();
          }

          if (type === 'input_audio_buffer.speech_stopped') {
            void commitAudioTurn();
          }

          if (type === 'response.error') {
            const message = typeof msg.error === 'string' ? msg.error : 'Realtime session error';
            setStatusMessage(null);
            setError(message);
          }
        } catch (err) {
          console.debug('[DEBUG] Failed to parse data channel message', err);
        }
      };

      pc.ondatachannel = (ev) => {
        const dc = ev.channel;
        dcRef.current = dc;
        dc.onmessage = (e) => handleDcMessage(e.data);
        dc.onopen = () => sendDataChannelSessionUpdate();
      };

      localStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
      localStream.getAudioTracks().forEach(track => pc!.addTrack(track, localStream!));

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = (e) => handleDcMessage(e.data);
      dc.onopen = () => sendDataChannelSessionUpdate();

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);

      const resp = await fetch('/api/rt/webrtc?model=gpt-4o-realtime-preview-2024-10-01', {
        method: 'POST',
        body: pc.localDescription?.sdp || '',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/sdp',
          'X-LLM-Provider': activeProvider,
          'X-LLM-Api-Key': activeApiKey,
          'X-LLM-Model': 'gpt-4o-realtime-preview-2024-10-01',
        },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`SDP exchange failed: ${resp.status} ${text}`);
      }
      const answerSdp = await resp.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      pcRef.current = pc;

      if (audioRef.current) {
        const el = audioRef.current;
        el.onplay = () => {
          console.log('[DEBUG] Audio started playing');
          setIsAudioPlaying(true);
        };
        el.onpause = () => {
          console.log('[DEBUG] Audio paused');
          setIsAudioPlaying(false);
        };
        el.onended = () => {
          console.log('[DEBUG] Audio ended');
          setIsAudioPlaying(false);
        };
        el.onerror = (e) => {
          console.log('[DEBUG] Audio element error (this is expected initially):', e);
        };
      }

      setSessionDuration(0);
      setIsConnected(true);
      setIsSessionReady(true);
      resetUserTranscriptionState();

      console.log('[INFO] Connection successful - ready for conversation');
    } catch (error) {
      console.error('[ERROR] Connection failed:', error);
      setStatusMessage(null);
      setError(error instanceof Error ? error.message : 'Failed to connect to AI');
      setIsConnected(false);
      setIsSessionReady(false);
      setIsAudioPlaying(false);

      if (pc) {
        try {
          pc.getSenders().forEach(sender => sender.track?.stop());
        } catch {}
        pc.close();
      }

      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      if (pcRef.current) {
        try {
          pcRef.current.getSenders().forEach(sender => sender.track?.stop());
        } catch {}
        pcRef.current.close();
        pcRef.current = null;
      }

      if (dcRef.current) {
        try { dcRef.current.close(); } catch {}
        dcRef.current = null;
      }

      if (aiTrackRef.current) {
        aiTrackRef.current.stop();
        aiTrackRef.current = null;
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const teardownRealtime = useCallback(async () => {
    try {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }

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

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
        audioRef.current.src = '';
      }

      if (dcRef.current) {
        try { dcRef.current.close(); } catch {}
        dcRef.current = null;
      }

      if (pcRef.current) {
        try {
          pcRef.current.getSenders().forEach(sender => sender.track?.stop());
        } catch {}
        pcRef.current.close();
        pcRef.current = null;
      }

      if (aiTrackRef.current) {
        aiTrackRef.current.stop();
        aiTrackRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }

      await fetch('/api/rt/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        cache: 'no-store'
      }).catch(() => {});
    } catch (error) {
      console.error('Error disconnecting:', error);
    }

    if (micFlushIntervalRef.current != null) {
      clearInterval(micFlushIntervalRef.current);
      micFlushIntervalRef.current = null;
    }

    micChunkQueueRef.current = [];
    isUploadingRef.current = false;
    hostAudioChunksRef.current = [];
    aiAudioChunksRef.current = [];

    aiTextBufferRef.current = '';
    lastAiMessageIdRef.current = null;

    if (aiTypingIntervalRef.current != null) {
      clearInterval(aiTypingIntervalRef.current);
      aiTypingIntervalRef.current = null;
    }
    hasUserTranscriptSseRef.current = false;
    hasAiTranscriptSseRef.current = false;
    const hasStoredConversation = latestConversationRef.current != null;
    hasCapturedAudioRef.current = hasStoredConversation;
    setHasCapturedAudio(hasStoredConversation);
    messageSequenceRef.current = 0;
    setActiveAiMessageId(null);
    resetUserTranscriptionState();
  }, [resetUserTranscriptionState, sessionId]);

  const buildConversationPayload = useCallback((): StoredConversation | null => {
    if (!currentPaper || messages.length === 0) {
      return null;
    }

    const sampleRate = Math.round(audioContextRef.current?.sampleRate ?? 24000);
    const hostAudio = encodePcm16ChunksToWav(hostAudioChunksRef.current, sampleRate);
    const aiAudio = encodePcm16ChunksToWav(aiAudioChunksRef.current, 24000);

    if (!hostAudio && !aiAudio) {
      return null;
    }

    const liveMessageId = currentUserMessageRef.current?.id;
    const liveTranscript = userTranscriptionDisplay.trim();

    const orderedMessages = sortMessages(messages).map((msg) => {
      if (liveMessageId && msg.id === liveMessageId && liveTranscript) {
        return {
          ...msg,
          content: liveTranscript,
        };
      }
      return msg;
    });

    const transcript = orderedMessages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
      speaker: msg.speaker,
      type: msg.type,
      order: msg.order,
    }));

    const durationSeconds = Math.max(
      hostAudio?.durationSeconds ?? 0,
      aiAudio?.durationSeconds ?? 0,
      sessionDuration,
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
  }, [currentPaper, messages, sessionDuration, sortMessages, userTranscriptionDisplay]);

  const handleDisconnect = async () => {
    if (isRecording) {
      await handleStopRecording();
    }

    try {
      const payload = buildConversationPayload();
      if (payload) {
        latestConversationRef.current = payload;
        saveConversationToSession(payload);
        setStatusMessage('Conversation saved for the Video Studio.');
      } else {
        latestConversationRef.current = null;
        setStatusMessage(null);
      }
    } catch (storageError) {
      console.error('Failed to persist conversation for Video Studio', storageError);
      setStatusMessage(null);
    }

    await teardownRealtime();

    setIsConnecting(false);
    setIsConnected(false);
    setIsSessionReady(false);
    setIsRecording(false);
    setSessionDuration(0);
    setMessages([]);
    setError(null);
    resetUserTranscriptionState();
    setActiveAiMessageId(null);
    setIsAudioPlaying(false);
  };

  const handleSendToVideoStudio = async () => {
    try {
      if (isRecording) {
        await handleStopRecording();
      }

      const payload = buildConversationPayload();
      if (!payload) {
        setError('Capture a conversation with audio before sending it to the Video Studio.');
        setStatusMessage(null);
        return;
      }

      latestConversationRef.current = payload;
      saveConversationToSession(payload);
      setError(null);
      setStatusMessage('Conversation handed off to the Video Studio.');
      router.push('/video-studio');
    } catch (error) {
      console.error('[ERROR] Failed to prepare conversation for Video Studio', error);
      setStatusMessage(null);
      setError(error instanceof Error ? error.message : 'Failed to prepare conversation for Video Studio');
    }
  };

  useEffect(() => {
    return () => {
      teardownRealtime().catch(() => {});
    };
  }, [teardownRealtime]);

  const handleExportTranscript = () => {
    const transcriptText = messages.map((msg: ConversationMessage) =>
      `[${msg.timestamp.toLocaleTimeString()}] ${msg.speaker || (msg.role === 'user' ? 'You' : msg.role)}: ${msg.content}`
    ).join('\n\n');

    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'podcast-transcript.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAudio = useCallback(async () => {
    try {
      let payload = buildConversationPayload();
      if (!payload) {
        payload = latestConversationRef.current;
      }

      if (!payload || (!payload.audio.host && !payload.audio.ai)) {
        setError('Capture a conversation with audio before downloading.');
        setStatusMessage(null);
        return;
      }

      latestConversationRef.current = payload;

      const files: Array<{ name: string; data: Uint8Array }> = [];

      if (payload.audio.host) {
        const hostBytes = base64ToUint8Array(payload.audio.host.base64);
        files.push({ name: 'host-track.wav', data: hostBytes });
      }

      if (payload.audio.ai) {
        const aiBytes = base64ToUint8Array(payload.audio.ai.base64);
        files.push({ name: 'ai-track.wav', data: aiBytes });
      }

      const transcriptText = payload.transcript
        .map((entry) => {
          const timestamp = new Date(entry.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
          const speakerLabel = entry.speaker || (entry.role === 'user' ? 'Host' : 'Dr. Sarah');
          return `[${timestamp}] ${speakerLabel}: ${entry.content}`;
        })
        .join('\n\n');

      const encoder = new TextEncoder();
      files.push({ name: 'transcript.txt', data: encoder.encode(transcriptText) });
      files.push({
        name: 'metadata.json',
        data: encoder.encode(JSON.stringify({
          paper: payload.paper,
          durationSeconds: payload.durationSeconds,
          createdAt: payload.createdAt,
        }, null, 2)),
      });

      const archiveBytes = createZipArchive(files);
      const blob = new Blob([archiveBytes], { type: 'application/zip' });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `podcast-session-${sessionId}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);

      setError(null);
      setStatusMessage('Audio bundle downloaded successfully.');
    } catch (error) {
      console.error('[ERROR] Failed to export audio bundle', error);
      setStatusMessage(null);
      setError(error instanceof Error ? error.message : 'Failed to download audio bundle');
    }
  }, [base64ToUint8Array, buildConversationPayload, sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
      <div className="flex">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          isLiveRecording={isRecording}
        />
        
        {/* Main Content */}
        <div className="flex-1">
          <Header
            title="Audio Studio"
            description="Generate audio conversations between you and AI experts"
            status={{
              label: !isConnected ? 'DISCONNECTED' : !isSessionReady ? 'CONNECTING' : isRecording ? 'LIVE' : 'READY',
              color: !isConnected || !isSessionReady ? 'yellow' : isRecording ? 'red' : 'green',
              active: isRecording
            }}
            timer={{
              duration: sessionDuration,
              format: formatTime
            }}
          />

          <main className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Paper Info */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="animate-fade-in">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BookOpen className="w-5 h-5 text-purple-600" />
                      <span>Current Paper</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {paperLoadError ? (
                      <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                        {paperLoadError}
                      </div>
                    ) : currentPaper ? (
                      <>
                        <div className="space-y-3">
                          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 leading-tight">
                            {currentPaper.title}
                          </h3>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Published {currentPaper.formattedPublishedDate ?? "(date unavailable)"}
                          </div>
                          <p className="text-sm text-gray-600">
                            {currentPaper.primaryAuthor
                              ? `${currentPaper.primaryAuthor}${currentPaper.hasAdditionalAuthors ? " et al." : ""}`
                              : currentPaper.authors}
                          </p>
                          <p className="text-sm text-gray-500 line-clamp-4 leading-relaxed">
                            {currentPaper.abstract}
                          </p>
                        </div>

                        <div className="space-y-2">
                          {currentPaper.arxiv_url ? (
                            <Button asChild variant="outline" className="w-full">
                              <a
                                href={currentPaper.arxiv_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                View Full Paper
                              </a>
                            </Button>
                          ) : (
                            <Button variant="outline" className="w-full" disabled>
                              <FileText className="w-4 h-4 mr-2" />
                              View Full Paper
                            </Button>
                          )}
                          <Button variant="outline" className="w-full" disabled>
                            <Brain className="w-4 h-4 mr-2" />
                            AI Summary
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-600 space-y-2">
                        <p className="font-medium text-gray-700">
                          Select a research paper from the Research Hub to populate this view.
                        </p>
                        <p className="text-gray-500">
                          Your selected paper details will appear here automatically once you start the Audio Studio from a research card.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recording Controls */}
                <Card className="animate-slide-up">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Mic className="w-5 h-5 text-red-500" />
                      <span>Recording Controls</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {error && (
                      <div className="text-red-500 text-sm mb-2 p-2 bg-red-50 rounded">
                        Error: {error}
                      </div>
                    )}

                    {!error && statusMessage && (
                      <div className="text-green-600 text-sm mb-2 p-2 bg-green-50 border border-green-200 rounded">
                        {statusMessage}
                      </div>
                    )}

                    <div className="flex space-x-2">
                      {!isConnected ? (
                        <Button
                          onClick={handleConnect}
                          variant="default"
                          size="lg"
                          className="flex-1"
                          disabled={isConnecting}
                        >
                          <Brain className="w-4 h-4 mr-2" />
                          {isConnecting ? 'Connecting...' : 'Connect to AI'}
                        </Button>
                      ) : !isRecording ? (
                      <Button
                        onClick={handleStartRecording}
                        disabled={!isConnected || !isSessionReady}
                        variant="destructive"
                        size="lg"
                        className="flex-1"
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        {hasCapturedAudio ? 'Resume Voice Recording' : 'Start Voice Recording'}
                      </Button>
                      ) : (
                        <Button 
                          onClick={handleStopRecording}
                          variant="outline"
                          size="lg"
                          className="flex-1"
                        >
                          <MicOff className="w-4 h-4 mr-2" />
                          Stop Recording
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendText();
                          }
                        }}
                      />
                      <Button
                        onClick={handleSendText}
                        disabled={!textInput.trim() || !isConnected || !isSessionReady}
                        size="lg"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Button variant="ghost" className="w-full justify-start" onClick={handleExportTranscript}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export Transcript
                      </Button>
                      <Button variant="ghost" className="w-full justify-start" onClick={handleSendToVideoStudio}>
                        <Video className="w-4 h-4 mr-2" />
                        Send to Video Studio
                      </Button>
                      <Button variant="ghost" className="w-full justify-start" onClick={handleDisconnect}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Disconnect Session
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Live Transcript */}
              <div className="lg:col-span-2">
                <Card className="h-[600px] flex flex-col overflow-hidden animate-scale-in border border-gray-200 shadow-sm">
                  <CardHeader className="flex-shrink-0 border-b border-gray-100 bg-gray-50/30">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        <span>Live Transcript</span>
                      </CardTitle>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3 text-xs">
                          <div className="flex items-center space-x-1 text-gray-500">
                            <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm"></div>
                            <span>Host (You)</span>
                          </div>
                          <div className="flex items-center space-x-1 text-gray-500">
                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm"></div>
                            <span>Dr. Sarah (AI Expert)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                
                  <CardContent className="flex-1 flex flex-col p-0 bg-white">
                    <ScrollArea ref={transcriptScrollRef} className="flex-1 px-6 py-4">
                      <div className="space-y-4">
                        {messages.length === 0 && !isRecording && (
                          <div className="text-center text-gray-500 py-8">
                            <Brain className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <div className="space-y-2">
                              {!isSessionReady ? (
                                <p>Click &ldquo;Connect to AI&rdquo; to begin your conversation</p>
                              ) : (
                                <>
                                  <p className="font-medium">Ready for podcast conversation!</p>
                                  <p className="text-sm">• Click &ldquo;Start Voice Recording&rdquo; and speak</p>
                                  <p className="text-sm">• Wait 1 second of silence after speaking</p>
                                  <p className="text-sm">• Dr. Sarah will respond with voice and text</p>
                                  <p className="text-sm">• Or type a message to start</p>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {messages.map((entry: ConversationMessage) => {
                          const isUser = entry.role === "user";
                          
                          const avatarStyles = isUser 
                            ? "bg-purple-100 border-purple-200 text-purple-600"
                            : "bg-blue-100 border-blue-200 text-blue-600";
                            
                          const messageStyles = isUser
                            ? "bg-gradient-to-r from-purple-50 to-purple-50/70 border-purple-200 text-gray-800"
                            : "bg-gradient-to-r from-blue-50 to-blue-50/70 border-blue-200 text-gray-800";
                            
                          const displayName = entry.speaker || (isUser ? "You" : "Dr. Sarah");
                          
                          return (
                            <div
                              key={entry.id}
                              className="flex items-start space-x-3 animate-fade-in"
                            >
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border ${avatarStyles}`}>
                                {isUser ? (
                                  <Headphones className="w-5 h-5" />
                                ) : (
                                  <Brain className="w-5 h-5" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="text-sm font-semibold text-gray-900">
                                    {displayName}
                                  </span>
                                  <span className="text-xs text-gray-500 font-mono bg-gray-100 border border-gray-200 px-2 py-1 rounded-md shadow-sm">
                                    {entry.timestamp.toLocaleTimeString('en-US', {
                                      hour: '2-digit', 
                                      minute: '2-digit', 
                                      second: '2-digit', 
                                      hour12: false
                                    })}
                                  </span>
                                </div>
                                <div className={`p-4 rounded-xl border-2 shadow-sm transition-all hover:shadow-md ${messageStyles}`}>
                                  <p className="text-sm leading-relaxed">
                                    {entry.content}
                                    {entry.id === activeAiMessageId && (
                                      <span className="inline-block w-2 h-4 bg-blue-500/70 ml-1 animate-pulse rounded-sm align-middle" />
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Live indicator when recording */}
                        {isRecording && (
                          <div className="flex items-center space-x-3 opacity-80 animate-pulse border border-green-200 bg-green-50/50 p-3 rounded-lg">
                            <div className="w-10 h-10 rounded-xl bg-green-100 border border-green-200 flex items-center justify-center shadow-sm">
                              <Mic className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-green-800">
                                Recording...
                              </div>
                              <div className="text-xs text-green-600">
                                Ready for new audio implementation
                              </div>
                            </div>
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                          </div>
                        )}
                        
                        {/* Live transcription when user is speaking */}
                        {isUserSpeaking && (
                          <div className="flex items-start space-x-3 animate-fade-in">
                            <div className="w-10 h-10 rounded-xl bg-yellow-100 border border-yellow-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                              <Mic className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  You (Speaking...)
                                </span>
                                <span className="text-xs text-yellow-600 font-mono bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-md">
                                  LIVE TRANSCRIPT
                                </span>
                              </div>
                              <div className="p-4 rounded-xl border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-yellow-50/70 shadow-sm">
                                <p className="text-sm leading-relaxed text-gray-800">
                                  {userTranscriptionDisplay || <span className="text-xs text-yellow-500 uppercase tracking-wide">Listening...</span>}
                                  <span className="inline-block w-2 h-4 bg-yellow-500 ml-1 animate-pulse"></span>
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={transcriptEndRef} />
                      </div>
                    </ScrollArea>
                  
                    {/* Audio Controls */}
                    <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-50/80 flex-shrink-0">
                      {/* Hidden audio element for streaming */}
                      <audio 
                        ref={audioRef} 
                        className="hidden"
                        onError={(e) => console.log('[DEBUG] Audio element error (expected initially):', e)}
                      />
                      
                      <div className="flex items-center space-x-4 mb-3">
                        <div className="flex items-center space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-gray-300 hover:border-purple-400 hover:bg-purple-50"
                            onClick={() => {
                              if (isAudioPlaying && audioRef.current) {
                                audioRef.current.pause();
                              } else {
                                console.log('[INFO] Audio playback will happen automatically when AI responds');
                              }
                            }}
                            disabled={!isConnected}
                          >
                            {isAudioPlaying ? (
                              <Pause className="w-4 h-4 mr-2" />
                            ) : (
                              <Play className="w-4 h-4 mr-2" />
                            )}
                            {isAudioPlaying ? 'Pause' : 'Audio'} Ready
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-gray-300 hover:border-green-400 hover:bg-green-50"
                            onClick={handleDownloadAudio}
                            disabled={!hasCapturedAudio}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download Audio Bundle
                          </Button>
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 shadow-inner">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 shadow-sm ${
                              isAudioPlaying ? 'bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse' : 'bg-gray-400'
                            }`}
                            style={{ width: isAudioPlaying ? '60%' : '0%' }}
                          ></div>
                        </div>
                        <div className="text-sm text-gray-600 font-mono bg-white px-3 py-1 rounded-md border border-gray-200 shadow-sm">
                          {formatTime(sessionDuration)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Volume2 className="w-3 h-3" />
                        <span>
                          {!isConnected 
                            ? 'Connect to AI to start audio streaming' 
                            : isAudioPlaying 
                              ? 'AI audio playing...' 
                              : 'Ready for conversation'
                          }
                        </span>
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
}