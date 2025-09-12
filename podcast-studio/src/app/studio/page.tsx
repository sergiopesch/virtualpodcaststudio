"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebar } from "@/contexts/sidebar-context";
import { useRealtimeConversation } from "@/hooks/useRealtimeConversation";
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
  MicOff
} from "lucide-react";

interface ConversationMessage {
  id: string;
  role: 'user' | 'expert' | 'curious';
  content: string;
  timestamp: Date;
  type: 'text' | 'audio';
  speaker?: string;
}

export default function Studio() {
  const { collapsed, toggleCollapsed } = useSidebar();
  const {
    isConnected,
    isRecording,
    messages,
    error,
    isTranscribing,
    currentTranscription,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendTextMessage
  } = useRealtimeConversation();
  
  const [textInput, setTextInput] = useState("");
  const [sessionDuration, setSessionDuration] = useState(0);

  const currentPaper = {
    title: "Attention Is All You Need",
    authors: "Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit",
    abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely."
  };

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendText = () => {
    if (textInput.trim() && isConnected) {
      sendTextMessage(textInput);
      setTextInput("");
    }
  };

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
        />
        
        {/* Main Content */}
        <div className="flex-1">
          <Header
            title="Audio Studio"
            description="Generate audio conversations between you and AI experts"
            status={{
              label: !isConnected ? 'CONNECTING' : isRecording ? 'RECORDING' : 'READY',
              color: !isConnected ? 'yellow' : isRecording ? 'red' : 'green',
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
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 leading-tight">
                        {currentPaper.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3 truncate">
                        {currentPaper.authors}
                      </p>
                      <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">
                        {currentPaper.abstract}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full">
                        <FileText className="w-4 h-4 mr-2" />
                        View Full Paper
                      </Button>
                      <Button variant="outline" className="w-full">
                        <Brain className="w-4 h-4 mr-2" />
                        AI Summary
                      </Button>
                    </div>
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
                      {!isRecording ? (
                        <Button 
                          onClick={startRecording}
                          disabled={!isConnected}
                          variant="destructive"
                          size="lg"
                          className="flex-1"
                        >
                          <Mic className="w-4 h-4 mr-2" />
                          Start Voice Recording
                        </Button>
                      ) : (
                        <Button 
                          onClick={stopRecording}
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
                        onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
                      />
                      <Button 
                        onClick={handleSendText}
                        disabled={!isConnected || !textInput.trim()}
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
                      <Button variant="ghost" className="w-full justify-start" onClick={disconnect}>
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
                            <span>AI Expert</span>
                          </div>
                          <div className="flex items-center space-x-1 text-gray-500">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm"></div>
                            <span>AI Researcher</span>
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
                            <p>Start recording or type a message to begin your conversation</p>
                          </div>
                        )}
                        
                        {messages.map((entry: ConversationMessage) => {
                          const isUser = entry.role === "user";
                          const isExpert = entry.role === "expert";
                          
                          const avatarStyles = isUser 
                            ? "bg-purple-100 border-purple-200 text-purple-600"
                            : isExpert 
                            ? "bg-blue-100 border-blue-200 text-blue-600"
                            : "bg-green-100 border-green-200 text-green-600";
                            
                          const messageStyles = isUser
                            ? "bg-gradient-to-r from-purple-50 to-purple-50/70 border-purple-200 text-gray-800"
                            : isExpert
                            ? "bg-gradient-to-r from-blue-50 to-blue-50/70 border-blue-200 text-gray-800"
                            : "bg-gradient-to-r from-green-50 to-green-50/70 border-green-200 text-gray-800";
                            
                          const displayName = entry.speaker || (isUser ? "You" : entry.role);
                          
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
                                AI is listening to your voice
                              </div>
                            </div>
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                          </div>
                        )}
                        
                        {/* Live transcription when transcribing */}
                        {isTranscribing && currentTranscription && (
                          <div className="flex items-start space-x-3 animate-fade-in">
                            <div className="w-10 h-10 rounded-xl bg-yellow-100 border border-yellow-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                              <Mic className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  You (Transcribing...)
                                </span>
                                <span className="text-xs text-yellow-600 font-mono bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-md">
                                  LIVE
                                </span>
                              </div>
                              <div className="p-4 rounded-xl border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-yellow-50/70 shadow-sm">
                                <p className="text-sm leading-relaxed text-gray-800">
                                  {currentTranscription}
                                  <span className="inline-block w-2 h-4 bg-yellow-500 ml-1 animate-pulse"></span>
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  
                    {/* Audio Controls */}
                    <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-50/80 flex-shrink-0">
                      <div className="flex items-center space-x-4 mb-3">
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline" className="border-gray-300 hover:border-purple-400 hover:bg-purple-50">
                            <Play className="w-4 h-4 mr-2" />
                            Play Audio
                          </Button>
                          <Button size="sm" variant="outline" className="border-gray-300 hover:border-green-400 hover:bg-green-50">
                            <Download className="w-4 h-4 mr-2" />
                            Save Audio
                          </Button>
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 shadow-inner">
                          <div className="gradient-primary h-2 rounded-full w-1/3 transition-all duration-300 shadow-sm"></div>
                        </div>
                        <div className="text-sm text-gray-600 font-mono bg-white px-3 py-1 rounded-md border border-gray-200 shadow-sm">
                          02:34 / 05:15
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Volume2 className="w-3 h-3" />
                        <span>Real-time transcription of your podcast conversation</span>
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