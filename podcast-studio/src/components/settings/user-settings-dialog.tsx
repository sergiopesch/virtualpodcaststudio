"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiConfig, type VideoProvider } from "@/contexts/api-config-context";
import { Settings, Check, AlertCircle, Key, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserSettingsDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function UserSettingsDialog({ trigger, open, onOpenChange }: UserSettingsDialogProps) {
  const {
    apiKeys,
    videoProvider,
    setVideoProvider,
    setApiKey,
    validateApiKey,
  } = useApiConfig();

  const [showOpenAiKey, setShowOpenAiKey] = React.useState(false);
  const [showGoogleKey, setShowGoogleKey] = React.useState(false);
  const [tempOpenAiKey, setTempOpenAiKey] = React.useState("");
  const [tempGoogleKey, setTempGoogleKey] = React.useState("");
  const [openAiValidation, setOpenAiValidation] = React.useState<{ isValid: boolean; message?: string } | null>(null);
  const [googleValidation, setGoogleValidation] = React.useState<{ isValid: boolean; message?: string } | null>(null);

  React.useEffect(() => {
    if (open) {
      setTempOpenAiKey(apiKeys.openai || "");
      setTempGoogleKey(apiKeys.google || "");
      setOpenAiValidation(null);
      setGoogleValidation(null);
    }
  }, [open, apiKeys]);

  const handleOpenAiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setTempOpenAiKey(newValue);
    
    if (newValue.trim()) {
      const validation = validateApiKey("openai", newValue);
      setOpenAiValidation(validation);
      if (validation.isValid) {
        setApiKey("openai", newValue);
      }
    } else {
      setOpenAiValidation(null);
      setApiKey("openai", "");
    }
  };

  const handleGoogleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setTempGoogleKey(newValue);
    
    if (newValue.trim()) {
      const validation = validateApiKey("google", newValue);
      setGoogleValidation(validation);
      if (validation.isValid) {
        setApiKey("google", newValue);
      }
    } else {
      setGoogleValidation(null);
      setApiKey("google", "");
    }
  };

  const openAiConfigured = !!apiKeys.openai?.trim();
  const googleConfigured = !!apiKeys.google?.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="glass-panel border-white/10 sm:max-w-[500px] text-white p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 py-4 border-b border-white/5 bg-white/5">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2 text-white">
            <Settings className="size-5" />
            Settings
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Manage your API keys and model preferences.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-6">
          {/* OpenAI Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-white/60 uppercase tracking-wider">
                OpenAI API Key
              </Label>
              <span className="text-[10px] text-white/40">
                For voice & text{videoProvider === "openai_sora" ? " + video" : ""}
              </span>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                <Key className="size-4" />
              </div>
              <Input
                type={showOpenAiKey ? "text" : "password"}
                value={tempOpenAiKey}
                onChange={handleOpenAiKeyChange}
                placeholder="sk-..."
                className={cn(
                  "pl-10 pr-10 bg-white/5 border-white/10 text-white focus:border-white/20 focus:ring-white/20 h-11 rounded-xl font-mono text-sm",
                  openAiValidation?.isValid === false && "border-red-500/50",
                  openAiValidation?.isValid === true && "border-white/20"
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 size-8 hover:bg-white/10 text-white/40 hover:text-white"
                onClick={() => setShowOpenAiKey(!showOpenAiKey)}
              >
                {showOpenAiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            {openAiValidation && !openAiValidation.isValid && (
              <p className="text-[10px] text-red-400 flex items-center gap-1">
                <AlertCircle className="size-3" />
                {openAiValidation.message}
              </p>
            )}
          </div>

          {/* Google Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Google API Key
              </Label>
              <span className="text-[10px] text-white/40">
                {videoProvider === "google_veo" ? "For video generation" : "Optional"}
              </span>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                <Key className="size-4" />
              </div>
              <Input
                type={showGoogleKey ? "text" : "password"}
                value={tempGoogleKey}
                onChange={handleGoogleKeyChange}
                placeholder="AIza..."
                className={cn(
                  "pl-10 pr-10 bg-white/5 border-white/10 text-white focus:border-white/20 focus:ring-white/20 h-11 rounded-xl font-mono text-sm",
                  googleValidation?.isValid === false && "border-red-500/50",
                  googleValidation?.isValid === true && "border-white/20"
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 size-8 hover:bg-white/10 text-white/40 hover:text-white"
                onClick={() => setShowGoogleKey(!showGoogleKey)}
              >
                {showGoogleKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            {googleValidation && !googleValidation.isValid && (
              <p className="text-[10px] text-red-400 flex items-center gap-1">
                <AlertCircle className="size-3" />
                {googleValidation.message}
              </p>
            )}
          </div>

          {/* Video Model Selection */}
          <div className="space-y-3">
            <Label className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Video Generation Model
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVideoProvider("google_veo")}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                  videoProvider === "google_veo"
                    ? "border-white/30 bg-white/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                <div
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border transition-all",
                    videoProvider === "google_veo"
                      ? "border-white bg-white"
                      : "border-white/30"
                  )}
                >
                  {videoProvider === "google_veo" && (
                    <Check className="size-2.5 text-black" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Google Veo 3</p>
                  <p className="text-[10px] text-white/40">5 sec, ~10-20s gen</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVideoProvider("openai_sora")}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                  videoProvider === "openai_sora"
                    ? "border-white/30 bg-white/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                <div
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border transition-all",
                    videoProvider === "openai_sora"
                      ? "border-white bg-white"
                      : "border-white/30"
                  )}
                >
                  {videoProvider === "openai_sora" && (
                    <Check className="size-2.5 text-black" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">OpenAI Sora</p>
                  <p className="text-[10px] text-white/40">4 sec videos</p>
                </div>
              </button>
            </div>
          </div>

          <p className="text-[10px] text-white/30 leading-relaxed">
            Your API keys are stored locally in your browser and never sent to our servers.
          </p>
        </div>
        
        <div className="p-6 pt-0 flex justify-end">
          <Button 
            onClick={() => onOpenChange?.(false)}
            className="bg-white text-black hover:bg-gray-200 rounded-xl px-6 h-10 font-medium"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
