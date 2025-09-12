"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Archive,
  BookOpen, 
  Settings, 
  Play,
  Pause,
  Square,
  FileText,
  Headphones,
  Clock,
  Download,
  MoreHorizontal,
  Video,
  Upload,
  Mic,
  Search,
  Calendar,
  Users,
  Eye,
  Share2,
  Trash2,
  Edit,
  Star,
  TrendingUp
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Episode {
  id: string;
  title: string;
  description: string;
  duration: string;
  publishDate: string;
  status: "published" | "draft" | "processing";
  views: number;
  audioUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  featured: boolean;
}

interface Season {
  id: string;
  title: string;
  description: string;
  episodeCount: number;
  totalViews: number;
  startDate: string;
  endDate?: string;
  episodes: Episode[];
  status: "active" | "completed";
}

export default function Library() {
  const pathname = usePathname();
  const [selectedSeason, setSelectedSeason] = useState<string>("1");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [seasons] = useState<Season[]>([
    {
      id: "1",
      title: "Season 1: AI Fundamentals",
      description: "Exploring foundational AI research papers and breakthroughs",
      episodeCount: 12,
      totalViews: 45200,
      startDate: "2024-01-01",
      status: "active",
      episodes: [
        {
          id: "1",
          title: "Attention Is All You Need",
          description: "Deep dive into the transformer architecture that revolutionized AI and natural language processing",
          duration: "24:35",
          publishDate: "2024-01-15",
          status: "published",
          views: 15300,
          audioUrl: "/audio/ep1.wav",
          videoUrl: "/video/ep1.mp4",
          thumbnailUrl: "/thumbnails/ep1.jpg",
          featured: true
        },
        {
          id: "2", 
          title: "BERT: Pre-training of Deep Bidirectional Transformers",
          description: "Understanding how BERT changed the landscape of language understanding",
          duration: "28:42",
          publishDate: "2024-01-22",
          status: "published", 
          views: 12800,
          audioUrl: "/audio/ep2.wav",
          videoUrl: "/video/ep2.mp4", 
          thumbnailUrl: "/thumbnails/ep2.jpg",
          featured: false
        },
        {
          id: "3",
          title: "GPT-3: Language Models are Few-Shot Learners",
          description: "Exploring the capabilities and implications of large language models",
          duration: "31:18",
          publishDate: "2024-01-29",
          status: "published",
          views: 18700,
          audioUrl: "/audio/ep3.wav",
          videoUrl: "/video/ep3.mp4",
          thumbnailUrl: "/thumbnails/ep3.jpg",
          featured: true
        },
        {
          id: "4",
          title: "ResNet: Deep Residual Learning for Image Recognition",
          description: "How residual networks solved the vanishing gradient problem",
          duration: "26:55",
          publishDate: "2024-02-05", 
          status: "processing",
          views: 0,
          featured: false
        },
        {
          id: "5",
          title: "AlphaGo: Mastering the Game of Go with Deep Neural Networks",
          description: "The breakthrough that demonstrated AI's potential in strategic thinking",
          duration: "29:12",
          publishDate: "2024-02-12",
          status: "draft",
          views: 0,
          featured: false
        }
      ]
    },
    {
      id: "2",
      title: "Season 2: Computer Vision Revolution",
      description: "Covering breakthrough papers in computer vision and image recognition",
      episodeCount: 8,
      totalViews: 32100,
      startDate: "2024-03-01", 
      status: "active",
      episodes: [
        {
          id: "6",
          title: "YOLO: Real-Time Object Detection",
          description: "How YOLO changed real-time object detection forever",
          duration: "22:30",
          publishDate: "2024-03-08",
          status: "published",
          views: 9400,
          audioUrl: "/audio/ep6.wav",
          videoUrl: "/video/ep6.mp4",
          thumbnailUrl: "/thumbnails/ep6.jpg",
          featured: false
        },
        {
          id: "7",
          title: "U-Net: Convolutional Networks for Biomedical Image Segmentation",
          description: "The architecture that revolutionized medical image analysis",
          duration: "25:18",
          publishDate: "2024-03-15",
          status: "published",
          views: 7200,
          audioUrl: "/audio/ep7.wav",
          videoUrl: "/video/ep7.mp4",
          thumbnailUrl: "/thumbnails/ep7.jpg",
          featured: false
        }
      ]
    }
  ]);

  const currentSeason = seasons.find(s => s.id === selectedSeason);
  const totalEpisodes = seasons.reduce((sum, season) => sum + season.episodeCount, 0);
  const totalViews = seasons.reduce((sum, season) => sum + season.totalViews, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "text-green-600 bg-green-100";
      case "processing": return "text-yellow-600 bg-yellow-100";
      case "draft": return "text-gray-600 bg-gray-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "published": return <Play className="w-3 h-3" />;
      case "processing": return <Clock className="w-3 h-3" />;
      case "draft": return <Edit className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-56 md:w-64 bg-white border-r border-gray-200 min-h-screen flex-shrink-0">
          <div className="p-6">
            <div 
              className="flex items-center space-x-3 mb-8 cursor-pointer"
              onClick={() => window.location.href = '/'}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Headphones className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 truncate">Virtual Podcast Studio</h1>
            </div>
            
            <nav className="space-y-2">
              <Link 
                href="/"
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/' 
                    ? 'bg-purple-50 text-purple-700' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Search className="w-4 h-4" />
                <span className="text-sm font-medium">Research Hub</span>
              </Link>
              <Link 
                href="/studio"
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/studio' 
                    ? 'bg-purple-50 text-purple-700' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span className="text-sm font-medium">Audio Studio</span>
              </Link>
              <Link 
                href="/video-studio"
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/video-studio' 
                    ? 'bg-purple-50 text-purple-700' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Video className="w-4 h-4" />
                <span className="text-sm font-medium">Video Studio</span>
              </Link>
              <Link 
                href="/publisher"
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/publisher' 
                    ? 'bg-purple-50 text-purple-700' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium">Publisher</span>
              </Link>
              <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-purple-50 text-purple-700">
                <Archive className="w-4 h-4" />
                <span className="text-sm font-medium">Episode Library</span>
              </div>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-gray-50">
          {/* Top Navigation */}
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Episode Library</h1>
                  <p className="text-gray-600 mt-1">Manage and browse your published podcast episodes</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm">
                  <div className="flex items-center space-x-1">
                    <Archive className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{totalEpisodes} episodes</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Eye className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{totalViews.toLocaleString()} views</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-gray-600">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </header>

          <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Season Sidebar */}
            <div className="lg:col-span-1">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-purple-600" />
                    <span>Seasons</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {seasons.map((season) => (
                    <div
                      key={season.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedSeason === season.id
                          ? 'border-purple-300 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      onClick={() => setSelectedSeason(season.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 leading-tight">
                          {season.title}
                        </h3>
                        <div className={`px-2 py-1 rounded-full text-xs ${
                          season.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {season.status}
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                        {season.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{season.episodeCount} episodes</span>
                        <span>{season.totalViews.toLocaleString()} views</span>
                      </div>
                    </div>
                  ))}
                  
                  <Button size="sm" variant="ghost" className="w-full mt-2">
                    <Calendar className="w-3 h-3 mr-2" />
                    New Season
                  </Button>
                </CardContent>
              </Card>

              {/* Stats */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <span>Statistics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Episodes:</span>
                    <span className="font-semibold text-gray-900">{totalEpisodes}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Views:</span>
                    <span className="font-semibold text-gray-900">{totalViews.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Published:</span>
                    <span className="font-semibold text-green-600">
                      {seasons.reduce((sum, s) => sum + s.episodes.filter(e => e.status === 'published').length, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">In Progress:</span>
                    <span className="font-semibold text-yellow-600">
                      {seasons.reduce((sum, s) => sum + s.episodes.filter(e => e.status === 'processing').length, 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Episodes Grid */}
            <div className="lg:col-span-3">
              <Card className="h-fit">
                <CardHeader className="border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      <span>{currentSeason?.title || 'Episodes'}</span>
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
                        {viewMode === 'grid' ? <Users className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  {currentSeason && (
                    <p className="text-sm text-gray-600 mt-1">{currentSeason.description}</p>
                  )}
                </CardHeader>
                
                <CardContent className="p-6">
                  {currentSeason && (
                    <ScrollArea className="h-[600px]">
                      {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {currentSeason.episodes.map((episode) => (
                            <Card key={episode.id} className="border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all">
                              <CardContent className="p-4">
                                <div className="flex items-start space-x-3">
                                  <div className="flex-shrink-0">
                                    {episode.featured && <Star className="w-4 h-4 text-yellow-500 mb-1" />}
                                    <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                                      <BookOpen className="w-6 h-6 text-purple-600" />
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between mb-2">
                                      <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 leading-tight">
                                        {episode.title}
                                      </h3>
                                      <div className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 ${getStatusColor(episode.status)}`}>
                                        {getStatusIcon(episode.status)}
                                        <span>{episode.status}</span>
                                      </div>
                                    </div>
                                    <p className="text-xs text-gray-600 line-clamp-2 mb-3">
                                      {episode.description}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                                      <span>{episode.duration}</span>
                                      <span>{new Date(episode.publishDate).toLocaleDateString()}</span>
                                    </div>
                                    {episode.status === 'published' && (
                                      <div className="flex items-center space-x-1 text-xs text-gray-500 mb-3">
                                        <Eye className="w-3 h-3" />
                                        <span>{episode.views.toLocaleString()} views</span>
                                      </div>
                                    )}
                                    <div className="flex items-center space-x-2">
                                      {episode.status === 'published' && (
                                        <>
                                          <Button size="sm" variant="ghost" className="text-xs px-2 py-1">
                                            <Play className="w-3 h-3 mr-1" />
                                            Play
                                          </Button>
                                          <Button size="sm" variant="ghost" className="text-xs px-2 py-1">
                                            <Download className="w-3 h-3 mr-1" />
                                            Download
                                          </Button>
                                        </>
                                      )}
                                      {episode.status === 'draft' && (
                                        <Button size="sm" variant="ghost" className="text-xs px-2 py-1">
                                          <Edit className="w-3 h-3 mr-1" />
                                          Edit
                                        </Button>
                                      )}
                                      <Button size="sm" variant="ghost" className="text-xs px-2 py-1">
                                        <MoreHorizontal className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {currentSeason.episodes.map((episode) => (
                            <div key={episode.id} className="flex items-center space-x-4 p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all">
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                                  <BookOpen className="w-5 h-5 text-purple-600" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  {episode.featured && <Star className="w-3 h-3 text-yellow-500" />}
                                  <h3 className="font-semibold text-sm text-gray-900 truncate">
                                    {episode.title}
                                  </h3>
                                  <div className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 ${getStatusColor(episode.status)}`}>
                                    {getStatusIcon(episode.status)}
                                    <span>{episode.status}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-600 line-clamp-1">
                                  {episode.description}
                                </p>
                              </div>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>{episode.duration}</span>
                                <span>{new Date(episode.publishDate).toLocaleDateString()}</span>
                                {episode.status === 'published' && (
                                  <div className="flex items-center space-x-1">
                                    <Eye className="w-3 h-3" />
                                    <span>{episode.views.toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center space-x-1">
                                {episode.status === 'published' && (
                                  <Button size="sm" variant="ghost" className="px-2 py-1">
                                    <Play className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="px-2 py-1">
                                  <MoreHorizontal className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
