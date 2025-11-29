"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { 
  Loader2, 
  Maximize2, 
  X,
  RefreshCw,
  Box,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Film,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type VisualStatus = "analyzing" | "generating" | "ready" | "error";
export type VisualType = "diagram" | "illustration" | "chart" | "animation" | "video";

export interface VisualData {
  id: string;
  concept: string;
  visualType: VisualType;
  status: VisualStatus;
  timestamp: number;
  // Video/image URL - can be data:video/mp4;base64,... or data:image/...
  videoUrl?: string;
  thumbnailUrl?: string;
  isVideo?: boolean; // True if this is a video, false if fallback image
  error?: string;
  generationTime?: number;
  provider?: string;
}

interface VisualCardProps {
  visual: VisualData;
  onRetry?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

export function VisualCard({ visual, onRetry, onDismiss, compact = false }: VisualCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const expandedVideoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {
          // Handle autoplay rejection
          console.log("[VisualCard] Autoplay blocked, user interaction required");
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
    if (expandedVideoRef.current) {
      expandedVideoRef.current.muted = !isMuted;
    }
  };

  // Handle video load errors gracefully
  const handleVideoError = () => {
    console.warn("[VisualCard] Video failed to load, may display as image fallback");
    setHasError(true);
    setIsLoaded(true);
  };

  // For analyzing/generating states, show a loading card
  if (visual.status === "analyzing" || visual.status === "generating") {
    return (
      <div className={cn(
        "rounded-xl border bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20",
        compact ? "p-3" : "p-4"
      )}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={cn(
              "rounded-full border-2 border-white/20 border-t-indigo-500 animate-spin",
              compact ? "size-8" : "size-10"
            )} />
            <Box className={cn(
              "text-white/60 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              compact ? "size-3" : "size-4"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <span className={cn(
              "text-white/70 block truncate",
              compact ? "text-xs" : "text-sm"
            )}>
              {visual.status === "analyzing" ? "Analyzing..." : "Generating video..."}
            </span>
            <span className="text-[10px] text-white/40 truncate block">{visual.concept}</span>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="size-6 p-0 rounded-full hover:bg-white/10 shrink-0"
            >
              <X className="size-3 text-white/50" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // For error state
  if (visual.status === "error") {
    return (
      <div className={cn(
        "rounded-xl border border-red-500/20 bg-red-500/10",
        compact ? "p-3" : "p-4"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "rounded-full bg-red-500/20 flex items-center justify-center shrink-0",
            compact ? "size-8" : "size-10"
          )}>
            <X className={cn("text-red-400", compact ? "size-4" : "size-5")} />
          </div>
          <div className="flex-1 min-w-0">
            <span className={cn("text-white/70 block", compact ? "text-xs" : "text-sm")}>Failed to generate</span>
            <span className="text-[10px] text-white/40 truncate block">{visual.error || "Unknown error"}</span>
          </div>
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="text-xs h-7 px-2 rounded-full bg-white/10 hover:bg-white/20 shrink-0"
            >
              <RefreshCw className="size-3 mr-1" />
              Retry
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="size-6 p-0 rounded-full hover:bg-white/10 shrink-0"
            >
              <X className="size-3 text-white/50" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // For ready state with video/image
  if (visual.status === "ready" && visual.videoUrl) {
    // Determine if this is a video based on:
    // 1. Explicit isVideo flag
    // 2. Data URL content type
    // 3. URL extension
    const isVideo = (() => {
      if (visual.isVideo !== undefined) return visual.isVideo;
      if (visual.videoUrl.startsWith("data:video/")) return true;
      if (visual.videoUrl.startsWith("data:image/")) return false;
      if (visual.videoUrl.includes(".mp4") || visual.videoUrl.includes(".webm")) return true;
      return false; // Default to image for safety
    })();

    return (
      <>
        <div className={cn(
          "rounded-xl border bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20 overflow-hidden",
          compact ? "" : ""
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <Box className="size-3.5 text-indigo-400 shrink-0" />
              <span className="text-xs font-medium text-white/70 truncate">{visual.concept}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(true)}
                className="size-6 p-0 rounded-full hover:bg-white/10"
              >
                <Maximize2 className="size-3 text-white/50" />
              </Button>
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="size-6 p-0 rounded-full hover:bg-white/10"
                >
                  <X className="size-3 text-white/50" />
                </Button>
              )}
            </div>
          </div>

          {/* Media Content */}
          <div className={cn(
            "relative bg-black/40",
            compact ? "aspect-video max-h-[180px]" : "aspect-video"
          )}>
            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-6 text-white/40 animate-spin" />
              </div>
            )}

            {isVideo && !hasError ? (
              <>
                <video
                  ref={videoRef}
                  src={visual.videoUrl}
                  poster={visual.thumbnailUrl}
                  className={cn(
                    "w-full h-full object-contain transition-opacity duration-300",
                    isLoaded ? "opacity-100" : "opacity-0"
                  )}
                  loop
                  autoPlay
                  muted={isMuted}
                  playsInline
                  preload="auto"
                  // Only use crossOrigin for non-data URLs
                  {...(!visual.videoUrl?.startsWith("data:") && { crossOrigin: "anonymous" })}
                  onLoadedData={() => {
                    setIsLoaded(true);
                    setIsPlaying(true); // Auto-playing
                  }}
                  onCanPlay={() => {
                    setIsLoaded(true);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onError={handleVideoError}
                />
                
                {/* Video Controls Overlay */}
                {isLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 bg-black/30">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={togglePlay}
                        className="size-10 p-0 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                      >
                        {isPlaying ? (
                          <Pause className="size-5 text-white" />
                        ) : (
                          <Play className="size-5 text-white ml-0.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleMute}
                        className="size-8 p-0 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                      >
                        {isMuted ? (
                          <VolumeX className="size-4 text-white" />
                        ) : (
                          <Volume2 className="size-4 text-white" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Fallback: Static image (or video that failed to load)
              <img
                src={visual.videoUrl}
                alt={`Visual explanation of ${visual.concept}`}
                className={cn(
                  "w-full h-full object-contain transition-opacity duration-300",
                  isLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setIsLoaded(true)}
                onError={() => setIsLoaded(true)} // Show even if image fails
                {...(!visual.videoUrl?.startsWith("data:") && { crossOrigin: "anonymous" })}
              />
            )}
          </div>

          {/* Footer */}
          {visual.generationTime && (
            <div className="px-3 py-1.5 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-white/40 flex items-center gap-1.5">
                {isVideo && !hasError ? <Film className="size-2.5" /> : <ImageIcon className="size-2.5" />}
                Generated in {(visual.generationTime / 1000).toFixed(1)}s
              </span>
              <span className="text-[10px] text-white/30 uppercase tracking-wide">
                {visual.provider === "google_veo" ? "Veo" : visual.provider === "openai_sora" ? "Sora" : "AI"}
              </span>
            </div>
          )}
        </div>

        {/* Expanded Modal */}
        {isExpanded && (
          <div 
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setIsExpanded(false)}
          >
            <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="absolute -top-12 right-0 text-white/70 hover:text-white z-10"
              >
                <X className="size-5 mr-1" />
                Close
              </Button>
              
              <div className="rounded-xl overflow-hidden bg-black/50">
                {isVideo && !hasError ? (
                  <video
                    ref={expandedVideoRef}
                    src={visual.videoUrl}
                    className="w-full h-auto max-h-[80vh] object-contain"
                    controls
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                    preload="auto"
                    {...(!visual.videoUrl?.startsWith("data:") && { crossOrigin: "anonymous" })}
                  />
                ) : (
                  <img
                    src={visual.videoUrl}
                    alt={`Visual explanation of ${visual.concept}`}
                    className="w-full h-auto max-h-[80vh] object-contain"
                    {...(!visual.videoUrl?.startsWith("data:") && { crossOrigin: "anonymous" })}
                  />
                )}
              </div>
              
              <div className="mt-4 text-center">
                <h3 className="text-lg font-semibold text-white">{visual.concept}</h3>
                <p className="text-sm text-white/50 mt-1">
                  AI-generated {isVideo && !hasError ? "video" : "diagram"} • Click outside to close
                </p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback - shouldn't happen
  return null;
}

// Inline visual component - renders below AI message
export function InlineVisual({ visual, onDismiss }: { visual: VisualData; onDismiss?: () => void }) {
  return (
    <div className="mt-3 max-w-sm">
      <VisualCard visual={visual} onDismiss={onDismiss} compact />
    </div>
  );
}
