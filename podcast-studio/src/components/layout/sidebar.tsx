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
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserSettingsDialog } from "@/components/settings/user-settings-dialog";
import { useEffect, useRef, useState } from "react";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const AUTO_HIDE_DELAY = 1200;

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const triggerAutoCollapse = () => {
    if (collapsed) {
      return;
    }
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setAutoCollapsed(true);
      setIsInteracting(false);
    }, AUTO_HIDE_DELAY);
  };

  const handlePointerEnter = () => {
    clearHideTimer();
    setIsInteracting(true);
    setAutoCollapsed(false);
  };

  const handlePointerLeave = () => {
    triggerAutoCollapse();
  };

  useEffect(() => {
    if (!collapsed) {
      triggerAutoCollapse();
    } else {
      clearHideTimer();
      setAutoCollapsed(false);
    }
    return () => clearHideTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  const isCondensed = collapsed || autoCollapsed;

  const getBadgeColor = (badge: string) => {
    if (badge === "LIVE") return "bg-white text-black shadow-glow animate-pulse"; // High contrast monochrome pulse
    if (badge === "12") return "bg-white/20 text-white backdrop-blur-md";
    return "bg-white/10 text-muted-foreground";
  };

  return (
    <div
      className={cn(
        "glass-sidebar h-screen sticky top-0 flex flex-col transition-all duration-500 ease-apple z-50 border-r border-white/5",
        isCondensed ? "w-20 lg:w-24" : "w-72",
        isInteracting ? "shadow-2xl shadow-black/40" : ""
      )}
      onMouseEnter={handlePointerEnter}
      onFocus={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
      onBlur={handlePointerLeave}
    >
      <div className={cn("p-6 flex-shrink-0", isCondensed ? "px-4" : "")}>
        <div className={cn("flex items-center", isCondensed ? "flex-col gap-4" : "justify-between")}>
          {!isCondensed && (
            <Link href="/" className="group cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-white rounded-xl flex items-center justify-center shadow-glass-sm group-hover:scale-105 transition-transform duration-300">
                  <Headphones className="size-5 text-black" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-white leading-tight">
                    Podcast Studio
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium">
                    Pro
                  </p>
                </div>
              </div>
            </Link>
          )}

          {isCondensed && (
            <div className="size-10 bg-white rounded-xl flex items-center justify-center shadow-glass-sm">
              <Headphones className="size-5 text-black" />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="text-muted-foreground hover:text-white hover:bg-white/10 rounded-full size-8"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <Menu className="size-4" /> : <X className="size-4" />}
          </Button>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2 no-scrollbar">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const badge = item.badge === "LIVE" && !isLiveRecording ? null : item.badge;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCondensed ? item.name : undefined}
              className={cn(
                "group flex items-center rounded-xl transition-all duration-300 ease-apple relative border border-transparent",
                isCondensed ? "justify-center p-3 aspect-square" : "px-4 py-3.5 gap-3",
                isActive
                  ? "bg-white/15 text-white shadow-glass-sm border-white/10 backdrop-blur-md"
                  : "text-muted-foreground hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "size-5 transition-all duration-300",
                  isActive ? "text-white scale-110" : "text-muted-foreground group-hover:text-white"
                )}
              />

              {!isCondensed && (
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <span className={cn("text-sm font-medium truncate", isActive ? "text-white" : "")}>
                    {item.name}
                  </span>
                  {badge && (
                    <span className={cn("px-2 py-0.5 text-[10px] rounded-full font-bold tracking-wide", getBadgeColor(badge))}>
                      {badge}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5">
        <UserSettingsDialog 
          open={settingsOpen} 
          onOpenChange={setSettingsOpen}
          trigger={
            <button className={cn(
              "w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all duration-300 group outline-none focus-visible:ring-2 focus-visible:ring-white/20", 
              isCondensed ? "justify-center" : ""
            )}>
              <div className="relative">
                <div className="size-10 rounded-full bg-gradient-to-br from-gray-700 to-black border border-white/10 flex items-center justify-center shadow-inner group-hover:shadow-glow transition-all duration-500">
                  <span className="text-xs font-bold text-white">SP</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 bg-white text-black rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-75">
                  <Settings className="size-3" />
                </div>
              </div>
              {!isCondensed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate text-white group-hover:text-white transition-colors">Sergio Peschiera</p>
                  <p className="text-xs text-muted-foreground truncate group-hover:text-white/60 transition-colors">Pro Plan</p>
                </div>
              )}
            </button>
          }
        />
      </div>
    </div>
  );
}
