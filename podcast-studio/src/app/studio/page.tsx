"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebar } from "@/contexts/sidebar-context";
import { 
  Mic, 
  BookOpen, 
  Brain, 
  Play,
  Pause,
  Square,
  FileText,
  Headphones,
  Download,
  RotateCcw,
  Volume2
} from "lucide-react";

interface Message {
  id: string;
  speaker: "Host" | "AI Expert" | "AI Researcher";
  content: string;
  timestamp: Date;
}

export default function Studio() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const { collapsed, toggleCollapsed } = useSidebar();
  const [transcript] = useState<Message[]>([
    {
      id: "1",
      speaker: "Host",
      content: "Welcome to today's AI Research Podcast. I'm here with two AI experts to discuss the fascinating paper on 'Attention Is All You Need'. Let's start with the basics - what problem were the authors trying to solve?",
      timestamp: new Date(2024, 0, 1, 14, 30, 0)
    },
    {
      id: "2", 
      speaker: "AI Expert",
      content: "Great question! The authors were addressing a fundamental limitation in sequence-to-sequence models that relied heavily on recurrent or convolutional neural networks. The main issue was that these architectures processed sequences sequentially, making it difficult to parallelize training and capture long-range dependencies effectively.",
      timestamp: new Date(2024, 0, 1, 14, 31, 0)
    },
    {
      id: "3",
      speaker: "Host", 
      content: "That's really interesting. So the Transformer architecture was designed to solve these parallelization issues?",
      timestamp: new Date(2024, 0, 1, 14, 32, 0)
    },
    {
      id: "4",
      speaker: "AI Researcher",
      content: "Exactly! The Transformer uses self-attention mechanisms to process all positions in the sequence simultaneously, allowing for much better parallelization during training. This was a game-changer for training efficiency.",
      timestamp: new Date(2024, 0, 1, 14, 33, 15)
    },
    {
      id: "5",
      speaker: "AI Expert",
      content: "To add to that, the attention mechanism essentially allows the model to focus on different parts of the input sequence when processing each element, creating rich contextual representations.",
      timestamp: new Date(2024, 0, 1, 14, 34, 30)
    },
    {
      id: "6",
      speaker: "Host",
      content: "That's fascinating! Could you both explain how this differs from traditional RNNs in more practical terms?",
      timestamp: new Date(2024, 0, 1, 14, 35, 45)
    }
  ]);
  const [sessionDuration, setSessionDuration] = useState(0);

  const currentPaper = {
    title: "Attention Is All You Need",
    authors: "Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit",
    abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely."
  };

  // Simulate timer
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setIsPaused(false);
  };

  const handlePauseRecording = () => {
    setIsPaused(!isPaused);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    setSessionDuration(0);
  };

  const handleExportAudio = () => {
    // Audio export functionality
    console.log("Exporting audio file...");
  };

  const handleExportTranscript = () => {
    // Transcript export functionality
    const transcriptText = transcript.map(msg => 
      `[${msg.timestamp.toLocaleTimeString()}] ${msg.speaker}: ${msg.content}`
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
              label: isRecording ? (isPaused ? 'PAUSED' : 'LIVE') : 'OFFLINE',
              color: isRecording ? 'red' : 'gray',
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
                    <div className="flex space-x-2">
                      {!isRecording ? (
                        <Button 
                          onClick={handleStartRecording}
                          variant="destructive"
                          size="lg"
                          className="flex-1"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Start Recording
                        </Button>
                      ) : (
                        <>
                          <Button 
                            onClick={handlePauseRecording}
                            variant="outline"
                            size="lg"
                            className="flex-1"
                          >
                            {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                            {isPaused ? 'Resume' : 'Pause'}
                          </Button>
                          <Button 
                            onClick={handleStopRecording}
                            variant="outline"
                            size="lg"
                            className="flex-1"
                          >
                            <Square className="w-4 h-4 mr-2" />
                            Stop
                          </Button>
                        </>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Button variant="ghost" className="w-full justify-start" onClick={handleExportAudio}>
                        <Download className="w-4 h-4 mr-2" />
                        Export Audio
                      </Button>
                      <Button variant="ghost" className="w-full justify-start" onClick={handleExportTranscript}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export Transcript
                      </Button>
                      <Button variant="ghost" className="w-full justify-start">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Clear Session
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Live Transcript */}
              <div className="lg:col-span-2">
                <Card className="h-[600px] flex flex-col animate-scale-in">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        <span>Live Transcript</span>
                      </CardTitle>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3 text-xs">
                          <div className="flex items-center space-x-1 text-gray-500">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span>Host (You)</span>
                          </div>
                          <div className="flex items-center space-x-1 text-gray-500">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span>AI Expert</span>
                          </div>
                          <div className="flex items-center space-x-1 text-gray-500">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span>AI Researcher</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                
                  <CardContent className="flex-1 flex flex-col p-0">
                    <ScrollArea className="flex-1 p-6">
                      <div className="space-y-6">
                        {transcript.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-start space-x-4 animate-fade-in"
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                              entry.speaker === "Host" 
                                ? "bg-purple-100 text-purple-600" 
                                : entry.speaker === "AI Expert"
                                ? "bg-blue-100 text-blue-600"
                                : "bg-green-100 text-green-600"
                            }`}>
                              {entry.speaker === "Host" ? (
                                <Headphones className="w-5 h-5" />
                              ) : (
                                <Brain className="w-5 h-5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {entry.speaker}
                                </span>
                                <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                                  {entry.timestamp.toLocaleTimeString('en-US', {
                                    hour: '2-digit', 
                                    minute: '2-digit', 
                                    second: '2-digit', 
                                    hour12: false
                                  })}
                                </span>
                              </div>
                              <div className={`p-4 rounded-xl border shadow-sm ${
                                entry.speaker === "Host"
                                  ? "bg-purple-50 border-purple-200 text-gray-800"
                                  : entry.speaker === "AI Expert"
                                  ? "bg-blue-50 border-blue-200 text-gray-800"
                                  : "bg-green-50 border-green-200 text-gray-800"
                              }`}>
                                <p className="text-sm leading-relaxed">{entry.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Live indicator when recording */}
                        {isRecording && (
                          <div className="flex items-center space-x-4 opacity-60 animate-pulse">
                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                              <Mic className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="text-sm text-gray-500 italic">
                              {isPaused ? "Recording paused..." : "Listening..."}
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  
                    {/* Audio Controls */}
                    <div className="p-6 border-t border-gray-200/60 bg-gray-50/50">
                      <div className="flex items-center space-x-4 mb-3">
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="ghost">
                            <Play className="w-4 h-4 mr-2" />
                            Play Audio
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Download className="w-4 h-4 mr-2" />
                            Save Audio
                          </Button>
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div className="gradient-primary h-2 rounded-full w-1/3 transition-all duration-300"></div>
                        </div>
                        <div className="text-sm text-gray-500 font-mono">
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