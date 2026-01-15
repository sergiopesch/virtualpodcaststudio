import React, { useRef, useEffect, useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VideoClip, VideoProjectData, DragState, DragMode, ClipType, MediaAsset } from "../types";
import { TRACK_HEIGHT, getClipTypeIcon } from "../utils";
import { Magnet, ZoomIn, ZoomOut, Trash2, Split, Scissors, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TimelineProps {
  project: VideoProjectData;
  currentTime: number;
  duration: number;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  onSeek: (time: number) => void;
  selectedClipIds: string[];
  onSelectClip: (id: string, multi: boolean) => void;
  onClipMove: (id: string, newStartTime: number, newTrack: number) => void;
  onClipTrim: (id: string, newStartTime: number, newDuration: number) => void;
  onDeleteClip: (id: string) => void;
  onSplitClip: (id: string, time: number) => void;
  onDropAsset: (asset: MediaAsset, time: number, track: number) => void;
  onCopyClip: (id: string) => void;
  onExternalDrop?: (files: FileList, time: number, track: number) => void;
}

export function Timeline({
  project,
  currentTime,
  duration,
  zoomLevel,
  onZoomChange,
  onSeek,
  selectedClipIds,
  onSelectClip,
  onClipMove,
  onClipTrim,
  onDeleteClip,
  onSplitClip,
  onDropAsset,
  onCopyClip,
  onExternalDrop
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  
  // Simple drag state for clips (this should ideally be more robust)
  const [draggingClip, setDraggingClip] = useState<{
    id: string;
    startX: number;
    originalStartTime: number;
    originalDuration: number;
    originalTrack: number;
    mode: DragMode;
  } | null>(null);

  const pixelsPerSecond = zoomLevel;

  // Generate tracks
  const tracks = Array.from({ length: 5 }, (_, i) => i); // 5 tracks for now

  const handleMouseDown = (e: React.MouseEvent) => {
      // Handle timeline click to seek
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
      const time = Math.max(0, (x - 100) / pixelsPerSecond); // 100px sidebar width
      if (time >= 0) {
          onSeek(time);
          setIsDraggingPlayhead(true);
      }
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
      if (isDraggingPlayhead) {
          const rect = timelineRef.current?.getBoundingClientRect();
          if (!rect) return;
          const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
          const time = Math.max(0, (x - 100) / pixelsPerSecond);
          onSeek(time);
      }

      if (draggingClip) {
          // Calculate delta
           const deltaX = e.clientX - draggingClip.startX;
           const deltaTime = deltaX / pixelsPerSecond;
           
           if (draggingClip.mode === 'move') {
               onClipMove(draggingClip.id, draggingClip.originalStartTime + deltaTime, draggingClip.originalTrack);
               // Track changing logic would be here (calculating Y delta)
           } else if (draggingClip.mode === 'trim-start') {
               const newStartTime = draggingClip.originalStartTime + deltaTime;
               const newDuration = draggingClip.originalDuration - deltaTime;
               if (newDuration >= 0.1) {
                   onClipTrim(draggingClip.id, newStartTime, newDuration);
               }
           } else if (draggingClip.mode === 'trim-end') {
               const newDuration = draggingClip.originalDuration + deltaTime;
               if (newDuration >= 0.1) {
                   onClipTrim(draggingClip.id, draggingClip.originalStartTime, newDuration);
               }
           }
      }
  }, [isDraggingPlayhead, draggingClip, pixelsPerSecond, onSeek, onClipMove, onClipTrim]);

  const handleMouseUp = React.useCallback(() => {
      setIsDraggingPlayhead(false);
      setDraggingClip(null);
  }, []);

  useEffect(() => {
      if (isDraggingPlayhead || draggingClip) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      } else {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isDraggingPlayhead, draggingClip, handleMouseMove, handleMouseUp]);


  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      
      // 1. Handle Files (Desktop -> Timeline)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onExternalDrop) {
          const rect = timelineRef.current?.getBoundingClientRect();
          if (!rect) return;

          const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
          const time = Math.max(0, (x - 100) / pixelsPerSecond); 
          
          const target = e.target as HTMLElement;
          const trackRow = target.closest('[data-track-index]');
          let trackIndex = 0;
          if (trackRow) {
              trackIndex = parseInt(trackRow.getAttribute('data-track-index') || '0');
          }
          
          onExternalDrop(e.dataTransfer.files, time, trackIndex);
          return;
      }

      // 2. Handle Assets (Library -> Timeline)
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;
      
      try {
          const asset = JSON.parse(data) as MediaAsset;
          const rect = timelineRef.current?.getBoundingClientRect();
          if (!rect) return;

          const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
          const time = Math.max(0, (x - 100) / pixelsPerSecond); // 100px sidebar width
          
          const target = e.target as HTMLElement;
          const trackRow = target.closest('[data-track-index]');
          let trackIndex = 0;
          if (trackRow) {
              trackIndex = parseInt(trackRow.getAttribute('data-track-index') || '0');
          } else {
              trackIndex = asset.type === 'audio' ? 1 : 0;
          }
          
          onDropAsset(asset, time, trackIndex);
      } catch (err) {
          console.error("Failed to parse dropped asset", err);
      }
  };

  return (
    <div className="flex h-full flex-col bg-background select-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2 bg-muted/20">
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="icon" onClick={() => onZoomChange(Math.max(10, zoomLevel - 10))}>
               <ZoomOut className="size-4" />
           </Button>
            <span className="text-xs text-muted-foreground min-w-[3ch] text-center">{(zoomLevel / 10).toFixed(1)}x</span>
           <Button variant="ghost" size="icon" onClick={() => onZoomChange(Math.min(200, zoomLevel + 10))}>
               <ZoomIn className="size-4" />
           </Button>
        </div>
        <div className="flex items-center gap-2">
            <Button 
                variant="ghost" 
                size="sm" 
                disabled={selectedClipIds.length !== 1}
                onClick={() => selectedClipIds[0] && onCopyClip(selectedClipIds[0])}
            >
                <Copy className="size-4 mr-2" />
                Duplicate
            </Button>
            <Button 
                variant="ghost" 
                size="sm" 
                disabled={selectedClipIds.length !== 1}
                onClick={() => selectedClipIds[0] && onSplitClip(selectedClipIds[0], currentTime)}
            >
                <Split className="size-4 mr-2" />
                Split
            </Button>
             <Button 
                variant="ghost" 
                size="sm" 
                disabled={selectedClipIds.length === 0}
                onClick={() => selectedClipIds.forEach(id => onDeleteClip(id))}
                className="text-destructive hover:text-destructive"
            >
                <Trash2 className="size-4 mr-2" />
                Delete
            </Button>
        </div>
      </div>

      {/* Ruler & Timeline */}
      <div 
          className="flex-1 relative overflow-hidden flex" 
          ref={timelineRef} 
          onMouseDown={e => {
              // Only trigger seek if clicking header or empty space, not clips
              if ((e.target as HTMLElement).closest('.clip-item')) return;
              handleMouseDown(e);
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
      >
         
         {/* Track Headers (Left Sidebar) */}
         <div className="w-[100px] flex-shrink-0 border-r border-border/50 bg-background z-20 shadow-sm">
             <div className="h-8 border-b border-border/50 bg-muted/30" /> {/* Ruler spacer */}
             {tracks.map(trackId => (
                 <div key={trackId} className="border-b border-border/50 flex items-center justify-center text-xs text-muted-foreground" style={{ height: TRACK_HEIGHT }}>
                     Track {trackId}
                 </div>
             ))}
         </div>

         {/* Scrollable Timeline Area */}
         <ScrollArea className="flex-1" orientation="horizontal">
             <div className="relative min-w-full h-full" style={{ width: Math.max(duration * pixelsPerSecond + 500, 2000) }}>
                 
                 {/* Ruler */}
                 <div className="h-8 border-b border-border/50 bg-muted/10 relative sticky top-0 z-10">
                     {/* Generate ticks based on zoom */}
                     {Array.from({ length: Math.ceil(duration) + 10 }).map((_, sec) => (
                         <div 
                            key={sec} 
                            className="absolute bottom-0 border-l border-border/50 h-4 text-[10px] pl-1 text-muted-foreground"
                            style={{ left: sec * pixelsPerSecond }}
                         >
                             {sec % 5 === 0 ? sec + 's' : ''}
                         </div>
                     ))}
                 </div>

                 {/* Tracks Container */}
                 <div className="relative">
                      {/* Playhead Line */}
                     <div 
                        className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
                        style={{ left: currentTime * pixelsPerSecond }}
                     >
                         <div className="absolute -top-2 -left-1.5 w-3 h-3 bg-red-500 rotate-45 transform" />
                     </div>

                     {tracks.map(trackId => (
                         <div 
                            key={trackId} 
                            data-track-index={trackId}
                            className="border-b border-border/50 relative bg-secondary/5" 
                            style={{ height: TRACK_HEIGHT }}
                        >
                             {project.clips
                                .filter(clip => clip.track === trackId)
                                .map(clip => (
                                    <div
                                        key={clip.id}
                                        className={cn(
                                            "absolute top-1 bottom-1 rounded-md border shadow-sm overflow-hidden cursor-pointer clip-item group",
                                            selectedClipIds.includes(clip.id) 
                                                ? "border-primary ring-2 ring-primary/20 z-10" 
                                                : "border-border/50 hover:border-primary/50"
                                        )}
                                        style={{
                                            left: clip.startTime * pixelsPerSecond,
                                            width: clip.duration * pixelsPerSecond,
                                            backgroundColor: clip.color || '#3b82f6'
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectClip(clip.id, e.metaKey || e.ctrlKey);
                                        }}
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            onSelectClip(clip.id, false);
                                            setDraggingClip({
                                                id: clip.id,
                                                startX: e.clientX,
                                                originalStartTime: clip.startTime,
                                                originalDuration: clip.duration,
                                                originalTrack: clip.track,
                                                mode: 'move'
                                            });
                                        }}
                                    >
                                        <div className="flex items-center gap-2 px-2 h-full text-white">
                                            {getClipTypeIcon(clip.type, "size-3")}
                                            <span className="text-[10px] font-medium truncate drop-shadow-md">{clip.name}</span>
                                        </div>
                                        
                                        {/* Resize Handles */}
                                        {/* Only show on hover/selected */}
                                        <div 
                                            className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize opacity-0 group-hover:opacity-100 bg-white/20 z-20"
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setDraggingClip({
                                                    id: clip.id,
                                                    startX: e.clientX,
                                                    originalStartTime: clip.startTime,
                                                    originalDuration: clip.duration,
                                                    originalTrack: clip.track,
                                                    mode: 'trim-start'
                                                });
                                            }}
                                        />
                                        <div 
                                            className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize opacity-0 group-hover:opacity-100 bg-white/20 z-20"
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setDraggingClip({
                                                    id: clip.id,
                                                    startX: e.clientX,
                                                    originalStartTime: clip.startTime,
                                                    originalDuration: clip.duration,
                                                    originalTrack: clip.track,
                                                    mode: 'trim-end'
                                                });
                                            }}
                                        />
                                    </div>
                                ))
                             }
                         </div>
                     ))}
                 </div>
             </div>
         </ScrollArea>
      </div>
    </div>
  );
}
