"use client";
import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebar } from "@/contexts/sidebar-context";
import {
  Video,
  Play,
  Pause,
  Square,
  FileText,
  Camera,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Plus,
  ZoomIn,
  ZoomOut,
  Magnet,
  Folder,
  Sliders,
  Search,
  Wand2,
  Sparkles,
  Download,
  Upload,
  Type,
  Rewind,
  FastForward,
  Trash2,
} from "lucide-react";

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const seededRandom = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t ^= t << 13;
    t ^= t >>> 17;
    t ^= t << 5;
    return (t >>> 0) / 4294967295;
  };
};

const generateWaveform = (
  id: string,
  length: number,
  amplitude = 1,
  floor = 0.1,
) => {
  const seed = Array.from(id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const rnd = seededRandom(seed);
  const values: number[] = [];
  for (let i = 0; i < length; i++) {
    const value = rnd() * amplitude + floor;
    values.push(Math.max(0, Math.min(1, value)));
  }
  return values;
};

const hexToRgb = (hex: string) => {
  const sanitized = hex.replace("#", "");
  if (sanitized.length !== 6) {
    return { r: 99, g: 102, b: 241 };
  }
  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  return { r, g, b };
};

const applyAlphaToHex = (hex: string, alpha: number) => {
  if (!hex.startsWith("#")) {
    return hex;
  }
  const sanitized = hex.slice(1);
  if (sanitized.length !== 6) {
    return hex;
  }
  const alphaHex = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${sanitized}${alphaHex}`;
};

type ClipType = "video" | "audio" | "image" | "text" | "effect" | "transition";
interface VideoClip {
  id: string;
  type: ClipType;
  name: string;
  startTime: number;
  duration: number;
  track: number;
  speaker?: "Host" | "Expert";
  content?: string;
  visualStyle?:
    | "talking-head"
    | "paper-visual"
    | "diagram"
    | "transition"
    | "overlay"
    | "background";
  thumbnailUrl?: string;
  volume?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
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

type MediaFilter = "all" | "video" | "audio" | "image";
interface MediaAsset {
  id: string;
  name: string;
  type: Exclude<MediaFilter, "all">;
  duration: string;
  source: "library" | "imported";
}

function getClipTypeIcon(type: ClipType, size = "w-4 h-4") {
  const iconClass = `${size} flex-shrink-0`;
  switch (type) {
    case "video":
      return <Video className={`${iconClass} text-blue-600`} />;
    case "audio":
      return <Volume2 className={`${iconClass} text-green-600`} />;
    case "image":
      return <ImageIcon className={`${iconClass} text-purple-600`} />;
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

const WAVEFORM_HEIGHT = 36;
const MIN_WAVEFORM_SAMPLES = 24;
const WAVEFORM_VERTICAL_PADDING = 2;

const createDefaultMediaAssets = (): MediaAsset[] => [
  { id: createId(), name: "Host Avatar", type: "video", duration: "0:45", source: "library" },
  { id: createId(), name: "Paper Visual", type: "image", duration: "Static", source: "library" },
  { id: createId(), name: "Background Music", type: "audio", duration: "2:30", source: "library" },
  { id: createId(), name: "Diagram Animation", type: "video", duration: "0:30", source: "library" },
  { id: createId(), name: "Logo Intro", type: "video", duration: "0:10", source: "library" },
];

const createInitialClips = (): VideoClip[] => [
  {
    id: "clip-1",
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
    waveform: generateWaveform("clip-1", 90, 0.4, 0.05),
  },
  {
    id: "clip-2",
    type: "audio",
    name: "Background Music",
    startTime: 0,
    duration: 45,
    track: 3,
    volume: 0.3,
    fadeInSec: 2,
    fadeOutSec: 3,
    color: "#10b981",
    waveform: generateWaveform("clip-2", 450, 0.6, 0.05),
  },
  {
    id: "clip-3",
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
    waveform: generateWaveform("clip-3", 108, 0.4, 0.05),
  },
  {
    id: "clip-4",
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
];

export default function VideoStudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [masterVolume, setMasterVolume] = useState(0.75);
  const [activeTab, setActiveTab] = useState("media");
  const [showWaveforms, setShowWaveforms] = useState(true);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { collapsed, toggleCollapsed } = useSidebar();
  const [videoClips, setVideoClips] = useState<VideoClip[]>(() => createInitialClips());
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(() => createDefaultMediaAssets());
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");

  const filteredMediaAssets = useMemo(() => {
    const query = mediaQuery.trim().toLowerCase();
    return mediaAssets.filter((asset) => {
      const matchesType = mediaFilter === "all" || asset.type === mediaFilter;
      const matchesQuery =
        query === "" || asset.name.toLowerCase().includes(query);
      return matchesType && matchesQuery;
    });
  }, [mediaAssets, mediaFilter, mediaQuery]);

  const [trackSettings, setTrackSettings] = useState<Record<number, {
    mute: boolean;
    volume: number;
    name: string;
  }>>({
    1: { mute: false, volume: 1, name: "Video" },
    2: { mute: false, volume: 1, name: "B-roll" },
    3: { mute: false, volume: 0.7, name: "Music" },
  });

  const sortedTrackEntries = useMemo(
    () => Object.entries(trackSettings).sort((a, b) => Number(a[0]) - Number(b[0])),
    [trackSettings],
  );

  const trackOptions = useMemo(
    () =>
      sortedTrackEntries.map(([trackNum, settings]) => ({
        id: Number(trackNum),
        name: settings.name,
      })),
    [sortedTrackEntries],
  );

  const totalClips = videoClips.length;
  const activeTrackCount = sortedTrackEntries.length;
  const currentPaper = {
    title: "Attention Is All You Need",
    authors:
      "Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit",
    audioFile: "conversation_20240101_143000.wav",
  };

  const totalDuration = useMemo(
    () =>
      Math.max(
        60,
        ...videoClips.map((clip) => clip.startTime + clip.duration),
      ),
    [videoClips],
  );

  const pixelsPerSecond = zoomLevel * 10;

  const timelineTicks = useMemo(() => {
    const stepSeconds = 10;
    const tickCount = Math.ceil(totalDuration / stepSeconds) + 1;
    return Array.from({ length: tickCount }, (_, index) => index * stepSeconds);
  }, [totalDuration]);

  const clipsByTrack = useMemo(() => {
    const trackMap = new Map<number, VideoClip[]>();
    sortedTrackEntries.forEach(([trackNum]) => {
      trackMap.set(Number(trackNum), []);
    });
    videoClips.forEach((clip) => {
      if (!trackMap.has(clip.track)) {
        trackMap.set(clip.track, []);
      }
      trackMap.get(clip.track)!.push(clip);
    });
    trackMap.forEach((clips) => {
      clips.sort((a, b) => a.startTime - b.startTime);
    });
    return trackMap;
  }, [sortedTrackEntries, videoClips]);

  const clipWaveformPaths = useMemo(() => {
    const usableHeight = WAVEFORM_HEIGHT - WAVEFORM_VERTICAL_PADDING * 2;
    const baseline = usableHeight + WAVEFORM_VERTICAL_PADDING;
    const paths: Record<string, string> = {};
    videoClips.forEach((clip) => {
      const values = clip.waveform;
      if (!values || values.length < 2) {
        return;
      }
      const width = clip.duration * pixelsPerSecond;
      if (!Number.isFinite(width) || width <= 0) {
        return;
      }
      const lastIndex = values.length - 1;
      const sampleTarget = Math.max(Math.round(width / 4), MIN_WAVEFORM_SAMPLES);
      const step = Math.max(1, Math.floor(lastIndex / sampleTarget));
      const commands: string[] = [];
      const firstValue = Math.max(0, Math.min(1, values[0]!));
      const firstY = (1 - firstValue) * usableHeight + WAVEFORM_VERTICAL_PADDING;
      commands.push(`L 0 ${firstY.toFixed(2)}`);
      for (let index = step; index < lastIndex; index += step) {
        const value = Math.max(0, Math.min(1, values[index]!));
        const x = (index / lastIndex) * width;
        const y = (1 - value) * usableHeight + WAVEFORM_VERTICAL_PADDING;
        commands.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
      }
      const lastValue = Math.max(0, Math.min(1, values[lastIndex]!));
      const lastY = (1 - lastValue) * usableHeight + WAVEFORM_VERTICAL_PADDING;
      commands.push(`L ${width.toFixed(2)} ${lastY.toFixed(2)}`);
      const path = `M 0 ${baseline.toFixed(2)} ${commands.join(" ")} L ${width.toFixed(2)} ${baseline.toFixed(2)} Z`;
      paths[clip.id] = path;
    });
    return paths;
  }, [videoClips, pixelsPerSecond]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime((previous) => {
        const next = previous + 0.1;
        if (next >= totalDuration) {
          clearInterval(interval);
          return totalDuration;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  useEffect(() => {
    setSelectedClips((previous) => {
      const existingIds = new Set(videoClips.map((clip) => clip.id));
      const next = previous.filter((id) => existingIds.has(id));
      return next.length === previous.length ? previous : next;
    });
  }, [videoClips]);

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}.${frames.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}.${frames.toString().padStart(2, "0")}`;
  }, []);

  const formatDurationLabel = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return "0s";
    }
    return Number.isInteger(seconds)
      ? `${seconds}s`
      : `${seconds.toFixed(1)}s`;
  }, []);

  const handlePlayPause = () => setIsPlaying((previous) => !previous);

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleZoomIn = () => setZoomLevel((previous) => Math.min(previous * 1.5, 3));

  const handleZoomOut = () => setZoomLevel((previous) => Math.max(previous / 1.5, 0.25));

  const handleSkip = (deltaSeconds: number) => {
    setCurrentTime((previous) =>
      Math.max(0, Math.min(previous + deltaSeconds, totalDuration)),
    );
  };

  const handleClipSelect = (clipId: string, multiSelect = false) => {
    if (multiSelect) {
      setSelectedClips((previous) =>
        previous.includes(clipId)
          ? previous.filter((id) => id !== clipId)
          : [...previous, clipId],
      );
    } else {
      setSelectedClips([clipId]);
    }
  };

  const handleTrackNameChange = (track: number, name: string) => {
    setTrackSettings((previous) => ({
      ...previous,
      [track]: { ...previous[track], name },
    }));
  };

  const handleTrackVolumeChange = (track: number, volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setTrackSettings((previous) => ({
      ...previous,
      [track]: { ...previous[track], volume: clamped },
    }));
  };

  const toggleTrackMute = (track: number) => {
    setTrackSettings((previous) => {
      if (!previous[track]) return previous;
      return {
        ...previous,
        [track]: { ...previous[track], mute: !previous[track].mute },
      };
    });
  };

  const handleAddTrack = () => {
    setTrackSettings((previous) => {
      const numericKeys = Object.keys(previous).map(Number);
      const nextId =
        numericKeys.length > 0 ? Math.max(...numericKeys) + 1 : 1;
      return {
        ...previous,
        [nextId]: { mute: false, volume: 1, name: `Track ${nextId}` },
      };
    });
  };

  const handleRemoveTrack = (track: number) => {
    setTrackSettings((previous) => {
      if (!previous[track] || Object.keys(previous).length <= 1) {
        return previous;
      }
      const next = { ...previous };
      delete next[track];
      return next;
    });
    setVideoClips((previous) => previous.filter((clip) => clip.track !== track));
  };

  const handleAddClipClick = () => {
    fileInputRef.current?.click();
  };

  const getTrackForAsset = (type: MediaAsset["type"]) => {
    const lowerCaseEntries = sortedTrackEntries.map(([trackNum, settings]) => ({
      track: Number(trackNum),
      name: settings.name.toLowerCase(),
    }));
    if (type === "audio") {
      const match = lowerCaseEntries.find(({ name }) =>
        ["music", "audio", "fx"].some((keyword) => name.includes(keyword)),
      );
      if (match) return match.track;
    }
    if (type === "image") {
      const match = lowerCaseEntries.find(({ name }) =>
        ["b-roll", "overlay", "graphics"].some((keyword) =>
          name.includes(keyword),
        ),
      );
      if (match) return match.track;
    }
    return lowerCaseEntries[0]?.track ?? 1;
  };

  const handleAddAssetToTimeline = (asset: MediaAsset) => {
    const newId = createId();
    const defaultDuration =
      asset.type === "audio" ? 20 : asset.type === "image" ? 8 : 12;
    const targetTrack = getTrackForAsset(asset.type);
    const timelineEnd = videoClips.reduce(
      (max, clip) => Math.max(max, clip.startTime + clip.duration),
      0,
    );
    const clipColor =
      asset.type === "audio"
        ? "#22c55e"
        : asset.type === "image"
        ? "#f97316"
        : "#6366f1";
    const baseClip: VideoClip = {
      id: newId,
      type: asset.type,
      name: asset.name,
      startTime: snapEnabled
        ? Math.round(timelineEnd)
        : Math.max(0, parseFloat(timelineEnd.toFixed(2))),
      duration: defaultDuration,
      track: targetTrack,
      volume: asset.type === "audio" ? 0.8 : 1,
      fadeInSec: asset.type === "audio" ? 1 : 0.5,
      fadeOutSec: asset.type === "audio" ? 1 : 0.5,
      opacity: asset.type === "image" ? 0.95 : 1,
      color: clipColor,
      waveform:
        asset.type === "image"
          ? undefined
          : generateWaveform(
              newId,
              Math.max(
                30,
                Math.floor(defaultDuration * (asset.type === "audio" ? 10 : 6)),
              ),
              asset.type === "audio" ? 0.6 : 0.4,
              0.05,
            ),
    };
    setVideoClips((previous) => [...previous, baseClip]);
    setSelectedClips([newId]);
    setActiveTab("properties");
  };

  const handleUpdateClip = useCallback(
    (clipId: string, updates: Partial<VideoClip>) => {
      setVideoClips((previous) =>
        previous.map((clip) =>
          clip.id === clipId ? { ...clip, ...updates } : clip,
        ),
      );
    },
    [],
  );


  const handleFilesSelected = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const newAssets: MediaAsset[] = Array.from(files).map((file) => {
      const type = file.type.startsWith("audio")
        ? "audio"
        : file.type.startsWith("image")
        ? "image"
        : "video";
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      return {
        id: createId(),
        name: baseName,
        type,
        duration: type === "image" ? "Still" : "Imported",
        source: "imported",
      };
    });
    setMediaAssets((previous) => [...newAssets, ...previous]);
    setActiveTab("media");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const trackClipCount = useMemo(() => {
    const counts = new Map<number, number>();
    videoClips.forEach((clip) => {
      counts.set(clip.track, (counts.get(clip.track) ?? 0) + 1);
    });
    return counts;
  }, [videoClips]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
      <div className="flex">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
        <div className="flex flex-1 flex-col">
          <Header
            title="Video Studio"
            description="Craft cinematic episodes with AI-assisted editing tools"
            status={{
              label: isPlaying ? "PLAYING" : "PAUSED",
              color: isPlaying ? "blue" : "gray",
              active: isPlaying,
            }}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={snapEnabled ? "secondary" : "outline"}
                  onClick={() => setSnapEnabled((previous) => !previous)}
                  aria-pressed={snapEnabled}
                  className="hidden sm:inline-flex"
                >
                  <Magnet className="h-4 w-4" />
                  {snapEnabled ? "Snapping on" : "Snapping off"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowWaveforms((previous) => !previous)}
                >
                  {showWaveforms ? "Hide waveforms" : "Show waveforms"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="gradient"
                  onClick={handleAddClipClick}
                >
                  <Upload className="h-4 w-4" />
                  Import media
                </Button>
              </div>
            }
          />
          <main className="space-y-6 p-6">
            <div className="flex flex-col gap-6 xl:flex-row">
              <div className="flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 bg-white p-6">
                  <div className="relative mx-auto flex aspect-video max-w-4xl items-center justify-center overflow-hidden rounded-xl bg-black">
                    <div className="text-center text-white/80">
                      <Camera className="mx-auto mb-3 h-12 w-12 opacity-60" />
                      <p className="text-sm font-medium">Video Preview</p>
                      <p className="text-xs text-white/60">
                        {formatTime(currentTime)} / {formatTime(totalDuration)}
                      </p>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 rounded-lg bg-black/30 p-3 backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => handleSkip(-10)} aria-label="Rewind 10 seconds">
                          <Rewind className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={handlePlayPause} aria-label={isPlaying ? "Pause" : "Play"}>
                          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => handleSkip(10)} aria-label="Fast forward 10 seconds">
                          <FastForward className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={handleStop} aria-label="Stop playback">
                          <Square className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={handleZoomOut} aria-label="Zoom out timeline">
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={handleZoomIn} aria-label="Zoom in timeline">
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={handleAddClipClick} aria-label="Add clip">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="absolute bottom-16 left-4 right-4">
                      <div className="h-1 rounded-full bg-white/30">
                        <div
                          className="h-1 rounded-full bg-purple-500 transition-all"
                          style={{ width: `${(currentTime / totalDuration) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-gray-200">
                  <div className="flex h-[400px]">
                    <div className="flex w-44 flex-col border-r border-gray-200 bg-gray-50">
                      <div className="flex h-12 items-center justify-between border-b border-gray-200 px-4">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Tracks
                        </span>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={handleAddTrack}
                          className="gap-1 text-[11px] text-gray-600"
                        >
                          <Plus className="h-3 w-3" />
                          Add
                        </Button>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {sortedTrackEntries.map(([trackNum, settings]) => {
                          const trackNumber = Number(trackNum);
                          const isMuted = settings.mute;
                          const clipCount = trackClipCount.get(trackNumber) ?? 0;
                          const canRemove =
                            clipCount === 0 && sortedTrackEntries.length > 1;
                          return (
                            <div
                              key={trackNum}
                              className={`border-b border-gray-200 px-4 py-3 text-xs ${
                                isMuted ? "bg-gray-100" : "bg-gray-50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <input
                                  type="text"
                                  value={settings.name}
                                  onChange={(event) =>
                                    handleTrackNameChange(
                                      trackNumber,
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded border border-transparent bg-transparent px-0 text-xs font-semibold text-gray-700 focus:border-gray-300 focus:outline-none focus:ring-0"
                                  aria-label={`Rename track ${trackNumber}`}
                                />
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant={isMuted ? "destructive" : "ghost"}
                                    onClick={() => toggleTrackMute(trackNumber)}
                                    aria-pressed={isMuted}
                                  >
                                    {isMuted ? (
                                      <VolumeX className="h-3 w-3" />
                                    ) : (
                                      <Volume2 className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => handleRemoveTrack(trackNumber)}
                                    disabled={!canRemove}
                                    className="disabled:opacity-40"
                                    title={
                                      canRemove
                                        ? "Remove track"
                                        : "Remove clips before deleting"
                                    }
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  value={settings.volume}
                                  onChange={(event) =>
                                    handleTrackVolumeChange(
                                      trackNumber,
                                      Number(event.target.value),
                                    )
                                  }
                                  className="flex-1"
                                  aria-label={`Adjust volume for track ${trackNumber}`}
                                />
                                <span className="w-10 text-right text-[11px] text-gray-500">
                                  {Math.round(settings.volume * 100)}%
                                </span>
                              </div>
                              <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                                {clipCount} clip{clipCount === 1 ? "" : "s"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
                        <div className="relative h-12 border-b border-gray-200 bg-gray-50">
                          {timelineTicks.map((time) => (
                            <div key={time}>
                              <div
                                className="absolute inset-y-0 border-l border-gray-300"
                                style={{ left: `${time * pixelsPerSecond}px` }}
                              />
                              <div
                                className="absolute ml-1 text-xs text-gray-600"
                                style={{ left: `${time * pixelsPerSecond}px`, top: 4 }}
                              >
                                {formatTime(time)}
                              </div>
                            </div>
                          ))}
                          <div className="absolute right-4 top-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
                            <Magnet className={`h-3 w-3 ${snapEnabled ? "text-purple-600" : "text-gray-400"}`} />
                            {snapEnabled ? "Snapping on" : "Snapping off"}
                          </div>
                          <div
                            className="pointer-events-none absolute top-0 z-20"
                            style={{ left: `${currentTime * pixelsPerSecond}px` }}
                          >
                            <div className="relative -translate-x-1/2">
                              <div className="h-0 w-0 border-b-[8px] border-l-[6px] border-r-[6px] border-b-purple-500 border-l-transparent border-r-transparent" />
                            </div>
                          </div>
                        </div>
                        {sortedTrackEntries.map(([trackNum, settings]) => {
                          const trackNumber = Number(trackNum);
                          const trackMuted = settings.mute;
                          const trackClips = clipsByTrack.get(trackNumber) ?? [];
                          return (
                            <div key={trackNum} className="relative border-b border-gray-200">
                              {trackClips.map((clip) => {
                                const clipColor = clip.color ?? "#6366f1";
                                const { r, g, b } = hexToRgb(clipColor);
                                const clipStart = clip.startTime * pixelsPerSecond;
                                const clipWidth = clip.duration * pixelsPerSecond;
                                const fadeInWidth = (clip.fadeInSec ?? 0) * pixelsPerSecond;
                                const fadeOutWidth = (clip.fadeOutSec ?? 0) * pixelsPerSecond;
                                const waveformPath = clipWaveformPaths[clip.id];
                                const clipMetaParts = [formatDurationLabel(clip.duration)];
                                if (clip.type === "audio") {
                                  const volumePercent = Math.round((clip.volume ?? 1) * 100);
                                  clipMetaParts.push(`${volumePercent}% vol`);
                                }
                                if (clip.speaker) {
                                  clipMetaParts.push(clip.speaker);
                                }
                                const clipMeta = clipMetaParts.join(" • ");
                                return (
                                  <div
                                    key={clip.id}
                                    className={`absolute z-10 h-10 cursor-pointer rounded-lg border transition-colors
                                      ${selectedClips.includes(clip.id) ? "border-purple-500 bg-opacity-80" : "border-transparent bg-opacity-60"}
                                      ${trackMuted || clip.muted ? "opacity-60" : ""}`}
                                    style={{
                                      left: `${clipStart}px`,
                                      width: `${clipWidth}px`,
                                      backgroundColor: applyAlphaToHex(clipColor, 0.6),
                                    }}
                                    onClick={(event) =>
                                      handleClipSelect(
                                        clip.id,
                                        event.metaKey || event.shiftKey,
                                      )
                                    }
                                  >
                                    {fadeInWidth > 0 && (
                                      <div
                                        className="pointer-events-none absolute inset-y-0 left-0"
                                        style={{
                                          width: `${fadeInWidth}px`,
                                          backgroundImage: `linear-gradient(to right, rgba(${r}, ${g}, ${b}, 0.55), transparent)`,
                                        }}
                                      />
                                    )}
                                    {fadeOutWidth > 0 && (
                                      <div
                                        className="pointer-events-none absolute inset-y-0 right-0"
                                        style={{
                                          width: `${fadeOutWidth}px`,
                                          backgroundImage: `linear-gradient(to left, rgba(${r}, ${g}, ${b}, 0.55), transparent)`,
                                        }}
                                      />
                                    )}
                                    <div className="pointer-events-none absolute inset-0">
                                      {showWaveforms && waveformPath && (
                                        <svg
                                          className="absolute inset-x-1 top-1 bottom-1 text-white/70"
                                          viewBox={`0 0 ${clipWidth} ${WAVEFORM_HEIGHT}`}
                                          preserveAspectRatio="none"
                                        >
                                          <path
                                            d={waveformPath}
                                            fill="rgba(255,255,255,0.35)"
                                            stroke="rgba(255,255,255,0.55)"
                                            strokeWidth={1}
                                          />
                                        </svg>
                                      )}
                                      <div className="absolute inset-x-2 bottom-1 flex flex-col gap-0.5 text-white drop-shadow-sm">
                                        <span className="truncate text-[11px] font-semibold leading-4">
                                          {clip.name}
                                        </span>
                                        <span className="truncate text-[10px] font-medium leading-3 text-white/80">
                                          {clipMeta}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full xl:w-80">
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
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
                    masterVolume={masterVolume}
                    setMasterVolume={setMasterVolume}
                    onAddAssetToTimeline={handleAddAssetToTimeline}
                    onUpdateClip={handleUpdateClip}
                    trackOptions={trackOptions}
                    formatTime={formatTime}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">
                    Source research
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-gray-600">
                  <p className="font-medium text-gray-900">{currentPaper.title}</p>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {currentPaper.authors}
                  </p>
                  <div className="rounded-lg bg-purple-50/80 px-3 py-2 text-xs text-purple-700">
                    Audio reference: {currentPaper.audioFile}
                  </div>
                  <p className="text-xs text-gray-500">
                    Keep the research summary visible so narration stays aligned with the paper.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">
                    Timeline overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Duration</span>
                    <span className="font-medium text-gray-900">{formatTime(totalDuration)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Clips</span>
                    <span className="font-medium text-gray-900">{totalClips}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tracks</span>
                    <span className="font-medium text-gray-900">{activeTrackCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Waveforms</span>
                    <span className="font-medium text-gray-900">
                      {showWaveforms ? "Visible" : "Hidden"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Master volume</span>
                    <span className="font-medium text-gray-900">
                      {Math.round(masterVolume * 100)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">
                    Export checklist
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Preset</span>
                    <span className="font-medium text-gray-900">1080p • 30fps</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>File size estimate</span>
                    <span className="font-medium text-gray-900">1.2 GB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Enhancements</span>
                    <span className="font-medium text-gray-900">Noise cleanup</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Delivery</span>
                    <span className="font-medium text-gray-900">Podcast & social</span>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button type="button" size="sm" variant="gradient" className="flex-1">
                      <Download className="h-4 w-4" />
                      Render episode
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="flex-1">
                      <Upload className="h-4 w-4" />
                      Publish draft
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*,audio/*,image/*"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

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
  masterVolume,
  setMasterVolume,
  onAddAssetToTimeline,
  onUpdateClip,
  trackOptions,
  formatTime,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mediaAssets: MediaAsset[];
  mediaQuery: string;
  setMediaQuery: (query: string) => void;
  mediaFilter: MediaFilter;
  setMediaFilter: (filter: MediaFilter) => void;
  selectedClips: string[];
  videoClips: VideoClip[];
  masterVolume: number;
  setMasterVolume: (value: number) => void;
  onAddAssetToTimeline: (asset: MediaAsset) => void;
  onUpdateClip: (clipId: string, updates: Partial<VideoClip>) => void;
  trackOptions: { id: number; name: string }[];
  formatTime: (seconds: number) => string;
}) {
  const selectedClip =
    selectedClips.length === 1
      ? videoClips.find((clip) => clip.id === selectedClips[0]) ?? null
      : null;
  const filterOptions: MediaFilter[] = ["all", "video", "audio", "image"];
  const clipEnd =
    selectedClip != null
      ? selectedClip.startTime + selectedClip.duration
      : null;
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
      <TabsList className="grid w-full grid-cols-2 shrink-0">
        <TabsTrigger value="media" className="flex items-center space-x-1">
          <Folder className="h-4 w-4" />
          <span className="hidden sm:inline">Media</span>
        </TabsTrigger>
        <TabsTrigger value="properties" className="flex items-center space-x-1">
          <Sliders className="h-4 w-4" />
          <span className="hidden sm:inline">Properties</span>
        </TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-hidden">
        <TabsContent value="media" className="h-full">
          <div className="flex h-full flex-col">
            <div className="space-y-3 border-b border-gray-200 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search media..."
                  value={mediaQuery}
                  onChange={(event) => setMediaQuery(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((filterOption) => (
                  <button
                    key={filterOption}
                    onClick={() => setMediaFilter(filterOption)}
                    className={`rounded px-3 py-1 text-xs transition ${
                      mediaFilter === filterOption
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    type="button"
                  >
                    {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-4">
                {mediaAssets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-xs text-gray-500">
                    Import media or adjust your filters to see assets.
                  </div>
                ) : (
                  mediaAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition hover:border-purple-300 hover:bg-purple-50/40"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                        {asset.type === "video" ? (
                          <Video className="h-5 w-5 text-purple-600" />
                        ) : asset.type === "audio" ? (
                          <Volume2 className="h-5 w-5 text-purple-600" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-purple-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {asset.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {asset.type.toUpperCase()} • {asset.duration}
                          {asset.source === "imported" ? " • Imported" : ""}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => onAddAssetToTimeline(asset)}
                        className="text-xs"
                      >
                        Add to timeline
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
        <TabsContent value="properties" className="h-full">
          <ScrollArea className="h-full">
            <div className="space-y-5 p-4 text-sm">
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-900">
                  Master volume
                </h3>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={masterVolume}
                  onChange={(event) => setMasterVolume(Number(event.target.value))}
                  className="w-full"
                />
                <div className="mt-1 text-xs text-gray-500">
                  {Math.round(masterVolume * 100)}%
                </div>
              </div>
              {selectedClips.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 p-4 text-xs text-gray-500">
                  Select a clip on the timeline to edit its properties.
                </div>
              )}
              {selectedClips.length > 1 && (
                <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-4 text-xs text-purple-700">
                  Multiple clips selected. Adjust start, trims, and fades individually for finer control.
                </div>
              )}
              {selectedClip && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      {getClipTypeIcon(selectedClip.type, "h-5 w-5")}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {selectedClip.name}
                        </h3>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">
                          Track {selectedClip.track}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3 text-xs text-gray-600">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1">
                          <span>Start (sec)</span>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={Number(selectedClip.startTime.toFixed(2))}
                            onChange={(event) =>
                              onUpdateClip(selectedClip.id, {
                                startTime: Number(event.target.value),
                              })
                            }
                            className="w-full rounded border border-gray-300 px-2 py-1 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                          />
                        </label>
                        <label className="space-y-1">
                          <span>Duration (sec)</span>
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={Number(selectedClip.duration.toFixed(2))}
                            onChange={(event) =>
                              onUpdateClip(selectedClip.id, {
                                duration: Number(event.target.value),
                              })
                            }
                            className="w-full rounded border border-gray-300 px-2 py-1 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1">
                          <span>Track</span>
                          <select
                            value={selectedClip.track}
                            onChange={(event) =>
                              onUpdateClip(selectedClip.id, {
                                track: Number(event.target.value),
                              })
                            }
                            className="w-full rounded border border-gray-300 px-2 py-1 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                          >
                            {trackOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.id}. {option.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span>Clip volume</span>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={selectedClip.volume ?? 1}
                            onChange={(event) =>
                              onUpdateClip(selectedClip.id, {
                                volume: Number(event.target.value),
                              })
                            }
                            className="w-full"
                          />
                          <span className="block text-[11px] text-gray-500">
                            {Math.round((selectedClip.volume ?? 1) * 100)}%
                          </span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="block">Fade in</span>
                          <input
                            type="range"
                            min={0}
                            max={5}
                            step={0.1}
                            value={selectedClip.fadeInSec ?? 0}
                            onChange={(event) =>
                              onUpdateClip(selectedClip.id, {
                                fadeInSec: Number(event.target.value),
                              })
                            }
                            className="w-full"
                          />
                          <span className="block text-[11px] text-gray-500">
                            {(selectedClip.fadeInSec ?? 0).toFixed(1)}s
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="block">Fade out</span>
                          <input
                            type="range"
                            min={0}
                            max={5}
                            step={0.1}
                            value={selectedClip.fadeOutSec ?? 0}
                            onChange={(event) =>
                              onUpdateClip(selectedClip.id, {
                                fadeOutSec: Number(event.target.value),
                              })
                            }
                            className="w-full"
                          />
                          <span className="block text-[11px] text-gray-500">
                            {(selectedClip.fadeOutSec ?? 0).toFixed(1)}s
                          </span>
                        </div>
                      </div>
                      <div className="rounded-md bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
                        <div>Starts at {formatTime(selectedClip.startTime)}</div>
                        {clipEnd != null && (
                          <div>Ends at {formatTime(clipEnd)}</div>
                        )}
                      </div>
                    </div>
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