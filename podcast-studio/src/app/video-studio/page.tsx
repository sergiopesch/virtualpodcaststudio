"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Video, 
  Settings, 
  Play,
  Pause,
  Square,
  FileText,
  Headphones,
  Clock,
  Download,
  Upload,
  Mic,
  Camera,
  Layers,
  Zap,
  Image,
  SkipBack,
  SkipForward,
  Volume2,
  Scissors,
  Copy,
  Trash2,
  Plus,
  ZoomIn,
  ZoomOut,
  Search,
  Archive
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface VideoClip {
  id: string;
  type: "video" | "audio" | "image" | "text";
  name: string;
  startTime: number;
  duration: number;
  track: number;
  speaker?: "Host" | "Expert";
  content?: string;
  visualStyle?: "talking-head" | "paper-visual" | "diagram" | "transition";
  thumbnailUrl?: string;
}


export default function VideoStudio() {
  const [isRendering, setIsRendering] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [trimMode, setTrimMode] = useState(false);
  const [trimmingClip, setTrimmingClip] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  
  const [videoClips, setVideoClips] = useState<VideoClip[]>([
    {
      id: "1",
      type: "video",
      name: "Host Introduction",
      startTime: 0,
      duration: 15,
      track: 1,
      speaker: "Host",
      content: "Welcome to today's AI Research Podcast",
      visualStyle: "talking-head"
    },
    {
      id: "2",
      type: "audio",
      name: "Background Music",
      startTime: 0,
      duration: 45,
      track: 3
    },
    {
      id: "3",
      type: "video",
      name: "Expert Response",
      startTime: 15,
      duration: 18,
      track: 1,
      speaker: "Expert",
      content: "The authors were addressing fundamental limitations",
      visualStyle: "paper-visual"
    },
    {
      id: "4",
      type: "image",
      name: "Paper Diagram",
      startTime: 20,
      duration: 10,
      track: 2,
      visualStyle: "diagram"
    }
  ]);
  
  const [renderDuration, setRenderDuration] = useState(0);

  const currentPaper = {
    title: "Attention Is All You Need",
    authors: "Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit",
    audioFile: "conversation_20240101_143000.wav"
  };

  // Simulate render timer
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRendering && !isPaused) {
      interval = setInterval(() => {
        setRenderDuration(prev => prev + 1);
        setRenderProgress(prev => Math.min(prev + 0.5, 100));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRendering, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRender = () => {
    setIsRendering(true);
    setIsPaused(false);
    setRenderProgress(0);
  };

  const handlePauseRender = () => {
    setIsPaused(!isPaused);
  };

  const handleStopRender = () => {
    setIsRendering(false);
    setIsPaused(false);
    setRenderDuration(0);
    setRenderProgress(0);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.5, 4));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.25));
  };

  const handleClipSelect = (clipId: string, multiSelect = false) => {
    if (multiSelect) {
      setSelectedClips(prev => 
        prev.includes(clipId) 
          ? prev.filter(id => id !== clipId)
          : [...prev, clipId]
      );
    } else {
      setSelectedClips([clipId]);
    }
  };

  const handleDeleteClip = () => {
    setVideoClips(prev => prev.filter(clip => !selectedClips.includes(clip.id)));
    setSelectedClips([]);
  };

  const handleTrimMode = () => {
    setTrimMode(!trimMode);
    if (trimMode) {
      setTrimmingClip(null);
    }
  };

  const handleTrimClip = (clipId: string) => {
    if (trimMode) {
      setTrimmingClip(clipId);
    }
  };

  const handleSplitClip = (clipId: string, splitTime: number) => {
    const clip = videoClips.find(c => c.id === clipId);
    if (!clip) return;

    const splitPosition = splitTime - clip.startTime;
    if (splitPosition <= 0 || splitPosition >= clip.duration) return;

    const newClip: VideoClip = {
      ...clip,
      id: `${clip.id}_split`,
      startTime: clip.startTime + splitPosition,
      duration: clip.duration - splitPosition
    };

    setVideoClips(prev => prev.map(c => 
      c.id === clipId 
        ? { ...c, duration: splitPosition }
        : c
    ).concat(newClip));
  };


  const getTrackColor = (track: number) => {
    const colors = ["bg-purple-100", "bg-blue-100", "bg-green-100", "bg-orange-100"];
    return colors[track - 1] || "bg-gray-100";
  };

  const getClipTypeIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="w-3 h-3" />;
      case "audio": return <Volume2 className="w-3 h-3" />;
      case "image": return <Image className="w-3 h-3" />;
      case "text": return <FileText className="w-3 h-3" />;
      default: return <Layers className="w-3 h-3" />;
    }
  };

  // Calculate total project duration
  const totalDuration = Math.max(...videoClips.map(clip => clip.startTime + clip.duration), 60);
  const pixelsPerSecond = zoomLevel * 10;


  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-56 md:w-64 bg-white border-r border-gray-200 min-h-screen flex-shrink-0">
          <div className="p-6">
            <div 
              className="flex items-center space-x-3 mb-8 cursor-pointer"
              onClick={() => window.location.href = '/'}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Headphones className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 truncate">Virtual Podcast Studio</h1>
            </div>
            
            <nav className="space-y-2">
              <Link 
                href="/"
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/' 
                    ? 'bg-purple-50 text-purple-700' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Search className="w-4 h-4" />
                <span className="text-sm font-medium">Research Hub</span>
              </Link>
              <Link 
                href="/studio"
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/studio' 
                    ? 'bg-purple-50 text-purple-700' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span className="text-sm font-medium">Audio Studio</span>
              </Link>
              <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-purple-50 text-purple-700">
                <Video className="w-4 h-4" />
                <span className="text-sm font-medium">Video Studio</span>
              </div>
              <Link 
                href="/publisher"
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/publisher' 
                    ? 'bg-purple-50 text-purple-700' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium">Publisher</span>
              </Link>
              <Link 
                href="/library"
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/library' 
                    ? 'bg-purple-50 text-purple-700' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Archive className="w-4 h-4" />
                <span className="text-sm font-medium">Episode Library</span>
              </Link>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-gray-50">
          {/* Top Navigation */}
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Video Studio</h1>
                  <p className="text-gray-600 mt-1">Generate video rendering from conversation transcripts</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isRendering ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className={`text-sm font-medium ${isRendering ? 'text-green-600' : 'text-gray-500'}`}>
                    {isRendering ? (isPaused ? 'PAUSED' : 'RENDERING') : 'READY'}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm font-mono">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{formatTime(renderDuration)}</span>
                </div>
                {isRendering && (
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{width: `${renderProgress}%`}}></div>
                    </div>
                    <span className="text-xs text-gray-500">{Math.round(renderProgress)}%</span>
                  </div>
                )}
                <Button variant="ghost" size="sm" className="text-gray-600">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </header>

          <div className="p-4 md:p-6 flex flex-col h-full">
            {/* Video Editor - Main Component */}
            <div className="flex-1 flex flex-col space-y-4">
              {/* Top Panel: Preview + Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-80">
                {/* Video Preview - 3/4 width */}
                <div className="lg:col-span-3">
                  <Card className="h-full">
                    <CardContent className="p-4 h-full flex flex-col">
                      <div className="bg-black rounded-lg aspect-video flex items-center justify-center mb-4 flex-1">
                        <div className="text-center text-gray-400">
                          <Camera className="w-16 h-16 mx-auto mb-3 opacity-50" />
                          <p className="text-lg">Video Preview</p>
                          <p className="text-sm">Time: {formatTime(currentTime)}</p>
                        </div>
                      </div>
                      
                      {/* Playback Controls */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Button size="sm" variant="ghost">
                            <SkipBack className="w-4 h-4" />
                          </Button>
                          <Button onClick={handlePlayPause} size="lg" className="bg-blue-600 hover:bg-blue-700">
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                          </Button>
                          <Button size="sm" variant="ghost">
                            <SkipForward className="w-4 h-4" />
                          </Button>
                          <div className="flex items-center space-x-2 ml-4">
                            <Volume2 className="w-4 h-4 text-gray-500" />
                            <div className="w-16 h-1 bg-gray-300 rounded-full">
                              <div className="w-3/4 h-1 bg-blue-600 rounded-full"></div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-mono text-gray-500">00:02:34 / 00:05:15</div>
                          {!isRendering ? (
                            <Button onClick={handleStartRender} className="bg-green-600 hover:bg-green-700 text-white">
                              <Play className="w-4 h-4 mr-2" />
                              Render
                            </Button>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <Button onClick={handlePauseRender} variant="outline" size="sm">
                                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                              </Button>
                              <Button onClick={handleStopRender} variant="outline" size="sm">
                                <Square className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Right Panel: Source & Settings - 1/4 width */}
                <div className="lg:col-span-1 space-y-4">
                  {/* Source Audio */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center space-x-2">
                        <Headphones className="w-4 h-4 text-purple-600" />
                        <span>Source</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                      <h4 className="text-xs font-semibold text-gray-900 line-clamp-2 mb-1 leading-tight">
                      {currentPaper.title}
                      </h4>
                      <p className="text-xs text-gray-600 mb-2 truncate">
                      {currentPaper.authors}
                      </p>
                        <div className="flex items-center space-x-1 text-xs text-gray-500 bg-gray-50 p-1 rounded">
                          <FileText className="w-3 h-3" />
                          <span className="truncate">{currentPaper.audioFile}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Settings */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center space-x-2">
                        <Settings className="w-4 h-4 text-gray-600" />
                        <span>Settings</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <select className="w-full text-xs border border-gray-300 rounded p-1">
                        <option>1080p HD</option>
                        <option>720p HD</option>
                        <option>4K UHD</option>
                      </select>
                      <select className="w-full text-xs border border-gray-300 rounded p-1">
                        <option>Professional</option>
                        <option>Academic</option>
                        <option>Podcast</option>
                      </select>
                      <div className="flex space-x-1">
                        <Button size="sm" variant="ghost" className="flex-1 text-xs">
                          <Download className="w-3 h-3 mr-1" />
                          Export
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Timeline Editor - Main Focus */}
              <Card className="flex-1 min-h-[400px] flex flex-col">
                <CardHeader className="border-b border-gray-200 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Layers className="w-5 h-5 text-blue-600" />
                      <span>Timeline Editor</span>
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="ghost" onClick={handleZoomOut}>
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-gray-500 font-mono">{Math.round(zoomLevel * 100)}%</span>
                      <Button size="sm" variant="ghost" onClick={handleZoomIn}>
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                      <div className="h-4 w-px bg-gray-300 mx-2"></div>
                      <Button 
                        size="sm" 
                        variant={trimMode ? "default" : "ghost"}
                        onClick={handleTrimMode}
                        className={trimMode ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}
                      >
                        <Scissors className="w-4 h-4 mr-1" />
                        {trimMode ? "Exit Trim" : "Trim Mode"}
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Plus className="w-4 h-4 mr-1" />
                        Add Clip
                      </Button>
                      {selectedClips.length > 0 && (
                        <>
                          <Button size="sm" variant="ghost">
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => selectedClips.forEach(clipId => handleSplitClip(clipId, currentTime))}
                          >
                            <Scissors className="w-4 h-4 mr-1" />
                            Split at Playhead
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleDeleteClip}>
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                  <div className="flex">
                    {/* Track Labels */}
                    <div className="w-24 flex-shrink-0 bg-gray-50 border-r border-gray-200">
                      <div className="h-8 border-b border-gray-200 flex items-center px-3">
                        <span className="text-xs font-semibold text-gray-600">TRACKS</span>
                      </div>
                      {[1, 2, 3, 4].map(trackNum => (
                        <div key={trackNum} className="h-16 border-b border-gray-200 flex items-center px-3">
                          <span className="text-xs text-gray-500">Track {trackNum}</span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Timeline Area */}
                    <div className="flex-1 overflow-x-auto">
                      <div 
                        ref={timelineRef}
                        className="relative"
                        style={{ width: `${totalDuration * pixelsPerSecond}px`, minWidth: '100%' }}
                      >
                        {/* Time Ruler */}
                        <div className="h-8 border-b border-gray-200 bg-gray-50 relative">
                          {Array.from({ length: Math.ceil(totalDuration / 5) }, (_, i) => (
                            <div
                              key={i}
                              className="absolute border-l border-gray-300"
                              style={{ left: `${i * 5 * pixelsPerSecond}px` }}
                            >
                              <span className="text-xs text-gray-600 ml-1">
                                {formatTime(i * 5)}
                              </span>
                            </div>
                          ))}
                          {/* Playhead */}
                          <div
                            className="absolute top-0 w-px bg-red-500 h-full z-10"
                            style={{ left: `${currentTime * pixelsPerSecond}px` }}
                          >
                            <div className="w-3 h-3 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1"></div>
                          </div>
                        </div>
                        
                        {/* Tracks */}
                        {[1, 2, 3, 4].map(trackNum => (
                          <div key={trackNum} className="h-16 border-b border-gray-200 relative bg-white">
                            {videoClips
                              .filter(clip => clip.track === trackNum)
                              .map(clip => (
                                <div
                                  key={clip.id}
                                  className={`absolute h-12 mt-2 rounded border-2 cursor-pointer transition-all ${
                                    selectedClips.includes(clip.id)
                                      ? 'border-blue-500 bg-blue-100'
                                      : trimMode && trimmingClip === clip.id
                                      ? 'border-orange-500 bg-orange-100'
                                      : `border-gray-300 ${getTrackColor(trackNum)} hover:border-gray-400`
                                  }`}
                                  style={{
                                    left: `${clip.startTime * pixelsPerSecond}px`,
                                    width: `${clip.duration * pixelsPerSecond}px`,
                                    minWidth: '60px'
                                  }}
                                  onClick={(e) => {
                                    if (trimMode) {
                                      handleTrimClip(clip.id);
                                    } else {
                                      handleClipSelect(clip.id, e.metaKey || e.ctrlKey);
                                    }
                                  }}
                                >
                                  <div className="p-2 h-full flex items-center overflow-hidden">
                                  <div className="flex items-center space-x-1 min-w-0 overflow-hidden">
                                  {getClipTypeIcon(clip.type)}
                                  <span className="text-xs font-medium truncate text-gray-800">
                                  {clip.name}
                                  </span>
                                  </div>
                                  </div>
                                  
                                  {/* Trim handles - only show in trim mode */}
                                  {trimMode && trimmingClip === clip.id && (
                                    <>
                                      {/* Left trim handle */}
                                      <div className="absolute left-0 top-0 w-2 h-full bg-orange-600 cursor-ew-resize flex items-center justify-center">
                                        <div className="w-1 h-6 bg-white rounded"></div>
                                      </div>
                                      {/* Right trim handle */}
                                      <div className="absolute right-0 top-0 w-2 h-full bg-orange-600 cursor-ew-resize flex items-center justify-center">
                                        <div className="w-1 h-6 bg-white rounded"></div>
                                      </div>
                                      {/* Trim overlay */}
                                      <div className="absolute inset-0 border-2 border-orange-500 rounded pointer-events-none">
                                        <div className="absolute -top-6 left-0 text-xs text-orange-600 font-semibold bg-white px-1 rounded">
                                          TRIMMING
                                        </div>
                                      </div>
                                    </>
                                  )}
                                  
                                  {/* Regular resize handles - only show when not in trim mode */}
                                  {!trimMode && (
                                    <>
                                      <div className="absolute left-0 top-0 w-1 h-full bg-blue-600 opacity-0 hover:opacity-100 cursor-ew-resize"></div>
                                      <div className="absolute right-0 top-0 w-1 h-full bg-blue-600 opacity-0 hover:opacity-100 cursor-ew-resize"></div>
                                    </>
                                  )}
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Media Browser & Asset Library */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-32">
                <Card className="lg:col-span-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center space-x-2">
                      <Image className="w-4 h-4 text-orange-600" />
                      <span>Media Library</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-20">
                      <div className="flex space-x-3">
                        {[
                          { name: "Host Avatar", type: "video", duration: "0:45" },
                          { name: "Paper Visual", type: "image", duration: "static" },
                          { name: "Background Music", type: "audio", duration: "2:30" },
                          { name: "Transition Effect", type: "effect", duration: "0:05" },
                          { name: "Diagram Animation", type: "video", duration: "0:30" },
                          { name: "Logo Intro", type: "video", duration: "0:10" }
                        ].map((asset, i) => (
                          <div
                            key={i}
                            className="flex-shrink-0 w-20 h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-center justify-center w-6 h-6 mb-1">
                              {asset.type === "video" ? <Video className="w-4 h-4 text-blue-600" /> :
                               asset.type === "audio" ? <Volume2 className="w-4 h-4 text-green-600" /> :
                               asset.type === "image" ? <Image className="w-4 h-4 text-purple-600" /> :
                               <Zap className="w-4 h-4 text-orange-600" />}
                            </div>
                            <div className="text-xs text-center leading-tight px-1">
                            <div className="font-medium truncate w-full text-gray-800">{asset.name}</div>
                            <div className="text-gray-500 text-xs">{asset.duration}</div>
                            </div>
                          </div>
                        ))}
                        <div className="flex-shrink-0 w-20 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                          <Plus className="w-6 h-6 text-gray-400" />
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
