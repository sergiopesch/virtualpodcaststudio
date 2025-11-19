"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebar } from "@/contexts/sidebar-context";
import {
  BookOpen,
  Play,
  FileText,
  Clock,
  Edit,
  Calendar,
  Users,
  Star,
  Filter,
  Plus,
  MoreVertical
} from "lucide-react";
import { defaultSeasons, type Season } from "@/data/library";

export default function Library() {
  const { collapsed, toggleCollapsed } = useSidebar();
  const [selectedSeason, setSelectedSeason] = useState<string>("1");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [tab, setTab] = useState<"episodes" | "shows">("episodes");
  const [activeTab, setActiveTab] = useState<"episodes" | "shows">("episodes");

  const [seasons] = useState<Season[]>(defaultSeasons);

  const currentSeason = seasons.find((s) => s.id === selectedSeason);

  const shows = useMemo(() => {
    return seasons.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      episodeCount: s.episodeCount,
      status: s.status,
    }));
  }, [seasons]);

  const tabs = [
    { id: 'episodes', label: 'Episodes', icon: Play },
    { id: 'shows', label: 'Shows', icon: BookOpen },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
        <div className="flex flex-1 flex-col min-w-0">
          <Header
            title="Your Library"
            description="Manage your generated episodes, research papers, and assets"
          />
          <main id="main-content" tabIndex={-1} className="space-y-6 p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1">
            <div className="max-w-7xl mx-auto space-y-8">
              {/* Header Section */}
              <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 text-foreground p-8 lg:p-10 shadow-apple-card glass-panel">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                      Your Library
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-xl">
                      Manage your generated episodes, research papers, and assets.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="border-border/50 shadow-sm">
                      <Filter className="size-4 mr-2" />
                      Filter
                    </Button>
                    <Button className="shadow-md font-semibold">
                      <Plus className="size-4 mr-2" />
                      New Project
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border/50">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`
                      flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all
                      ${activeTab === t.id
                        ? 'border-accent text-accent'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                      }
                    `}
                  >
                    <t.icon className={`size-4 ${activeTab === t.id ? 'text-accent' : 'text-muted-foreground'}`} />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Example Cards */}
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="group glass-panel rounded-2xl border border-border/50 shadow-apple-card hover:shadow-apple-floating transition-all duration-300 overflow-hidden cursor-pointer hover:border-primary/40"
                  >
                    <div className="aspect-video bg-secondary/30 relative overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        {activeTab === 'episodes' ? (
                          <div className="size-12 bg-background rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all">
                            <Play className="size-5 ml-0.5" />
                          </div>
                        ) : (
                          <div className="size-12 bg-secondary rounded-lg flex items-center justify-center">
                            <BookOpen className="size-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm text-foreground text-xs px-2 py-1 rounded-md border border-border/50">
                        {activeTab === 'episodes' ? '24:12' : 'PDF'}
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {activeTab === 'episodes' ? 'Episode' : 'Research'}
                        </span>
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <MoreVertical className="size-4" />
                        </button>
                      </div>

                      <h3 className="font-bold text-foreground mb-2 line-clamp-1 group-hover:text-accent transition-colors">
                        {activeTab === 'episodes'
                          ? "The Future of Generative AI in 2025"
                          : "Attention Is All You Need (Vaswani et al.)"}
                      </h3>

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        An in-depth exploration of how transformer models are revolutionizing the landscape of artificial intelligence...
                      </p>

                      <div className="flex items-center justify-between pt-4 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="size-3" />
                          <span>2 days ago</span>
                        </div>
                        <div className="flex -space-x-2">
                          {[1, 2].map((u) => (
                            <div key={u} className="size-6 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                              {u === 1 ? 'AI' : 'U'}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
