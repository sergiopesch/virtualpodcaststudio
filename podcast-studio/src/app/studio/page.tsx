"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebar } from "@/contexts/sidebar-context";
import { useApiConfig } from "@/contexts/api-config-context";
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
  Pause
} from "lucide-react";

interface ConversationMessage {
  id: string;
  role: 'user' | 'expert';
  content: string;
  timestamp: Date;
  type: 'text' | 'audio';
  speaker?: string;
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

export default function Studio() {
  const { collapsed, toggleCollapsed } = useSidebar();
  const { activeProvider, apiKeys } = useApiConfig();
  const activeApiKey = (apiKeys[activeProvider] ?? "").trim();
  const providerLabel = activeProvider === "openai" ? "OpenAI" : "Google";

  // State for the realtime studio
  const [isConnected, setIsConnected] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [userTranscription, setUserTranscription] = useState(''); // Live user speech
  const [textInput, setTextInput] = useState("");
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [currentPaper, setCurrentPaper] = useState<SelectedPaper | null>(null);
  const [paperLoadError, setPaperLoadError] = useState<string | null>(null);

  // Refs for real-time functionality
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MicrophoneProcessor | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micChunkQueueRef = useRef<Uint8Array[]>([]);
  const micFlushIntervalRef = useRef<number | null>(null);
  const isUploadingRef = useRef<boolean>(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const lastAiMessageIdRef = useRef<string | null>(null);
  const aiTrackRef = useRef<MediaStreamTrack | null>(null);
  const aiAudioStartedRef = useRef<boolean>(false);
  const aiTextBufferRef = useRef<string>("");
  const aiTypingIntervalRef = useRef<number | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, userTranscription, isTranscribing]);

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
      body: JSON.stringify({ sessionId, provider: activeProvider, apiKey: activeApiKey }),
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
  }, [activeApiKey, activeProvider, sessionId]);

  // Fast typing animation helpers for AI transcript
  const startAiTyping = () => {
    if (aiTypingIntervalRef.current != null) return;
    aiTypingIntervalRef.current = window.setInterval(() => {
      if (!aiAudioStartedRef.current && aiTextBufferRef.current.length === 0) {
        clearInterval(aiTypingIntervalRef.current!);
        aiTypingIntervalRef.current = null;
        return;
      }
      if (aiTextBufferRef.current.length === 0) return;
      if (!lastAiMessageIdRef.current) {
        const id = `ai_${Date.now()}`;
        lastAiMessageIdRef.current = id;
        setMessages(prev => [...prev, {
          id,
          role: 'expert',
          content: '',
          timestamp: new Date(),
          type: 'text',
          speaker: 'Dr. Sarah (AI Expert)'
        }]);
      }
      const maxPerTick = Math.min(64, Math.max(2, Math.floor(aiTextBufferRef.current.length / 8)));
      const chunk = aiTextBufferRef.current.slice(0, maxPerTick);
      aiTextBufferRef.current = aiTextBufferRef.current.slice(maxPerTick);
      setMessages(prev => prev.map(m => m.id === lastAiMessageIdRef.current ? { ...m, content: m.content + chunk } : m));
    }, 16);
  };

  const flushAiTyping = (stop: boolean) => {
    if (aiTextBufferRef.current.length > 0 && lastAiMessageIdRef.current) {
      const chunk = aiTextBufferRef.current;
      aiTextBufferRef.current = '';
      setMessages(prev => prev.map(m => m.id === lastAiMessageIdRef.current ? { ...m, content: m.content + chunk } : m));
    }
    if (stop && aiTypingIntervalRef.current != null) {
      clearInterval(aiTypingIntervalRef.current);
      aiTypingIntervalRef.current = null;
    }
  };

  const handleSendText = async () => {
    const trimmed = textInput.trim();
    if (!trimmed) {
      return;
    }

    if (!isConnected || !isSessionReady) {
      setError('Connect to the AI session before sending a message.');
      return;
    }

    try {
      setError(null);
      await ensureRealtimeSession();

      const userMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
        type: 'text'
      };

      setMessages(prev => [...prev, userMessage]);
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
      setError(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  const startMicrophoneRecording = async () => {
    try {
      await ensureRealtimeSession();
    } catch (error) {
      console.error('[ERROR] Realtime session not ready for microphone recording:', error);
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
      setError('Failed to access microphone. Please check permissions.');
      return false;
    }
  };

  const handleStartRecording = async () => {
    if (!isConnected) {
      setError('Please connect to AI first');
      return;
    }

    setError(null);
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
    setIsConnected(false);
    setIsSessionReady(false);
    setIsAudioPlaying(false);

    let pc: RTCPeerConnection | null = null;
    let localStream: MediaStream | null = null;

    try {
      if (!activeApiKey) {
        setError(`Add your ${providerLabel} API key in Settings before connecting.`);
        setIsConnecting(false);
        return;
      }

      if (activeProvider === "google") {
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

          if (type === 'response.output_text.delta' || type === 'response.text.delta' || type === 'response.audio_transcript.delta') {
            const deltaText = typeof msg.delta === 'string' ? msg.delta : '';
            const responseText = typeof msg.text === 'string' ? msg.text : '';
            const text = deltaText || responseText;
            if (text) {
              aiTextBufferRef.current += text;
              startAiTyping();
            }
          }

          if (type === 'response.done' || type === 'response.completed' || type === 'response.output_text.done') {
            flushAiTyping(true);
            lastAiMessageIdRef.current = null;
          }

          if (type === 'conversation.item.input_audio_transcription.started' || type === 'input_audio_buffer.transcription.started') {
            setUserTranscription('');
            setIsTranscribing(true);
          }

          if (type === 'conversation.item.input_audio_transcription.delta' || type === 'input_audio_buffer.transcription.delta') {
            const delta = typeof msg.delta === 'string' ? msg.delta : '';
            if (delta) {
              setUserTranscription(prev => (prev ? prev + delta : delta));
              setIsTranscribing(true);
            }
          }

          if (type === 'conversation.item.input_audio_transcription.completed' || type === 'input_audio_buffer.transcription.completed') {
            const transcript = typeof msg.transcript === 'string' ? msg.transcript : '';
            if (transcript.trim()) {
              const userMessage: ConversationMessage = {
                id: `user_${Date.now()}`,
                role: 'user',
                content: transcript,
                timestamp: new Date(),
                type: 'text'
              };
              setMessages(prev => [...prev, userMessage]);
            }
            setUserTranscription('');
            setIsTranscribing(false);
          }

          if (type === 'response.error') {
            const message = typeof msg.error === 'string' ? msg.error : 'Realtime session error';
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
      };

      localStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
      localStream.getAudioTracks().forEach(track => pc!.addTrack(track, localStream!));

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = (e) => handleDcMessage(e.data);
      dc.onopen = () => {
        try {
          dc.send(JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              voice: 'alloy',
              input_audio_transcription: { model: 'whisper-1' },
              turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 800 }
            }
          }));
        } catch (err) {
          console.error('[ERROR] Failed to send session update over data channel:', err);
        }
      };

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
      setUserTranscription('');
      setIsTranscribing(false);

      console.log('[INFO] Connection successful - ready for conversation');
    } catch (error) {
      console.error('[ERROR] Connection failed:', error);
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

    aiTextBufferRef.current = '';
    lastAiMessageIdRef.current = null;

    if (aiTypingIntervalRef.current != null) {
      clearInterval(aiTypingIntervalRef.current);
      aiTypingIntervalRef.current = null;
    }
  }, [sessionId]);

  const handleDisconnect = async () => {
    await teardownRealtime();

    setIsConnecting(false);
    setIsConnected(false);
    setIsSessionReady(false);
    setIsRecording(false);
    setSessionDuration(0);
    setMessages([]);
    setError(null);
    setIsTranscribing(false);
    setUserTranscription('');
    setIsAudioPlaying(false);
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
                          Start Voice Recording
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
                <Card className="h-[600px] flex flex-col animate-scale-in border border-gray-200 shadow-sm">
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
                    <ScrollArea className="flex-1 px-6 py-4">
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
                                  <p className="text-sm leading-relaxed">{entry.content}</p>
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
                        {isTranscribing && userTranscription && (
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
                                  {userTranscription}
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
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = `/api/rt/audio?sessionId=${sessionId}`;
                              link.download = 'podcast-audio.wav';
                              link.click();
                            }}
                            disabled={!isConnected}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Save Audio
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