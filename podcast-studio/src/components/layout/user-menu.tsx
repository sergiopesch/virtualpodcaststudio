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
import { useApiConfig, type LlmProvider } from "@/contexts/api-config-context";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";

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
    apiKeys,
    setActiveProvider: persistActiveProvider,
    setApiKey: persistApiKey,
    validateApiKey,
  } = useApiConfig();
  const [llmSettings, setLlmSettings] = useState<LlmSettingsState>({
    activeProvider: storedProvider,
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
      openaiKey: apiKeys.openai ?? "",
      googleKey: apiKeys.google ?? "",
    });
  }, [isSheetOpen, activeItem, storedProvider, apiKeys.openai, apiKeys.google]);

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

    setIsSheetOpen(false);
    setActiveItem(null);
  }, [
    activeItem,
    llmSettings,
    persistActiveProvider,
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
          <section className="space-y-4 rounded-xl border border-gray-200/80 bg-white/90 p-4 shadow-sm">
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
                    onChange={(event) => {
                      const { value } = event.target;
                      setLlmSettings((previous) => ({
                        ...previous,
                        openaiKey: value,
                      }));
                      if (keyErrors.openai) {
                        setKeyErrors((previous) => ({
                          ...previous,
                          openai: null,
                        }));
                      }
                    }}
                    placeholder="sk-0123456789…"
                    className={`${baseFieldClass} flex-1 ${keyErrors.openai ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-300" : ""}`}
                    aria-invalid={keyErrors.openai ? true : undefined}
                    aria-describedby={keyErrors.openai ? "openai-api-key-error" : undefined}
                  />
                  {llmSettings.openaiKey && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLlmSettings((previous) => ({
                          ...previous,
                          openaiKey: "",
                        }));
                        if (keyErrors.openai) {
                          setKeyErrors((previous) => ({
                            ...previous,
                            openai: null,
                          }));
                        }
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <p
                  id={keyErrors.openai ? "openai-api-key-error" : undefined}
                  className={`text-xs ${keyErrors.openai ? "text-red-600" : "text-gray-500"}`}
                >
                  {keyErrors.openai
                    ? keyErrors.openai
                    : openAiConfigured
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
                    onChange={(event) => {
                      const { value } = event.target;
                      setLlmSettings((previous) => ({
                        ...previous,
                        googleKey: value,
                      }));
                      if (keyErrors.google) {
                        setKeyErrors((previous) => ({
                          ...previous,
                          google: null,
                        }));
                      }
                    }}
                    placeholder="AIzaSyExample…"
                    className={`${baseFieldClass} flex-1 ${keyErrors.google ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-300" : ""}`}
                    aria-invalid={keyErrors.google ? true : undefined}
                    aria-describedby={keyErrors.google ? "google-api-key-error" : undefined}
                  />
                  {llmSettings.googleKey && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLlmSettings((previous) => ({
                          ...previous,
                          googleKey: "",
                        }));
                        if (keyErrors.google) {
                          setKeyErrors((previous) => ({
                            ...previous,
                            google: null,
                          }));
                        }
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <p
                  id={keyErrors.google ? "google-api-key-error" : undefined}
                  className={`text-xs ${keyErrors.google ? "text-red-600" : "text-gray-500"}`}
                >
                  {keyErrors.google
                    ? keyErrors.google
                    : googleConfigured
                      ? "Saved locally in this browser."
                      : "Use your Google AI Studio key (starts with \"AIza\")."}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              API keys stay on this device and are only sent to Virtual Podcast Studio when needed.
            </p>
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
            className="flex items-center gap-3 rounded-full border border-gray-200/70 px-2 py-1.5 pr-3 text-sm font-medium text-gray-700 hover:border-purple-200"
          >
            <span className="flex size-9 items-center justify-center rounded-full gradient-primary text-sm font-semibold text-white shadow-glow">
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
            <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 p-3 shadow-inner">
              <span className="flex size-10 items-center justify-center rounded-full gradient-primary text-sm font-semibold text-white shadow-glow">
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
                className="flex touch-manipulation items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-200 data-[highlighted]:bg-purple-50/80 data-[highlighted]:text-gray-900"
                onSelect={(event) => {
                  event.preventDefault();
                  handleItemSelect(item);
                }}
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shadow-inner">
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
