export type ClipType = "video" | "audio" | "image" | "text" | "effect" | "transition";

export type DragMode = "move" | "trim-start" | "trim-end";

export interface DragState {
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

export type SelectionMode = "single" | "multi" | "range";

export interface VideoClip {
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
  url?: string;
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
  transitions?: TransitionConfig[];
  effects?: ClipEffect[];
  animatedProperties?: AnimatedProperty[];
  playbackRate?: number;
}

export type TransitionType = "crossfade" | "dip-black" | "zoom" | "glitch";

export interface TransitionConfig {
  id: string;
  type: TransitionType;
  duration: number;
  ease?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

export type ClipEffectType = "vignette" | "vhs" | "cinematic" | "mono" | "custom";

export interface ClipEffect {
  id: string;
  name: string;
  type: ClipEffectType;
  intensity: number;
}

export type AnimatedPropertyType = "position" | "scale" | "opacity" | "rotation" | "x" | "y";

export interface AnimatedProperty {
  id: string;
  type: AnimatedPropertyType;
  keyframes: Array<{
    time: number;
    value: number;
    ease?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  }>;
}

export type MediaFilter = "all" | "video" | "audio" | "image";

export interface MediaAsset {
  id: string;
  name: string;
  type: ClipType;
  duration: string;
  source: "library" | "imported";
  url?: string;
}

export type TrackSetting = {
  mute: boolean;
  volume: number;
  name: string;
};

export type TrackSettings = Record<number, TrackSetting>;

export interface ConversationSummary {
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

export interface VideoProjectData {
  clips: VideoClip[];
  trackSettings: TrackSettings;
  mediaAssets: MediaAsset[];
  summary: ConversationSummary | null;
  primaryClipId: string | null;
}

