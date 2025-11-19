"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Mic,
  Video,
  Upload,
  Archive,
  Headphones,
  Menu,
  X,
  LineChart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isLiveRecording?: boolean;
}

type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  badge: string | null;
};

const navigation: NavigationItem[] = [
  {
    name: "Research Hub",
    href: "/",
    icon: Search,
    description: "Discover research papers",
    badge: null,
  },
  {
    name: "Audio Studio",
    href: "/studio",
    icon: Mic,
    description: "Record conversations",
    badge: "LIVE",
  },
  {
    name: "Video Studio",
    href: "/video-studio",
    icon: Video,
    description: "Create video content",
    badge: null,
  },
  {
    name: "Publisher",
    href: "/publisher",
    icon: Upload,
    description: "Publish episodes",
    badge: null,
  },
  {
    name: "Episode Library",
    href: "/library",
    icon: Archive,
    description: "Manage episodes",
    badge: "12",
  },
  {
    name: "Analytics",
    href: "/analytics",
    icon: LineChart,
    description: "Track performance insights",
    badge: null,
  },
];

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  isLiveRecording = false,
}: SidebarProps) {
  const pathname = usePathname();

  const getBadgeColor = (badge: string) => {
    if (badge === "LIVE") return "bg-destructive text-destructive-foreground";
    if (badge === "12") return "bg-primary text-primary-foreground";
    return "bg-muted-foreground/20 text-muted-foreground";
  };

  return (
    <div
      className={cn(
        "glass-sidebar h-screen sticky top-0 flex flex-col transition-all duration-300 ease-apple z-20",
        collapsed ? "w-20" : "w-72"
      )}
    >
      <div className={cn("p-6 flex-shrink-0", collapsed ? "px-4" : "")}>
        <div className={cn("flex items-center", collapsed ? "flex-col gap-4" : "justify-between")}>
          {!collapsed && (
            <Link href="/" className="group cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-primary rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
                  <Headphones className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-foreground">
                    Podcast Studio
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium">
                    Research Hub
                  </p>
                </div>
              </div>
            </Link>
          )}

          {collapsed && (
            <div className="size-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <Headphones className="size-5 text-primary-foreground" />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="text-muted-foreground hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <Menu className="size-5" /> : <X className="size-5" />}
          </Button>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const badge = item.badge === "LIVE" && !isLiveRecording ? null : item.badge;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={cn(
                "group flex items-center rounded-xl transition-all duration-200 ease-apple relative",
                collapsed ? "justify-center p-3" : "px-4 py-3 gap-3",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-5 transition-colors",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}
              />

              {!collapsed && (
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <span className="text-sm font-medium truncate">
                    {item.name}
                  </span>
                  {badge && (
                    <span className={cn("px-2 py-0.5 text-[10px] rounded-full font-bold", getBadgeColor(badge))}>
                      {badge}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "")}>
          <div className="size-8 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-xs font-medium">SP</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Sergio Peschiera</p>
              <p className="text-xs text-muted-foreground truncate">Pro Plan</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
