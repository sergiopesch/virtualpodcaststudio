"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebar } from "@/contexts/sidebar-context";
import {
  Upload,
  BookOpen,
  Settings,
  Play,
  Pause,
  Square,
  FileText,
  Clock,
  Video,
  Image as ImageIcon,
  Share2,
  Globe,
  Youtube,
  Music,
  Podcast,
  CheckCircle,
  AlertCircle,
  Monitor,
  Smartphone,
  Speaker,
  Rss,
  Mic
} from "lucide-react";

interface MediaAsset {
  id: string;
  type: "audio" | "video" | "thumbnail";
  name: string;
  duration?: string;
  size: string;
  status: "ready" | "processing" | "error";
}

interface ExportPlatform {
  id: string;
  name: string;
  icon: React.ElementType;
  status: "Connected" | "Pending" | "Disconnected";
  settings: {
    title?: string;
    description?: string;
    tags?: string[];
  };
}

export default function Publisher() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const { collapsed, toggleCollapsed } = useSidebar();
  const [publishDuration, setPublishDuration] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  const [mediaAssets] = useState<MediaAsset[]>([
    {
      id: "1",
      type: "audio",
      name: "attention_is_all_you_need_conversation.wav",
      duration: "24:35",
      size: "156 MB",
      status: "ready",
    },
    {
      id: "2",
      type: "video",
      name: "attention_is_all_you_need_video.mp4",
      duration: "24:35",
      size: "2.1 GB",
      status: "ready",
    },
    {
      id: "3",
      type: "thumbnail",
      name: "episode_thumbnail.png",
      size: "2.3 MB",
      status: "ready",
    },
  ]);

  const [platforms] = useState<ExportPlatform[]>([
    {
      id: "youtube",
      name: "YouTube",
      icon: Youtube,
      status: "Connected",
      settings: {
        title: "Attention Is All You Need - AI Research Explained",
        description:
          "Deep dive into the transformer architecture that revolutionized AI",
        tags: ["AI", "Machine Learning", "Research", "Transformers"],
      },
    },
    {
      id: "spotify",
      name: "Spotify",
      icon: Music,
      status: "Connected",
      settings: {
        title: "EP1: Attention Is All You Need",
        description: "AI Research Podcast - Exploring cutting-edge papers",
      },
    },
    {
      id: "applepodcasts",
      name: "Apple Podcasts",
      icon: Podcast,
      status: "Disconnected",
      settings: {},
    },
  ]);

  const currentProject = {
    title: "Attention Is All You Need",
    authors: "Ashish Vaswani et al.",
    episodeNumber: "001",
    publishDate: "2024-01-15",
  };

  // Simulate publish timer
  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPublishing && !isPaused) {
      interval = setInterval(() => {
        setPublishDuration((prev: number) => prev + 1);
        setPublishProgress((prev: number) => Math.min(prev + 1, 100));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPublishing, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartPublish = () => {
    setIsPublishing(true);
    setIsPaused(false);
    setPublishProgress(0);
  };

  const handlePausePublish = () => {
    setIsPaused(!isPaused);
  };

  const handleStopPublish = () => {
    setIsPublishing(false);
    setIsPaused(false);
    setPublishDuration(0);
    setPublishProgress(0);
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "audio":
        return <Speaker className="w-4 h-4 text-gray-900" />;
      case "video":
        return <Video className="w-4 h-4 text-gray-900" />;
      case "thumbnail":
        return <ImageIcon className="w-4 h-4 text-gray-900" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ready":
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case "processing":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
        <div className="flex flex-1 flex-col min-w-0">
          <Header
            title="Publisher"
            description="Distribute your podcast to the world"
          />
          <main id="main-content" tabIndex={-1} className="space-y-6 p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1">
            <div className="max-w-5xl mx-auto space-y-8">
              {/* Header Section */}
              <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 text-foreground p-8 lg:p-10 shadow-apple-card glass-panel">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                      Publisher
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-xl">
                      Distribute your podcast to the world.
                    </p>
                  </div>
                  <Button className="shadow-md font-semibold">
                    <Upload className="size-4 mr-2" />
                    New Release
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                  <Card className="glass-panel border-border/50 shadow-apple-card">
                    <CardHeader className="border-b border-border/50 bg-background/50 pb-4">
                      <CardTitle className="flex items-center gap-2 text-foreground text-lg font-semibold">
                        <Share2 className="size-5 text-foreground" />
                        Distribution Channels
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {platforms.map((channel) => (
                        <div key={channel.name} className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border/50 hover:bg-secondary/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-secondary flex items-center justify-center shadow-sm">
                              <channel.icon className="size-5 text-foreground" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">{channel.name}</h3>
                              <p className="text-xs text-muted-foreground">Auto-sync enabled</p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${channel.status === "Connected"
                            ? "bg-accent/10 text-accent border border-accent/20"
                            : "bg-secondary text-muted-foreground border border-border/50"
                            }`}>
                            {channel.status}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  <Card className="glass-panel border-border/50 shadow-apple-card">
                    <CardHeader className="border-b border-border/50 bg-background/50 pb-4">
                      <CardTitle className="flex items-center gap-2 text-foreground text-base font-semibold">
                        <Rss className="size-4 text-foreground" />
                        RSS Feed
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 break-all text-xs text-muted-foreground font-mono">
                        https://feed.podcaststudio.ai/u/speschiera/feed.xml
                      </div>
                      <Button variant="outline" className="w-full border-border/50 shadow-sm">
                        Copy Feed URL
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
