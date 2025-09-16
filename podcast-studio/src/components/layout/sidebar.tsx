"use client";

import React, { useCallback, useEffect, useState } from "react";
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
  ChevronDown,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useApiConfig, type LlmProvider } from "@/contexts/api-config-context";

interface SidebarProps {
  children?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isLiveRecording?: boolean;
}

const navigation = [
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
];

type UserMenuKey = "profile" | "settings";

interface UserMenuItem {
  key: UserMenuKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface LlmSettingsState {
  activeProvider: LlmProvider;
  openaiKey: string;
  googleKey: string;
}

const userMenuItems: UserMenuItem[] = [
  {
    key: "profile",
    label: "Profile",
    description: "Personalize how you appear on every recording.",
    icon: User,
  },
  {
    key: "settings",
    label: "Workspace Settings",
    description: "Tune the studio theme, tools, and AI providers.",
    icon: Settings,
  },
];

const baseFieldClass =
  "w-full rounded-lg border border-gray-300 bg-white/90 px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200";

export function Sidebar({
  children,
  collapsed = false,
  onToggleCollapse,
  isLiveRecording = false,
}: SidebarProps) {
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isUserConfigOpen, setIsUserConfigOpen] = useState(false);
  const [activeUserMenu, setActiveUserMenu] = useState<UserMenuItem | null>(null);
  const [profileSettings, setProfileSettings] = useState({
    fullName: "John Doe",
    role: "Creator",
    location: "San Francisco, CA",
    email: "john.doe@example.com",
    bio: "Hosts AI-powered conversations and curates research-backed stories.",
  });
  const [workspacePreferences, setWorkspacePreferences] = useState({
    theme: "system" as "system" | "light" | "dark",
    autoSaveDrafts: true,
    enableTimelineSnapping: true,
    showAdvancedAnalytics: false,
  });
  const {
    activeProvider: storedProvider,
    apiKeys,
    setActiveProvider: persistActiveProvider,
    setApiKey: persistApiKey,
  } = useApiConfig();
  const [llmSettings, setLlmSettings] = useState<LlmSettingsState>({
    activeProvider: storedProvider,
    openaiKey: apiKeys.openai ?? "",
    googleKey: apiKeys.google ?? "",
  });

  useEffect(() => {
    if (!isUserConfigOpen || activeUserMenu?.key !== "settings") {
      return;
    }

    setLlmSettings({
      activeProvider: storedProvider,
      openaiKey: apiKeys.openai ?? "",
      googleKey: apiKeys.google ?? "",
    });
  }, [
    isUserConfigOpen,
    activeUserMenu,
    storedProvider,
    apiKeys.openai,
    apiKeys.google,
  ]);

  const handleUserMenuItemSelect = useCallback((item: UserMenuItem) => {
    setActiveUserMenu(item);
    setShowUserMenu(false);
    setIsUserConfigOpen(true);
  }, []);

  const handleUserConfigSheetChange = useCallback((open: boolean) => {
    setIsUserConfigOpen(open);
    if (!open) {
      setActiveUserMenu(null);
    }
  }, []);

  const handleUserConfigSave = useCallback(() => {
    if (!activeUserMenu) {
      return;
    }

    switch (activeUserMenu.key) {
      case "profile":
        console.info("Profile settings saved", profileSettings);
        break;
      case "settings": {
        const trimmedOpenAiKey = llmSettings.openaiKey.trim();
        const trimmedGoogleKey = llmSettings.googleKey.trim();

        persistActiveProvider(llmSettings.activeProvider);
        persistApiKey("openai", trimmedOpenAiKey);
        persistApiKey("google", trimmedGoogleKey);

        setLlmSettings((previous) => ({
          ...previous,
          openaiKey: trimmedOpenAiKey,
          googleKey: trimmedGoogleKey,
        }));

        console.info("Workspace preferences saved", workspacePreferences);
        console.info("LLM provider preferences saved", {
          provider: llmSettings.activeProvider,
          hasOpenAiKey: trimmedOpenAiKey.length > 0,
          hasGoogleKey: trimmedGoogleKey.length > 0,
        });
        break;
      }
      default:
        break;
    }

    setIsUserConfigOpen(false);
    setActiveUserMenu(null);
  }, [
    activeUserMenu,
    llmSettings,
    persistActiveProvider,
    persistApiKey,
    profileSettings,
    workspacePreferences,
  ]);

  const getPrimaryActionLabel = (key: UserMenuKey) =>
    key === "profile" ? "Save profile" : "Save workspace";

  const renderUserConfiguration = () => {
    if (!activeUserMenu) {
      return null;
    }

    if (activeUserMenu.key === "profile") {
      return (
        <div className="space-y-6 text-sm text-gray-700">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Public presence
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label htmlFor="profile-full-name" className="flex flex-col space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Display name
                </span>
                <input
                  id="profile-full-name"
                  type="text"
                  value={profileSettings.fullName}
                  onChange={(event) =>
                    setProfileSettings((previous) => ({
                      ...previous,
                      fullName: event.target.value,
                    }))
                  }
                  className={baseFieldClass}
                />
              </label>
              <label htmlFor="profile-role" className="flex flex-col space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Role
                </span>
                <input
                  id="profile-role"
                  type="text"
                  value={profileSettings.role}
                  onChange={(event) =>
                    setProfileSettings((previous) => ({
                      ...previous,
                      role: event.target.value,
                    }))
                  }
                  className={baseFieldClass}
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label htmlFor="profile-location" className="flex flex-col space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Location
                </span>
                <input
                  id="profile-location"
                  type="text"
                  value={profileSettings.location}
                  onChange={(event) =>
                    setProfileSettings((previous) => ({
                      ...previous,
                      location: event.target.value,
                    }))
                  }
                  className={baseFieldClass}
                />
              </label>
              <label htmlFor="profile-email" className="flex flex-col space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Contact email
                </span>
                <input
                  id="profile-email"
                  type="email"
                  value={profileSettings.email}
                  onChange={(event) =>
                    setProfileSettings((previous) => ({
                      ...previous,
                      email: event.target.value,
                    }))
                  }
                  className={baseFieldClass}
                />
              </label>
            </div>
          </section>
          <section className="space-y-2">
            <label htmlFor="profile-bio" className="flex flex-col space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Bio
              </span>
              <textarea
                id="profile-bio"
                value={profileSettings.bio}
                onChange={(event) =>
                  setProfileSettings((previous) => ({
                    ...previous,
                    bio: event.target.value,
                  }))
                }
                rows={4}
                className={`${baseFieldClass} min-h-[120px] resize-none leading-relaxed`}
              />
            </label>
            <p className="text-xs text-gray-500">
              Share a short description that appears on your published show pages.
            </p>
            <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/70 p-3 text-xs text-purple-700">
              Tip: keep your bio warm and concise—around 2–3 sentences perform best for new
              listeners.
            </div>
          </section>
        </div>
      );
    }

    if (activeUserMenu.key === "settings") {
      const openAiConfigured = (apiKeys.openai ?? "").trim().length > 0;
      const googleConfigured = (apiKeys.google ?? "").trim().length > 0;

      return (
        <div className="space-y-6 text-sm text-gray-700">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Appearance
            </p>
            <div className="flex flex-col space-y-2">
              <label
                htmlFor="workspace-theme"
                className="text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Theme
              </label>
              <select
                id="workspace-theme"
                value={workspacePreferences.theme}
                onChange={(event) =>
                  setWorkspacePreferences((previous) => ({
                    ...previous,
                    theme: event.target.value as "system" | "light" | "dark",
                  }))
                }
                className={baseFieldClass}
              >
                <option value="system">Match system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </section>
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Editing preferences
            </p>
            <div className="space-y-3">
              <label
                htmlFor="workspace-auto-save"
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200/80 bg-white/90 p-4 shadow-sm transition hover:border-purple-200 hover:bg-purple-50/70"
              >
                <Checkbox
                  id="workspace-auto-save"
                  checked={workspacePreferences.autoSaveDrafts}
                  onCheckedChange={(checked) =>
                    setWorkspacePreferences((previous) => ({
                      ...previous,
                      autoSaveDrafts: checked === true,
                    }))
                  }
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-900">Auto-save drafts</span>
                  <p className="text-xs text-gray-500">
                    Store timeline changes automatically every 30 seconds.
                  </p>
                </div>
              </label>
              <label
                htmlFor="workspace-snapping"
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200/80 bg-white/90 p-4 shadow-sm transition hover:border-purple-200 hover:bg-purple-50/70"
              >
                <Checkbox
                  id="workspace-snapping"
                  checked={workspacePreferences.enableTimelineSnapping}
                  onCheckedChange={(checked) =>
                    setWorkspacePreferences((previous) => ({
                      ...previous,
                      enableTimelineSnapping: checked === true,
                    }))
                  }
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-900">Enable timeline snapping</span>
                  <p className="text-xs text-gray-500">
                    Align clips to bars and markers for frame-perfect edits.
                  </p>
                </div>
              </label>
              <label
                htmlFor="workspace-analytics"
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200/80 bg-white/90 p-4 shadow-sm transition hover:border-purple-200 hover:bg-purple-50/70"
              >
                <Checkbox
                  id="workspace-analytics"
                  checked={workspacePreferences.showAdvancedAnalytics}
                  onCheckedChange={(checked) =>
                    setWorkspacePreferences((previous) => ({
                      ...previous,
                      showAdvancedAnalytics: checked === true,
                    }))
                  }
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-900">Show advanced analytics</span>
                  <p className="text-xs text-gray-500">
                    Surface engagement metrics alongside every render.
                  </p>
                </div>
              </label>
            </div>
          </section>
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              AI providers
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                htmlFor="llm-provider-openai"
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-sm transition ${
                  llmSettings.activeProvider === "openai"
                    ? "border-purple-300 bg-purple-50/70"
                    : "border-gray-200/80 bg-white/90 hover:border-purple-200 hover:bg-purple-50/60"
                }`}
              >
                <input
                  id="llm-provider-openai"
                  type="radio"
                  name="llm-provider"
                  value="openai"
                  checked={llmSettings.activeProvider === "openai"}
                  onChange={() =>
                    setLlmSettings((previous) => ({
                      ...previous,
                      activeProvider: "openai",
                    }))
                  }
                  className="mt-0.5 h-4 w-4 text-purple-600 focus:ring-purple-500"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-900">OpenAI</span>
                  <p className="text-xs text-gray-500">
                    Realtime conversations powered by GPT-4o.
                  </p>
                </div>
              </label>
              <label
                htmlFor="llm-provider-google"
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-sm transition ${
                  llmSettings.activeProvider === "google"
                    ? "border-purple-300 bg-purple-50/70"
                    : "border-gray-200/80 bg-white/90 hover:border-purple-200 hover:bg-purple-50/60"
                }`}
              >
                <input
                  id="llm-provider-google"
                  type="radio"
                  name="llm-provider"
                  value="google"
                  checked={llmSettings.activeProvider === "google"}
                  onChange={() =>
                    setLlmSettings((previous) => ({
                      ...previous,
                      activeProvider: "google",
                    }))
                  }
                  className="mt-0.5 h-4 w-4 text-purple-600 focus:ring-purple-500"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-900">Google</span>
                  <p className="text-xs text-gray-500">
                    Gemini responses for research synthesis.
                  </p>
                </div>
              </label>
            </div>
          </section>
          <section className="space-y-4 rounded-2xl border border-gray-200/80 bg-white/90 p-4 shadow-sm">
            <div className="space-y-3">
              <div className="flex flex-col space-y-2">
                <label
                  htmlFor="openai-api-key"
                  className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  OpenAI API key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="openai-api-key"
                    type="password"
                    autoComplete="off"
                    value={llmSettings.openaiKey}
                    onChange={(event) =>
                      setLlmSettings((previous) => ({
                        ...previous,
                        openaiKey: event.target.value,
                      }))
                    }
                    placeholder="sk-..."
                    className={`${baseFieldClass} flex-1`}
                  />
                  {llmSettings.openaiKey && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setLlmSettings((previous) => ({
                          ...previous,
                          openaiKey: "",
                        }))
                      }
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {openAiConfigured
                    ? "Saved locally in this browser."
                    : "Paste your OpenAI key (starts with \"sk-\")."}
                </p>
              </div>
              <div className="flex flex-col space-y-2">
                <label
                  htmlFor="google-api-key"
                  className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  Google API key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="google-api-key"
                    type="password"
                    autoComplete="off"
                    value={llmSettings.googleKey}
                    onChange={(event) =>
                      setLlmSettings((previous) => ({
                        ...previous,
                        googleKey: event.target.value,
                      }))
                    }
                    placeholder="AIza..."
                    className={`${baseFieldClass} flex-1`}
                  />
                  {llmSettings.googleKey && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setLlmSettings((previous) => ({
                          ...previous,
                          googleKey: "",
                        }))
                      }
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {googleConfigured
                    ? "Saved locally in this browser."
                    : "Use your Google AI Studio key (starts with \"AIza\")."}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/70 p-3 text-xs text-purple-700">
              API keys stay on this device and are only sent to Virtual Podcast Studio when you
              start a conversation or request a summary.
            </div>
          </section>
        </div>
      );
    }

    return null;
  };

  const getBadgeColor = (badge: string) => {
    if (badge === "LIVE") return "bg-red-500 text-white";
    if (badge === "12") return "bg-blue-500 text-white";
    return "bg-gray-500 text-white";
  };

  return (
    <div
      className={`${collapsed ? "w-16" : "w-72 md:w-64 lg:w-72"} bg-white border-r border-gray-200/60 min-h-screen flex-shrink-0 relative transition-all duration-300 ease-in-out flex flex-col`}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-50/30 via-transparent to-blue-50/20 pointer-events-none" />

      {/* Header - Fixed at top */}
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
          >
            {collapsed ? (
              <Menu className="w-4 h-4" />
            ) : (
              <X className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation - Scrollable content area */}
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
                {isActive && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse" />
                )}
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-medium block truncate ${isActive ? "drop-shadow-sm" : ""}`}
                    >
                      {item.name}
                    </span>
                    <div className="flex items-center space-x-2">
                      {badge && (
                        <span
                          className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${getBadgeColor(badge)}`}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs block truncate ${
                      isActive
                        ? "text-white/90"
                        : "text-gray-500 group-hover:text-purple-500"
                    }`}
                  >
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

      {/* User Profile & Settings - Sticky Footer */}
      <div className={`${collapsed ? "p-2" : "p-4"} border-t border-gray-200/60 flex-shrink-0 relative z-20 bg-white`}>
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            title={collapsed ? "John Doe - Creator" : undefined}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            className={`group w-full rounded-2xl border border-transparent p-2 text-gray-700 transition-all duration-200 ${
              collapsed
                ? "justify-center hover:bg-purple-50/80 hover:text-purple-700"
                : "items-center justify-start hover:border-purple-200 hover:bg-purple-50/80 hover:text-purple-700"
            }`}
            onClick={() => setShowUserMenu((previous) => !previous)}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-[0_12px_24px_-12px_rgba(99,102,241,0.65)] ${
                collapsed ? "mr-0" : "mr-3"
              }`}
            >
              <User className="h-4 w-4 text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-1 items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900 group-hover:text-purple-700">
                      John Doe
                    </span>
                    <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Ready
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 group-hover:text-gray-600">
                    <span>Creator</span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span>Premium workspace</span>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showUserMenu ? "rotate-180" : ""}`}
                />
              </div>
            )}
          </Button>

          {/* User Menu Dropdown */}
          {showUserMenu && !collapsed && (
            <div className="absolute bottom-full left-0 right-0 mb-3 z-50">
              <div className="rounded-2xl border border-gray-200/80 bg-white/95 p-4 shadow-2xl backdrop-blur">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary text-white shadow-md">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">John Doe</p>
                    <p className="text-xs text-gray-500">Creator • Premium workspace</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {userMenuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeUserMenu?.key === item.key;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                          isActive
                            ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg ring-1 ring-purple-500/40"
                            : "text-gray-700 hover:bg-purple-50/70 hover:text-purple-700"
                        }`}
                        onClick={() => handleUserMenuItemSelect(item)}
                      >
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            isActive
                              ? "bg-white/15 text-white"
                              : "bg-gray-100 text-gray-500 group-hover:bg-purple-100 group-hover:text-purple-600"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1">
                          <p className={`text-sm font-semibold leading-tight ${isActive ? "text-white" : ""}`}>
                            {item.label}
                          </p>
                          <p
                            className={`text-xs ${
                              isActive ? "text-white/80" : "text-gray-500 group-hover:text-purple-600"
                            }`}
                          >
                            {item.description}
                          </p>
                        </span>
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            isActive
                              ? "text-white"
                              : "text-gray-400 group-hover:translate-x-0.5 group-hover:text-purple-500"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-xl bg-gradient-to-r from-purple-100 via-purple-50 to-blue-100 p-3 text-xs text-gray-600 shadow-inner">
                  Seamlessly switch between personal details and workspace-wide preferences without
                  leaving your creative flow.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {children}
      <Sheet open={isUserConfigOpen} onOpenChange={handleUserConfigSheetChange}>
        <SheetContent side="right" className="sm:max-w-md p-0">
          {activeUserMenu ? (
            <>
              <SheetHeader className="border-b border-gray-200 px-6 pt-6 pb-4">
                <SheetTitle>{activeUserMenu.label}</SheetTitle>
                <SheetDescription>{activeUserMenu.description}</SheetDescription>
              </SheetHeader>
              <div
                className="px-6 py-4"
                style={{ maxHeight: "calc(100vh - 16rem)", overflowY: "auto" }}
              >
                {renderUserConfiguration()}
              </div>
              <SheetFooter className="px-6 pb-6">
                <Button
                  type="button"
                  variant="gradient"
                  className="w-full shadow-[0_20px_40px_-18px_rgba(99,102,241,0.65)]"
                  onClick={handleUserConfigSave}
                >
                  {getPrimaryActionLabel(activeUserMenu.key)}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}