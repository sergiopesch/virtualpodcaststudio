import React from "react";
import { Video, Volume2, Image as ImageIcon, Type, Wand2, Sparkles, FileText } from "lucide-react";
import { ClipType, VideoClip, TrackSettings, VideoProjectData } from "./types";

export const TRACK_HEIGHT = 64;
export const MIN_CLIP_DURATION = 0.5;
export const SNAP_INTERVAL_SECONDS = 0.5;
export const DRAG_SCROLL_MARGIN = 80;
export const DRAG_SCROLL_SPEED = 18;
export const MIN_TIMELINE_LABEL_SPACING = 80;
export const TIMELINE_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300] as const;
export const WAVEFORM_HEIGHT = 36;
export const MIN_WAVEFORM_SAMPLES = 24;
export const WAVEFORM_VERTICAL_PADDING = 2;

export function getClipTypeIcon(type: ClipType, size = "size-4") {
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

export const cloneClip = (clip: VideoClip): VideoClip => ({
  ...clip,
  filters: clip.filters ? { ...clip.filters } : undefined,
  keyframes: clip.keyframes
    ? clip.keyframes.map((keyframe) => ({
        time: keyframe.time,
        properties: { ...keyframe.properties },
      }))
    : undefined,
  waveform: clip.waveform ? [...clip.waveform] : undefined,
  transitions: clip.transitions ? clip.transitions.map((transition) => ({ ...transition })) : undefined,
  effects: clip.effects ? clip.effects.map((effect) => ({ ...effect })) : undefined,
  animatedProperties: clip.animatedProperties
    ? clip.animatedProperties.map((property) => ({
        ...property,
        keyframes: property.keyframes.map((keyframe) => ({ ...keyframe })),
      }))
    : undefined,
  playbackRate: clip.playbackRate ?? 1,
});

export const cloneTrackSettings = (settings: TrackSettings): TrackSettings =>
  Object.entries(settings).reduce<TrackSettings>((accumulator, [track, value]) => {
    accumulator[Number(track)] = { ...value };
    return accumulator;
  }, {});

export const cloneProject = (project: VideoProjectData): VideoProjectData => ({
  clips: project.clips.map(cloneClip),
  trackSettings: cloneTrackSettings(project.trackSettings),
  mediaAssets: [...project.mediaAssets],
  summary: project.summary ? { ...project.summary, audio: { ...project.summary.audio } } : null,
  primaryClipId: project.primaryClipId,
});

export const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const seededRandom = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t ^= t << 13;
    t ^= t >>> 17;
    t ^= t << 5;
    return (t >>> 0) / 4294967295;
  };
};

