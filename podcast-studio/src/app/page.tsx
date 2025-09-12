"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  UserCheck
} from "lucide-react";

const topics = [
  { id: "cs.AI", label: "Artificial Intelligence", icon: Brain, color: "text-purple-400" },
  { id: "cs.LG", label: "Machine Learning", icon: Cpu, color: "text-blue-400" },
  { id: "cs.CV", label: "Computer Vision", icon: Eye, color: "text-green-400" },
  { id: "cs.RO", label: "Robotics", icon: Settings, color: "text-orange-400" },
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Headphones className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Virtual Podcast Studio</h1>
            </div>
            
            <nav className="space-y-2">
              <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-purple-50 text-purple-700">
                <Mic className="w-4 h-4" />
                <span className="text-sm font-medium">Studio</span>
              </div>
              <div className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Scripts</span>
              </div>
              <div className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer">
                <BookOpen className="w-4 h-4" />
                <span className="text-sm font-medium">Research</span>
              </div>
              <div className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer">
                <UserCheck className="w-4 h-4" />
                <span className="text-sm font-medium">Team</span>
              </div>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-gray-50">
          {/* Top Navigation */}
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Research Hub</h1>
                <p className="text-gray-600 mt-1">Discover and analyze research papers for podcast content</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search papers..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <Button variant="ghost" size="sm" className="text-gray-600">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Topic Selection */}
            <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Research Topics</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {topics.map((topic) => {
                  const IconComponent = topic.icon;
                  const isSelected = selectedTopics.includes(topic.id);
                  
                  return (
                    <div
                      key={topic.id}
                      className={`flex items-center space-x-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-purple-300 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      onClick={() => handleTopicChange(topic.id, !isSelected)}
                    >
                      <div className={`flex-shrink-0 ${topic.color}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${
                            isSelected 
                              ? 'bg-purple-600 border-purple-600' 
                              : 'border-gray-300 bg-white'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-900 flex-1">
                            {topic.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Action Buttons */}
            <section className="flex justify-center">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 w-full max-w-md">
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3 px-4 rounded-lg disabled:opacity-50"
                    onClick={handleClearSelection}
                    disabled={selectedTopics.length === 0 && papers.length === 0}
                  >
                    Clear
                  </Button>
                </div>
                
                {(selectedTopics.length > 0 || papers.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
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
              </div>
            </section>

            {/* Paper Preview */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Research Papers</h2>
                <p className="text-gray-600 text-sm mt-1">Latest papers from your selected topics</p>
              </div>
              
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
                        className="border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200"
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                                {paper.title}
                              </h3>
                              <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                                <span className="flex items-center">
                                  {paper.authors.split(',')[0]}
                                  {paper.authors.split(',').length > 1 && ' et al.'}
                                </span>
                                <span>
                                  {new Date(paper.published).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-gray-700 text-sm line-clamp-3 mb-4">
                                {paper.abstract}
                              </p>
                              <div className="flex items-center space-x-4">
                                <Button
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700 text-white"
                                  onClick={() =>
                                    console.log(`Selected paper: ${paper.title}`)
                                  }
                                >
                                  <Play className="w-3 h-3 mr-1" />
                                  Create Podcast
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                                  onClick={() => window.open(paper.arxiv_url, '_blank')}
                                >
                                  <BookOpen className="w-3 h-3 mr-1" />
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
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 font-medium mb-2">No papers yet</p>
                    <p className="text-gray-500 text-sm">
                      Select research topics and click &quot;Find Papers&quot; to discover content
                    </p>
                  </div>
                )}
              </ScrollArea>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
