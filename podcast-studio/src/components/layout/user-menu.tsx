"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { useApiConfig, type LlmProvider, type VideoProvider, VIDEO_PROVIDER_INFO } from "@/contexts/api-config-context";
import { Check, ChevronDown, LogOut, Mic, MessageSquare, Settings, User, Video, Sparkles } from "lucide-react";

interface UserMenuItem {
  key: UserMenuKey;
  menuLabel: string;
  sheetTitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

type UserMenuKey = "profile" | "settings";

interface LlmSettingsState {
  activeProvider: LlmProvider;
  videoProvider: VideoProvider;
  openaiKey: string;
  googleKey: string;
}

const userMenuItems: UserMenuItem[] = [
  {
    key: "profile",
    menuLabel: "Profile…",
    sheetTitle: "Profile",
    description: "Update your public details and contact info.",
    icon: User,
  },
  {
    key: "settings",
    menuLabel: "Workspace settings…",
    sheetTitle: "Workspace settings",
    description: "Configure collaboration preferences and AI providers.",
    icon: Settings,
  },
];

const baseFieldClass =
  "w-full rounded-lg border border-gray-300 bg-white/90 px-3 py-2 text-base text-gray-900 shadow-sm transition focus-visible:border-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300";

export function UserMenu() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<UserMenuItem | null>(null);
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
    videoProvider: storedVideoProvider,
    apiKeys,
    setActiveProvider: persistActiveProvider,
    setVideoProvider: persistVideoProvider,
    setApiKey: persistApiKey,
    validateApiKey,
  } = useApiConfig();
  const [llmSettings, setLlmSettings] = useState<LlmSettingsState>({
    activeProvider: storedProvider,
    videoProvider: storedVideoProvider,
    openaiKey: apiKeys.openai ?? "",
    googleKey: apiKeys.google ?? "",
  });
  const [keyErrors, setKeyErrors] = useState<Record<LlmProvider, string | null>>({
    openai: null,
    google: null,
  });

  useEffect(() => {
    if (!isSheetOpen || activeItem?.key !== "settings") {
      return;
    }

    setLlmSettings({
      activeProvider: storedProvider,
      videoProvider: storedVideoProvider,
      openaiKey: apiKeys.openai ?? "",
      googleKey: apiKeys.google ?? "",
    });
  }, [isSheetOpen, activeItem, storedProvider, storedVideoProvider, apiKeys.openai, apiKeys.google]);

  useEffect(() => {
    if (!isSheetOpen) {
      setKeyErrors({ openai: null, google: null });
    }
  }, [isSheetOpen]);

  const handleItemSelect = useCallback((item: UserMenuItem) => {
    setActiveItem(item);
    setIsSheetOpen(true);
  }, []);

  const handleSheetChange = useCallback((open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      setActiveItem(null);
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!activeItem) {
      return;
    }

    switch (activeItem.key) {
      case "profile":
        console.info("Profile settings saved", profileSettings);
        break;
      case "settings": {
        const trimmedOpenAiKey = llmSettings.openaiKey.trim();
        const trimmedGoogleKey = llmSettings.googleKey.trim();

        const nextErrors: Record<LlmProvider, string | null> = {
          openai: null,
          google: null,
        };

        if (trimmedOpenAiKey) {
          const validation = validateApiKey("openai", trimmedOpenAiKey);
          if (!validation.isValid) {
            nextErrors.openai = validation.message ?? "Invalid OpenAI API key.";
          }
        }

        if (trimmedGoogleKey) {
          const validation = validateApiKey("google", trimmedGoogleKey);
          if (!validation.isValid) {
            nextErrors.google = validation.message ?? "Invalid Google API key.";
          }
        }

        if (nextErrors.openai || nextErrors.google) {
          setKeyErrors(nextErrors);
          return;
        }

        setKeyErrors({ openai: null, google: null });

        persistActiveProvider(llmSettings.activeProvider);
        persistVideoProvider(llmSettings.videoProvider);
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
          videoProvider: llmSettings.videoProvider,
          hasOpenAiKey: trimmedOpenAiKey.length > 0,
          hasGoogleKey: trimmedGoogleKey.length > 0,
        });
        break;
      }
      default:
        break;
    }

    setIsSheetOpen(false);
    setActiveItem(null);
  }, [
    activeItem,
    llmSettings,
    persistActiveProvider,
    persistVideoProvider,
    persistApiKey,
    profileSettings,
    validateApiKey,
    workspacePreferences,
  ]);

  const handleSignOut = useCallback(() => {
    console.info("User signed out");
  }, []);

  const initials = useMemo(() => {
    if (!profileSettings.fullName.trim()) {
      return "JD";
    }

    return profileSettings.fullName
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("");
  }, [profileSettings.fullName]);

  const renderConfiguration = () => {
    if (!activeItem) {
      return null;
    }

    if (activeItem.key === "profile") {
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
          </section>
        </div>
      );
    }

    if (activeItem.key === "settings") {
      const openAiConfigured = (apiKeys.openai ?? "").trim().length > 0;
      const googleConfigured = (apiKeys.google ?? "").trim().length > 0;

      // Check if the selected video provider has an API key configured
      const selectedVideoProviderKeyProvider = VIDEO_PROVIDER_INFO[llmSettings.videoProvider].keyProvider;
      const videoProviderKeyConfigured = (apiKeys[selectedVideoProviderKeyProvider] ?? "").trim().length > 0;

      return (
        <div className="space-y-6 text-sm text-gray-700">
          {/* AI Providers - Side by Side */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2">
              <Sparkles className="size-5 text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">AI Providers</p>
                <p className="text-xs text-gray-500">Configure your API keys and see what each provider powers</p>
              </div>
            </div>

            {/* Side-by-side provider cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* OpenAI Card */}
              <div className={`rounded-xl border-2 p-4 transition-all ${
                openAiConfigured 
                  ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50" 
                  : "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50"
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
                    <span className="text-xs font-bold text-white">O</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">OpenAI</p>
                    <p className={`text-[10px] font-medium ${openAiConfigured ? "text-emerald-600" : "text-amber-600"}`}>
                      {openAiConfigured ? "✓ Connected" : "Key required"}
                    </p>
                  </div>
                </div>

                {/* What OpenAI powers */}
                <div className="space-y-1.5 mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Powers:</p>
                  <div className="flex items-center gap-1.5">
                    <Mic className="size-3 text-blue-600" />
                    <span className="text-xs text-gray-700">Voice Conversations</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="size-3 text-emerald-600" />
                    <span className="text-xs text-gray-700">Text Analysis</span>
                  </div>
                  {llmSettings.videoProvider === "openai_sora" && (
                    <div className="flex items-center gap-1.5">
                      <Video className="size-3 text-purple-600" />
                      <span className="text-xs text-gray-700">Video (Sora)</span>
                      <span className="rounded bg-purple-100 px-1 py-0.5 text-[8px] font-medium text-purple-700">
                        Selected
                      </span>
                    </div>
                  )}
                </div>

                {/* API Key input */}
                <div className="space-y-1.5">
                  <input
                    id="openai-api-key"
                    type="password"
                    autoComplete="off"
                    value={llmSettings.openaiKey}
                    onChange={(event) => {
                      setLlmSettings((prev) => ({ ...prev, openaiKey: event.target.value }));
                      if (keyErrors.openai) setKeyErrors((prev) => ({ ...prev, openai: null }));
                    }}
                    placeholder="sk-..."
                    className={`w-full rounded-lg border bg-white px-2.5 py-2 text-xs shadow-sm transition focus-visible:outline-none focus-visible:ring-2 ${
                      keyErrors.openai 
                        ? "border-red-300 focus-visible:ring-red-200" 
                        : "border-gray-200 focus-visible:ring-emerald-200"
                    }`}
                  />
                  {keyErrors.openai && (
                    <p className="text-[10px] text-red-600">{keyErrors.openai}</p>
                  )}
                  {llmSettings.openaiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setLlmSettings((prev) => ({ ...prev, openaiKey: "" }));
                        setKeyErrors((prev) => ({ ...prev, openai: null }));
                      }}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition"
                    >
                      Clear key
                    </button>
                  )}
                </div>
              </div>

              {/* Google Card */}
              <div className={`rounded-xl border-2 p-4 transition-all ${
                llmSettings.videoProvider === "google_veo"
                  ? googleConfigured
                    ? "border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50"
                    : "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50"
                  : "border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50"
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                    <span className="text-xs font-bold text-white">G</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Google AI</p>
                    <p className={`text-[10px] font-medium ${
                      llmSettings.videoProvider !== "google_veo"
                        ? "text-gray-400"
                        : googleConfigured 
                          ? "text-blue-600" 
                          : "text-amber-600"
                    }`}>
                      {llmSettings.videoProvider !== "google_veo"
                        ? "Not selected"
                        : googleConfigured 
                          ? "✓ Connected" 
                          : "Key required"}
                    </p>
                  </div>
                </div>

                {/* What Google powers */}
                <div className="space-y-1.5 mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Powers:</p>
                  {llmSettings.videoProvider === "google_veo" ? (
                    <div className="flex items-center gap-1.5">
                      <Video className="size-3 text-purple-600" />
                      <span className="text-xs text-gray-700">Video (Veo 2)</span>
                      <span className="rounded bg-purple-100 px-1 py-0.5 text-[8px] font-medium text-purple-700">
                        Selected
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      Select Veo 2 for video
                    </p>
                  )}
                </div>

                {/* API Key input */}
                <div className="space-y-1.5">
                  <input
                    id="google-api-key"
                    type="password"
                    autoComplete="off"
                    value={llmSettings.googleKey}
                    onChange={(event) => {
                      setLlmSettings((prev) => ({ ...prev, googleKey: event.target.value }));
                      if (keyErrors.google) setKeyErrors((prev) => ({ ...prev, google: null }));
                    }}
                    placeholder="AIza..."
                    className={`w-full rounded-lg border bg-white px-2.5 py-2 text-xs shadow-sm transition focus-visible:outline-none focus-visible:ring-2 ${
                      keyErrors.google 
                        ? "border-red-300 focus-visible:ring-red-200" 
                        : "border-gray-200 focus-visible:ring-blue-200"
                    }`}
                  />
                  {keyErrors.google && (
                    <p className="text-[10px] text-red-600">{keyErrors.google}</p>
                  )}
                  {llmSettings.googleKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setLlmSettings((prev) => ({ ...prev, googleKey: "" }));
                        setKeyErrors((prev) => ({ ...prev, google: null }));
                      }}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition"
                    >
                      Clear key
                    </button>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-gray-500 text-center">
              🔒 Keys are stored locally in your browser only
            </p>
          </section>

          {/* Video Model Selection */}
          <section className="space-y-3 rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50/80 to-pink-50/80 p-4">
            <div className="flex items-center gap-2">
              <Video className="size-5 text-purple-600" />
              <div>
                <p className="text-sm font-semibold text-purple-900">Video Generation Model</p>
                <p className="text-xs text-purple-600">Choose which AI creates visual explanations</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {/* Google Veo 2 Option */}
              <label
                className={`flex cursor-pointer flex-col rounded-xl border-2 p-3 transition-all ${
                  llmSettings.videoProvider === "google_veo"
                    ? "border-purple-400 bg-white shadow-md ring-2 ring-purple-200"
                    : "border-gray-200 bg-white/50 hover:border-purple-200 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`flex size-5 items-center justify-center rounded-full border-2 transition-all ${
                      llmSettings.videoProvider === "google_veo"
                        ? "border-purple-500 bg-purple-500"
                        : "border-gray-300 bg-white"
                    }`}
                  >
                    {llmSettings.videoProvider === "google_veo" && (
                      <Check className="size-3 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-900">Veo 2</span>
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">
                    Best
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">
                  Google's latest • 5-8 sec videos
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Uses: Google AI key
                </p>
                <input
                  type="radio"
                  name="videoProvider"
                  value="google_veo"
                  checked={llmSettings.videoProvider === "google_veo"}
                  onChange={() => setLlmSettings((prev) => ({ ...prev, videoProvider: "google_veo" }))}
                  className="sr-only"
                />
              </label>

              {/* OpenAI Sora Option */}
              <label
                className={`flex cursor-pointer flex-col rounded-xl border-2 p-3 transition-all ${
                  llmSettings.videoProvider === "openai_sora"
                    ? "border-purple-400 bg-white shadow-md ring-2 ring-purple-200"
                    : "border-gray-200 bg-white/50 hover:border-purple-200 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`flex size-5 items-center justify-center rounded-full border-2 transition-all ${
                      llmSettings.videoProvider === "openai_sora"
                        ? "border-purple-500 bg-purple-500"
                        : "border-gray-300 bg-white"
                    }`}
                  >
                    {llmSettings.videoProvider === "openai_sora" && (
                      <Check className="size-3 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-900">Sora</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">
                  OpenAI • 4 sec videos
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Uses: OpenAI key
                </p>
                <input
                  type="radio"
                  name="videoProvider"
                  value="openai_sora"
                  checked={llmSettings.videoProvider === "openai_sora"}
                  onChange={() => setLlmSettings((prev) => ({ ...prev, videoProvider: "openai_sora" }))}
                  className="sr-only"
                />
              </label>
            </div>

            {!videoProviderKeyConfigured && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 text-center">
                ⚠️ Add your {llmSettings.videoProvider === "google_veo" ? "Google" : "OpenAI"} API key above to enable video
              </p>
            )}
          </section>

          {/* Appearance */}
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
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200/80 bg-white/90 p-4 shadow-sm transition hover:border-purple-200 hover:bg-purple-50/70"
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
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200/80 bg-white/90 p-4 shadow-sm transition hover:border-purple-200 hover:bg-purple-50/70"
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
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200/80 bg-white/90 p-4 shadow-sm transition hover:border-purple-200 hover:bg-purple-50/70"
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
        </div>
      );
    }

    return null;
  };

  const getPrimaryActionLabel = (key: UserMenuKey) =>
    key === "profile" ? "Save profile" : "Save workspace";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="glass"
            className="flex items-center gap-3 rounded-full border border-gray-200/70 px-2 py-1.5 pr-3 text-sm font-medium text-gray-700 hover:border-gray-400"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-black text-sm font-semibold text-white shadow-md">
              {initials}
            </span>
            <span className="hidden sm:flex flex-col text-left leading-tight">
              <span className="text-sm font-semibold text-gray-900">{profileSettings.fullName}</span>
              <span className="text-xs text-gray-500">{profileSettings.role}</span>
            </span>
            <ChevronDown className="size-4 text-gray-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64 rounded-2xl glass p-2 shadow-xl"
        >
          <DropdownMenuLabel className="px-2 py-1">
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 shadow-inner">
              <span className="flex size-10 items-center justify-center rounded-full bg-black text-sm font-semibold text-white shadow-md">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{profileSettings.fullName}</p>
                <p className="text-xs text-gray-500 truncate">{profileSettings.email}</p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {userMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem
                key={item.key}
                className="flex touch-manipulation items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900"
                onSelect={(event) => {
                  event.preventDefault();
                  handleItemSelect(item);
                }}
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-gray-100 text-gray-900 shadow-inner">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.menuLabel}</p>
                  <p className="text-xs text-gray-500 truncate">{item.description}</p>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="flex touch-manipulation items-center gap-3 px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 data-[highlighted]:bg-red-50/80"
            onSelect={(event) => {
              event.preventDefault();
              handleSignOut();
            }}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-red-50 text-red-500">
              <LogOut className="size-4" aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-xs text-muted-foreground">Securely end this session</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={isSheetOpen} onOpenChange={handleSheetChange}>
        <SheetContent side="right" className="sm:max-w-md p-0">
          {activeItem ? (
            <>
              <SheetHeader className="border-b border-gray-200 px-6 pt-6 pb-4">
                <SheetTitle>{activeItem.sheetTitle}</SheetTitle>
                <SheetDescription>{activeItem.description}</SheetDescription>
              </SheetHeader>
              <div
                className="px-6 py-4"
                style={{ maxHeight: "calc(100vh - 16rem)", overflowY: "auto" }}
              >
                {renderConfiguration()}
              </div>
              <SheetFooter className="px-6 pb-6">
                <Button
                  type="button"
                  variant="gradient"
                  className="w-full"
                  onClick={handleSave}
                >
                  {getPrimaryActionLabel(activeItem.key)}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
