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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiConfig, type LlmProvider } from "@/contexts/api-config-context";
import { Settings, Check, AlertCircle, Key, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserSettingsDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function UserSettingsDialog({ trigger, open, onOpenChange }: UserSettingsDialogProps) {
  const {
    activeProvider,
    apiKeys,
    models,
    defaultModels,
    setActiveProvider,
    setApiKey,
    setModel,
    validateApiKey,
  } = useApiConfig();

  const [showKey, setShowKey] = React.useState(false);
  const [tempKey, setTempKey] = React.useState("");
  const [validationState, setValidationState] = React.useState<{
    isValid: boolean;
    message?: string;
  } | null>(null);

  // Reset temp state when provider changes or dialog opens
  React.useEffect(() => {
    setTempKey(apiKeys[activeProvider] || "");
    setValidationState(null);
  }, [activeProvider, apiKeys, open]);

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setTempKey(newValue);
    
    if (newValue.trim()) {
      const validation = validateApiKey(activeProvider, newValue);
      setValidationState(validation);
      if (validation.isValid) {
        setApiKey(activeProvider, newValue);
      }
    } else {
      setValidationState(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="glass-panel border-white/10 sm:max-w-[425px] text-white p-0 overflow-hidden gap-0">
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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60 uppercase tracking-wider">AI Provider</Label>
              <Select
                value={activeProvider}
                onValueChange={(val) => setActiveProvider(val as LlmProvider)}
              >
                <SelectTrigger className="w-full bg-white/5 border-white/10 text-white focus:ring-white/20 h-11 rounded-xl">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent className="glass-panel border-white/10 text-white">
                  <SelectItem value="openai" className="focus:bg-white/10 focus:text-white cursor-pointer">OpenAI</SelectItem>
                  <SelectItem value="google" className="focus:bg-white/10 focus:text-white cursor-pointer">Google (Gemini)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60 uppercase tracking-wider">API Key</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                  <Key className="size-4" />
                </div>
                <Input
                  type={showKey ? "text" : "password"}
                  value={tempKey}
                  onChange={handleKeyChange}
                  placeholder={`Enter your ${activeProvider === "openai" ? "OpenAI" : "Google"} API key`}
                  className={cn(
                    "pl-10 pr-10 bg-white/5 border-white/10 text-white focus:border-white/20 focus:ring-white/20 h-11 rounded-xl font-mono text-sm",
                    validationState?.isValid === false && "border-red-500/50 focus:border-red-500/50",
                    validationState?.isValid === true && "border-green-500/50 focus:border-green-500/50"
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-8 hover:bg-white/10 text-white/40 hover:text-white"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              
              {validationState && (
                <div className={cn(
                  "text-xs flex items-center gap-1.5 mt-1.5",
                  validationState.isValid ? "text-green-400" : "text-red-400"
                )}>
                  {validationState.isValid ? (
                    <>
                      <Check className="size-3.5" />
                      <span>Valid API key format</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-3.5" />
                      <span>{validationState.message}</span>
                    </>
                  )}
                </div>
              )}
              <p className="text-[10px] text-white/40 leading-relaxed">
                Your API key is stored locally in your browser and never sent to our servers.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60 uppercase tracking-wider">Model</Label>
              <Select
                value={models[activeProvider] || defaultModels[activeProvider]}
                onValueChange={(val) => setModel(activeProvider, val)}
              >
                <SelectTrigger className="w-full bg-white/5 border-white/10 text-white focus:ring-white/20 h-11 rounded-xl">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent className="glass-panel border-white/10 text-white">
                  {activeProvider === "openai" ? (
                    <>
                      <SelectItem value="gpt-4o-realtime-preview-2024-10-01" className="focus:bg-white/10 focus:text-white cursor-pointer">GPT-4o Realtime (Preview)</SelectItem>
                      <SelectItem value="gpt-4o-mini-realtime-preview-2024-12-17" className="focus:bg-white/10 focus:text-white cursor-pointer">GPT-4o Mini Realtime</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="models/gemini-1.5-flash" className="focus:bg-white/10 focus:text-white cursor-pointer">Gemini 1.5 Flash</SelectItem>
                      <SelectItem value="models/gemini-1.5-pro" className="focus:bg-white/10 focus:text-white cursor-pointer">Gemini 1.5 Pro</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
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

