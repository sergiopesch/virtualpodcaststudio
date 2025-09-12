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
  Download,
  RotateCcw,
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
  icon: React.ReactNode;
  status: "connected" | "disconnected";
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
      icon: <Youtube className="w-4 h-4 text-red-500" />,
      status: "connected",
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
      icon: <Music className="w-4 h-4 text-green-500" />,
      status: "connected",
      settings: {
        title: "EP1: Attention Is All You Need",
        description: "AI Research Podcast - Exploring cutting-edge papers",
      },
    },
    {
      id: "applepodcasts",
      name: "Apple Podcasts",
      icon: <Podcast className="w-4 h-4 text-purple-500" />,
      status: "disconnected",
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
    let interval: NodeJS.Timeout;
    if (isPublishing && !isPaused) {
      interval = setInterval(() => {
        setPublishDuration((prev) => prev + 1);
        setPublishProgress((prev) => Math.min(prev + 1, 100));
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
        return <Speaker className="w-4 h-4 text-purple-500" />;
      case "video":
        return <Video className="w-4 h-4 text-blue-500" />;
      case "thumbnail":
        return <ImageIcon className="w-4 h-4 text-green-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ready":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "processing":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
      <div className="flex">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />

        {/* Main Content */}
        <div className="flex-1">
          <Header
            title="Publisher"
            description="Merge audio with video and generate final podcast files"
            status={{
              label: isPublishing
                ? isPaused
                  ? "PAUSED"
                  : "PUBLISHING"
                : "READY",
              color: isPublishing ? "blue" : "gray",
              active: isPublishing,
            }}
            timer={{
              duration: publishDuration,
              format: formatTime,
            }}
            progress={
              isPublishing
                ? {
                    value: publishProgress,
                    label: `${Math.round(publishProgress)}%`,
                  }
                : undefined
            }
          />

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Project Info & Media Assets */}
            <div className="lg:col-span-1 space-y-6">
              {/* Project Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                    <span>Project Info</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                      {currentProject.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {currentProject.authors}
                    </p>
                    <div className="space-y-1 text-xs text-gray-500">
                      <div className="flex justify-between">
                        <span>Episode:</span>
                        <span>{currentProject.episodeNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Publish Date:</span>
                        <span>{currentProject.publishDate}</span>
                      </div>
                    </div>
                  </div>

                  <Button size="sm" variant="outline" className="w-full">
                    <Settings className="w-3 h-3 mr-2" />
                    Project Settings
                  </Button>
                </CardContent>
              </Card>

              {/* Media Assets */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span>Media Assets</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mediaAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                        selectedAsset === asset.id
                          ? "border-purple-300 bg-purple-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                      onClick={() => setSelectedAsset(asset.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          {getAssetIcon(asset.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {asset.name}
                            </p>
                            {getStatusIcon(asset.status)}
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            {asset.duration && <span>{asset.duration}</span>}
                            <span>{asset.size}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" className="w-full mt-2">
                    <Upload className="w-3 h-3 mr-2" />
                    Add Media
                  </Button>
                </CardContent>
              </Card>

              {/* Publish Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Share2 className="w-5 h-5 text-green-500" />
                    <span>Publish Controls</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex space-x-2">
                    {!isPublishing ? (
                      <Button
                        onClick={handleStartPublish}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        Publish All
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={handlePausePublish}
                          variant="outline"
                          className="flex-1"
                        >
                          {isPaused ? (
                            <Play className="w-4 h-4 mr-2" />
                          ) : (
                            <Pause className="w-4 h-4 mr-2" />
                          )}
                          {isPaused ? "Resume" : "Pause"}
                        </Button>
                        <Button
                          onClick={handleStopPublish}
                          variant="outline"
                          className="flex-1"
                        >
                          <Square className="w-4 h-4 mr-2" />
                          Stop
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <Button size="sm" variant="ghost" className="flex-1">
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1">
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Publishing Platforms */}
            <div className="lg:col-span-2">
              <Card className="h-[700px] flex flex-col">
                <CardHeader className="border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Globe className="w-5 h-5 text-blue-600" />
                      <span>Publishing Platforms</span>
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="ghost">
                        <Settings className="w-4 h-4 mr-1" />
                        Configure
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Play className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col p-6">
                  <ScrollArea className="flex-1">
                    <div className="space-y-4">
                      {platforms.map((platform) => (
                        <Card
                          key={platform.id}
                          className="border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start space-x-4">
                              <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                {platform.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                                    <span>{platform.name}</span>
                                    {platform.status === "connected" ? (
                                      <CheckCircle className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <AlertCircle className="w-4 h-4 text-gray-400" />
                                    )}
                                  </h3>
                                  <div className="flex items-center space-x-2">
                                    <Button size="sm" variant="ghost">
                                      <Settings className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      className={
                                        platform.status === "connected"
                                          ? "bg-green-600 hover:bg-green-700 text-white"
                                          : "bg-blue-600 hover:bg-blue-700 text-white"
                                      }
                                    >
                                      {platform.status === "connected"
                                        ? "Publish"
                                        : "Connect"}
                                    </Button>
                                  </div>
                                </div>

                                {platform.status === "connected" &&
                                  platform.settings.title && (
                                    <div className="space-y-2">
                                      <div>
                                        <p className="text-sm font-medium text-gray-700 mb-1">
                                          Title
                                        </p>
                                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                          {platform.settings.title}
                                        </p>
                                      </div>
                                      {platform.settings.description && (
                                        <div>
                                          <p className="text-sm font-medium text-gray-700 mb-1">
                                            Description
                                          </p>
                                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded line-clamp-2">
                                            {platform.settings.description}
                                          </p>
                                        </div>
                                      )}
                                      {platform.settings.tags && (
                                        <div>
                                          <p className="text-sm font-medium text-gray-700 mb-1">
                                            Tags
                                          </p>
                                          <div className="flex flex-wrap gap-1">
                                            {platform.settings.tags.map(
                                              (tag, index) => (
                                                <span
                                                  key={index}
                                                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                                >
                                                  {tag}
                                                </span>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                {platform.status === "disconnected" && (
                                  <p className="text-sm text-gray-500">
                                    Connect your account to publish to{" "}
                                    {platform.name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Device Preview */}
                  <div className="mt-6 p-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                      Preview Across Devices
                    </h3>
                    <div className="flex items-center justify-center space-x-8">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                          <Monitor className="w-6 h-6 text-gray-600" />
                        </div>
                        <span className="text-xs text-gray-500">Desktop</span>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                          <Smartphone className="w-6 h-6 text-gray-600" />
                        </div>
                        <span className="text-xs text-gray-500">Mobile</span>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                          <Speaker className="w-6 h-6 text-gray-600" />
                        </div>
                        <span className="text-xs text-gray-500">Audio</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
