import { useState, useRef, useCallback, useEffect } from 'react';

interface ConversationMessage {
  id: string;
  role: 'user' | 'expert' | 'curious';
  content: string;
  timestamp: Date;
  type: 'text' | 'audio';
  speaker?: string;
}

interface RealtimeConversationState {
  isConnected: boolean;
  isRecording: boolean;
  messages: ConversationMessage[];
  error: string | null;
  expertAudioBuffer: string;
  curiousAudioBuffer: string;
  isTranscribing: boolean;
  currentTranscription: string;
}

export const useRealtimeConversation = () => {
  const [state, setState] = useState<RealtimeConversationState>({
    isConnected: false,
    isRecording: false,
    messages: [],
    error: null,
    expertAudioBuffer: '',
    curiousAudioBuffer: '',
    isTranscribing: false,
    currentTranscription: ''
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
        console.log('Session ready');
        break;
        
      case 'audio_delta':
        // Handle incoming audio from AI
        if (data.audio && typeof data.audio === 'string') {
          playAudioDelta(data.audio);
        }
        break;
        
      case 'text_delta':
        // Handle incoming text from AI with persona detection
        if (data.text && typeof data.text === 'string') {
          setState(prev => {
            let targetBuffer = 'expertAudioBuffer';
            
            // Detect persona from the text content or metadata
            if (data.persona === 'curious' || (data.text && typeof data.text === 'string' && data.text.includes('Alex Rivera:'))) {
              targetBuffer = 'curiousAudioBuffer';
            } else if (data.persona === 'expert' || (data.text && typeof data.text === 'string' && data.text.includes('Dr. Sarah Chen:'))) {
              targetBuffer = 'expertAudioBuffer';
            }
            
            return {
              ...prev,
              [targetBuffer]: (prev[targetBuffer as keyof typeof prev] as string) + data.text
            };
          });
        }
        break;
        
      case 'response_done':
        // AI finished response, add to messages
        setState(prev => {
          // Check both buffers and add messages for non-empty ones
          const messages = [...prev.messages];
          
          if (prev.expertAudioBuffer) {
            messages.push({
              id: `msg_${Date.now()}_expert`,
              role: 'expert',
              content: prev.expertAudioBuffer,
              timestamp: new Date(),
              type: 'text',
              speaker: 'Dr. Sarah Chen'
            });
          }
          
          if (prev.curiousAudioBuffer) {
            messages.push({
              id: `msg_${Date.now()}_curious`,
              role: 'curious',
              content: prev.curiousAudioBuffer,
              timestamp: new Date(),
              type: 'text',
              speaker: 'Alex Rivera'
            });
          }
          
          return {
            ...prev,
            messages,
            expertAudioBuffer: '',
            curiousAudioBuffer: ''
          };
        });
        break;
        
      case 'speech_started':
        console.log('User started speaking');
        setState(prev => ({ ...prev, isTranscribing: true }));
        break;
        
      case 'speech_stopped':
        console.log('User stopped speaking');
        setState(prev => ({ ...prev, isTranscribing: false }));
        break;
        
      case 'transcription_started':
        console.log('Transcription started');
        setState(prev => ({ ...prev, isTranscribing: true, currentTranscription: '' }));
        break;
        
      case 'transcription_delta':
        if (data.text && typeof data.text === 'string') {
          setState(prev => ({
            ...prev,
            currentTranscription: prev.currentTranscription + data.text
          }));
        }
        break;
        
      case 'transcription_complete':
        if (data.text && typeof data.text === 'string') {
          // Add the complete transcription as a user message
          const transcriptionMessage: ConversationMessage = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content: data.text,
            timestamp: new Date(),
            type: 'audio'
          };
          setState(prev => ({
            ...prev,
            messages: [...prev.messages, transcriptionMessage],
            isTranscribing: false,
            currentTranscription: ''
          }));
        }
        break;
        
      case 'error':
        setState(prev => ({ ...prev, error: typeof data.message === 'string' ? data.message : 'Unknown error' }));
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  }, [playAudioDelta]);

  const connect = useCallback(async () => {
    try {
      console.log('Attempting to connect to WebSocket...');
      setState(prev => ({ ...prev, error: null }));
      
      // Check if backend server is running first
      try {
        console.log('Checking backend health...');
        const response = await fetch('http://localhost:8000/health');
        if (!response.ok) {
          throw new Error('Backend server not responding');
        }
        console.log('Backend is healthy');
      } catch (fetchError) {
        console.error('Backend health check failed:', fetchError);
        setState(prev => ({ 
          ...prev, 
          error: 'Backend server is not running. Please start the backend server on port 8000.' 
        }));
        return;
      }
      
      console.log('Creating WebSocket connection...');
      const ws = new WebSocket('ws://localhost:8000/ws/conversation');
      
      ws.onopen = () => {
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        console.log('✅ Connected to conversation WebSocket');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Received WebSocket message:', data.type);
          handleWebSocketMessage(data);
        } catch (parseError) {
          console.error('Error parsing WebSocket message:', parseError);
        }
      };
      
      ws.onclose = (event) => {
        setState(prev => ({ ...prev, isConnected: false }));
        console.log('❌ Disconnected from conversation WebSocket', event.code, event.reason);
        
        // Provide more specific error messages based on close codes
        if (event.code === 1006) {
          setState(prev => ({ 
            ...prev, 
            error: 'Connection lost. Please check if the backend server is running.' 
          }));
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to connect to conversation server. Please ensure the backend is running on port 8000.' 
        }));
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Connection setup failed:', error);
      setState(prev => ({ ...prev, error: `Connection failed: ${error}` }));
    }
  }, [handleWebSocketMessage]);

  const convertToBase64AndSend = useCallback(async (audioBlob: Blob) => {
    try {
      console.log('Converting audio blob to base64, size:', audioBlob.size, 'type:', audioBlob.type);
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      
      if (wsRef.current && state.isConnected) {
        console.log('Sending audio data to WebSocket, base64 length:', base64.length);
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          audio: base64
        }));
      } else {
        console.warn('WebSocket not connected, cannot send audio data');
      }
    } catch (error) {
      console.error('Error converting audio to base64:', error);
      setState(prev => ({ ...prev, error: `Audio conversion failed: ${error}` }));
    }
  }, [state.isConnected]);

  const startRecording = useCallback(async () => {
    console.log('Starting recording...');
    
    if (!state.isConnected) {
      console.error('Not connected to WebSocket');
      setState(prev => ({ ...prev, error: 'Not connected to server' }));
      return;
    }

    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      console.log('Microphone access granted, creating MediaRecorder...');
      
      // Try different mimeTypes based on browser support
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')) {
        mimeType = 'audio/webm;codecs=pcm';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      
      console.log('Using mimeType:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('Audio data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          // Convert to base64 and send to WebSocket
          convertToBase64AndSend(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('Recording stopped');
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        setState(prev => ({ ...prev, error: 'Recording error occurred' }));
      };
      
      mediaRecorder.start(100); // Capture data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      
      setState(prev => ({ ...prev, isRecording: true, error: null }));
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Failed to start recording:', error);
      setState(prev => ({ ...prev, error: `Failed to start recording: ${error}` }));
    }
  }, [convertToBase64AndSend, state.isConnected]);

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
      expertAudioBuffer: '',
      curiousAudioBuffer: '',
      isTranscribing: false,
      currentTranscription: ''
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
