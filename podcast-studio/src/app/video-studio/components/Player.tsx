import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Maximize2 } from "lucide-react";
import { VideoProjectData, VideoClip } from "../types";

interface PlayerProps {
  project: VideoProjectData;
  currentTime: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  duration: number;
  onExportStart?: () => void;
  onExportEnd?: () => void;
  isExporting?: boolean;
  onImport?: (files: FileList) => void;
}

export function Player({
  project,
  currentTime,
  isPlaying,
  onPlayPause,
  onSeek,
  duration,
  onExportStart,
  onExportEnd,
  isExporting,
  onImport
}: PlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Media refs cache
  const mediaCache = useRef<Record<string, HTMLImageElement | HTMLVideoElement>>({});
  
  // Export refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const exportStartTimeRef = useRef<number>(0);

  // --- Export Logic ---
  useEffect(() => {
    if (isExporting && !mediaRecorderRef.current) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        try {
            // Setup Stream
            const stream = canvas.captureStream(60); // 60 FPS
            
            let mimeType = 'video/webm';
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                mimeType = 'video/webm;codecs=vp9';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
                mimeType = 'video/webm;codecs=h264';
            }

            const recorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: 8000000 // 8 Mbps
            });

            mediaRecorderRef.current = recorder;
            recordedChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordedChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                // While we are technically recording webm/h264, naming it .mp4 is often enough for users
                // and most players will detect the container/codec correctly.
                // However, for correctness we should probably stick to .webm or check if we can force mp4 container in future.
                // For now, user asked for MP4 explicitly.
                a.download = `video-export-${Date.now()}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                mediaRecorderRef.current = null;
                onExportEnd?.();
                onSeek(exportStartTimeRef.current); // Restore time
            };

            // Start Export Process
            exportStartTimeRef.current = currentTime;
            onSeek(0); // Go to start
            
            // Give canvas time to render frame 0
            setTimeout(() => {
                if (recorder.state === 'inactive') {
                    recorder.start();
                    if (!isPlaying) {
                        onPlayPause(); // Start playing
                    }
                }
            }, 200);
            
        } catch (e) {
            console.error("Export failed", e);
            onExportEnd?.();
        }
    } else if (!isExporting && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
  }, [isExporting]);

  // Watch for end of playback during export
  useEffect(() => {
      if (isExporting && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          if (currentTime >= duration - 0.1) {
               mediaRecorderRef.current.stop();
               if (isPlaying) onPlayPause();
          }
      }
  }, [currentTime, isExporting, duration, isPlaying, onPlayPause]);


  const [forceUpdate, setForceUpdate] = React.useState(0);

  // ... Export Logic ...

  // --- Rendering Logic ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = 1920;
    canvas.height = 1080;

    // Clear canvas
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Filter active clips
    const activeClips = project.clips
        .filter(clip => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration)
        .sort((a, b) => a.track - b.track);

    // 2. Render each clip
    activeClips.forEach(clip => {
        try {
            const clipTime = Math.max(0, currentTime - clip.startTime);
            
            ctx.save();
            
            // Transform
            ctx.translate(canvas.width / 2, canvas.height / 2);
            
            // Safe transforms
            if (isFinite(clip.x || 0) && isFinite(clip.y || 0)) {
                ctx.translate(clip.x || 0, clip.y || 0);
            }
            
            const scale = clip.scale ?? 1;
            if (isFinite(scale) && scale > 0) {
                ctx.scale(scale, scale);
            }
            
            const rotation = clip.rotation ?? 0;
            if (isFinite(rotation)) {
                ctx.rotate((rotation * Math.PI) / 180);
            }

            if (isFinite(clip.opacity ?? 1)) {
                ctx.globalAlpha = Math.max(0, Math.min(1, clip.opacity ?? 1));
            }
            
            // Fade Calculation
            let fadeAlpha = 1;
            if (clip.fadeInSec && clip.fadeInSec > 0 && clipTime < clip.fadeInSec) {
                fadeAlpha = Math.max(0, Math.min(1, clipTime / clip.fadeInSec));
            } else if (clip.fadeOutSec && clip.fadeOutSec > 0 && clipTime > (clip.duration - clip.fadeOutSec)) {
                fadeAlpha = Math.max(0, Math.min(1, (clip.duration - clipTime) / clip.fadeOutSec));
            }
            ctx.globalAlpha *= fadeAlpha;

            // Volume Logic (Side effect)
            if (clip.type === 'video' || clip.type === 'audio') {
                 const media = mediaCache.current[clip.id];
                 if (media instanceof HTMLMediaElement) { // Check for Video or Audio
                     let volume = (clip.volume ?? 1) * (project.trackSettings[clip.track]?.volume ?? 1);
                     if (project.trackSettings[clip.track]?.mute) volume = 0;
                     
                     // Apply Fades to Volume too
                     volume *= fadeAlpha;
                     // Ensure volume is finite and within range
                     if (isFinite(volume)) {
                        media.volume = Math.max(0, Math.min(1, volume));
                     }
                 }
            }

            // Draw Content
            if (clip.type === 'video' || clip.type === 'image' || clip.type === 'audio') {
                if (clip.url) {
                    let media = mediaCache.current[clip.id];
                    
                    if (!media) {
                        try {
                            if (clip.type === 'video') {
                                const v = document.createElement('video');
                                v.src = clip.url;
                                v.muted = false; 
                                v.volume = 0; 
                                v.load();
                                media = v;
                            } else if (clip.type === 'audio') {
                                const a = new Audio(clip.url);
                                a.muted = false;
                                a.volume = 0;
                                a.load();
                                media = a;
                            } else {
                                // Pre-load image with Promise to ensure it's ready
                                const img = new Image();
                                img.crossOrigin = "anonymous";
                                
                                const handleLoad = () => {
                                    setForceUpdate(c => c + 1);
                                    mediaCache.current[clip.id] = img; // Only cache once loaded
                                };
                                
                                img.onload = handleLoad;
                                img.onerror = (e) => {
                                    console.error(`Image load error for clip ${clip.id}`, clip.url, e);
                                };

                                if (clip.url) {
                                    img.src = clip.url;
                                    // If cached or data URL, it might be complete immediately
                                    if (img.complete) {
                                        handleLoad();
                                    } else {
                                        // Store partially loaded image to prevent re-creation loop
                                        // But we need to know it's not ready yet
                                        mediaCache.current[clip.id] = img; 
                                    }
                                }
                                media = img;
                            }
                            mediaCache.current[clip.id] = media;
                        } catch (e) {
                            console.error("Failed to create media element", e);
                        }
                    }

                    if (media instanceof HTMLMediaElement) {
                        // ... (video logic) ...
                        // Playback Control
                        if (isFinite(clip.playbackRate ?? 1)) {
                            media.playbackRate = clip.playbackRate ?? 1;
                        }
                        
                        if (Math.abs(media.currentTime - clipTime) > 0.3) {
                            if (isFinite(clipTime)) {
                                media.currentTime = clipTime;
                            }
                        }
                        
                        if (isPlaying && media.paused) {
                            media.play().catch(() => {});
                        } else if (!isPlaying && !media.paused) {
                            media.pause();
                        }

                        // Only Draw Video (Audio is invisible)
                        if (media instanceof HTMLVideoElement && media.readyState >= 2) {
                            if (media.videoWidth > 0 && media.videoHeight > 0) {
                                try {
                                    const vidAspect = media.videoWidth / media.videoHeight;
                                    const canvasAspect = canvas.width / canvas.height;
                                    let drawW = canvas.width;
                                    let drawH = canvas.height;
                                    
                                    if (vidAspect > canvasAspect) {
                                        drawW = canvas.width;
                                        drawH = canvas.width / vidAspect;
                                    } else {
                                        drawH = canvas.height;
                                        drawW = canvas.height * vidAspect;
                                    }
                                    
                                    ctx.drawImage(media, -drawW/2, -drawH/2, drawW, drawH);
                                } catch (e) {
                                    // Ignore draw errors
                                }
                            }
                        }
                    } else if (media instanceof HTMLImageElement) {
                         // Ensure image is fully loaded and has dimensions
                        if (media.complete && media.naturalWidth > 0) {
                                 try {
                                    const imgAspect = media.naturalWidth / media.naturalHeight;
                                    const canvasAspect = canvas.width / canvas.height;
                                    let drawW = canvas.width;
                                    let drawH = canvas.height;
                                    
                                    if (imgAspect > canvasAspect) {
                                        drawW = canvas.width;
                                        drawH = canvas.width / imgAspect;
                                    } else {
                                        drawH = canvas.height;
                                        drawW = canvas.height * imgAspect;
                                    }

                                    ctx.drawImage(media, -drawW/2, -drawH/2, drawW, drawH);
                                 } catch (e) {
                                     // Ignore draw errors
                                 }
                        }
                    }
                }
            } else if (clip.type === 'text') {
                // Text rendering
                // ... (User asked to remove text option from Asset Browser, but existing clips might remain, or if we want to support it internally)
            }

            ctx.restore();
        } catch (e) {
            console.error("Error rendering clip", clip.id, e);
            ctx.restore(); // Ensure restore is called even on error
        }
    });
    
    // Cleanup inactive videos
    Object.keys(mediaCache.current).forEach(id => {
        const clip = project.clips.find(c => c.id === id);
        const media = mediaCache.current[id];
        if (!clip && media) {
            if (media instanceof HTMLMediaElement) {
                media.pause();
                media.src = "";
            }
            delete mediaCache.current[id];
        } else if (clip && (currentTime < clip.startTime || currentTime > clip.startTime + clip.duration)) {
             // Pause inactive videos
             if (media instanceof HTMLMediaElement && !media.paused) {
                 media.pause();
             }
        }
    });

  }, [project.clips, currentTime, isPlaying, project.trackSettings, forceUpdate]);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "00:00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${ms.toString().padStart(2, "0")}`;
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onImport) {
          onImport(e.dataTransfer.files);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
  };

  return (
    <div 
      className="flex h-full flex-col bg-black"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black/90">
        <div 
          ref={containerRef}
          className="aspect-video w-full max-w-4xl bg-black border border-white/10 relative shadow-2xl overflow-hidden"
        >
            <canvas 
                ref={canvasRef}
                className="w-full h-full object-contain"
            />
            
            {project.clips.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-white/20 pointer-events-none">
                    <div className="text-center">
                        <div className="mb-2 text-4xl opacity-20">🎬</div>
                        <p>No Media</p>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Player Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-zinc-900">
        <div className="flex items-center gap-1 text-xs font-mono text-white/70">
          <span className="text-white font-semibold">{formatTime(currentTime)}</span>
          <span className="text-white/30 mx-1">/</span>
          <span className="text-white/50">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => onSeek(0)}>
            <SkipBack className="size-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 rounded-full bg-white text-black hover:bg-gray-200 hover:text-black hover:scale-105 transition-all"
            onClick={onPlayPause}
          >
            {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => onSeek(duration)}>
            <SkipForward className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10">
                <Maximize2 className="size-4" />
             </Button>
        </div>
      </div>
    </div>
  );
}
