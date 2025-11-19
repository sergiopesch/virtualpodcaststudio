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
  loadConversationFromSession,
  decodeWavBase64,
  type StoredConversation,
  type StoredConversationAudioTrack,
} from "@/lib/conversationStorage";
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
  Trash2,
  RefreshCcw,
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
const TRACK_HEIGHT = 64;
const MIN_CLIP_DURATION = 0.5;
const SNAP_INTERVAL_SECONDS = 0.5;
const DRAG_SCROLL_MARGIN = 80;
const DRAG_SCROLL_SPEED = 18;
const MIN_TIMELINE_LABEL_SPACING = 80;
const TIMELINE_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300] as const;
type DragMode = "move" | "trim-start" | "trim-end";
interface DragState {
  clipId: string;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  initialStart: number;
  initialDuration: number;
  initialTrackIndex: number;
  trackIds: number[];
  pixelsPerSecond: number;
  snapEnabled: boolean;
  snapInterval: number;
  hasMoved: boolean;
}

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

function getClipTypeIcon(type: ClipType, size = "size-4") {
  const iconClass = `${size} flex-shrink-0`;
  switch (type) {
    case "video":
      return <Video className={`${iconClass} text-foreground`} />;
    case "audio":
      return <Volume2 className={`${iconClass} text-foreground`} />;
    case "image":
      return <ImageIcon className={`${iconClass} text-foreground`} />;
    case "text":
      return <Type className={`${iconClass} text-foreground`} />;
    case "effect":
      return <Wand2 className={`${iconClass} text-foreground`} />;
    case "transition":
      return <Sparkles className={`${iconClass} text-foreground`} />;
    default:
      return <FileText className={`${iconClass} text-muted-foreground`} />;
  }
}

const WAVEFORM_HEIGHT = 36;
const MIN_WAVEFORM_SAMPLES = 24;
const WAVEFORM_VERTICAL_PADDING = 2;

type TrackSetting = {
  mute: boolean;
  volume: number;
  name: string;
};

type TrackSettings = Record<number, TrackSetting>;

interface ConversationSummary {
  durationSeconds: number;
  durationLabel: string;
  hostTurns: number;
  expertTurns: number;
  lastUpdated: string;
  highlight?: string;
  audio: {
    host: boolean;
    expert: boolean;
  };
}

interface VideoProjectData {
  clips: VideoClip[];
  trackSettings: TrackSettings;
  mediaAssets: MediaAsset[];
  summary: ConversationSummary | null;
  primaryClipId: string | null;
}

const cloneClip = (clip: VideoClip): VideoClip => ({
  ...clip,
  filters: clip.filters ? { ...clip.filters } : undefined,
  keyframes: clip.keyframes
    ? clip.keyframes.map((keyframe) => ({
      time: keyframe.time,
      properties: { ...keyframe.properties },
    }))
    : undefined,
  waveform: clip.waveform ? [...clip.waveform] : undefined,
});

const cloneTrackSettings = (settings: TrackSettings): TrackSettings =>
  Object.entries(settings).reduce<TrackSettings>((accumulator, [track, value]) => {
    accumulator[Number(track)] = { ...value };
    return accumulator;
  }, {});

const cloneProject = (project: VideoProjectData): VideoProjectData => ({
  clips: project.clips.map(cloneClip),
  trackSettings: cloneTrackSettings(project.trackSettings),
  mediaAssets: project.mediaAssets.map((asset) => ({ ...asset })),
  summary: project.summary ? { ...project.summary, audio: { ...project.summary.audio } } : null,
  primaryClipId: project.primaryClipId,
});

const formatDurationClock = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  const base = `${minutes.toString().padStart(hours > 0 ? 2 : 1, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;

  if (hours > 0) {
    return `${hours}:${base}`;
  }

  return base;
};

const createWaveformFromAudioTrack = (
  clipId: string,
  audioTrack: StoredConversationAudioTrack | null,
): number[] | undefined => {
  if (!audioTrack) {
    return undefined;
  }

  try {
    const { pcm } = decodeWavBase64(audioTrack.base64);
    if (!pcm.length) {
      return undefined;
    }

    const desiredSamples = Math.min(
      Math.max(Math.round(audioTrack.durationSeconds * 80), MIN_WAVEFORM_SAMPLES),
      1200,
    );

    const chunkSize = Math.max(1, Math.floor(pcm.length / desiredSamples));
    const samples: number[] = [];
    for (let index = 0; index < pcm.length; index += chunkSize) {
      let peak = 0;
      for (let offset = 0; offset < chunkSize && index + offset < pcm.length; offset++) {
        const amplitude = Math.abs(pcm[index + offset] ?? 0) / 32768;
        peak = Math.max(peak, Math.min(1, amplitude));
      }
      samples.push(peak);
    }

    if (samples.length < MIN_WAVEFORM_SAMPLES) {
      const padValue = samples[samples.length - 1] ?? 0;
      while (samples.length < MIN_WAVEFORM_SAMPLES) {
        samples.push(padValue);
      }
    }

    return samples;
  } catch (error) {
    console.error(`[VideoStudio] Failed to decode audio track for clip ${clipId}`, error);
    return undefined;
  }
};

const createEmptyProject = (): VideoProjectData => ({
  clips: [],
  trackSettings: {
    1: { mute: false, volume: 1, name: "Timeline" },
  },
  mediaAssets: [],
  summary: null,
  primaryClipId: null,
});

const createConversationSummary = (
  conversation: StoredConversation,
  timelineDuration: number,
): ConversationSummary => {
  const hostTurns = conversation.transcript.filter((message) => message.role === "user").length;
  const expertTurns = conversation.transcript.filter((message) => message.role === "expert").length;
  const latestExpertReply = [...conversation.transcript]
    .reverse()
    .find((message) => message.role === "expert" && message.content.trim().length > 0);

  return {
    durationSeconds: timelineDuration,
    durationLabel: formatDurationClock(timelineDuration),
    hostTurns,
    expertTurns,
    lastUpdated: new Date(conversation.createdAt).toLocaleString(),
    highlight: latestExpertReply?.content,
    audio: {
      host: Boolean(conversation.audio.host),
      expert: Boolean(conversation.audio.ai),
    },
  };
};

const createConversationProject = (conversation: StoredConversation): VideoProjectData => {
  const clips: VideoClip[] = [];
  const mediaAssets: MediaAsset[] = [];
  const trackSettings: TrackSettings = {};

  let cursor = 0;
  let timelineEnd = 0;
  let primaryClipId: string | null = null;

  let trackCounter = 1;
  const registerTrack = (name: string, volume = 1, mute = false) => {
    const id = trackCounter++;
    trackSettings[id] = { name, volume, mute };
    return id;
  };

  let hostTrackId: number | null = null;
  let expertTrackId: number | null = null;
  let overlayTrackId: number | null = null;

  const pushClip = (clip: VideoClip) => {
    clips.push(clip);
    timelineEnd = Math.max(timelineEnd, clip.startTime + clip.duration);
  };

  const hostAudio = conversation.audio.host;
  if (hostAudio) {
    if (!hostTrackId) {
      hostTrackId = registerTrack("Host narration");
    }
    const hostClipId = createId();
    const hostDuration = Math.max(hostAudio.durationSeconds || 0, MIN_CLIP_DURATION);
    pushClip({
      id: hostClipId,
      type: "audio",
      name: "Host narration",
      startTime: 0,
      duration: hostDuration,
      track: hostTrackId,
      speaker: "Host",
      content: conversation.transcript
        .filter((message) => message.role === "user")
        .map((message) => message.content)
        .join(" \n"),
      volume: 1,
      fadeInSec: 0.25,
      fadeOutSec: 0.5,
      color: "#2563eb",
      waveform: createWaveformFromAudioTrack(hostClipId, hostAudio),
    });

    mediaAssets.push({
      id: createId(),
      name: "Host conversation export",
      type: "audio",
      duration: formatDurationClock(hostDuration),
      source: "imported",
    });

    cursor = hostDuration + 0.4;
    primaryClipId = hostClipId;
  }

  const expertAudio = conversation.audio.ai;
  if (expertAudio) {
    if (!expertTrackId) {
      expertTrackId = registerTrack(hostAudio ? "AI expert" : "Conversation");
    }
    const expertClipId = createId();
    const expertDuration = Math.max(expertAudio.durationSeconds || 0, MIN_CLIP_DURATION);
    const startTime = hostAudio ? cursor : 0;
    pushClip({
      id: expertClipId,
      type: "audio",
      name: "AI expert response",
      startTime,
      duration: expertDuration,
      track: expertTrackId,
      speaker: "Expert",
      content: conversation.transcript
        .filter((message) => message.role === "expert")
        .map((message) => message.content)
        .join(" \n"),
      volume: 0.95,
      fadeInSec: 0.2,
      fadeOutSec: 0.5,
      color: "#8b5cf6",
      waveform: createWaveformFromAudioTrack(expertClipId, expertAudio),
    });

    mediaAssets.push({
      id: createId(),
      name: "AI narration export",
      type: "audio",
      duration: formatDurationClock(expertDuration),
      source: "imported",
    });

    cursor = startTime + expertDuration + 0.4;
    if (!primaryClipId) {
      primaryClipId = expertClipId;
    }
  }

  const overlayDuration = Math.max(
    timelineEnd,
    conversation.durationSeconds,
    hostAudio?.durationSeconds ?? 0,
    expertAudio?.durationSeconds ?? 0,
  );

  if (overlayDuration > 0) {
    const highlightSource = conversation.transcript.filter(
      (message) => message.content.trim().length > 0,
    );

    if (highlightSource.length > 0) {
      if (!overlayTrackId) {
        overlayTrackId = registerTrack("Transcript overlays");
      }

      const highlightEntries = highlightSource.slice(0, 4);
      const highlightContent = highlightEntries
        .map((message) => {
          const speakerLabel = message.role === "user" ? "Host" : "Expert";
          return `${speakerLabel}: ${message.content.trim()}`;
        })
        .join(" \u2022 ");

      pushClip({
        id: createId(),
        type: "text",
        name: "Conversation highlights",
        startTime: 0,
        duration: Math.max(overlayDuration, MIN_CLIP_DURATION),
        track: overlayTrackId,
        content: highlightContent,
        opacity: 0.95,
        color: "#f97316",
        visualStyle: "overlay",
      });
    }
  }

  const summary = createConversationSummary(conversation, Math.max(overlayDuration, timelineEnd));

  return {
    clips,
    trackSettings,
    mediaAssets,
    summary,
    primaryClipId,
  };
};

export default function VideoStudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [masterVolume, setMasterVolume] = useState(0.75);
  const [activeTab, setActiveTab] = useState("media");
  const [showWaveforms, setShowWaveforms] = useState(true);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const playheadScrubRef = useRef<{ wasPlaying: boolean } | null>(null);
  const [activeDrag, setActiveDrag] = useState<{
    clipId: string;
    mode: DragMode;
  } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const { collapsed, toggleCollapsed } = useSidebar();
  const defaultProjectRef = useRef<VideoProjectData>(createEmptyProject());
  const [conversation, setConversation] = useState<StoredConversation | null>(null);
  const [conversationSummary, setConversationSummary] = useState<ConversationSummary | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [videoClips, setVideoClips] = useState<VideoClip[]>(() =>
    defaultProjectRef.current.clips.map(cloneClip),
  );
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(() =>
    defaultProjectRef.current.mediaAssets.map((asset) => ({ ...asset })),
  );
  const [trackSettings, setTrackSettings] = useState<TrackSettings>(() =>
    cloneTrackSettings(defaultProjectRef.current.trackSettings),
  );
  const [selectedClips, setSelectedClips] = useState<string[]>(() =>
    defaultProjectRef.current.primaryClipId ? [defaultProjectRef.current.primaryClipId] : [],
  );
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
  const latestPaper = conversation?.paper ?? null;
  const hostAudioAvailable = conversationSummary?.audio.host ?? false;
  const expertAudioAvailable = conversationSummary?.audio.expert ?? false;
  const hasConversation = Boolean(conversation);

  const totalDuration = useMemo(
    () =>
      Math.max(
        60,
        ...videoClips.map((clip) => clip.startTime + clip.duration),
      ),
    [videoClips],
  );

  const pixelsPerSecond = zoomLevel * 10;

  const timelineTickConfig = useMemo(() => {
    const safePixelsPerSecond =
      Number.isFinite(pixelsPerSecond) && pixelsPerSecond > 0
        ? pixelsPerSecond
        : 10;
    const step =
      TIMELINE_STEPS.find(
        (value) => value * safePixelsPerSecond >= MIN_TIMELINE_LABEL_SPACING,
      ) ?? TIMELINE_STEPS[TIMELINE_STEPS.length - 1];
    const ticks: number[] = [];
    const maxTickCount = Math.ceil(totalDuration / step) + 1;
    for (let index = 0; index < maxTickCount; index++) {
      const timeValue = Number((index * step).toFixed(3));
      if (timeValue > totalDuration) {
        break;
      }
      if (ticks.length === 0 || Math.abs(ticks[ticks.length - 1] - timeValue) > 0.001) {
        ticks.push(timeValue);
      }
    }
    if (totalDuration > 0) {
      const finalTick = Number(totalDuration.toFixed(3));
      if (ticks.length === 0 || Math.abs(ticks[ticks.length - 1] - finalTick) > 0.001) {
        ticks.push(finalTick);
      }
    }
    if (ticks.length === 0 || Math.abs(ticks[0]) > 0.001) {
      ticks.unshift(0);
    }
    return { ticks, step };
  }, [pixelsPerSecond, totalDuration]);

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

  const applyProject = useCallback((project: VideoProjectData) => {
    const next = cloneProject(project);
    setVideoClips(next.clips);
    setTrackSettings(next.trackSettings);
    setMediaAssets(next.mediaAssets);
    setConversationSummary(next.summary);
    setSelectedClips(next.primaryClipId ? [next.primaryClipId] : []);
  }, []);

  const loadLatestConversation = useCallback(() => {
    setIsLoadingConversation(true);
    setConversationError(null);
    try {
      const stored = loadConversationFromSession();
      if (stored) {
        setConversation(stored);
        applyProject(createConversationProject(stored));
      } else {
        setConversation(null);
        applyProject(defaultProjectRef.current);
      }
    } catch (error) {
      console.error("[VideoStudio] Failed to load conversation from session", error);
      setConversation(null);
      setConversationError(
        "Failed to load the latest conversation. Record a new session in the Audio Studio and try again.",
      );
      applyProject(defaultProjectRef.current);
    } finally {
      setIsLoadingConversation(false);
    }
  }, [applyProject, defaultProjectRef]);

  useEffect(() => {
    loadLatestConversation();
  }, [loadLatestConversation]);

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

  const handleClipSelect = useCallback((clipId: string, multiSelect = false) => {
    if (multiSelect) {
      setSelectedClips((previous) =>
        previous.includes(clipId)
          ? previous.filter((id) => id !== clipId)
          : [...previous, clipId],
      );
    } else {
      setSelectedClips([clipId]);
    }
  }, []);

  const handleGlobalPointerMove = useCallback(
    (event: PointerEvent) => {
      const dragData = dragStateRef.current;
      if (!dragData) {
        return;
      }

      event.preventDefault();

      const applySnap = (value: number) => {
        if (!dragData.snapEnabled) {
          return value;
        }
        return (
          Math.round(value / dragData.snapInterval) * dragData.snapInterval
        );
      };

      const deltaSeconds =
        (event.clientX - dragData.startClientX) / dragData.pixelsPerSecond;
      const deltaY = event.clientY - dragData.startClientY;
      let nextStart = dragData.initialStart;
      let nextDuration = dragData.initialDuration;
      let nextTrackIndex = dragData.initialTrackIndex;

      if (dragData.mode === "move") {
        nextStart = Math.max(0, dragData.initialStart + deltaSeconds);
        if (dragData.snapEnabled) {
          nextStart = applySnap(nextStart);
        }
        const trackOffset = Math.round(deltaY / TRACK_HEIGHT);
        nextTrackIndex = Math.min(
          dragData.trackIds.length - 1,
          Math.max(0, dragData.initialTrackIndex + trackOffset),
        );
      } else if (dragData.mode === "trim-start") {
        const maxStart =
          dragData.initialStart +
          dragData.initialDuration -
          MIN_CLIP_DURATION;
        let candidate = Math.max(
          0,
          Math.min(dragData.initialStart + deltaSeconds, maxStart),
        );
        if (dragData.snapEnabled) {
          candidate = Math.min(maxStart, applySnap(candidate));
        }
        nextStart = candidate;
        nextDuration =
          dragData.initialDuration + (dragData.initialStart - nextStart);
        nextDuration = Math.max(MIN_CLIP_DURATION, nextDuration);
      } else if (dragData.mode === "trim-end") {
        let candidateDuration = Math.max(
          MIN_CLIP_DURATION,
          dragData.initialDuration + deltaSeconds,
        );
        if (dragData.snapEnabled) {
          const snappedEnd = applySnap(
            dragData.initialStart + candidateDuration,
          );
          candidateDuration = Math.max(
            MIN_CLIP_DURATION,
            snappedEnd - dragData.initialStart,
          );
        }
        nextDuration = candidateDuration;
      }

      const sanitizedStart = Number(nextStart.toFixed(3));
      const sanitizedDuration = Number(nextDuration.toFixed(3));
      const nextTrack =
        dragData.trackIds[nextTrackIndex] ??
        dragData.trackIds[dragData.initialTrackIndex] ??
        dragData.trackIds[0];

      setVideoClips((previous) =>
        previous.map((clip) =>
          clip.id === dragData.clipId
            ? {
              ...clip,
              startTime: sanitizedStart,
              duration: sanitizedDuration,
              track: nextTrack,
            }
            : clip,
        ),
      );

      if (!dragData.hasMoved) {
        const distanceX = Math.abs(event.clientX - dragData.startClientX);
        if (distanceX > 2 || Math.abs(deltaY) > 4) {
          dragData.hasMoved = true;
        }
      }

      const scroller = scrollerRef.current;
      if (scroller) {
        const { left, right } = scroller.getBoundingClientRect();
        if (event.clientX > right - DRAG_SCROLL_MARGIN) {
          scroller.scrollLeft += DRAG_SCROLL_SPEED;
        } else if (event.clientX < left + DRAG_SCROLL_MARGIN) {
          scroller.scrollLeft -= DRAG_SCROLL_SPEED;
        }
      }
    },
    [setVideoClips],
  );

  const handleGlobalPointerUp = useCallback(() => {
    window.removeEventListener("pointermove", handleGlobalPointerMove);
    window.removeEventListener("pointerup", handleGlobalPointerUp);
    dragStateRef.current = null;
    setActiveDrag(null);
    if (typeof document !== "undefined") {
      document.body.style.userSelect = "";
    }
  }, [handleGlobalPointerMove]);

  const handleClipInteractionStart = useCallback(
    (event: React.PointerEvent<HTMLElement>, clip: VideoClip, mode: DragMode) => {
      if (event.button !== 0 || dragStateRef.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const multiSelect =
        event.metaKey || event.ctrlKey || event.shiftKey;
      handleClipSelect(clip.id, multiSelect);
      const trackIds = sortedTrackEntries.map(([trackNum]) => Number(trackNum));
      const initialTrackIndex = Math.max(
        0,
        trackIds.findIndex((trackId) => trackId === clip.track),
      );
      dragStateRef.current = {
        clipId: clip.id,
        mode,
        startClientX: event.clientX,
        startClientY: event.clientY,
        initialStart: clip.startTime,
        initialDuration: clip.duration,
        initialTrackIndex:
          initialTrackIndex === -1 ? 0 : initialTrackIndex,
        trackIds: trackIds.length > 0 ? trackIds : [clip.track],
        pixelsPerSecond,
        snapEnabled,
        snapInterval: SNAP_INTERVAL_SECONDS,
        hasMoved: false,
      };
      setActiveDrag({ clipId: clip.id, mode });
      window.addEventListener("pointermove", handleGlobalPointerMove);
      window.addEventListener("pointerup", handleGlobalPointerUp);
      if (typeof document !== "undefined") {
        document.body.style.userSelect = "none";
      }
    },
    [
      handleClipSelect,
      pixelsPerSecond,
      snapEnabled,
      sortedTrackEntries,
      handleGlobalPointerMove,
      handleGlobalPointerUp,
    ],
  );

  const updateCurrentTimeFromPointer = useCallback(
    (clientX: number) => {
      const timeline = timelineRef.current;
      if (!timeline) {
        return;
      }
      const rect = timeline.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const rawSeconds = relativeX / pixelsPerSecond;
      const safeSeconds = Number.isFinite(rawSeconds) ? rawSeconds : 0;
      const clampedSeconds = Math.max(0, Math.min(safeSeconds, totalDuration));
      setCurrentTime(Number(clampedSeconds.toFixed(3)));
    },
    [pixelsPerSecond, totalDuration],
  );

  const handleTimelinePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!playheadScrubRef.current) {
        return;
      }
      event.preventDefault();
      updateCurrentTimeFromPointer(event.clientX);
    },
    [updateCurrentTimeFromPointer],
  );

  const handleTimelinePointerUp = useCallback(() => {
    if (!playheadScrubRef.current) {
      return;
    }
    window.removeEventListener("pointermove", handleTimelinePointerMove);
    window.removeEventListener("pointerup", handleTimelinePointerUp);
    if (typeof document !== "undefined") {
      document.body.style.userSelect = "";
    }
    const shouldResume = playheadScrubRef.current.wasPlaying;
    playheadScrubRef.current = null;
    setIsScrubbing(false);
    if (shouldResume) {
      setIsPlaying(true);
    }
  }, [handleTimelinePointerMove, setIsPlaying, setIsScrubbing]);

  const handleTimelinePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest("[data-timeline-control]") || dragStateRef.current) {
        return;
      }
      event.preventDefault();
      playheadScrubRef.current = { wasPlaying: isPlaying };
      if (isPlaying) {
        setIsPlaying(false);
      }
      setIsScrubbing(true);
      updateCurrentTimeFromPointer(event.clientX);
      window.addEventListener("pointermove", handleTimelinePointerMove);
      window.addEventListener("pointerup", handleTimelinePointerUp);
      if (typeof document !== "undefined") {
        document.body.style.userSelect = "none";
      }
    },
    [
      handleTimelinePointerMove,
      handleTimelinePointerUp,
      isPlaying,
      updateCurrentTimeFromPointer,
      setIsPlaying,
      setIsScrubbing,
    ],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      if (typeof document !== "undefined") {
        document.body.style.userSelect = "";
      }
    };
  }, [handleGlobalPointerMove, handleGlobalPointerUp]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleTimelinePointerMove);
      window.removeEventListener("pointerup", handleTimelinePointerUp);
      if (typeof document !== "undefined") {
        document.body.style.userSelect = "";
      }
      playheadScrubRef.current = null;
    };
  }, [handleTimelinePointerMove, handleTimelinePointerUp]);

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
      const validTracks = new Set(
        sortedTrackEntries.map(([trackNum]) => Number(trackNum)),
      );
      setVideoClips((previous) =>
        previous.map((clip) => {
          if (clip.id !== clipId) {
            return clip;
          }
          const next: VideoClip = { ...clip, ...updates };
          if (updates.startTime !== undefined) {
            const startValue =
              typeof updates.startTime === "number" &&
                Number.isFinite(updates.startTime)
                ? Math.max(0, updates.startTime)
                : clip.startTime;
            next.startTime = Number(startValue.toFixed(3));
          }
          if (updates.duration !== undefined) {
            const durationValue =
              typeof updates.duration === "number" &&
                Number.isFinite(updates.duration)
                ? Math.max(MIN_CLIP_DURATION, updates.duration)
                : clip.duration;
            next.duration = Number(durationValue.toFixed(3));
          }
          if (updates.track !== undefined) {
            const proposedTrack = Number(updates.track);
            if (!validTracks.has(proposedTrack)) {
              const fallback = sortedTrackEntries[0];
              next.track = fallback ? Number(fallback[0]) : clip.track;
            }
          }
          return next;
        }),
      );
    },
    [sortedTrackEntries],
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

  const { ticks: timelineTicks } = timelineTickConfig;
  const playbackProgress = totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;
  const timelineWidthPx = totalDuration * pixelsPerSecond;
  const playheadLeftPx = Math.max(
    0,
    Math.min(timelineWidthPx, currentTime * pixelsPerSecond),
  );
  const isPlayheadActive = isPlaying || isScrubbing;
  const playheadIsNearStart = playheadLeftPx < 48;
  const playheadIsNearEnd = timelineWidthPx - playheadLeftPx < 48;
  const playheadTransform = playheadIsNearStart
    ? "translateX(0)"
    : playheadIsNearEnd
      ? "translateX(-100%)"
      : "translateX(-50%)";
  const playheadAlignmentClasses = playheadIsNearStart
    ? "items-start text-left"
    : playheadIsNearEnd
      ? "items-end text-right"
      : "items-center text-center";

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
        <div className="flex flex-1 flex-col min-w-0">
          <Header
            title="Video Studio"
            description="Craft cinematic episodes with AI-assisted editing tools"
            status={{
              label: isPlaying ? "PLAYING" : "PAUSED",
              color: isPlaying ? "blue" : "gray",
              active: isPlaying,
            }}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={loadLatestConversation}
                  disabled={isLoadingConversation}
                  className="gap-1 h-8 rounded-lg border-border/50"
                >
                  <RefreshCcw
                    className={`size-3.5 ${isLoadingConversation ? "animate-spin" : ""}`}
                  />
                  {isLoadingConversation ? "Refreshing" : "Reload"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={snapEnabled ? "secondary" : "outline"}
                  onClick={() => setSnapEnabled((previous) => !previous)}
                  aria-pressed={snapEnabled}
                  className="hidden sm:inline-flex h-8 rounded-lg border-border/50"
                >
                  <Magnet className="size-3.5 mr-1" />
                  {snapEnabled ? "Snap On" : "Snap Off"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowWaveforms((previous) => !previous)}
                  className="h-8 rounded-lg border-border/50"
                >
                  {showWaveforms ? "Hide Waves" : "Show Waves"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={handleAddClipClick}
                  className="h-8 rounded-lg shadow-sm"
                >
                  <Upload className="size-3.5 mr-1" />
                  Import
                </Button>
              </div>
            }
          />
          <main id="main-content" tabIndex={-1} className="space-y-6 p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1">
            <div className="flex flex-col gap-6 xl:flex-row h-[600px]">
              <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-apple-card glass-panel">
                <div className="border-b border-border/50 bg-black/5 p-6 flex-1 flex items-center justify-center relative">
                  <div className="relative mx-auto flex aspect-video w-full max-w-4xl items-center justify-center overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10">
                    <div className="pointer-events-none text-center text-white/60">
                      <Camera className="mx-auto mb-3 size-12 opacity-50" />
                      <p className="text-sm font-medium tracking-wide">Video Preview</p>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handlePlayPause}
                        aria-label={isPlaying ? "Pause playback" : "Play preview"}
                        className="size-20 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 hover:scale-105 transition-all duration-300 border border-white/20 shadow-2xl"
                      >
                        {isPlaying ? <Pause className="size-8 fill-current" /> : <Play className="size-8 fill-current ml-1" />}
                      </Button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="flex items-center gap-3 text-xs text-white/90 font-medium font-mono">
                        <span className="w-12 text-right">{formatTime(currentTime)}</span>
                        <div
                          role="progressbar"
                          aria-valuenow={Math.round(playbackProgress * 100)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/20 backdrop-blur-sm"
                        >
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)] transition-all duration-100 ease-linear"
                            style={{ width: `${playbackProgress * 100}%` }}
                          />
                        </div>
                        <span className="w-12 text-white/60">{formatTime(totalDuration)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-border/50 bg-background/50 backdrop-blur-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={handlePlayPause}
                        aria-label={isPlaying ? "Pause playback" : "Play preview"}
                        className="rounded-lg hover:bg-secondary/80 size-8"
                      >
                        {isPlaying ? <Pause className="size-4 fill-foreground" /> : <Play className="size-4 fill-foreground" />}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={handleStop}
                        aria-label="Stop playback"
                        className="rounded-lg hover:bg-secondary/80 size-8"
                      >
                        <Square className="size-4 fill-foreground" />
                      </Button>
                      <div className="h-4 w-px bg-border/50 mx-2" />
                      <span className="font-mono text-xs font-medium text-foreground">{formatTime(currentTime)}</span>
                      <span className="font-mono text-xs text-muted-foreground">/ {formatTime(totalDuration)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={handleZoomOut}
                        aria-label="Zoom out timeline"
                        className="rounded-lg hover:bg-secondary/80 size-8"
                      >
                        <ZoomOut className="size-4" />
                      </Button>
                      <div className="w-20 px-2">
                        <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary/50" style={{ width: `${(zoomLevel / 3) * 100}%` }} />
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={handleZoomIn}
                        aria-label="Zoom in timeline"
                        className="rounded-lg hover:bg-secondary/80 size-8"
                      >
                        <ZoomIn className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex h-[280px]">
                    <div className="flex w-48 min-w-[12rem] flex-col border-r border-border/50 bg-secondary/10">
                      <div className="flex h-10 items-center justify-between border-b border-border/50 px-3 bg-secondary/20">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Tracks
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={handleAddTrack}
                          className="size-6 rounded-md hover:bg-background/50"
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {sortedTrackEntries.map(([trackNum, settings]) => {
                          const trackNumber = Number(trackNum);
                          const isMuted = settings.mute;
                          const clipCount = trackClipCount.get(trackNumber) ?? 0;
                          const canRemove =
                            clipCount === 0 && sortedTrackEntries.length > 1;
                          return (
                            <div
                              key={trackNum}
                              className={`relative overflow-hidden border-b border-border/50 px-3 text-xs transition-colors ${isMuted ? "bg-secondary/50" : "bg-transparent hover:bg-secondary/20"
                                }`}
                              style={{ height: TRACK_HEIGHT, minHeight: TRACK_HEIGHT }}
                            >
                              <div className="relative z-10 flex h-full flex-col justify-center gap-1.5">
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
                                    className="w-full rounded border border-transparent bg-transparent px-0 text-xs font-medium text-foreground focus:border-primary/20 focus:outline-none focus:ring-0 truncate"
                                    aria-label={`Rename track ${trackNumber}`}
                                  />
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => toggleTrackMute(trackNumber)}
                                      aria-pressed={isMuted}
                                      className={`size-5 rounded-md ${isMuted ? "text-destructive hover:text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                      {isMuted ? (
                                        <VolumeX className="size-3" />
                                      ) : (
                                        <Volume2 className="size-3" />
                                      )}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleRemoveTrack(trackNumber)}
                                      disabled={!canRemove}
                                      className="size-5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
                                      title={
                                        canRemove
                                          ? "Remove track"
                                          : "Remove clips before deleting"
                                      }
                                    >
                                      <Trash2 className="size-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary/50 rounded-full"
                                      style={{ width: `${settings.volume * 100}%` }}
                                    />
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
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                      aria-label={`Adjust volume for track ${trackNumber}`}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 overflow-x-auto custom-scrollbar bg-background/30" ref={scrollerRef}>
                      <div
                        ref={timelineRef}
                        className="relative select-none min-h-full"
                        style={{
                          width: `${timelineWidthPx}px`,
                          minWidth: "100%",
                        }}
                        onPointerDown={handleTimelinePointerDown}
                      >
                        <div className="relative h-10 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
                          {timelineTicks.map((time) => {
                            const position = time * pixelsPerSecond;
                            const labelNearStart = position < 48;
                            const labelNearEnd = timelineWidthPx - position < 48;
                            const labelTransform = labelNearStart
                              ? "translateX(0)"
                              : labelNearEnd
                                ? "translateX(-100%)"
                                : "translateX(-50%)";
                            const labelAlignment = labelNearStart
                              ? "items-start text-left"
                              : labelNearEnd
                                ? "items-end text-right"
                                : "items-center text-center";
                            return (
                              <React.Fragment key={time}>
                                <div
                                  className="absolute inset-y-0 border-l border-border/20 h-2 bottom-0"
                                  style={{ left: `${position}px` }}
                                />
                                <div
                                  className={`absolute top-2.5 z-10 flex ${labelAlignment} text-[10px] font-medium text-muted-foreground font-mono`}
                                  style={{ left: `${position}px`, transform: labelTransform }}
                                >
                                  <span>
                                    {formatTime(time)}
                                  </span>
                                </div>
                              </React.Fragment>
                            );
                          })}
                          <div
                            className="pointer-events-none absolute top-0 z-30 h-full"
                            style={{ left: `${playheadLeftPx}px` }}
                          >
                            <div
                              className={`relative flex flex-col items-center`}
                              style={{ transform: "translateX(-50%)" }}
                            >
                              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary drop-shadow-sm" />
                            </div>
                          </div>
                        </div>
                        <div
                          className={`pointer-events-none absolute top-0 bottom-0 z-20 w-px ${isPlayheadActive ? "bg-primary" : "bg-primary/50"
                            }`}
                          style={{
                            left: `${playheadLeftPx}px`,
                          }}
                        />
                        {sortedTrackEntries.map(([trackNum, settings]) => {
                          const trackNumber = Number(trackNum);
                          const trackMuted = settings.mute;
                          const trackClips = clipsByTrack.get(trackNumber) ?? [];
                          return (
                            <div
                              key={trackNum}
                              className="relative border-b border-border/50 bg-background/20"
                              style={{ height: TRACK_HEIGHT }}
                            >
                              {trackClips.length === 0 && (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/20">
                                  Drop clips here
                                </div>
                              )}
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
                                const isSelected = selectedClips.includes(clip.id);
                                const isDraggingClip =
                                  activeDrag?.clipId === clip.id &&
                                  activeDrag.mode === "move";
                                const isResizingClip =
                                  activeDrag?.clipId === clip.id &&
                                  activeDrag.mode !== "move";
                                return (
                                  <div
                                    key={clip.id}
                                    className={`group absolute top-1/2 z-10 flex h-10 -translate-y-1/2 transform items-stretch rounded-lg border shadow-sm transition-all duration-150 ease-out
                                      ${trackMuted || clip.muted ? "opacity-60 grayscale" : ""}
                                      ${isSelected ? "border-primary ring-2 ring-primary/20 shadow-md z-20" : "border-transparent hover:border-primary/40"}
                                      ${isDraggingClip ? "cursor-grabbing scale-[1.02] shadow-lg z-30" : "cursor-grab"}`}
                                    style={{
                                      left: `${clipStart}px`,
                                      width: `${clipWidth}px`,
                                      backgroundColor: applyAlphaToHex(clipColor, 0.8),
                                    }}
                                    onPointerDown={(event) =>
                                      handleClipInteractionStart(event, clip, "move")
                                    }
                                  >
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      aria-label="Trim clip start"
                                      className={`absolute inset-y-0 left-0 z-20 flex w-3 cursor-ew-resize items-center justify-center rounded-l-lg hover:bg-black/10 transition-colors focus:outline-none ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                        }`}
                                      onPointerDown={(event) =>
                                        handleClipInteractionStart(event, clip, "trim-start")
                                      }
                                    >
                                      <div className="h-4 w-1 rounded-full bg-white/50" />
                                    </button>
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      aria-label="Trim clip end"
                                      className={`absolute inset-y-0 right-0 z-20 flex w-3 cursor-ew-resize items-center justify-center rounded-r-lg hover:bg-black/10 transition-colors focus:outline-none ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                        }`}
                                      onPointerDown={(event) =>
                                        handleClipInteractionStart(event, clip, "trim-end")
                                      }
                                    >
                                      <div className="h-4 w-1 rounded-full bg-white/50" />
                                    </button>
                                    {fadeInWidth > 0 && (
                                      <div
                                        className="pointer-events-none absolute inset-y-0 left-0 z-[1] rounded-l-lg"
                                        style={{
                                          width: `${fadeInWidth}px`,
                                          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.3), transparent)`,
                                        }}
                                      />
                                    )}
                                    {fadeOutWidth > 0 && (
                                      <div
                                        className="pointer-events-none absolute inset-y-0 right-0 z-[1] rounded-r-lg"
                                        style={{
                                          width: `${fadeOutWidth}px`,
                                          backgroundImage: `linear-gradient(to left, rgba(0,0,0,0.3), transparent)`,
                                        }}
                                      />
                                    )}
                                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
                                      {showWaveforms && waveformPath && (
                                        <svg
                                          className="absolute inset-x-0 top-0 bottom-0 text-white/40 h-full w-full"
                                          preserveAspectRatio="none"
                                        >
                                          <path
                                            d={waveformPath}
                                            fill="currentColor"
                                            className="opacity-50"
                                          />
                                        </svg>
                                      )}
                                      <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 text-white drop-shadow-md">
                                        <span className="truncate text-[11px] font-bold leading-tight tracking-tight">
                                          {clip.name}
                                        </span>
                                        {isSelected && (
                                          <span className="truncate text-[9px] font-medium leading-none opacity-90">
                                            {clipMeta}
                                          </span>
                                        )}
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
              <div className="w-full xl:w-80 shrink-0">
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-apple-card glass-panel">
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
              <Card className="glass-panel border-border/50 shadow-apple-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <FileText className="size-4 text-foreground" />
                    Latest Conversation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  {isLoadingConversation ? (
                    <div className="space-y-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
                      <div className="h-20 animate-pulse rounded-lg bg-secondary/50" />
                    </div>
                  ) : conversationError ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive font-medium">
                      {conversationError}
                    </div>
                  ) : hasConversation ? (
                    <div className="space-y-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {latestPaper?.title ?? "Untitled session"}
                        </p>
                        {latestPaper?.authors ? (
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
                            {latestPaper.authors}
                          </p>
                        ) : null}
                      </div>
                      {conversationSummary ? (
                        <div className="space-y-2 rounded-lg bg-secondary/30 border border-border/50 p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Duration</span>
                            <span className="font-semibold text-foreground">
                              {conversationSummary.durationLabel}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Host turns</span>
                            <span className="font-semibold text-foreground">
                              {conversationSummary.hostTurns}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Expert turns</span>
                            <span className="font-semibold text-foreground">
                              {conversationSummary.expertTurns}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Audio tracks</span>
                            <span className="flex items-center gap-3 font-semibold text-foreground">
                              <span className="flex items-center gap-1">
                                {hostAudioAvailable ? (
                                  <Volume2 className="size-3 text-foreground" />
                                ) : (
                                  <VolumeX className="size-3 text-muted-foreground" />
                                )}
                                Host
                              </span>
                              <span className="flex items-center gap-1">
                                {expertAudioAvailable ? (
                                  <Volume2 className="size-3 text-foreground" />
                                ) : (
                                  <VolumeX className="size-3 text-muted-foreground" />
                                )}
                                Expert
                              </span>
                            </span>
                          </div>
                        </div>
                      ) : null}
                      {conversationSummary?.highlight ? (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground shadow-sm">
                          <p className="font-semibold text-foreground mb-1">Expert highlight</p>
                          <p className="italic text-foreground/80">
                            &ldquo;{conversationSummary.highlight}&rdquo;
                          </p>
                        </div>
                      ) : null}
                      <p className="text-xs text-muted-foreground/70">
                        Last updated {conversationSummary?.lastUpdated ?? "just now"}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 text-sm text-muted-foreground text-center py-4">
                      <div className="size-10 rounded-full bg-secondary mx-auto flex items-center justify-center">
                        <FileText className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">No conversation loaded</p>
                        <p className="text-xs mt-1">
                          Record a session in the Audio Studio first.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="glass-panel border-border/50 shadow-apple-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Sliders className="size-4 text-foreground" />
                    Timeline Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span>Duration</span>
                    <span className="font-medium text-foreground">{formatTime(totalDuration)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span>Clips</span>
                    <span className="font-medium text-foreground">{totalClips}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span>Tracks</span>
                    <span className="font-medium text-foreground">{activeTrackCount}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span>Waveforms</span>
                    <span className="font-medium text-foreground">
                      {showWaveforms ? "Visible" : "Hidden"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span>Master volume</span>
                    <span className="font-medium text-foreground">
                      {Math.round(masterVolume * 100)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-panel border-border/50 shadow-apple-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Download className="size-4 text-foreground" />
                    Export Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span>Preset</span>
                    <span className="font-medium text-foreground">1080p • 30fps</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span>Estimated Size</span>
                    <span className="font-medium text-foreground">~1.2 GB</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span>Enhancements</span>
                    <span className="font-medium text-foreground">Noise cleanup</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span>Format</span>
                    <span className="font-medium text-foreground">MP4 (H.264)</span>
                  </div>
                  <div className="flex items-center gap-3 pt-4">
                    <Button type="button" size="sm" className="flex-1 shadow-md font-semibold">
                      <Download className="size-3.5 mr-2" />
                      Render
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="flex-1 border-border/50">
                      <Upload className="size-3.5 mr-2" />
                      Publish
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
      <TabsList className="grid w-full grid-cols-2 shrink-0 rounded-lg bg-secondary/50 p-1 m-3 mb-0">
        <TabsTrigger
          value="media"
          className="flex items-center gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:text-accent data-[state=active]:shadow-sm text-muted-foreground"
        >
          <Folder className="size-3.5" />
          <span className="hidden sm:inline text-xs font-medium">Media</span>
        </TabsTrigger>
        <TabsTrigger
          value="properties"
          className="flex items-center gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:text-accent data-[state=active]:shadow-sm text-muted-foreground"
        >
          <Sliders className="size-3.5" />
          <span className="hidden sm:inline text-xs font-medium">Properties</span>
        </TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-hidden">
        <TabsContent value="media" className="h-full m-0">
          <div className="flex h-full flex-col">
            <div className="space-y-3 border-b border-border/50 p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search media…"
                  value={mediaQuery}
                  onChange={(event) => setMediaQuery(event.target.value)}
                  className="w-full rounded-lg border border-border/50 bg-background py-2 pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.map((filterOption) => (
                  <Button
                    key={filterOption}
                    type="button"
                    size="xs"
                    variant={mediaFilter === filterOption ? "secondary" : "ghost"}
                    onClick={() => setMediaFilter(filterOption)}
                    aria-pressed={mediaFilter === filterOption}
                    className={`h-6 rounded-md px-2.5 text-[10px] font-medium ${mediaFilter === filterOption
                      ? "bg-accent/10 text-accent border-accent/20"
                      : "text-muted-foreground hover:bg-secondary"
                      }`}
                  >
                    {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            <ScrollArea className="flex-1 custom-scrollbar">
              <div className="space-y-2 p-3">
                {mediaAssets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/50 bg-secondary/20 p-6 text-center text-xs text-muted-foreground">
                    No media found. Import or adjust filters.
                  </div>
                ) : (
                  mediaAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="group flex items-center gap-3 rounded-lg border border-border/50 bg-background px-3 py-2.5 transition-all hover:border-primary/40 hover:bg-secondary/30 hover:shadow-sm"
                    >
                      <div className="flex size-9 items-center justify-center rounded-lg bg-secondary group-hover:bg-secondary/80 transition-colors">
                        {asset.type === "video" ? (
                          <Video className="size-4 text-foreground" />
                        ) : asset.type === "audio" ? (
                          <Volume2 className="size-4 text-foreground" />
                        ) : (
                          <ImageIcon className="size-4 text-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-foreground">
                          {asset.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {asset.type.toUpperCase()} • {asset.duration}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => onAddAssetToTimeline(asset)}
                        className="h-6 shrink-0 rounded-md px-2 text-[10px] font-medium hover:bg-secondary hover:text-foreground"
                      >
                        Add
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
        <TabsContent value="properties" className="h-full m-0">
          <ScrollArea className="h-full custom-scrollbar">
            <div className="space-y-4 p-3 text-sm">
              <div className="rounded-lg border border-border/50 bg-background p-3">
                <h3 className="mb-2 text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Volume2 className="size-3.5 text-foreground" />
                  Master Volume
                </h3>
                <div className="space-y-2">
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full transition-all"
                      style={{ width: `${masterVolume * 100}%` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={masterVolume}
                      onChange={(event) => setMasterVolume(Number(event.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-center font-medium">
                    {Math.round(masterVolume * 100)}%
                  </div>
                </div>
              </div>
              {selectedClips.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/50 bg-secondary/20 p-4 text-center text-xs text-muted-foreground">
                  Select a clip to edit properties
                </div>
              )}
              {selectedClips.length > 1 && (
                <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs text-accent font-medium">
                  {selectedClips.length} clips selected
                </div>
              )}
              {selectedClip && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border/50 bg-background p-3">
                    <div className="mb-3 flex items-center gap-2 pb-3 border-b border-border/50">
                      {getClipTypeIcon(selectedClip.type, "size-5")}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-semibold text-foreground truncate">
                          {selectedClip.name}
                        </h3>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Track {selectedClip.track}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Start (s)</span>
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
                            className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Duration (s)</span>
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
                            className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Track</span>
                          <select
                            value={selectedClip.track}
                            onChange={(event) =>
                              onUpdateClip(selectedClip.id, {
                                track: Number(event.target.value),
                              })
                            }
                            className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                          >
                            {trackOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.id}. {option.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Volume</span>
                          <div className="relative">
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden mt-1">
                              <div
                                className="h-full bg-primary/60 rounded-full"
                                style={{ width: `${(selectedClip.volume ?? 1) * 100}%` }}
                              />
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
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                            </div>
                            <span className="block text-[10px] text-muted-foreground text-center mt-1">
                              {Math.round((selectedClip.volume ?? 1) * 100)}%
                            </span>
                          </div>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Fade In</span>
                          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/60 rounded-full"
                              style={{ width: `${((selectedClip.fadeInSec ?? 0) / 5) * 100}%` }}
                            />
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
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                          <span className="block text-[10px] text-muted-foreground text-center">
                            {(selectedClip.fadeInSec ?? 0).toFixed(1)}s
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Fade Out</span>
                          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/60 rounded-full"
                              style={{ width: `${((selectedClip.fadeOutSec ?? 0) / 5) * 100}%` }}
                            />
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
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                          <span className="block text-[10px] text-muted-foreground text-center">
                            {(selectedClip.fadeOutSec ?? 0).toFixed(1)}s
                          </span>
                        </div>
                      </div>
                      <div className="rounded-md bg-secondary/30 px-3 py-2 text-[10px] text-muted-foreground space-y-0.5 font-mono">
                        <div>Start: {formatTime(selectedClip.startTime)}</div>
                        {clipEnd != null && (
                          <div>End: {formatTime(clipEnd)}</div>
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