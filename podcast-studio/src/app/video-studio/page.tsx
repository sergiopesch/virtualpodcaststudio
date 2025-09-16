"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Sidebar } from "@/components/layout/sidebar";
// Removed Header to avoid a second page-level nav on this route
import { useSidebar } from "@/contexts/sidebar-context";
import {
  Video,
  Settings,
  Play,
  Pause,
  Square,
  FileText,
  Camera,
  Image,
  SkipBack,
  SkipForward,
  Volume2,
  Scissors,
  Plus,
  ZoomIn,
  ZoomOut,
  VolumeX,
  Magnet,
  Menu,
  MoreHorizontal,
  Folder,
  Sliders,
  Search,
  Layers,
  Wand2,
  Palette,
  Filter,
  Download,
  Upload,
  Copy,
  Trash2,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Move,
  MousePointer2,
  Hand,
  Type,
  Music,
  Mic,
  Headphones,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Star,
  Sparkles,
  Zap,
  Target,
  Grid,
  Maximize2,
  Minimize2,
  FullScreen,
  PictureInPicture,
  Rewind,
  FastForward,
  SkipBackward,
  SkipForward as SkipForwardIcon,
} from "lucide-react";

// Shared util so both the main component and SimpleInspectorPanel can render icons
function getClipTypeIcon(type: VideoClip["type"], size = "w-4 h-4") {
  const iconClass = `${size} flex-shrink-0`;
  switch (type) {
    case "video":
      return <Video className={`${iconClass} text-blue-600`} />;
    case "audio":
      return <Volume2 className={`${iconClass} text-green-600`} />;
    case "image":
      return <Image className={`${iconClass} text-purple-600`} />;
    case "text":
      return <Type className={`${iconClass} text-orange-600`} />;
    case "effect":
      return <Wand2 className={`${iconClass} text-pink-600`} />;
    case "transition":
      return <Sparkles className={`${iconClass} text-indigo-600`} />;
    default:
      return <FileText className={`${iconClass} text-gray-600`} />;
  }
}

interface VideoClip {
  id: string;
  type: "video" | "audio" | "image" | "text" | "effect" | "transition";
  name: string;
  startTime: number;
  duration: number;
  track: number;
  speaker?: "Host" | "Expert";
  content?: string;
  visualStyle?: "talking-head" | "paper-visual" | "diagram" | "transition" | "overlay" | "background";
  thumbnailUrl?: string;
  volume?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  // Advanced properties
  opacity?: number;
  scale?: number;
  rotation?: number;
  x?: number;
  y?: number;
  filters?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    hue?: number;
    blur?: number;
    sharpen?: number;
  };
  keyframes?: {
    time: number;
    properties: Record<string, number>;
  }[];
  locked?: boolean;
  muted?: boolean;
  solo?: boolean;
  color?: string;
  waveform?: number[];
}

interface TimelineMarker {
  id: string;
  time: number;
  label?: string;
  color?: string;
  type?: "marker" | "chapter" | "cut" | "bookmark";
}

interface Effect {
  id: string;
  name: string;
  category: "color" | "blur" | "distort" | "stylize" | "noise" | "light";
  icon: React.ReactNode;
  previewUrl?: string;
  parameters: {
    name: string;
    type: "slider" | "color" | "dropdown" | "checkbox";
    min?: number;
    max?: number;
    default: any;
    options?: string[];
  }[];
}

interface Transition {
  id: string;
  name: string;
  duration: number;
  type: "fade" | "slide" | "zoom" | "wipe" | "dissolve" | "push";
  direction?: "left" | "right" | "up" | "down";
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  previewUrl?: string;
}

type Tool = "select" | "razor" | "hand" | "zoom" | "text" | "crop";

type ViewMode = "timeline" | "storyboard" | "multicam" | "color";

export default function VideoStudio() {
  // Core playback and timeline state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [volume, setVolume] = useState(0.75);

  // UI state for responsive layout
  const [activeTab, setActiveTab] = useState("media");
  const [showWaveforms, setShowWaveforms] = useState(true);

  // Refs
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { } = useSidebar();

  // Enhanced sample data with professional features
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
      visualStyle: "talking-head",
      volume: 0.8,
      opacity: 1,
      scale: 1,
      rotation: 0,
      x: 0,
      y: 0,
      color: "#3b82f6",
      filters: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hue: 0,
        blur: 0,
        sharpen: 0,
      },
      waveform: [],
    },
    {
      id: "2",
      type: "audio",
      name: "Background Music",
      startTime: 0,
      duration: 45,
      track: 3,
      volume: 0.3,
      fadeInSec: 2,
      fadeOutSec: 3,
      color: "#10b981",
      waveform: [],
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
      visualStyle: "paper-visual",
      volume: 0.9,
      opacity: 1,
      scale: 1.05,
      color: "#8b5cf6",
      filters: {
        brightness: 105,
        contrast: 110,
        saturation: 95,
        hue: 0,
        blur: 0,
        sharpen: 0,
      },
      waveform: [],
    },
    {
      id: "4",
      type: "image",
      name: "Paper Diagram",
      startTime: 20,
      duration: 10,
      track: 2,
      visualStyle: "diagram",
      opacity: 0.9,
      scale: 1,
      color: "#f59e0b",
    },
  ]);

  const [viewportWidthPx, setViewportWidthPx] = useState(0);

  // Simplified media library
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState<"all" | "video" | "audio" | "image">("all");
  
  const mediaAssets = React.useMemo(() => ([
    { name: "Host Avatar", type: "video" as const, duration: "0:45" },
    { name: "Paper Visual", type: "image" as const, duration: "static" },
    { name: "Background Music", type: "audio" as const, duration: "2:30" },
    { name: "Diagram Animation", type: "video" as const, duration: "0:30" },
    { name: "Logo Intro", type: "video" as const, duration: "0:10" },
  ]), []);

  const filteredMediaAssets = React.useMemo(() => {
    const q = mediaQuery.trim().toLowerCase();
    return mediaAssets.filter(a =>
      (mediaFilter === "all" || a.type === mediaFilter) &&
      (q === "" || a.name.toLowerCase().includes(q))
    );
  }, [mediaAssets, mediaFilter, mediaQuery]);

  // Simplified track settings
  const [trackSettings, setTrackSettings] = useState<Record<number, { 
    mute: boolean; 
    volume: number; 
    name: string;
  }>>({
    1: { mute: false, volume: 1, name: "Video" },
    2: { mute: false, volume: 1, name: "Audio" },
    3: { mute: false, volume: 0.7, name: "Music" },
  });

  const currentPaper = {
    title: "Attention Is All You Need",
    authors: "Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit",
    audioFile: "conversation_20240101_143000.wav",
  };

  // Timeline calculations
  const totalDuration = Math.max(
    ...videoClips.map((clip) => clip.startTime + clip.duration),
    60
  );
  const pixelsPerSecond = zoomLevel * 10;
  
  // Deterministic waveform generation to avoid hydration mismatch
  const seededRandom = (seed: number) => {
    let t = seed >>> 0;
    return () => {
      // xorshift32
      t ^= t << 13; t ^= t >>> 17; t ^= t << 5;
      // map to 0..1
      return ((t >>> 0) / 4294967295);
    };
  };

  const generateWaveform = useCallback((id: string, length: number, amplitude = 1, floor = 0.1) => {
    const seed = Array.from(id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const rnd = seededRandom(seed);
    const values: number[] = [];
    for (let i = 0; i < length; i++) {
      const v = rnd() * amplitude + floor;
      values.push(Math.max(0, Math.min(1, v)));
    }
    return values;
  }, []);

  // Populate waveforms once on mount (SSR-safe, deterministic)
  useEffect(() => {
    setVideoClips(prev => prev.map(clip => {
      if (clip.type === "audio") {
        const len = Math.max(30, Math.floor(clip.duration * 10));
        return { ...clip, waveform: clip.waveform?.length ? clip.waveform : generateWaveform(clip.id, len, 0.6, 0.05) };
      }
      if (clip.type === "video") {
        const len = Math.max(30, Math.floor(clip.duration * 6));
        return { ...clip, waveform: clip.waveform?.length ? clip.waveform : generateWaveform(clip.id, len, 0.4, 0.05) };
      }
      return clip;
    }));
  }, [generateWaveform]);

  const updateViewport = () => {
    if (scrollerRef.current) {
      setViewportWidthPx(scrollerRef.current.clientWidth || 0);
    }
  };

  // Playback simulation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.1;
        if (next >= totalDuration) {
          clearInterval(interval);
          return totalDuration;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  // Enhanced utility functions
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30); // 30 FPS
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${frames.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${frames.toString().padStart(2, "0")}`;
  };

  // getClipTypeIcon moved to module scope above

  // Event handlers
  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev * 1.5, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev / 1.5, 0.25));
  const handleSkip = (deltaSeconds: number) => {
    setCurrentTime((prev) => Math.max(0, Math.min(prev + deltaSeconds, totalDuration)));
  };

  const handleClipSelect = (clipId: string, multiSelect = false) => {
    if (multiSelect) {
      setSelectedClips((prev) =>
        prev.includes(clipId)
          ? prev.filter((id) => id !== clipId)
          : [...prev, clipId]
      );
    } else {
      setSelectedClips([clipId]);
    }
  };

  const toggleTrackMute = (track: number) => {
    setTrackSettings((prev) => ({
      ...prev,
      [track]: { ...prev[track], mute: !prev[track].mute }
    }));
  };

  const handleAddClipClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    // Handle file upload logic here
    console.log("Files selected:", files);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="hidden md:flex w-56">
          <Sidebar />
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video Preview */}
          <div className="p-4 bg-white border-b border-gray-200">
            <div className="max-w-4xl mx-auto aspect-video bg-black rounded-lg relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white/70 text-center">
                  <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Video Preview</p>
                  <p className="text-xs opacity-70">{formatTime(currentTime)} / {formatTime(totalDuration)}</p>
                </div>
              </div>
              {/* Inline essential controls */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleSkip(-10)}>
                    <Rewind className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handlePlayPause}>
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleSkip(10)}>
                    <FastForward className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleStop}>
                    <Square className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={handleZoomOut}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleZoomIn}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleAddClipClick}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {/* Simple scrubber */}
              <div className="absolute bottom-16 left-4 right-4">
                <div className="bg-white/20 h-1 rounded-full">
                  <div 
                    className="bg-purple-500 h-1 rounded-full transition-all"
                    style={{ width: `${(currentTime / totalDuration) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Timeline */}
          <div className="flex-1 bg-white border-t border-gray-200 flex">
            {/* Track Labels */}
            <div className="w-32 bg-gray-50 border-r border-gray-200">
              <div className="h-8 border-b border-gray-200 flex items-center px-3">
                <span className="text-xs font-semibold text-gray-600">TRACKS</span>
              </div>
              {Object.entries(trackSettings).map(([trackNum, settings]) => (
                <div key={trackNum} className="h-16 border-b border-gray-200 flex items-center justify-between px-2">
                  <span className="text-xs text-gray-600">{settings.name}</span>
                  <Button
                    size="xs"
                    variant={settings.mute ? "destructive" : "ghost"}
                    onClick={() => toggleTrackMute(parseInt(trackNum))}
                  >
                    {settings.mute ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </Button>
                </div>
              ))}
            </div>
            
            {/* Timeline Area */}
            <div className="flex-1 overflow-x-auto" ref={scrollerRef}>
              <div
                ref={timelineRef}
                className="relative bg-white"
                style={{
                  width: `${totalDuration * pixelsPerSecond}px`,
                  minWidth: "100%",
                  height: "100%",
                }}
              >
                {/* Time Ruler */}
                <div className="h-8 border-b border-gray-200 bg-gray-50 relative">
                  {Array.from({ length: Math.ceil(totalDuration / 10) + 1 }, (_, i) => i * 10).map((time) => (
                    <div key={time}>
                      <div
                        className="absolute border-l border-gray-300"
                        style={{
                          left: `${time * pixelsPerSecond}px`,
                          top: 0,
                          bottom: 0,
                        }}
                      />
                      <div
                        className="absolute text-xs text-gray-600 ml-1"
                        style={{ left: `${time * pixelsPerSecond}px`, top: 2 }}
                      >
                        {formatTime(time)}
                      </div>
                    </div>
                  ))}

                  {/* Playhead */}
                  <div
                    className="absolute top-0 z-20 pointer-events-none"
                    style={{ left: `${currentTime * pixelsPerSecond}px` }}
                  >
                    <div className="relative -translate-x-1/2">
                      <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-purple-500" />
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[2px] bg-purple-500" style={{ height: '200px' }} />
                    </div>
                  </div>
                </div>

                {/* Tracks */}
                {Object.keys(trackSettings).map((trackNum) => (
                  <div key={trackNum} className="h-16 border-b border-gray-200 relative">
                    {videoClips
                      .filter((clip) => clip.track === parseInt(trackNum))
                      .map((clip) => (
                        <div
                          key={clip.id}
                          className={`absolute h-12 mt-2 rounded border-2 cursor-pointer transition-all ${
                            selectedClips.includes(clip.id)
                              ? "border-purple-500 bg-purple-100"
                              : "border-gray-300 bg-white hover:border-gray-400"
                          }`}
                          style={{
                            left: `${clip.startTime * pixelsPerSecond}px`,
                            width: `${clip.duration * pixelsPerSecond}px`,
                            minWidth: "60px",
                          }}
                          onClick={() => handleClipSelect(clip.id)}
                        >
                          <div className="p-2 h-full flex items-center">
                            <div className="flex items-center space-x-1">
                              {getClipTypeIcon(clip.type)}
                              <span className="text-xs font-medium truncate">
                                {clip.name}
                              </span>
                            </div>
                          </div>
                          
                          {/* Simple waveform for audio */}
                          {clip.type === "audio" && clip.waveform && showWaveforms && (
                            <div className="absolute bottom-1 left-1 right-1 h-2 flex items-end space-x-px">
                              {clip.waveform.slice(0, Math.floor(clip.duration * 2)).map((amplitude, i) => (
                                <div
                                  key={i}
                                  className="bg-purple-400 opacity-60 flex-1"
                                  style={{ height: `${amplitude * 100}%`, minHeight: '1px' }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Inspector Panel */}
        <div className="hidden lg:flex w-80 bg-white border-l border-gray-200">
          <SimpleInspectorPanel
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            mediaAssets={filteredMediaAssets}
            mediaQuery={mediaQuery}
            setMediaQuery={setMediaQuery}
            mediaFilter={mediaFilter}
            setMediaFilter={setMediaFilter}
            selectedClips={selectedClips}
            videoClips={videoClips}
            volume={volume}
            setVolume={setVolume}
          />
        </div>
      </div>
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />
    </div>
  );
}

// Simplified Inspector Panel
function SimpleInspectorPanel({
  activeTab,
  setActiveTab,
  mediaAssets,
  mediaQuery,
  setMediaQuery,
  mediaFilter,
  setMediaFilter,
  selectedClips,
  videoClips,
  volume,
  setVolume,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mediaAssets: any[];
  mediaQuery: string;
  setMediaQuery: (query: string) => void;
  mediaFilter: "all" | "video" | "audio" | "image";
  setMediaFilter: (filter: "all" | "video" | "audio" | "image") => void;
  selectedClips: string[];
  videoClips: VideoClip[];
  volume: number;
  setVolume: (volume: number) => void;
}) {
  const selectedClip = selectedClips.length === 1 ? videoClips.find(c => c.id === selectedClips[0]) : null;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2 shrink-0">
        <TabsTrigger value="media" className="flex items-center space-x-1">
          <Folder className="w-4 h-4" />
          <span className="hidden sm:inline">Media</span>
        </TabsTrigger>
        <TabsTrigger value="properties" className="flex items-center space-x-1">
          <Sliders className="w-4 h-4" />
          <span className="hidden sm:inline">Properties</span>
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-hidden">
        <TabsContent value="media" className="h-full">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search media..."
                  value={mediaQuery}
                  onChange={(e) => setMediaQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex space-x-1">
                {["all", "video", "audio", "image"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setMediaFilter(filter as any)}
                    className={`px-3 py-1 text-xs rounded ${
                      mediaFilter === filter
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {mediaAssets.map((asset, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200"
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      {asset.type === "video" ? (
                        <Video className="w-5 h-5 text-purple-600" />
                      ) : asset.type === "audio" ? (
                        <Volume2 className="w-5 h-5 text-purple-600" />
                      ) : (
                        <Image className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{asset.name}</div>
                      <div className="text-xs text-gray-500">{asset.type.toUpperCase()} • {asset.duration}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="properties" className="h-full">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Master Volume</h3>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">{Math.round(volume * 100)}%</div>
              </div>

              {selectedClip && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Selected Clip</h3>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      {getClipTypeIcon(selectedClip.type)}
                      <span className="text-sm font-medium">{selectedClip.name}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Duration: {selectedClip.duration}s • Track: {selectedClip.track}
                    </div>
                    {selectedClip.volume !== undefined && (
                      <div className="mt-2">
                        <label className="text-xs text-gray-600">Volume</label>
                        <div className="text-xs text-gray-500">{Math.round(selectedClip.volume * 100)}%</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </div>
    </Tabs>
  );
}