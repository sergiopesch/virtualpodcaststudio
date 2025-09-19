import { useState, useRef, useCallback, useEffect } from 'react';

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type: 'text' | 'audio';
}

interface RealtimeConversationState {
  isConnected: boolean;
  isRecording: boolean;
  messages: ConversationMessage[];
  error: string | null;
  currentAudioBuffer: string;
}

export const useRealtimeConversation = () => {
  const [state, setState] = useState<RealtimeConversationState>({
    isConnected: false,
    isRecording: false,
    messages: [],
    error: null,
    currentAudioBuffer: ''
  });

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const playAudioDelta = useCallback(async (audioBase64: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      const audioData = base64ToArrayBuffer(audioBase64);
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }, []);

  const handleWebSocketMessage = useCallback((data: Record<string, string | number | boolean | undefined>) => {
    switch (data.type) {
      case 'session_ready':
        if (process.env.NODE_ENV === 'development') {
          console.log('Session ready');
        }
        break;
        
      case 'audio_delta':
        // Handle incoming audio from AI
        if (data.audio && typeof data.audio === 'string') {
          playAudioDelta(data.audio);
        }
        break;
        
      case 'text_delta':
        // Handle incoming text from AI
        if (data.text && typeof data.text === 'string') {
          setState(prev => ({
            ...prev,
            currentAudioBuffer: prev.currentAudioBuffer + data.text
          }));
        }
        break;
        
      case 'response_done':
        // AI finished response, add to messages
        setState(prev => {
          if (prev.currentAudioBuffer) {
            const newMessage: ConversationMessage = {
              id: `msg_${Date.now()}`,
              role: 'assistant',
              content: prev.currentAudioBuffer,
              timestamp: new Date(),
              type: 'text'
            };
            return {
              ...prev,
              messages: [...prev.messages, newMessage],
              currentAudioBuffer: ''
            };
          }
          return prev;
        });
        break;
        
      case 'speech_started':
        if (process.env.NODE_ENV === 'development') {
          console.log('User started speaking');
        }
        break;
        
      case 'speech_stopped':
        if (process.env.NODE_ENV === 'development') {
          console.log('User stopped speaking');
        }
        break;
        
      case 'error':
        setState(prev => ({ ...prev, error: typeof data.message === 'string' ? data.message : 'Unknown error' }));
        break;
        
      default:
        if (process.env.NODE_ENV === 'development') {
          console.log('Unknown message type:', data.type);
        }
    }
  }, [playAudioDelta]);

  const connect = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      // Check if backend server is running first
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const wsUrl = backendUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      
      try {
        const response = await fetch(`${backendUrl}/health`);
        if (!response.ok) {
          throw new Error('Backend server not responding');
        }
      } catch {
        setState(prev => ({
          ...prev,
          error: 'Backend server is not running. Please check your backend configuration.'
        }));
        return;
      }
      
      const ws = new WebSocket(`${wsUrl}/ws/conversation`);
      
      ws.onopen = () => {
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        if (process.env.NODE_ENV === 'development') {
          console.log('Connected to conversation WebSocket');
        }
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (parseError) {
          console.error('Error parsing WebSocket message:', parseError);
        }
      };
      
      ws.onclose = (event) => {
        setState(prev => ({ ...prev, isConnected: false }));
        console.log('Disconnected from conversation WebSocket', event.code, event.reason);
        
        // Provide more specific error messages based on close codes
        if (event.code === 1006) {
          setState(prev => ({ 
            ...prev, 
            error: 'Connection lost. Please check if the backend server is running.' 
          }));
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to connect to conversation server. Please ensure the backend is running on port 8000.' 
        }));
      };
      
      wsRef.current = ws;
    } catch (error) {
      setState(prev => ({ ...prev, error: `Connection failed: ${error}` }));
    }
  }, [handleWebSocketMessage]);

  const convertToBase64AndSend = useCallback(async (audioBlob: Blob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      
      if (wsRef.current && state.isConnected) {
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          audio: base64
        }));
      }
    } catch (error) {
      console.error('Error converting audio to base64:', error);
    }
  }, [state.isConnected]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=pcm'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          // Convert to base64 and send to WebSocket
          convertToBase64AndSend(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('Recording stopped');
      };
      
      mediaRecorder.start(100); // Capture data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      
      setState(prev => ({ ...prev, isRecording: true }));
    } catch (error) {
      setState(prev => ({ ...prev, error: `Failed to start recording: ${error}` }));
    }
  }, [convertToBase64AndSend]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setState(prev => ({ ...prev, isRecording: false }));
    }
  }, [state.isRecording]);

  const sendTextMessage = useCallback((text: string) => {
    if (wsRef.current && state.isConnected) {
      // Add user message to state
      const userMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
        type: 'text'
      };
      
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage]
      }));
      
      // Send to WebSocket
      wsRef.current.send(JSON.stringify({
        type: 'text',
        text: text
      }));
    }
  }, [state.isConnected]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaRecorderRef.current) {
      stopRecording();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setState({
      isConnected: false,
      isRecording: false,
      messages: [],
      error: null,
      currentAudioBuffer: ''
    });
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendTextMessage
  };
};

// Utility functions
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};
