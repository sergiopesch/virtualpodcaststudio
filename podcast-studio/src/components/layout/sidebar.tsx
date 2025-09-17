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
    name: "Analytics",
    href: "/analytics",
    icon: LineChart,
    description: "Track performance insights",
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
];

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  isLiveRecording = false,
}: SidebarProps) {
  const pathname = usePathname();

  const getBadgeColor = (badge: string) => {
    if (badge === "LIVE") return "bg-red-500 text-white";
    if (badge === "12") return "bg-blue-500 text-white";
    return "bg-gray-500 text-white";
  };

  return (
    <div
      className={`${collapsed ? "w-16" : "w-72 md:w-64 lg:w-72"} bg-white border-r border-gray-200/60 min-h-screen flex-shrink-0 relative transition-all duration-300 ease-in-out flex flex-col`}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-purple-50/30 via-transparent to-blue-50/20 pointer-events-none" />

      <div className={`${collapsed ? "p-2" : "p-4"} border-b border-gray-200/60 flex-shrink-0 relative z-10`}>
        <div className={`flex items-center ${collapsed ? "flex-col space-y-2" : "justify-between"}`}>
          {!collapsed && (
            <Link href="/" className="group cursor-pointer">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glow group-hover:shadow-glow-lg transition-all duration-300">
                  <Headphones className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 group-hover:text-purple-700 transition-colors">
                    Podcast Studio
                  </h1>
                  <p className="text-xs text-gray-500 group-hover:text-purple-500 transition-colors">
                    AI-Powered Research
                  </p>
                </div>
              </div>
            </Link>
          )}

          {collapsed && (
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glow">
              <Headphones className="w-6 h-6 text-white" />
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <nav className={`flex-1 ${collapsed ? "p-2" : "p-4"} space-y-1 overflow-y-auto relative z-10`}>
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const badge = item.badge === "LIVE" && !isLiveRecording ? null : item.badge;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={`group flex items-center ${collapsed ? "justify-center px-2 py-3" : "space-x-3 px-3 py-2.5"} rounded-lg transition-all duration-200 relative ${
                isActive
                  ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg border border-purple-500/30"
                  : "text-gray-700 hover:bg-gray-50 hover:text-purple-700"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 ${isActive ? "text-white drop-shadow-sm" : "text-gray-500 group-hover:text-purple-600"}`}
                />
                {isActive && <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse" />}
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium block truncate ${isActive ? "drop-shadow-sm" : ""}`}>
                      {item.name}
                    </span>
                    <div className="flex items-center space-x-2">
                      {badge && (
                        <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${getBadgeColor(badge)}`}>
                          {badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs block truncate ${
                      isActive ? "text-white/90" : "text-gray-500 group-hover:text-purple-500"
                    }`}
                  >
                    {item.description}
                  </span>
                </div>
              )}

              {isActive && !collapsed && (
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
