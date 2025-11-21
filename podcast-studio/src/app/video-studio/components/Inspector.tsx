import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider"; // Assuming we have this or use input type=range
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoClip, ClipType } from "../types";
import { getClipTypeIcon } from "../utils";

interface InspectorProps {
  selectedClipIds: string[];
  clips: VideoClip[];
  onUpdateClip: (clipId: string, updates: Partial<VideoClip>) => void;
}

export function Inspector({ selectedClipIds, clips, onUpdateClip }: InspectorProps) {
  const selectedClip =
    selectedClipIds.length === 1
      ? clips.find((clip) => clip.id === selectedClipIds[0]) ?? null
      : null;

  if (selectedClipIds.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground bg-background border-l border-border/50">
        <p>Select a clip to edit properties</p>
      </div>
    );
  }

  if (selectedClipIds.length > 1) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground bg-background border-l border-border/50">
        <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-accent font-medium">
          {selectedClipIds.length} clips selected
        </div>
      </div>
    );
  }

  if (!selectedClip) return null;

  return (
    <div className="flex h-full flex-col border-l border-border/50 bg-background w-80">
       <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
             {getClipTypeIcon(selectedClip.type, "size-5")}
             <Input 
                value={selectedClip.name} 
                onChange={(e) => onUpdateClip(selectedClip.id, { name: e.target.value })}
                className="h-8 text-xs font-semibold"
             />
          </div>
       </div>

      <Tabs defaultValue="video" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 p-0 bg-transparent border-b border-border/50 rounded-none h-10">
          <TabsTrigger 
            value="video" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none h-10 text-xs"
            disabled={selectedClip.type === 'audio'}
          >
            Video
          </TabsTrigger>
          <TabsTrigger 
             value="audio" 
             className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none h-10 text-xs"
             disabled={selectedClip.type === 'image' || selectedClip.type === 'text'}
          >
            Audio
          </TabsTrigger>
          <TabsTrigger 
            value="speed" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none h-10 text-xs"
            disabled={selectedClip.type === 'image' || selectedClip.type === 'text'}
          >
            Speed
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <TabsContent value="video" className="space-y-4 m-0">
               {/* Position & Size */}
               <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Transform</h3>
                  <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Scale</label>
                          <div className="flex items-center gap-2">
                              <input 
                                type="range" 
                                min={0.1} max={3} step={0.1}
                                value={selectedClip.scale ?? 1}
                                onChange={(e) => onUpdateClip(selectedClip.id, { scale: parseFloat(e.target.value) })}
                                className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-[10px] w-8 text-right">{Math.round((selectedClip.scale ?? 1) * 100)}%</span>
                          </div>
                      </div>
                       <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Opacity</label>
                          <div className="flex items-center gap-2">
                              <input 
                                type="range" 
                                min={0} max={1} step={0.05}
                                value={selectedClip.opacity ?? 1}
                                onChange={(e) => onUpdateClip(selectedClip.id, { opacity: parseFloat(e.target.value) })}
                                className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-[10px] w-8 text-right">{Math.round((selectedClip.opacity ?? 1) * 100)}%</span>
                          </div>
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Rotation</label>
                           <div className="flex items-center gap-2">
                              <input 
                                type="range" 
                                min={-180} max={180} step={1}
                                value={selectedClip.rotation ?? 0}
                                onChange={(e) => onUpdateClip(selectedClip.id, { rotation: parseFloat(e.target.value) })}
                                className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-[10px] w-8 text-right">{Math.round(selectedClip.rotation ?? 0)}°</span>
                          </div>
                      </div>
                  </div>
               </div>

               <div className="space-y-3 pt-4 border-t border-border/50">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Visual Style</h3>
                   <div className="grid grid-cols-2 gap-2">
                      {["talking-head", "paper-visual", "diagram", "overlay"].map(style => (
                          <Button 
                            key={style}
                            variant={selectedClip.visualStyle === style ? "secondary" : "outline"}
                            size="sm"
                            className="text-[10px] h-7"
                            onClick={() => onUpdateClip(selectedClip.id, { visualStyle: style as any })}
                          >
                            {style.replace("-", " ")}
                          </Button>
                      ))}
                   </div>
               </div>
            </TabsContent>

            <TabsContent value="audio" className="space-y-4 m-0">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Volume</h3>
                   <div className="space-y-1">
                          <div className="flex items-center gap-2">
                              <input 
                                type="range" 
                                min={0} max={1} step={0.05}
                                value={selectedClip.volume ?? 1}
                                onChange={(e) => onUpdateClip(selectedClip.id, { volume: parseFloat(e.target.value) })}
                                className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-[10px] w-8 text-right">{Math.round((selectedClip.volume ?? 1) * 100)}%</span>
                          </div>
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t border-border/50">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Fade</h3>
                   <div className="space-y-2">
                       <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Fade In (s)</label>
                           <div className="flex items-center gap-2">
                              <input 
                                type="range" 
                                min={0} max={5} step={0.1}
                                value={selectedClip.fadeInSec ?? 0}
                                onChange={(e) => onUpdateClip(selectedClip.id, { fadeInSec: parseFloat(e.target.value) })}
                                className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-[10px] w-8 text-right">{(selectedClip.fadeInSec ?? 0).toFixed(1)}s</span>
                          </div>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Fade Out (s)</label>
                           <div className="flex items-center gap-2">
                              <input 
                                type="range" 
                                min={0} max={5} step={0.1}
                                value={selectedClip.fadeOutSec ?? 0}
                                onChange={(e) => onUpdateClip(selectedClip.id, { fadeOutSec: parseFloat(e.target.value) })}
                                className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-[10px] w-8 text-right">{(selectedClip.fadeOutSec ?? 0).toFixed(1)}s</span>
                          </div>
                       </div>
                   </div>
                </div>
            </TabsContent>

             <TabsContent value="speed" className="space-y-4 m-0">
                 <div className="space-y-3">
                     <div className="flex items-center justify-between">
                         <label className="text-xs">Playback Rate</label>
                         <span className="text-xs font-mono">{selectedClip.playbackRate ?? 1}x</span>
                     </div>
                     <div className="flex items-center gap-2">
                         <span className="text-[10px] text-muted-foreground">0.5x</span>
                         <input 
                            type="range" 
                            min={0.5} max={2} step={0.1}
                            value={selectedClip.playbackRate ?? 1}
                            onChange={(e) => onUpdateClip(selectedClip.id, { playbackRate: parseFloat(e.target.value) })}
                            className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                        />
                         <span className="text-[10px] text-muted-foreground">2x</span>
                     </div>
                 </div>
             </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

