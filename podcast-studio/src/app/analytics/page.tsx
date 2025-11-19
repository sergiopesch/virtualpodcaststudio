"use client";

import { useMemo } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebar } from "@/contexts/sidebar-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  Clock,
  Mic,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { defaultSeasons, type Episode, type Season } from "@/data/library";

type OverviewCard = {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
};

type EpisodeHighlight = {
  id: string;
  title: string;
  views: number;
  seasonTitle: string;
};

const overviewCards: OverviewCard[] = [
  {
    label: "Papers Analyzed",
    value: "1,247",
    change: "+12% vs last week",
    icon: BookOpen,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-900",
  },
  {
    label: "Episodes Created",
    value: "89",
    change: "+6 new this month",
    icon: Mic,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-900",
  },
  {
    label: "Audience Reach",
    value: "45.2K",
    change: "+3.1% vs last season",
    icon: Users,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-900",
  },
  {
    label: "Research Hours Saved",
    value: "156",
    change: "Automations saved 42 hrs",
    icon: Clock,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-900",
  },
];

const engagementTimeline = [
  { week: "Week 1", audience: "10.2K", change: "+4.3%" },
  { week: "Week 2", audience: "11.8K", change: "+6.1%" },
  { week: "Week 3", audience: "12.5K", change: "+3.4%" },
  { week: "Week 4", audience: "13.7K", change: "+5.6%" },
];

export default function AnalyticsPage() {
  const { collapsed, toggleCollapsed } = useSidebar();
  const seasons: Season[] = defaultSeasons;

  const {
    totalEpisodes,
    publishedEpisodes,
    totalViews,
    averageViews,
    topEpisodes,
  } = useMemo(() => {
    let published = 0;
    let processing = 0;
    let draft = 0;
    let publishedViews = 0;
    const episodesWithSeason: (Episode & { seasonTitle: string })[] = [];

    seasons.forEach((season) => {
      season.episodes.forEach((episode) => {
        episodesWithSeason.push({ ...episode, seasonTitle: season.title });

        if (episode.status === "published") {
          published += 1;
          publishedViews += episode.views;
        } else if (episode.status === "processing") {
          processing += 1;
        } else if (episode.status === "draft") {
          draft += 1;
        }
      });
    });

    const totalEpisodeCount = episodesWithSeason.length;

    const highlights: EpisodeHighlight[] = episodesWithSeason
      .filter((episode) => episode.status === "published" && episode.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)
      .map((episode) => ({
        id: episode.id,
        title: episode.title,
        views: episode.views,
        seasonTitle: episode.seasonTitle,
      }));

    const avgViews = published > 0 ? Math.round(publishedViews / published) : 0;

    return {
      totalEpisodes: totalEpisodeCount,
      publishedEpisodes: published,
      processingEpisodes: processing,
      draftEpisodes: draft,
      totalViews: publishedViews,
      averageViews: avgViews,
      topEpisodes: highlights,
    };
  }, [seasons]);

  const activeSeasons = useMemo(() => {
    return seasons.map((season) => {
      const publishedCount = season.episodes.filter((episode) => episode.status === "published").length;
      const completion = season.episodeCount > 0 ? Math.round((publishedCount / season.episodeCount) * 100) : 0;

      return {
        id: season.id,
        title: season.title,
        description: season.description,
        completion,
        status: season.status,
        startDate: season.startDate,
      };
    });
  }, [seasons]);

  const audienceData = engagementTimeline;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
        <div className="flex flex-1 flex-col min-w-0">
          <Header
            title="Analytics"
            description="Track performance and audience engagement"
          />
          <main id="main-content" tabIndex={-1} className="space-y-6 p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1">
            <div className="max-w-7xl mx-auto space-y-8">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {overviewCards.map((card) => (
                  <Card key={card.label} className="glass-panel border-border/50 shadow-apple-card">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-lg bg-secondary">
                          <card.icon className="size-5 text-foreground" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-full border border-border/50">
                          {card.change}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                      <h3 className="text-2xl font-bold text-foreground mt-1">{card.value}</h3>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Audience Insights */}
                <Card className="xl:col-span-2 glass-panel border-border/50 shadow-apple-card">
                  <CardHeader className="border-b border-border/50 bg-background/50 pb-4">
                    <CardTitle className="flex items-center gap-2 text-foreground text-lg font-semibold">
                      <Users className="size-5 text-foreground" />
                      Audience Insights
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Engagement signals from published content</p>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="rounded-lg border border-border/50 p-4 bg-secondary/20">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Views</p>
                        <p className="text-2xl font-bold text-foreground mt-2">{totalViews.toLocaleString()}</p>
                        <p className="text-xs text-accent mt-1 font-medium">+18.4% this quarter</p>
                      </div>
                      <div className="rounded-lg border border-border/50 p-4 bg-secondary/20">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Avg Views / EP</p>
                        <p className="text-2xl font-bold text-foreground mt-2">{averageViews.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Top 10% of category</p>
                      </div>
                      <div className="rounded-lg border border-border/50 p-4 bg-secondary/20">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Engagement</p>
                        <p className="text-2xl font-bold text-foreground mt-2">72%</p>
                        <p className="text-xs text-accent mt-1 font-medium">+5.2% vs last month</p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">Growth Over Time</h4>
                      <div className="space-y-2">
                        {audienceData.map((week) => (
                          <div key={week.week} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{week.week}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Weekly audience</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-foreground">{week.audience}</span>
                              <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-1 rounded-md">
                                {week.change}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Episodes */}
                <Card className="glass-panel border-border/50 shadow-apple-card">
                  <CardHeader className="border-b border-border/50 bg-background/50 pb-4">
                    <CardTitle className="flex items-center gap-2 text-foreground text-base font-semibold">
                      <Sparkles className="size-4 text-foreground" />
                      Top Episodes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                      <div className="p-4 space-y-2">
                        {topEpisodes.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            No published episodes yet
                          </div>
                        ) : (
                          topEpisodes.map((episode, index) => (
                            <div
                              key={episode.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors"
                            >
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {episode.title}
                                </p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {episode.seasonTitle}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-foreground">
                                  {episode.views.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">views</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Active Seasons */}
              <Card className="glass-panel border-border/50 shadow-apple-card">
                <CardHeader className="border-b border-border/50 bg-background/50 pb-4">
                  <CardTitle className="flex items-center gap-2 text-foreground text-lg font-semibold">
                    <BookOpen className="size-5 text-foreground" />
                    Active Seasons
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Production progress and scheduling</p>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {activeSeasons.map((season) => (
                      <div
                        key={season.id}
                        className="rounded-lg border border-border/50 p-4 bg-background hover:bg-secondary/20 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-foreground truncate">
                              {season.title}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {season.description}
                            </p>
                          </div>
                          <span className={`ml-2 shrink-0 px-2 py-1 rounded-md text-xs font-medium ${season.status === "active"
                              ? "bg-accent/10 text-accent"
                              : season.status === "completed"
                                ? "bg-secondary text-muted-foreground"
                                : "bg-secondary/50 text-muted-foreground"
                            }`}>
                            {season.status.charAt(0).toUpperCase() + season.status.slice(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Clock className="size-3" />
                          <span>Started {season.startDate}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-muted-foreground">Progress</span>
                            <span className="font-bold text-foreground">{season.completion}%</span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${season.completion}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Production Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="glass-panel border-border/50 shadow-apple-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-foreground text-base font-semibold">
                      <Clock className="size-4 text-foreground" />
                      Production Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Avg per episode</span>
                      <span className="text-sm font-bold text-foreground">2.4 hrs</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Fastest episode</span>
                      <span className="text-sm font-bold text-foreground">1.1 hrs</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Total time</span>
                      <span className="text-sm font-bold text-foreground">156 hrs</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-panel border-border/50 shadow-apple-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-foreground text-base font-semibold">
                      <Mic className="size-4 text-foreground" />
                      Content Quality
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Avg quality score</span>
                      <span className="text-sm font-bold text-foreground">94%</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Re-recording rate</span>
                      <span className="text-sm font-bold text-foreground">8%</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Success rate</span>
                      <span className="text-sm font-bold text-accent">92%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-panel border-border/50 shadow-apple-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-foreground text-base font-semibold">
                      <Sparkles className="size-4 text-foreground" />
                      AI Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Papers processed</span>
                      <span className="text-sm font-bold text-foreground">1,247</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Avg tokens/ep</span>
                      <span className="text-sm font-bold text-foreground">42.3K</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Model efficiency</span>
                      <span className="text-sm font-bold text-accent">96%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

