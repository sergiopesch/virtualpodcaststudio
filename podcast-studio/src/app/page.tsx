"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebar } from "@/contexts/sidebar-context";
import { 
  Mic, 
  BookOpen, 
  Brain, 
  Eye, 
  Cpu, 
  Settings, 
  Search,
  Play,
  FileText,
  Headphones,
  UserCheck,
  Video,
  Upload,
  Archive,
  Sparkles,
  TrendingUp,
  Clock,
  Users
} from "lucide-react";
import Link from "next/link";

const topics = [
  { 
    id: "cs.AI", 
    label: "Artificial Intelligence", 
    icon: Brain, 
    color: "text-purple-600", 
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    description: "Latest AI breakthroughs and research"
  },
  { 
    id: "cs.LG", 
    label: "Machine Learning", 
    icon: Cpu, 
    color: "text-blue-600", 
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "ML algorithms and applications"
  },
  { 
    id: "cs.CV", 
    label: "Computer Vision", 
    icon: Eye, 
    color: "text-green-600", 
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    description: "Image recognition and processing"
  },
  { 
    id: "cs.RO", 
    label: "Robotics", 
    icon: Settings, 
    color: "text-orange-600", 
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    description: "Robotic systems and automation"
  },
];

const stats = [
  { label: "Papers Analyzed", value: "1,247", icon: BookOpen, color: "text-purple-600" },
  { label: "Episodes Created", value: "89", icon: Mic, color: "text-blue-600" },
  { label: "Total Views", value: "12.4K", icon: TrendingUp, color: "text-green-600" },
  { label: "Research Hours", value: "156", icon: Clock, color: "text-orange-600" },
];

interface Paper {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  published: string;
  arxiv_url: string;
}

export default function Home() {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { collapsed, toggleCollapsed } = useSidebar();

  const handleTopicChange = (topicId: string, checked: boolean) => {
    setSelectedTopics((prev) =>
      checked
        ? [...prev, topicId]
        : prev.filter((id) => id !== topicId)
    );
  };

  const handleFetchPapers = async () => {
    if (selectedTopics.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/papers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topics: selectedTopics }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch papers");
      }
      
      const data = await response.json();
      // Remove duplicate papers based on ID
      const uniquePapers = data.papers.filter((paper: Paper, index: number, self: Paper[]) => 
        index === self.findIndex(p => p.id === paper.id)
      );
      setPapers(uniquePapers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching papers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedTopics([]);
    setPapers([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
      <div className="flex">
        <Sidebar 
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
        
        {/* Main Content */}
        <div className="flex-1">
          <Header
            title="Research Hub"
            description="Discover and analyze research papers to fuel AI-powered podcast conversations"
            search={{
              placeholder: "Search papers...",
              onSearch: (query) => console.log("Search:", query)
            }}
          />

          <main className="p-6 space-y-8">
            {/* Stats Overview */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                  <Card key={index} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center`}>
                          <IconComponent className={`w-6 h-6 ${stat.color}`} />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                          <p className="text-sm text-gray-600">{stat.label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            {/* Topic Selection */}
            <section className="animate-slide-up">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <span>Research Topics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {topics.map((topic) => {
                      const IconComponent = topic.icon;
                      const isSelected = selectedTopics.includes(topic.id);
                      
                      return (
                        <div
                          key={topic.id}
                          className={`group p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                            isSelected
                              ? `${topic.bgColor} ${topic.borderColor} border-opacity-60 shadow-md`
                              : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                          }`}
                          onClick={() => handleTopicChange(topic.id, !isSelected)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className={`w-10 h-10 rounded-lg ${isSelected ? topic.bgColor : 'bg-gray-50'} flex items-center justify-center transition-colors`}>
                              <IconComponent className={`w-5 h-5 ${topic.color}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-1">
                                <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${
                                  isSelected 
                                    ? 'bg-purple-600 border-purple-600' 
                                    : 'border-gray-300 bg-white group-hover:border-gray-400'
                                }`}>
                                  {isSelected && (
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                                <span className="font-medium text-gray-900">{topic.label}</span>
                              </div>
                              <p className="text-xs text-gray-600 ml-7">{topic.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Action Buttons */}
            <section className="flex justify-center animate-scale-in">
              <Card className="w-full max-w-md">
                <CardContent className="p-6">
                  <div className="flex gap-3 mb-4">
                    <Button
                      variant="gradient"
                      size="lg"
                      className="flex-1"
                      onClick={handleFetchPapers}
                      disabled={selectedTopics.length === 0 || loading}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Find Papers
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleClearSelection}
                      disabled={selectedTopics.length === 0 && papers.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                  
                  {(selectedTopics.length > 0 || papers.length > 0) && (
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center text-sm">
                        {selectedTopics.length > 0 && (
                          <span className="text-gray-600">
                            {selectedTopics.length} topic{selectedTopics.length !== 1 ? 's' : ''} selected
                          </span>
                        )}
                        {papers.length > 0 && (
                          <span className="text-green-600 font-medium">
                            {papers.length} paper{papers.length !== 1 ? 's' : ''} found
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Paper Preview */}
            <section className="animate-fade-in">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <span>Research Papers</span>
                  </CardTitle>
                  <p className="text-sm text-gray-600">Latest papers from your selected topics</p>
                </CardHeader>
                
                <CardContent className="p-0">
                  <ScrollArea className="h-96">
                    {error ? (
                      <div className="text-center py-12">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FileText className="w-6 h-6 text-red-600" />
                        </div>
                        <p className="text-red-600 font-medium mb-2">Error loading papers</p>
                        <p className="text-gray-500 text-sm">{error}</p>
                      </div>
                    ) : papers.length > 0 ? (
                      <div className="p-6 space-y-4">
                        {papers.map((paper, index) => (
                          <Card
                            key={`${paper.id}-${index}`}
                            className="border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-300 interactive"
                          >
                            <CardContent className="p-6">
                              <div className="flex items-start space-x-4">
                                <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-glow">
                                  <BookOpen className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 text-base">
                                    {paper.title}
                                  </h3>
                                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                                    <span className="flex items-center">
                                      <Users className="w-3 h-3 mr-1" />
                                      {paper.authors.split(',')[0]}
                                      {paper.authors.split(',').length > 1 && ' et al.'}
                                    </span>
                                    <span className="flex items-center">
                                      <Clock className="w-3 h-3 mr-1" />
                                      {new Date(paper.published).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-gray-700 text-sm line-clamp-3 mb-4 leading-relaxed">
                                    {paper.abstract}
                                  </p>
                                  <div className="flex items-center space-x-3">
                                    <Link href="/studio">
                                      <Button variant="gradient" size="sm">
                                        <Play className="w-4 h-4 mr-2" />
                                        Start Audio Studio
                                      </Button>
                                    </Link>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(paper.arxiv_url, '_blank')}
                                    >
                                      <FileText className="w-4 h-4 mr-2" />
                                      Read Paper
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
                          <Search className="w-8 h-8 text-white" />
                        </div>
                        <p className="text-gray-600 font-medium mb-2">No papers yet</p>
                        <p className="text-gray-500 text-sm">
                          Select research topics and click "Find Papers" to discover content
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
