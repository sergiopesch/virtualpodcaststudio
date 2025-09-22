"use client";

import { useMemo } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebar } from "@/contexts/sidebar-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Brain,
  Clock,
  LineChart,
  Mic,
  Sparkles,
  TrendingUp,
  Users,
  BarChart3,
  ArrowUpRight,
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

type TopicMomentum = {
  topic: string;
  sentiment: string;
  progress: number;
  delta: string;
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
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  {
    label: "Episodes Created",
    value: "89",
    change: "+6 new this month",
    icon: Mic,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    label: "Audience Reach",
    value: "45.2K",
    change: "+3.1% vs last season",
    icon: Users,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  {
    label: "Research Hours Saved",
    value: "156",
    change: "Automations saved 42 hrs",
    icon: Clock,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
];

const topicMomentum: TopicMomentum[] = [
  {
    topic: "Artificial Intelligence",
    sentiment: "High engagement",
    progress: 86,
    delta: "+8.2%",
  },
  {
    topic: "Machine Learning",
    sentiment: "Consistent growth",
    progress: 78,
    delta: "+5.4%",
  },
  {
    topic: "Computer Vision",
    sentiment: "Emerging interest",
    progress: 64,
    delta: "+3.7%",
  },
  {
    topic: "Robotics",
    sentiment: "Steady research",
    progress: 58,
    delta: "+2.1%",
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
    processingEpisodes,
    draftEpisodes,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
      <div className="flex">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />

        <div className="flex-1">
          <Header
            title="Analytics"
            description="Real-time performance insights across research and production"
            status={{ label: "Updated 2m ago", color: "green", active: true }}
            actions={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-gray-600">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate report
                </Button>
                <Button variant="gradient" size="sm">
                  <LineChart className="w-4 h-4 mr-2" />
                  View trends
                </Button>
              </div>
            }
          />

          <main id="main-content" tabIndex={-1} className="p-6 space-y-6">
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {overviewCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Card key={card.label} className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-purple-50/40" />
                    <CardContent className="p-6 relative">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">{card.label}</p>
                          <p className="text-3xl font-semibold text-gray-900 mt-2">{card.value}</p>
                          <p className="text-xs text-emerald-600 mt-2">{card.change}</p>
                        </div>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${card.iconBg}`}>
                          <Icon className={`w-6 h-6 ${card.iconColor}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card className="xl:col-span-2">
                <CardHeader className="border-b border-gray-200">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    Topic momentum
                  </CardTitle>
                  <p className="text-sm text-gray-600">Tracking interest growth across your core research themes</p>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  {topicMomentum.map((topic) => (
                    <div key={topic.topic} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{topic.topic}</p>
                          <p className="text-xs text-gray-500">{topic.sentiment}</p>
                        </div>
                        <span className="text-xs font-medium text-emerald-600">{topic.delta}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                          style={{ width: `${topic.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-gray-200">
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-600" />
                    Research efficiency
                  </CardTitle>
                  <p className="text-sm text-gray-600">Workflow improvements driven by automation</p>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Active topics</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-1">24</p>
                    <p className="text-xs text-emerald-600 mt-1">+5 topics activated this quarter</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Average research time</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-1">38 min</p>
                    <p className="text-xs text-gray-500 mt-1">↓ 14 minutes compared to manual review</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4 bg-gradient-to-br from-indigo-50 to-purple-50">
                    <p className="text-xs uppercase tracking-wide text-purple-600">Automation impact</p>
                    <p className="text-2xl font-semibold text-purple-700 mt-1">62%</p>
                    <p className="text-xs text-purple-600 mt-1">Of episodes created directly from AI-assisted research</p>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="border-b border-gray-200">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-600" />
                    Production pipeline
                  </CardTitle>
                  <p className="text-sm text-gray-600">Snapshot of episode progress across the studio</p>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Published episodes</span>
                    <span className="font-semibold text-gray-900">{publishedEpisodes}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>In production</span>
                    <span className="font-semibold text-gray-900">{processingEpisodes}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Draft scripts</span>
                    <span className="font-semibold text-gray-900">{draftEpisodes}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Total catalog</span>
                    <span className="font-semibold text-gray-900">{totalEpisodes}</span>
                  </div>
                  <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white p-4 mt-4">
                    <p className="text-xs uppercase tracking-wide text-white/80">Conversion rate</p>
                    <p className="text-2xl font-semibold mt-1">
                      {totalEpisodes > 0 ? Math.round((publishedEpisodes / totalEpisodes) * 100) : 0}%
                    </p>
                    <p className="text-xs text-white/80 mt-1">of researched topics become published episodes</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader className="border-b border-gray-200">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Audience insights
                  </CardTitle>
                  <p className="text-sm text-gray-600">Engagement signals aggregated from published content</p>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-gray-200 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Total views</p>
                      <p className="text-2xl font-semibold text-gray-900 mt-1">{totalViews.toLocaleString()}</p>
                      <p className="text-xs text-emerald-600 mt-1">+18.4% audience lift this quarter</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Avg views per episode</p>
                      <p className="text-2xl font-semibold text-gray-900 mt-1">{averageViews.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">Benchmark: 9.4K per AI-focused episode</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Top performing series</p>
                      <p className="text-2xl font-semibold text-gray-900 mt-1">Season 1</p>
                      <p className="text-xs text-gray-500 mt-1">Transformer deep dives keep outperforming</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Weekly engagement</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {engagementTimeline.map((entry) => (
                        <div key={entry.week} className="rounded-lg border border-gray-200 p-4">
                          <p className="text-xs uppercase tracking-wide text-gray-500">{entry.week}</p>
                          <p className="text-lg font-semibold text-gray-900 mt-1">{entry.audience}</p>
                          <p className="text-xs text-emerald-600 mt-1">{entry.change}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Top performing episodes</h3>
                    <div className="space-y-3">
                      {topEpisodes.map((episode) => (
                        <div key={episode.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{episode.title}</p>
                            <p className="text-xs text-gray-500">{episode.seasonTitle}</p>
                          </div>
                          <div className="flex items-center text-sm font-semibold text-gray-900">
                            {episode.views.toLocaleString()} views
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="border-b border-gray-200">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    Season health
                  </CardTitle>
                  <p className="text-sm text-gray-600">Track completion velocity across your production roadmap</p>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {activeSeasons.map((season) => (
                    <div key={season.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{season.title}</p>
                          <p className="text-xs text-gray-500">{season.description}</p>
                        </div>
                        <span className={`text-xs font-medium ${season.status === "active" ? "text-emerald-600" : "text-gray-500"}`}>
                          {season.status}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-3">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                          style={{ width: `${season.completion}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {season.completion}% of planned episodes published · Launched {new Date(season.startDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-gray-200">
                  <CardTitle className="flex items-center gap-2">
                    <ArrowUpRight className="w-5 h-5 text-rose-500" />
                    Next best actions
                  </CardTitle>
                  <p className="text-sm text-gray-600">AI-powered recommendations to sustain growth</p>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">Double down on transformer content</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Transformer-focused episodes drive 32% more engagement than the catalog average.
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">Launch interactive research recaps</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Add short recap videos to boost completion rates on long-form discussions.
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">Schedule robotics spotlight</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Robotics interest is climbing; line up a dedicated mini-series next month.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
