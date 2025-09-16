"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebar } from "@/contexts/sidebar-context";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Brain,
  Eye,
  Cpu,
  Settings, 
  Search,
  Play,
  FileText,
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
  { label: "Episodes Created", value: "89", icon: Brain, color: "text-blue-600" },
  { label: "Total Views", value: "12.4K", icon: TrendingUp, color: "text-green-600" },
  { label: "Research Hours", value: "156", icon: Clock, color: "text-orange-600" },
];

interface PaperApi {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  published: string;
  arxiv_url: string;
}

interface PaperApiResponse {
  papers?: PaperApi[];
  error?: string;
}

interface PaperCardData extends PaperApi {
  primaryAuthor: string;
  hasAdditionalAuthors: boolean;
  formattedPublishedDate: string;
}

const transformPapers = (papers: PaperApi[] = []): PaperCardData[] => {
  const seen = new Set<string>();
  const parsed: PaperCardData[] = [];

  for (const paper of papers) {
    if (seen.has(paper.id)) {
      continue;
    }

    seen.add(paper.id);

    const authors = paper.authors
      .split(",")
      .map((author) => author.trim())
      .filter(Boolean);

    const publishedDate = new Date(paper.published);
    const formattedPublishedDate = Number.isNaN(publishedDate.getTime())
      ? paper.published
      : publishedDate.toLocaleDateString();

    parsed.push({
      ...paper,
      primaryAuthor: authors[0] ?? "Unknown author",
      hasAdditionalAuthors: authors.length > 1,
      formattedPublishedDate,
    });
  }

  return parsed;
};

export default function Home() {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [papers, setPapers] = useState<PaperCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { collapsed, toggleCollapsed } = useSidebar();

  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedTopicSet = useMemo(() => new Set(selectedTopics), [selectedTopics]);
  const selectedTopicCount = selectedTopics.length;
  const hasSelectedTopics = selectedTopicCount > 0;
  const hasPapers = papers.length > 0;

  const handleTopicToggle = useCallback((topicId: string) => {
    setSelectedTopics((previous) => {
      const next = new Set(previous);

      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }

      return topics
        .filter((topic) => next.has(topic.id))
        .map((topic) => topic.id);
    });
  }, []);

  const handleFetchPapers = useCallback(async () => {
    const topicsPayload = [...selectedTopics];

    if (topicsPayload.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/papers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topics: topicsPayload }),
        cache: "no-store",
        signal: controller.signal,
      });

      const result = (await response.json()) as PaperApiResponse;

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to fetch papers");
      }

      setPapers(transformPapers(result.papers));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      console.error("Error fetching papers:", err);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setLoading(false);
      }
    }
  }, [selectedTopics]);

  const handleClearSelection = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSelectedTopics([]);
    setPapers([]);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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
                      const isSelected = selectedTopicSet.has(topic.id);

                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => handleTopicToggle(topic.id)}
                          aria-pressed={isSelected}
                          className={cn(
                            "group flex w-full items-center space-x-4 rounded-xl border-2 p-4 text-left transition-all duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-200",
                            isSelected
                              ? `${topic.bgColor} ${topic.borderColor} border-opacity-60 shadow-md`
                              : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                          )}
                        >
                          <div
                            className={cn(
                              "flex size-10 items-center justify-center rounded-lg transition-colors",
                              isSelected ? topic.bgColor : "bg-gray-50"
                            )}
                          >
                            <IconComponent className={cn("size-5", topic.color)} />
                          </div>
                          <div className="flex-1">
                            <div className="mb-1 flex items-center space-x-3">
                              <div
                                className={cn(
                                  "flex size-4 items-center justify-center rounded border-2 transition-colors",
                                  isSelected
                                    ? "border-purple-600 bg-purple-600"
                                    : "border-gray-300 bg-white group-hover:border-gray-400"
                                )}
                              >
                                {isSelected && (
                                  <svg className="size-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                              <span className="font-medium text-gray-900">{topic.label}</span>
                            </div>
                            <p className="ml-7 text-xs text-gray-600">{topic.description}</p>
                          </div>
                        </button>
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
                      disabled={!hasSelectedTopics || loading}
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
                      disabled={!hasSelectedTopics && !hasPapers}
                    >
                      Clear
                    </Button>
                  </div>

                  {(hasSelectedTopics || hasPapers) && (
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center text-sm">
                        {hasSelectedTopics && (
                          <span className="text-gray-600">
                            {selectedTopicCount} topic{selectedTopicCount !== 1 ? "s" : ""} selected
                          </span>
                        )}
                        {hasPapers && (
                          <span className="text-green-600 font-medium">
                            {papers.length} paper{papers.length !== 1 ? "s" : ""} found
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
                    ) : hasPapers ? (
                      <div className="p-6 space-y-4">
                        {papers.map((paper) => (
                          <Card
                            key={paper.id}
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
                                      {paper.primaryAuthor}
                                      {paper.hasAdditionalAuthors && " et al."}
                                    </span>
                                    <span className="flex items-center">
                                      <Clock className="w-3 h-3 mr-1" />
                                      {paper.formattedPublishedDate}
                                    </span>
                                  </div>
                                  <p className="text-gray-700 text-sm line-clamp-3 mb-4 leading-relaxed">
                                    {paper.abstract}
                                  </p>
                                  <div className="flex items-center space-x-3">
                                    <Button asChild variant="gradient" size="sm">
                                      <Link href="/studio">
                                        <Play className="w-4 h-4 mr-2" />
                                        Start Audio Studio
                                      </Link>
                                    </Button>
                                    <Button asChild variant="outline" size="sm">
                                      <a href={paper.arxiv_url} target="_blank" rel="noopener noreferrer">
                                        <FileText className="w-4 h-4 mr-2" />
                                        Read Paper
                                      </a>
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
                          Select research topics and click &quot;Find Papers&quot; to discover content
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
