"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";

const topics = [
  {
    id: "cs.AI",
    label: "Artificial Intelligence",
    icon: Brain,
    description: "Latest AI breakthroughs and research"
  },
  {
    id: "cs.LG",
    label: "Machine Learning",
    icon: Cpu,
    description: "ML algorithms and applications"
  },
  {
    id: "cs.CV",
    label: "Computer Vision",
    icon: Eye,
    description: "Image recognition and processing"
  },
  {
    id: "cs.RO",
    label: "Robotics",
    icon: Settings,
    description: "Robotic systems and automation"
  },
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

    const primaryAuthor = authors[0] || "Unknown Author";
    const hasAdditionalAuthors = authors.length > 1;

    const dateObj = new Date(paper.published);
    const formattedPublishedDate = isNaN(dateObj.getTime())
      ? "Unknown Date"
      : dateObj.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

    parsed.push({
      ...paper,
      primaryAuthor,
      hasAdditionalAuthors,
      formattedPublishedDate,
    });
  }

  return parsed;
};

export default function Home() {
  const { collapsed, toggleCollapsed } = useSidebar();
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [papers, setPapers] = useState<PaperCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Load saved state on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTopics = sessionStorage.getItem("vps:selectedTopics");
      if (savedTopics) {
        try {
          setSelectedTopics(JSON.parse(savedTopics));
        } catch (e) {
          console.error("Failed to parse saved topics", e);
        }
      }

      const savedPapers = sessionStorage.getItem("vps:papers");
      if (savedPapers) {
        try {
          setPapers(JSON.parse(savedPapers));
        } catch (e) {
          console.error("Failed to parse saved papers", e);
        }
      }
    }
  }, []);

  const handleTopicToggle = (topicId: string) => {
    setSelectedTopics((prev) => {
      const next = prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId];
      sessionStorage.setItem("vps:selectedTopics", JSON.stringify(next));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedTopics([]);
    setPapers([]);
    sessionStorage.removeItem("vps:selectedTopics");
    sessionStorage.removeItem("vps:papers");
  };

  const handleFetchPapers = async () => {
    if (selectedTopics.length === 0) return;

    setLoading(true);
    setError(null);
    setPapers([]);

    try {
      const response = await fetch("/api/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: selectedTopics }),
      });

      const data = (await response.json().catch(() => ({}))) as PaperApiResponse;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch papers");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const transformed = transformPapers(data.papers);
      setPapers(transformed);
      sessionStorage.setItem("vps:papers", JSON.stringify(transformed));
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load papers. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPaper = (paper: PaperCardData) => {
    sessionStorage.setItem("vps:selectedPaper", JSON.stringify(paper));
    router.push("/studio");
  };

  const hasSelectedTopics = selectedTopics.length > 0;
  const hasPapers = papers.length > 0;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      <div className="flex">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-12">
              {/* Topic Selection */}
              <section className="space-y-8">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-3xl font-semibold tracking-tight text-white flex items-center gap-3">
                    Select Topics
                  </h2>
                  {hasSelectedTopics && (
                    <span className="text-xs font-bold tracking-wider text-black bg-white px-4 py-1.5 rounded-full uppercase shadow-glow">
                      {selectedTopics.length} Selected
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {topics.map((topic) => {
                    const isSelected = selectedTopics.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        onClick={() => handleTopicToggle(topic.id)}
                        className={cn(
                          "group relative flex flex-col items-start p-8 rounded-[1.5rem] transition-all duration-500 ease-apple text-left w-full border",
                          isSelected
                            ? "bg-white/15 border-white/20 shadow-glass-sm scale-[1.02] backdrop-blur-md"
                            : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 hover:-translate-y-1"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-6">
                          <div
                            className={cn(
                              "p-4 rounded-2xl transition-all duration-500",
                              isSelected
                                ? "bg-white text-black shadow-glow"
                                : "bg-white/5 text-white/70 group-hover:bg-white/10 group-hover:text-white"
                            )}
                          >
                            <topic.icon className="size-6" />
                          </div>
                          <div
                            className={cn(
                              "size-6 rounded-full border flex items-center justify-center transition-all duration-300",
                              isSelected
                                ? "border-white bg-white"
                                : "border-white/20 bg-transparent"
                            )}
                          >
                            {isSelected && (
                              <div className="size-2.5 rounded-full bg-black animate-in zoom-in" />
                            )}
                          </div>
                        </div>
                        <h3
                          className={cn(
                            "text-xl font-semibold mb-3 transition-colors",
                            isSelected ? "text-white" : "text-white/90"
                          )}
                        >
                          {topic.label}
                        </h3>
                        <p
                          className={cn(
                            "text-sm leading-relaxed transition-colors font-light",
                            isSelected ? "text-white/80" : "text-white/50"
                          )}
                        >
                          {topic.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Error Display */}
              {error && (
                <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-6 backdrop-blur-sm">
                    <div className="flex items-start gap-4">
                      <div className="size-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-red-400 text-sm">⚠️</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="text-lg font-semibold text-red-400">Error Loading Papers</h3>
                        <p className="text-sm text-red-300/90 leading-relaxed">{error}</p>
                        {error.includes("Backend service is not available") && (
                          <div className="mt-4 p-4 rounded-lg bg-black/40 border border-white/10">
                            <p className="text-xs text-white/70 mb-2 font-semibold uppercase tracking-wider">To enable paper search:</p>
                            <code className="text-xs text-white/90 font-mono bg-black/60 px-3 py-2 rounded block">
                              cd backend && uvicorn main:app --reload
                            </code>
                            <p className="text-xs text-white/50 mt-3">
                              Note: The backend is optional. You can still use the Audio Studio without it.
                            </p>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setError(null)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 w-8 p-0"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              {/* Action Buttons */}
              <section className="flex justify-center py-8 sticky bottom-8 z-40 pointer-events-none">
                <div className="flex gap-4 bg-black/60 backdrop-blur-2xl p-2.5 rounded-2xl shadow-apple-floating border border-white/10 pointer-events-auto">
                  <Button
                    size="lg"
                    onClick={handleFetchPapers}
                    disabled={!hasSelectedTopics || loading}
                    className={cn(
                      "min-w-[200px] font-semibold text-base h-14 rounded-xl transition-all duration-300 shadow-none",
                      hasSelectedTopics
                        ? "bg-white text-black hover:bg-gray-200 hover:scale-105 shadow-glow"
                        : "bg-white/10 text-white/40 border border-white/5"
                    )}
                  >
                    {loading ? (
                      <>
                        <span className="size-5 mr-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                        Curating...
                      </>
                    ) : (
                      <>
                        <Search className="size-5 mr-2" />
                        Find Papers
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={handleClearSelection}
                    disabled={!hasSelectedTopics && !hasPapers}
                    className="h-14 px-8 rounded-xl text-white/60 hover:text-white hover:bg-white/10"
                  >
                    Clear
                  </Button>
                </div>
              </section>

              {/* Results Section */}
              {hasPapers && (
                <section className="space-y-10 animate-in fade-in slide-in-from-bottom-12 duration-1000 ease-apple pb-20">
                  <div className="flex items-center justify-between border-b border-white/10 pb-6">
                    <h2 className="text-3xl font-semibold tracking-tight text-white flex items-center gap-4">
                      <BookOpen className="size-8 text-white/80" />
                      Research Papers
                    </h2>
                    <span className="text-sm font-medium text-white/40 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                      {papers.length} results found
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {papers.map((paper) => (
                      <Card
                        key={paper.id}
                        className="group cursor-pointer border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                        onClick={() => handleSelectPaper(paper)}
                      >
                        <CardContent className="p-8 flex flex-col h-full">
                          <div className="flex justify-between items-start gap-6 mb-6">
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 text-xs font-bold tracking-wider uppercase text-white/50">
                                <span className="px-2.5 py-1 rounded-md bg-white/10 text-white">
                                  arXiv
                                </span>
                                <span>{paper.formattedPublishedDate}</span>
                              </div>
                              <h3 className="text-2xl font-bold text-white leading-tight group-hover:text-white/90 transition-colors">
                                {paper.title}
                              </h3>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              className="shrink-0 rounded-full size-12 bg-transparent border-white/10 hover:bg-white hover:text-black hover:border-white transition-all duration-300"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(paper.arxiv_url, "_blank");
                              }}
                            >
                              <FileText className="size-5" />
                            </Button>
                          </div>

                          <p className="text-base text-white/60 line-clamp-3 mb-8 leading-relaxed font-light">
                            {paper.abstract}
                          </p>

                          <div className="flex items-center justify-between pt-8 border-t border-white/5 mt-auto">
                            <div className="flex items-center gap-4">
                              <div className="size-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-sm font-bold text-white border border-white/10">
                                {paper.primaryAuthor.charAt(0)}
                              </div>
                              <div className="text-sm">
                                <p className="font-medium text-white">
                                  {paper.primaryAuthor}
                                </p>
                                {paper.hasAdditionalAuthors && (
                                  <p className="text-xs text-white/40">et al.</p>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-medium text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all duration-300">
                              Select Paper →
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
