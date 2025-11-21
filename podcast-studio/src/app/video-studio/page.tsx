"use client";

import React, { useState, useRef, useEffect } from "react";
import { VideoProjectData, VideoClip, MediaAsset, MediaFilter, DragState } from "./types";
import { createId, cloneProject, cloneClip } from "./utils";
import { Header } from "./components/Header";
import { AssetBrowser } from "./components/AssetBrowser";
import { Player } from "./components/Player";
import { Inspector } from "./components/Inspector";
import { Timeline } from "./components/Timeline";
import { Sidebar } from "@/components/layout/sidebar";
import { useSidebar } from "@/contexts/sidebar-context";
import { StoredConversation } from "@/lib/conversationStorage";

  // Initial empty project state
  const createEmptyProject = (): VideoProjectData => ({
    clips: [],
    trackSettings: {
      0: { mute: false, volume: 1, name: "Track 1" },
      1: { mute: false, volume: 1, name: "Track 2" },
      2: { mute: false, volume: 1, name: "Track 3" },
      3: { mute: false, volume: 1, name: "Track 4" },
      4: { mute: false, volume: 1, name: "Track 5" },
    },
    mediaAssets: [],
    summary: null,
    primaryClipId: null,
  });

export default function VideoStudio() {
  const [project, setProject] = useState<VideoProjectData>(createEmptyProject());
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(50); // pixels per second
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [activeAssetTab, setActiveAssetTab] = useState("media");
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const { collapsed, toggleCollapsed } = useSidebar();
  
  // Playback loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      const startTime = Date.now() - currentTime * 1000;
      interval = setInterval(() => {
        const newTime = (Date.now() - startTime) / 1000;
        const maxDuration = Math.max(60, ...project.clips.map(c => c.startTime + c.duration));
        
        if (newTime >= maxDuration) {
            setIsPlaying(false);
            setCurrentTime(maxDuration);
        } else {
            setCurrentTime(newTime);
        }
      }, 16); // ~60fps
    }
    return () => clearInterval(interval);
  }, [isPlaying, project.clips]);

  // Handlers
  const handlePlayPause = () => setIsPlaying(p => !p);
  const handleSeek = (time: number) => {
      setCurrentTime(time);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        switch (e.code) {
            case "Space":
                e.preventDefault();
                handlePlayPause();
                break;
            case "Backspace":
            case "Delete":
                if (selectedClipIds.length > 0) {
                    e.preventDefault();
                    selectedClipIds.forEach(id => handleDeleteClip(id));
                }
                break;
        }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClipIds]);

  const parseDuration = (durationStr: string): number => {
    if (!durationStr) return 0;
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return parseFloat(durationStr) || 0;
  };

  const getAvailableTrack = (startTime: number, duration: number, preferredTrack: number): number => {
      const hasCollision = (track: number) => project.clips.some(c => 
          c.track === track && 
          !(c.startTime + c.duration <= startTime || c.startTime >= startTime + duration)
      );

      if (!hasCollision(preferredTrack)) return preferredTrack;
      
      // Try tracks 0-4
      for (let i = 0; i < 5; i++) {
          if (!hasCollision(i)) return i;
      }
      return preferredTrack; // Fallback
  };

  const handleAddAsset = (asset: MediaAsset) => {
    const parsedDuration = parseDuration(asset.duration);
    const duration = parsedDuration > 0 ? parsedDuration : 5;
    const preferredTrack = asset.type === "audio" ? 1 : 0;
    
    const track = getAvailableTrack(currentTime, duration, preferredTrack);

    const newClip: VideoClip = {
      id: createId(),
      type: asset.type,
      name: asset.name,
      startTime: currentTime, // Add at playhead
      duration,
      track,
      url: asset.url,
      volume: 1,
      opacity: 1,
      scale: 1,
    };

    setProject(prev => ({
      ...prev,
      clips: [...prev.clips, newClip]
    }));
  };

  const handleDropAsset = (asset: MediaAsset, time: number, track: number) => {
    const parsedDuration = parseDuration(asset.duration);
    const newClip: VideoClip = {
      id: createId(),
      type: asset.type,
      name: asset.name,
      startTime: time,
      // Ensure duration is valid
      duration: parsedDuration > 0 ? parsedDuration : 5,
      track: track,
      url: asset.url,
      volume: 1,
      opacity: 1,
      scale: 1,
    };

    setProject(prev => ({
      ...prev,
      clips: [...prev.clips, newClip]
    }));
  };

  const handleUpdateClip = (clipId: string, updates: Partial<VideoClip>) => {
    setProject(prev => ({
      ...prev,
      clips: prev.clips.map(clip => 
        clip.id === clipId ? { ...clip, ...updates } : clip
      )
    }));
  };

  const handleSelectClip = (id: string, multi: boolean) => {
      if (multi) {
          setSelectedClipIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
      } else {
          setSelectedClipIds([id]);
      }
  };

  const handleClipMove = (id: string, newStartTime: number, newTrack: number) => {
      setProject(prev => ({
          ...prev,
          clips: prev.clips.map(clip => 
              clip.id === id ? { ...clip, startTime: Math.max(0, newStartTime), track: newTrack } : clip
          )
      }));
  };

  const handleClipTrim = (id: string, newStartTime: number, newDuration: number) => {
       setProject(prev => ({
          ...prev,
          clips: prev.clips.map(clip => 
              clip.id === id ? { ...clip, startTime: newStartTime, duration: Math.max(0.1, newDuration) } : clip
          )
      }));
  };

  const handleDeleteClip = (id: string) => {
      setProject(prev => ({
          ...prev,
          clips: prev.clips.filter(c => c.id !== id),
          primaryClipId: prev.primaryClipId === id ? null : prev.primaryClipId
      }));
      setSelectedClipIds(prev => prev.filter(c => c !== id));
  };

  const handleSplitClip = (id: string, splitTime: number) => {
      const clip = project.clips.find(c => c.id === id);
      if (!clip) return;

      // Check if split time is within clip
      if (splitTime <= clip.startTime || splitTime >= clip.startTime + clip.duration) return;

      const firstDuration = splitTime - clip.startTime;
      const secondDuration = clip.duration - firstDuration;

      const firstClip = { ...clip, duration: firstDuration };
      const secondClip = { 
          ...cloneClip(clip), 
          id: createId(), 
          startTime: splitTime, 
          duration: secondDuration,
          name: `${clip.name} (Part 2)`
      };

      setProject(prev => ({
          ...prev,
          clips: [...prev.clips.filter(c => c.id !== id), firstClip, secondClip]
      }));
      
      // Select the second part
      setSelectedClipIds([secondClip.id]);
  };

  const handleCopyClip = (id: string) => {
    const clip = project.clips.find(c => c.id === id);
    if (!clip) return;

    // Find next available spot on the same track
    // Or simply offset by 1s for visibility
    const newClip = { 
        ...cloneClip(clip), 
        id: createId(), 
        startTime: clip.startTime + clip.duration + 0.5,
        name: `${clip.name} (Copy)`
    };

    setProject(prev => ({
        ...prev,
        clips: [...prev.clips, newClip]
    }));
    
    // Select the new clip
    setSelectedClipIds([newClip.id]);
  };

  const getMediaDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
        const element = document.createElement(file.type.startsWith('audio') ? 'audio' : 'video');
        element.preload = 'metadata';
        element.onloadedmetadata = () => {
            window.URL.revokeObjectURL(element.src);
            resolve(element.duration);
        };
        element.onerror = () => resolve(0); // Resolve 0 on error to fallback
        element.src = URL.createObjectURL(file);
    });
  };

  const handleImportMedia = async (files: FileList | null): Promise<MediaAsset[]> => {
    if (!files) return [];
    
    const newAssets: MediaAsset[] = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (!file) continue;

        // Strict type detection
        let type: "video" | "audio" | "image" | "text" | "effect" | "transition" = "image";
        if (file.type.startsWith("video")) type = "video";
        else if (file.type.startsWith("audio")) type = "audio";
        else if (file.type.startsWith("image")) type = "image";
        else {
            console.warn(`Skipping unsupported file type: ${file.type} (${file.name})`);
            continue;
        }
        
        let durationStr = "0:05"; // Default
        
        if (type === 'video' || type === 'audio') {
            try {
                const dur = await getMediaDuration(file);
                if (isFinite(dur) && dur > 0) {
                   // Keep it as seconds for internal use, but Asset expects string? 
                   // The parseDuration I added handles M:S.
                   const mins = Math.floor(dur / 60);
                   const secs = Math.floor(dur % 60);
                   const ms = Math.floor((dur % 1) * 100);
                   durationStr = `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
                }
            } catch (e) {
                console.error("Failed to get duration", e);
            }
        }
        
        newAssets.push({
            id: createId(),
            name: file.name,
            type,
            duration: durationStr,
            source: "imported",
            url: URL.createObjectURL(file)
        });
    }

    setProject(prev => ({
        ...prev,
        mediaAssets: [...prev.mediaAssets, ...newAssets]
    }));

    return newAssets;
  };

  const handleTimelineDrop = async (files: FileList, time: number, track: number) => {
      const assets = await handleImportMedia(files);
      
      // Add imported assets to timeline at drop point
      assets.forEach(asset => {
          handleDropAsset(asset, time, track);
          // Increment time slightly for multiple files? 
          // For now just stack them or put them same time. 
          // Ideally sequential if multiple files dropped.
      });
  };

  const handleExport = async () => {
      if (isExporting) return;
      setIsExporting(true);
      // The actual export logic is handled inside Player via the isExporting prop
  };

  const totalDuration = Math.max(60, ...project.clips.map(c => c.startTime + c.duration));

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Header 
          onExport={handleExport} 
          onImport={handleImportMedia}
          isExporting={isExporting}
        />
        
        <div className="flex flex-1 min-h-0">
          {/* Left Sidebar - Asset Browser */}
          <div className="w-[360px] flex-shrink-0 h-full">
             <AssetBrowser 
               assets={project.mediaAssets}
               onAddAsset={handleAddAsset}
               searchQuery={assetSearchQuery}
               onSearchChange={setAssetSearchQuery}
               activeTab={activeAssetTab}
               onTabChange={setActiveAssetTab}
               onImport={handleImportMedia}
             />
          </div>

          {/* Center - Player */}
          <div className="flex-1 flex flex-col min-w-0 bg-black/95 relative z-10">
             <Player 
               project={project}
               currentTime={currentTime}
               duration={totalDuration}
               isPlaying={isPlaying}
               onPlayPause={handlePlayPause}
               onSeek={handleSeek}
               onExportStart={() => setIsExporting(true)}
               onExportEnd={() => setIsExporting(false)}
               isExporting={isExporting}
               onImport={(files) => {
                   handleImportMedia(files).then(assets => {
                       // Add to timeline at playhead
                       assets.forEach(asset => {
                           handleAddAsset(asset);
                       });
                   });
               }}
             />
          </div>

          {/* Right Sidebar - Inspector */}
          <div className="w-[320px] flex-shrink-0 h-full bg-background border-l border-border/50">
              <Inspector 
                selectedClipIds={selectedClipIds}
                clips={project.clips}
                onUpdateClip={handleUpdateClip}
              />
          </div>
        </div>

        {/* Bottom - Timeline */}
        <div className="h-[350px] flex-shrink-0 border-t border-border/50 bg-background z-20">
            <Timeline 
              project={project}
              currentTime={currentTime}
              duration={totalDuration}
              zoomLevel={zoomLevel}
              onZoomChange={setZoomLevel}
              onSeek={handleSeek}
              selectedClipIds={selectedClipIds}
              onSelectClip={handleSelectClip}
              onClipMove={handleClipMove}
              onClipTrim={handleClipTrim}
              onDeleteClip={handleDeleteClip}
              onSplitClip={handleSplitClip}
              onDropAsset={handleDropAsset}
              onCopyClip={handleCopyClip}
              onExternalDrop={handleTimelineDrop}
            />
        </div>
      </div>
    </div>
  );
}
