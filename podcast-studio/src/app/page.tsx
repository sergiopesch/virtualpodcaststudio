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
  Clock,
  Users,
  Plus,
  MoreVertical,
  Filter
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
      const query = selectedTopics.join("+OR+");
      const response = await fetch(`/api/papers?query=${query}&max_results=10`);
      if (!response.ok) {
        throw new Error("Failed to fetch papers");
      }

      const data = (await response.json()) as PaperApiResponse;

      if (data.error) {
        throw new Error(data.error);
      }

      const transformed = transformPapers(data.papers);
      setPapers(transformed);
      sessionStorage.setItem("vps:papers", JSON.stringify(transformed));
    } catch (err) {
      console.error(err);
      setError("Failed to load papers. Please try again.");
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
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            title="Research Hub"
            description="Discover and curate research papers for your podcast."
          />
          <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-10">
              {/* Hero Section */}
              <div className="relative overflow-hidden rounded-3xl bg-black text-white p-10 shadow-apple-floating">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black opacity-50" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                  <div className="max-w-2xl">
                    <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-white">
                      Research Hub
                    </h1>
                    <p className="text-gray-300 text-lg leading-relaxed">
                      Select topics to discover the latest research papers for your next episode.
                      Our AI curates the most relevant content for your audience.
                    </p>
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
              </div>

              {/* Topic Selection */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                    <BookOpen className="size-6" />
                    Select Topics
                  </h2>
                  {hasSelectedTopics && (
                    <span className="text-sm font-medium text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                      {selectedTopics.length} selected
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
                          "group relative flex flex-col items-start p-6 rounded-2xl transition-all duration-300 ease-apple text-left w-full border",
                          isSelected
                            ? "bg-black border-black shadow-apple-card transform scale-[1.02]"
                            : "bg-card border-border/50 hover:border-border hover:shadow-subtle hover:bg-secondary/50"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-4">
                          <div
                            className={cn(
                              "p-3 rounded-xl transition-colors duration-300",
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-secondary text-foreground group-hover:bg-white"
                            )}
                          >
                            <topic.icon className="size-6" />
                          </div>
                          <div
                            className={cn(
                              "size-6 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                              isSelected
                                ? "border-white bg-white"
                                : "border-border bg-transparent group-hover:border-foreground/20"
                            )}
                          >
                            {isSelected && (
                              <div className="size-2.5 rounded-full bg-black" />
                            )}
                          </div>
                        </div>
                        <h3
                          className={cn(
                            "text-lg font-semibold mb-2 transition-colors",
                            isSelected ? "text-white" : "text-foreground"
                          )}
                        >
                          {topic.label}
                        </h3>
                        <p
                          className={cn(
                            "text-sm leading-relaxed transition-colors",
                            isSelected ? "text-gray-400" : "text-muted-foreground"
                          )}
                        >
                          {topic.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Action Buttons */}
              <section className="flex justify-center pb-4">
                <div className="flex gap-4 bg-white/80 backdrop-blur-xl p-2 rounded-2xl shadow-apple-card border border-white/20">
                  <Button
                    size="lg"
                    onClick={handleFetchPapers}
                    disabled={!hasSelectedTopics || loading}
                    className={cn(
                      "min-w-[180px] font-semibold text-base h-12 rounded-xl transition-all duration-300 shadow-none",
                      hasSelectedTopics
                        ? "bg-black text-white hover:bg-gray-800 hover:scale-105"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {loading ? (
                      <>
                        <span className="size-5 mr-2 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                        Searching...
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
                    className="h-12 px-6 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary"
                  >
                    Clear
                  </Button>
                </div>
              </section>

              {/* Results Section */}
              {hasPapers && (
                <section className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-apple">
                  <div className="flex items-center justify-between border-b border-border/50 pb-4">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                      <FileText className="size-6" />
                      Research Papers
                    </h2>
                    <span className="text-sm font-medium text-muted-foreground">
                      {papers.length} results found
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {papers.map((paper) => (
                      <Card
                        key={paper.id}
                        className="group overflow-hidden border-border/50 hover:border-border hover:shadow-apple-card transition-all duration-300 ease-apple bg-card/50 backdrop-blur-sm"
                      >
                        <CardContent className="p-8">
                          <div className="flex justify-between items-start gap-6 mb-6">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground mb-3">
                                <span className="px-2.5 py-1 rounded-md bg-secondary text-foreground">
                                  arXiv
                                </span>
                                <span>{paper.formattedPublishedDate}</span>
                              </div>
                              <h3 className="text-xl font-bold text-foreground leading-tight group-hover:text-accent transition-colors">
                                {paper.title}
                              </h3>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              className="shrink-0 rounded-full size-10 bg-transparent border-border/50 hover:bg-secondary hover:border-border"
                              onClick={() => window.open(paper.arxiv_url, "_blank")}
                            >
                              <FileText className="size-5" />
                            </Button>
                          </div>

                          <p className="text-base text-muted-foreground line-clamp-3 mb-8 leading-relaxed">
                            {paper.abstract}
                          </p>

                          <div className="flex items-center justify-between pt-6 border-t border-border/50">
                            <div className="flex items-center gap-3">
                              <div className="size-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground">
                                {paper.primaryAuthor.charAt(0)}
                              </div>
                              <div className="text-sm">
                                <p className="font-semibold text-foreground">
                                  {paper.primaryAuthor}
                                </p>
                                {paper.hasAdditionalAuthors && (
                                  <p className="text-muted-foreground text-xs">et al.</p>
                                )}
                              </div>
                            </div>

                            <Button
                              onClick={() => handleSelectPaper(paper)}
                              className="bg-black text-white hover:bg-gray-800 rounded-full px-6 shadow-sm group-hover:shadow-md transition-all duration-300"
                            >
                              <Sparkles className="size-4 mr-2" />
                              Create Episode
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* Empty State / Instructions */}
              {!hasPapers && !loading && (
                <div className="text-center py-20">
                  <div className="inline-flex items-center justify-center size-20 rounded-full bg-secondary mb-6 shadow-subtle">
                    <Search className="size-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    Start your research
                  </h3>
                  <p className="text-muted-foreground max-w-md mx-auto text-lg">
                    Select one or more topics above and click "Find Papers" to discover content for your podcast.
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
