"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// Visual data for video/image visualization
export type VisualStatus = "analyzing" | "generating" | "ready" | "error";
export type VisualType = "diagram" | "illustration" | "chart" | "animation" | "video";
export type VideoProvider = "openai_sora" | "google_veo";

export interface VisualData {
  id: string;
  concept: string;
  visualType: VisualType;
  status: VisualStatus;
  timestamp: number;
  // Video/image URL from provider or DALL-E fallback
  videoUrl?: string;
  thumbnailUrl?: string;
  isVideo?: boolean; // True if actual video, false if fallback image
  error?: string;
  generationTime?: number;
  provider?: VideoProvider;
}

// Conversation context for better visual generation
export interface ConversationContext {
  userQuestion: string;      // What the user asked
  aiResponse: string;        // The AI's current response
  conversationHistory: string; // Recent conversation for context
  paperTitle?: string;       // The paper being discussed (if any)
  paperTopic?: string;       // Main topic of the paper
}

interface VisualAgentConfig {
  enabled: boolean;
  apiKey?: string; // OpenAI API key for voice/text
  sessionId?: string; // For injecting context back to AI
  minTranscriptLength?: number;
  minSecondsBetweenVisuals?: number; // Rate limiting
  onlyHighPriority?: boolean; // Cost control: only generate high priority visuals
  onVisualReady?: (visual: VisualData, summary: string) => void;
  // Multi-provider video support
  videoProvider?: VideoProvider;
  openaiApiKey?: string;
  googleApiKey?: string;
}

interface AnalysisResult {
  shouldGenerate: boolean;
  concept?: string;
  visualType?: VisualType;
  prompt?: string;
  reason?: string;
  priority?: "high" | "medium" | "low";
}

interface VideoGenerateResult {
  success: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
  concept: string;
  visualSummary?: string;
  generationTime?: number;
  fallback?: boolean; // True if fell back to image
  error?: string;
  provider?: VideoProvider;
}

// Similarity check to avoid generating visuals for similar concepts
function conceptsSimilar(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aNorm = normalize(a);
  const bNorm = normalize(b);
  
  // Check if one contains the other
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return true;
  
  // Check word overlap
  const aWords = new Set(a.toLowerCase().split(/\s+/));
  const bWords = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...aWords].filter(w => bWords.has(w) && w.length > 3);
  const union = new Set([...aWords, ...bWords]);
  const similarity = intersection.length / union.size;
  
  return similarity > 0.5; // 50% word overlap = similar
}

export function useVisualAgent(config: VisualAgentConfig) {
  const {
    enabled,
    apiKey,
    sessionId,
    minTranscriptLength = 200,
    minSecondsBetweenVisuals = 60,
    onlyHighPriority = true,
    onVisualReady,
    videoProvider = "google_veo",
    openaiApiKey,
    googleApiKey,
  } = config;

  const [visuals, setVisuals] = useState<VisualData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Refs for tracking state across renders
  const lastAnalyzedHashRef = useRef<string>("");
  const lastVisualTimeRef = useRef<number>(0);
  const generatedConceptsRef = useRef<string[]>([]);
  const pendingAnalysisRef = useRef<AbortController | null>(null);
  const conversationHistoryRef = useRef<string>("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingAnalysisRef.current) {
        pendingAnalysisRef.current.abort();
      }
    };
  }, []);

  const addVisual = useCallback((visual: VisualData) => {
    setVisuals((prev) => [...prev, visual]);
  }, []);

  const updateVisual = useCallback((id: string, updates: Partial<VisualData>) => {
    setVisuals((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...updates } : v))
    );
  }, []);

  const removeVisual = useCallback((id: string) => {
    setVisuals((prev) => prev.filter((v) => v.id !== id));
  }, []);

  // Inject context to the AI when visual is ready
  // Note: This is optional - the visual works even if context injection fails
  const injectVisualContext = useCallback(async (concept: string, summary: string) => {
    if (!sessionId) {
      console.log("[VISUAL-AGENT] No sessionId, skipping context injection (visual still works)");
      return;
    }

    try {
      const response = await fetch("/api/rt/inject-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          context: `Visual for "${concept}": ${summary}`,
          type: "visual_ready",
        }),
      });

      const data = await response.json().catch(() => ({}));
      
      if (response.ok && data.success) {
        console.log(`[VISUAL-AGENT] ✓ Context injected to AI for: "${concept}"`);
      } else if (response.status === 404) {
        // Session not found - this is fine, session may have ended
        console.log(`[VISUAL-AGENT] Session ended, skipping context injection for: "${concept}"`);
      } else if (response.status === 500 && data.warning?.includes("hot reload")) {
        // Hot reload issue - just log it
        console.warn(`[VISUAL-AGENT] Hot reload issue - context not injected (visual still works)`);
      } else {
        // Other errors - log but don't worry about it
        console.log(`[VISUAL-AGENT] Context injection skipped: ${data.error || data.warning || 'unknown'} (visual still works)`);
      }
    } catch (error) {
      // Network errors - just log, visual still works
      console.log("[VISUAL-AGENT] Context injection failed (network error) - visual still works");
    }
  }, [sessionId]);

  // Check if we should skip generation based on rate limiting and deduplication
  const shouldSkipGeneration = useCallback((concept: string): { skip: boolean; reason?: string } => {
    // Rate limiting: check time since last visual
    const now = Date.now();
    const timeSinceLastVisual = (now - lastVisualTimeRef.current) / 1000;
    if (lastVisualTimeRef.current > 0 && timeSinceLastVisual < minSecondsBetweenVisuals) {
      return { 
        skip: true, 
        reason: `Rate limited: ${Math.ceil(minSecondsBetweenVisuals - timeSinceLastVisual)}s until next visual` 
      };
    }

    // Deduplication: check if similar concept was already generated
    for (const existing of generatedConceptsRef.current) {
      if (conceptsSimilar(concept, existing)) {
        return { skip: true, reason: `Similar to existing: "${existing}"` };
      }
    }

    return { skip: false };
  }, [minSecondsBetweenVisuals]);

  const generateVisual = useCallback(
    async (concept: string, visualType: VisualType, prompt: string, context?: ConversationContext) => {
      // Check if we should skip
      const { skip, reason } = shouldSkipGeneration(concept);
      if (skip) {
        console.log(`[VISUAL-AGENT] Skipping generation: ${reason}`);
        return;
      }

      const id = `visual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Record this concept and time
      generatedConceptsRef.current.push(concept);
      lastVisualTimeRef.current = Date.now();

      // Add visual in generating state
      addVisual({
        id,
        concept,
        visualType: "video",
        status: "generating",
        timestamp: Date.now(),
      });

      setIsGenerating(true);

      try {
        console.log(`[VISUAL-AGENT] Generating video for: "${concept}" using ${videoProvider}`);
        
        // Use video generation endpoint with selected provider
        const response = await fetch("/api/visual-agent/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            concept,
            apiKey,
            videoProvider,
            openaiApiKey: openaiApiKey || apiKey,
            googleApiKey,
            // Pass conversation context for better video generation
            userQuestion: context?.userQuestion,
            aiResponse: context?.aiResponse,
            paperTitle: context?.paperTitle,
          }),
        });

        const data: VideoGenerateResult = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Generation failed");
        }

        const updatedVisual: Partial<VisualData> = {
          status: "ready",
          videoUrl: data.videoUrl,
          thumbnailUrl: data.thumbnailUrl,
          isVideo: !data.fallback, // True if actual video, false if image fallback
          generationTime: data.generationTime,
          provider: data.provider || videoProvider,
        };

        updateVisual(id, updatedVisual);

        console.log(`[VISUAL-AGENT] ✓ Visual ready: "${concept}" via ${data.provider} (${(data.generationTime! / 1000).toFixed(1)}s)${data.fallback ? " [fallback]" : ""}`);

        // Inject context to AI so it can reference the visual
        if (data.visualSummary) {
          await injectVisualContext(concept, data.visualSummary);
          
          // Also call the callback if provided
          if (onVisualReady) {
            onVisualReady(
              { ...updatedVisual, id, concept, visualType: "video", timestamp: Date.now() } as VisualData, 
              data.visualSummary
            );
          }
        }
      } catch (error: any) {
        console.error("[VISUAL-AGENT] Generation error:", error);
        updateVisual(id, {
          status: "error",
          error: error.message || "Failed to generate visual",
        });
        // Remove from concepts list so it can be retried
        generatedConceptsRef.current = generatedConceptsRef.current.filter(c => c !== concept);
      } finally {
        setIsGenerating(false);
      }
    },
    [apiKey, videoProvider, openaiApiKey, googleApiKey, shouldSkipGeneration, addVisual, updateVisual, injectVisualContext, onVisualReady]
  );

  /**
   * Analyze transcript with full conversation context
   * @param context - Full conversation context including user question and AI response
   * @param isStreaming - Whether the AI is still generating the response
   */
  const analyzeTranscript = useCallback(
    async (context: ConversationContext, isStreaming: boolean = false) => {
      if (!enabled || !context.aiResponse) return;

      const { aiResponse, userQuestion, conversationHistory, paperTitle, paperTopic } = context;

      // Check minimum length
      if (aiResponse.length < minTranscriptLength) {
        return;
      }

      // Create a hash of the transcript to avoid re-analyzing the same text
      const hash = aiResponse.slice(-500) + userQuestion.slice(0, 100);
      if (hash === lastAnalyzedHashRef.current) {
        return;
      }

      // If still streaming and transcript is short, wait for more content
      if (isStreaming && aiResponse.length < minTranscriptLength * 1.5) {
        return;
      }

      // Cancel any pending analysis
      if (pendingAnalysisRef.current) {
        pendingAnalysisRef.current.abort();
      }

      // Create new abort controller
      const abortController = new AbortController();
      pendingAnalysisRef.current = abortController;

      lastAnalyzedHashRef.current = hash;
      setIsAnalyzing(true);

      try {
        console.log(`[VISUAL-AGENT] Analyzing with context - Q: "${userQuestion.slice(0, 50)}..." A: ${aiResponse.length} chars`);
        
        const response = await fetch("/api/visual-agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Full context for better analysis
            userQuestion,
            aiResponse,
            conversationHistory: conversationHistory || conversationHistoryRef.current,
            paperTitle,
            paperTopic,
            apiKey,
          }),
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) return;

        const result: AnalysisResult = await response.json();

        console.log(`[VISUAL-AGENT] Analysis result:`, {
          shouldGenerate: result.shouldGenerate,
          concept: result.concept,
          priority: result.priority,
          reason: result.reason?.slice(0, 50),
        });

        // Cost control: only generate if high priority (when enabled)
        if (onlyHighPriority && result.priority !== "high") {
          console.log(`[VISUAL-AGENT] Skipping non-high priority: ${result.priority}`);
          return;
        }

        if (
          result.shouldGenerate &&
          result.concept &&
          result.visualType &&
          result.prompt
        ) {
          // Start generation with full context
          generateVisual(result.concept, result.visualType, result.prompt, context);
        }

        // Update conversation history for next analysis
        conversationHistoryRef.current = `User: ${userQuestion}\nAI: ${aiResponse.slice(-500)}`;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log("[VISUAL-AGENT] Analysis aborted (new analysis started)");
        } else {
          console.error("[VISUAL-AGENT] Analysis error:", error);
        }
      } finally {
        setIsAnalyzing(false);
        pendingAnalysisRef.current = null;
      }
    },
    [enabled, apiKey, minTranscriptLength, onlyHighPriority, generateVisual]
  );

  const reset = useCallback(() => {
    setVisuals([]);
    setIsAnalyzing(false);
    setIsGenerating(false);
    generatedConceptsRef.current = [];
    lastAnalyzedHashRef.current = "";
    lastVisualTimeRef.current = 0;
    conversationHistoryRef.current = "";
    if (pendingAnalysisRef.current) {
      pendingAnalysisRef.current.abort();
      pendingAnalysisRef.current = null;
    }
  }, []);

  return {
    visuals,
    isAnalyzing,
    isGenerating,
    analyzeTranscript,
    removeVisual,
    reset,
  };
}
