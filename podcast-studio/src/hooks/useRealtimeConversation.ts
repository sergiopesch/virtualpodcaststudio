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
  messages: ConversationMessage[];
  error: string | null;
  currentAiTranscript: string;
  currentUserTranscript: string;
}

interface UseRealtimeConversationProps {
  onAudioDelta?: (base64: string) => void;
  onAiTranscriptDelta?: (text: string) => void;
  onUserTranscript?: (text: string) => void;
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
}

export const useRealtimeConversation = ({
  onAudioDelta,
  onAiTranscriptDelta,
  onUserTranscript,
  onSpeechStarted,
  onSpeechStopped
}: UseRealtimeConversationProps = {}) => {
  const [state, setState] = useState<RealtimeConversationState>({
    isConnected: false,
    messages: [],
    error: null,
    currentAiTranscript: '',
    currentUserTranscript: ''
  });

  const wsRef = useRef<WebSocket | null>(null);

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
          onAudioDelta?.(data.audio);
        }
        break;
        
      case 'text_delta':
        // Handle incoming text from AI
        if (data.text && typeof data.text === 'string') {
          setState(prev => ({
            ...prev,
            currentAiTranscript: prev.currentAiTranscript + data.text
          }));
          onAiTranscriptDelta?.(data.text);
        }
        break;
        
      case 'response_done':
        // AI finished response, add to messages
        setState(prev => {
          if (prev.currentAiTranscript) {
            const newMessage: ConversationMessage = {
              id: `msg_${Date.now()}`,
              role: 'assistant',
              content: prev.currentAiTranscript,
              timestamp: new Date(),
              type: 'text'
            };
            return {
              ...prev,
              messages: [...prev.messages, newMessage],
              currentAiTranscript: ''
            };
          }
          return prev;
        });
        break;
        
      case 'speech_started':
        onSpeechStarted?.();
        break;
        
      case 'speech_stopped':
        onSpeechStopped?.();
        break;

      case 'user_transcript':
        if (data.text && typeof data.text === 'string') {
           setState(prev => ({
             ...prev,
             currentUserTranscript: data.text
           }));
           onUserTranscript?.(data.text);
           
           // Add user message to history
           const userMessage: ConversationMessage = {
              id: `msg_${Date.now()}`,
              role: 'user',
              content: data.text,
              timestamp: new Date(),
              type: 'text'
           };
           setState(prev => ({
             ...prev,
             messages: [...prev.messages, userMessage]
           }));
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
  }, [onAiTranscriptDelta, onAudioDelta, onSpeechStarted, onSpeechStopped, onUserTranscript]);

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
          error: 'Backend server is not running. Please ensure the Python backend is started (port 8000).'
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

  const sendAudioChunk = useCallback((base64Audio: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'audio',
        audio: base64Audio
      }));
    }
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isConnected: false,
      error: null,
      currentAiTranscript: '',
      currentUserTranscript: ''
    }));
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    sendAudioChunk,
    sendTextMessage
  };
};
