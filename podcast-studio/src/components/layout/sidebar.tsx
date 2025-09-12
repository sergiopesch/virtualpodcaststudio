"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Search, 
  Mic, 
  Video, 
  Upload, 
  Archive, 
  Headphones,
  Settings,
  User,
  Bell,
  HelpCircle,
  ChevronDown,
  Zap,
  TrendingUp,
  Clock,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  children?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const navigation = [
  {
    name: "Research Hub",
    href: "/",
    icon: Search,
    description: "Discover research papers",
    badge: null,
    shortcut: "⌘R"
  },
  {
    name: "Audio Studio", 
    href: "/studio",
    icon: Mic,
    description: "Record conversations",
    badge: "LIVE",
    shortcut: "⌘A"
  },
  {
    name: "Video Studio",
    href: "/video-studio", 
    icon: Video,
    description: "Create video content",
    badge: null,
    shortcut: "⌘V"
  },
  {
    name: "Publisher",
    href: "/publisher",
    icon: Upload,
    description: "Publish episodes",
    badge: null,
    shortcut: "⌘P"
  },
  {
    name: "Episode Library",
    href: "/library",
    icon: Archive,
    description: "Manage episodes",
    badge: "12",
    shortcut: "⌘L"
  }
];

const quickActions = [
  { name: "New Episode", icon: Zap, action: () => console.log("New Episode") },
  { name: "Analytics", icon: TrendingUp, action: () => console.log("Analytics") },
  { name: "Recent", icon: Clock, action: () => console.log("Recent") }
];

export function Sidebar({ children, collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const getBadgeColor = (badge: string | null) => {
    if (!badge) return "";
    if (badge === "LIVE") return "bg-red-500 text-white";
    if (badge === "12") return "bg-blue-500 text-white";
    return "bg-gray-500 text-white";
  };

  return (
    <div className={`${collapsed ? 'w-16' : 'w-72'} bg-white border-r border-gray-200/60 min-h-screen flex-shrink-0 relative transition-all duration-300 ease-in-out`}>
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-50/30 via-transparent to-blue-50/20 pointer-events-none" />
      
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200/60">
          <div className="flex items-center justify-between">
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
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glow mx-auto">
                <Headphones className="w-6 h-6 text-white" />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
            >
              {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        {/* Quick Actions */}
        {!collapsed && (
          <div className="p-4 border-b border-gray-200/60">
            <div className="flex space-x-2">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    onClick={action.action}
                    className="flex-1 text-xs hover:bg-purple-50 hover:text-purple-700 transition-colors"
                  >
                    <Icon className="w-3 h-3 mr-1" />
                    {action.name}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative ${
                  isActive
                    ? 'bg-gradient-primary text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-purple-700'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-purple-600'}`} />
                  {isActive && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse" />
                  )}
                </div>
                
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium block truncate">
                        {item.name}
                      </span>
                      <div className="flex items-center space-x-2">
                        {item.badge && (
                          <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${getBadgeColor(item.badge)}`}>
                            {item.badge}
                          </span>
                        )}
                        {item.shortcut && (
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${
                            isActive 
                              ? 'text-white/80 border-white/30' 
                              : 'text-gray-400 border-gray-300'
                          }`}>
                            {item.shortcut}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs block truncate ${
                      isActive ? 'text-white/80' : 'text-gray-500 group-hover:text-purple-500'
                    }`}>
                      {item.description}
                    </span>
                  </div>
                )}
                
                {/* Active indicator */}
                {isActive && !collapsed && (
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                )}
              </Link>
            );
          })}
        </nav>
        
        {/* User Profile & Settings */}
        <div className="p-4 border-t border-gray-200/60 space-y-2">
          {/* User Profile */}
          <div className="relative">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-700 hover:bg-gray-50 hover:text-purple-700 p-2"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center mr-3">
                <User className="w-4 h-4 text-white" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">John Doe</div>
                    <div className="text-xs text-gray-500">Creator</div>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </>
              )}
            </Button>
            
            {/* User Menu Dropdown */}
            {showUserMenu && !collapsed && (
              <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 space-y-1">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Help
                </Button>
              </div>
            )}
          </div>
          
          {/* Notifications & Settings */}
          {!collapsed && (
            <div className="flex space-x-1">
              <Button variant="ghost" size="sm" className="flex-1 text-gray-600 hover:text-purple-700 hover:bg-purple-50">
                <Bell className="w-4 h-4 mr-2" />
                <span className="text-xs">Notifications</span>
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 text-gray-600 hover:text-purple-700 hover:bg-purple-50">
                <Settings className="w-4 h-4 mr-2" />
                <span className="text-xs">Settings</span>
              </Button>
            </div>
          )}
          
          {collapsed && (
            <div className="flex flex-col space-y-1">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-purple-700 hover:bg-purple-50">
                <Bell className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-purple-700 hover:bg-purple-50">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        
        {children}
      </div>
    </div>
  );
}