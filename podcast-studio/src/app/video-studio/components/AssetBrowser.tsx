import React, { useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Video, Wand2, Sparkles, Plus, Upload, Film, Eye } from "lucide-react";
import { MediaAsset } from "../types";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AssetBrowserProps {
  assets: MediaAsset[];
  onAddAsset: (asset: MediaAsset) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onImport: (files: FileList | null) => void;
}

export function AssetBrowser({
  assets,
  onAddAsset,
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  onImport
}: AssetBrowserProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);

  const categories = [
    { id: "media", label: "Media", icon: Film },
    { id: "transitions", label: "Transitions", icon: Sparkles },
  ];

  // Mock data for built-ins
  const mockAssets: Record<string, MediaAsset[]> = {
    transitions: [
      { id: 'tr-1', name: 'Cross Fade', type: 'transition', duration: '0:01', source: 'library' },
      { id: 'tr-2', name: 'Dip to Black', type: 'transition', duration: '0:01', source: 'library' },
      { id: 'tr-3', name: 'Zoom', type: 'transition', duration: '0:01', source: 'library' },
    ]
  };

  // Filter assets based on active tab
  const getDisplayAssets = () => {
    let sourceList: MediaAsset[] = [];
    
    if (activeTab === 'media') {
        // Combine video, image, audio
        sourceList = assets.filter(a => ['video', 'image', 'audio'].includes(a.type));
    } else {
        sourceList = mockAssets[activeTab] || [];
    }

    if (searchQuery) {
        return sourceList.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return sourceList;
  };

  const filteredAssets = getDisplayAssets();

  const handleDragStart = (e: React.DragEvent, asset: MediaAsset) => {
    e.dataTransfer.setData("application/json", JSON.stringify(asset));
    e.dataTransfer.effectAllowed = "copy";
  };

  // Drag & Drop Upload Handlers
  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onImport(e.dataTransfer.files);
      }
  };

  const handleUploadClick = () => {
      fileInputRef.current?.click();
  };

  return (
    <div 
      className="flex h-full flex-col border-r border-border/50 bg-background/50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
      <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept="video/*,audio/*,image/*"
          onChange={(e) => onImport(e.target.files)}
      />

      {/* Top Navigation Tabs */}
      <div className="px-2 pt-2 border-b border-border/50">
         <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-2">
            {categories.map((category) => (
                <button
                    key={category.id}
                    onClick={() => onTabChange(category.id)}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                        activeTab === category.id 
                            ? "bg-secondary text-foreground shadow-sm" 
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                >
                    <category.icon className="size-3.5" />
                    {category.label}
                </button>
            ))}
         </div>
      </div>

      {/* Search & Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="pl-8 h-8 text-xs bg-secondary/30 border-border/50"
            />
          </div>
          
          {/* Upload Button (Only in Media Tab) */}
          {activeTab === 'media' && (
              <Button 
                variant="outline" 
                className="w-full h-8 text-xs border-dashed border-border/60 hover:border-primary/50 hover:bg-secondary/50"
                onClick={handleUploadClick}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                  <Upload className="size-3 mr-2" />
                  Import Media
              </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 gap-3 p-3">
             {filteredAssets.length === 0 ? (
               <div 
                    className="col-span-2 py-12 text-center flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg bg-secondary/10 transition-colors hover:bg-secondary/20 hover:border-primary/30 cursor-pointer"
                    onClick={() => activeTab === 'media' && handleUploadClick()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                 {activeTab === 'media' ? (
                     <>
                        <Upload className="size-8 mb-2 opacity-50" />
                        <p className="text-xs font-medium">No media imported</p>
                        <p className="text-[10px] mt-1 opacity-70">Click or drag files here</p>
                     </>
                 ) : (
                     <p className="text-xs">No items found</p>
                 )}
               </div>
             ) : (
               filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, asset)}
                  className="group relative aspect-video cursor-grab active:cursor-grabbing overflow-hidden rounded-lg border border-border/50 bg-secondary/20 transition-all hover:ring-2 hover:ring-primary/50 hover:border-primary/50"
                  onClick={() => onAddAsset(asset)}
                >
                  {/* Thumbnail / Icon */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    {asset.url && (asset.type === 'image' || asset.type === 'video') ? (
                        asset.type === 'video' ? (
                             <video src={asset.url} className="w-full h-full object-cover" />
                        ) : (
                             <img src={asset.url} className="w-full h-full object-cover" alt={asset.name} />
                        )
                    ) : (
                         <div className="text-muted-foreground/50">
                            {asset.type === "video" && <Video className="size-6" />}
                            {asset.type === "effect" && <Wand2 className="size-6" />}
                            {asset.type === "transition" && <Sparkles className="size-6" />}
                            {/* Fallback for others if any */}
                            {!['video', 'effect', 'transition', 'image'].includes(asset.type) && <Film className="size-6" />}
                         </div>
                    )}
                  </div>

                  {/* Info Overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-4">
                    <div className="truncate text-[10px] font-medium text-white shadow-sm">
                      {asset.name}
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                         <div className="text-[9px] text-white/70 font-mono">
                            {asset.duration}
                         </div>
                         {/* Quick Actions on Hover */}
                         <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                            <button 
                                className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewAsset(asset);
                                }}
                                title="Preview"
                            >
                                <Eye className="size-3" />
                            </button>
                            <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                                <Plus className="size-3" />
                            </div>
                         </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Preview Dialog */}
        <Dialog open={!!previewAsset} onOpenChange={(open) => !open && setPreviewAsset(null)}>
            <DialogContent className="max-w-3xl bg-black/95 border-white/10 p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b border-white/10">
                    <DialogTitle className="text-sm font-medium text-white flex items-center justify-between">
                        <span>{previewAsset?.name}</span>
                        <span className="text-xs font-normal text-white/50">{previewAsset?.duration}</span>
                    </DialogTitle>
                </DialogHeader>
                <div className="aspect-video w-full flex items-center justify-center bg-black relative">
                    {previewAsset && (
                        <>
                            {previewAsset.type === 'video' && previewAsset.url && (
                                <video 
                                    src={previewAsset.url} 
                                    controls 
                                    autoPlay 
                                    className="w-full h-full object-contain" 
                                />
                            )}
                            {previewAsset.type === 'audio' && previewAsset.url && (
                                <div className="w-full p-8 flex flex-col items-center justify-center gap-4">
                                    <div className="size-24 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                                        <Film className="size-10 text-primary" />
                                    </div>
                                    <audio src={previewAsset.url} controls className="w-full max-w-md" />
                                </div>
                            )}
                            {previewAsset.type === 'image' && previewAsset.url && (
                                <img 
                                    src={previewAsset.url} 
                                    alt={previewAsset.name} 
                                    className="w-full h-full object-contain" 
                                />
                            )}
                        </>
                    )}
                </div>
                <div className="p-4 border-t border-white/10 flex justify-end">
                    <Button 
                        onClick={() => {
                            if (previewAsset) {
                                onAddAsset(previewAsset);
                                setPreviewAsset(null);
                            }
                        }}
                    >
                        Add to Timeline
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
