import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 120; // Reduced to 2 minutes - Veo 3 Fast is quick

type VideoProvider = "openai_sora" | "google_veo";

interface GenerateVideoRequest {
  prompt: string;
  concept: string;
  apiKey?: string;
  videoProvider?: VideoProvider;
  openaiApiKey?: string;
  googleApiKey?: string;
  // Conversation context for better prompts
  userQuestion?: string;
  aiResponse?: string;
  paperTitle?: string;
  useFastModel?: boolean; // Use Veo 3 Fast for faster generation
}

interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
  concept: string;
  visualSummary?: string;
  generationTime?: number;
  error?: string;
  fallback?: boolean;
  provider?: VideoProvider;
  isProxied?: boolean; // Indicates if URL is proxied through our server (base64)
  modelUsed?: string;
}

// Google Veo 3 Model Configuration
// Prioritize Veo 3.1 Fast for best speed (~10-20s generation)
// Falls back through available models if primary fails
const VEO_MODELS = {
  // Primary: Veo 3.1 Fast - fastest generation (~10-20s)
  fast: process.env.GOOGLE_VEO_FAST_MODEL ?? "veo-3.1-fast-generate-preview",
  // Secondary: Veo 3.1 Standard - higher quality but slower
  standard: process.env.GOOGLE_VEO_MODEL ?? "veo-3.1-generate-preview",
  // Fallback: Veo 3.0 stable if previews unavailable
  stable: process.env.GOOGLE_VEO_STABLE_MODEL ?? "veo-3.0-generate-preview",
} as const;

const VIDEO_CONFIG = {
  veo: {
    duration: 5, // 5 seconds is optimal for speed - balances quality and generation time
    aspectRatio: "16:9",
    models: VEO_MODELS,
    // Aggressive polling for faster completion detection
    pollIntervalFast: 800, // 800ms for fast model
    pollIntervalStandard: 1200, // 1.2s for standard
    maxPollAttempts: 90, // ~72-108 seconds max wait
  },
  sora: {
    duration: 4, // Sora can do 4 seconds
    resolution: "480p",
  },
} as const;

// Debug logging helper
function debugLog(stage: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[VISUAL-AGENT-VIDEO] [${timestamp}] [${stage}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

/**
 * Generate a short educational video using the selected AI video provider
 * 
 * Supported providers:
 * - Google Veo 3.1 (Recommended) - Via Gemini API
 * - OpenAI Sora - Via OpenAI API
 * 
 * Falls back to DALL-E 3 for static image generation if video fails.
 * 
 * Cost optimization:
 * - Duration: 6 seconds max (plays on loop)
 * - Resolution: 720p (Veo standard)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    debugLog("START", "Received video generation request");
    
    const body: GenerateVideoRequest = await request.json();
    const { 
      prompt, 
      concept, 
      apiKey,
      videoProvider = "google_veo",
      openaiApiKey,
      googleApiKey,
      userQuestion,
      aiResponse,
      paperTitle,
    } = body;

    // Default to fast model for speed
    const useFastModel = body.useFastModel !== false; // true by default

    debugLog("REQUEST", "Parsed request body", {
      concept,
      videoProvider,
      useFastModel,
      hasOpenaiKey: !!openaiApiKey,
      hasGoogleKey: !!googleApiKey,
      hasUserQuestion: !!userQuestion,
      promptLength: prompt?.length,
    });

    if (!prompt || !concept) {
      debugLog("ERROR", "Missing required fields");
      return NextResponse.json(
        { error: "Prompt and concept are required" },
        { status: 400 }
      );
    }

    // Determine which API key to use based on provider
    const providerApiKey = videoProvider === "google_veo" 
      ? (googleApiKey || process.env.GOOGLE_API_KEY)
      : (openaiApiKey || apiKey || process.env.OPENAI_API_KEY);

    debugLog("API_KEY", `Provider: ${videoProvider}, Has key: ${!!providerApiKey}`);

    if (!providerApiKey) {
      debugLog("ERROR", `No API key for provider: ${videoProvider}`);
      return NextResponse.json(
        { error: `API key required for ${videoProvider}` },
        { status: 400 }
      );
    }

    // Craft an educational video prompt with conversation context
    const videoPrompt = buildVideoPrompt(concept, prompt, videoProvider, {
      userQuestion,
      aiResponse,
      paperTitle,
    });

    debugLog("PROMPT", "Built video prompt", { promptLength: videoPrompt.length });

    let videoUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    let success = false;

    // Try the selected provider
    debugLog("GENERATION", `Attempting ${videoProvider} video generation...`);
    
    let modelUsed: string | undefined;
    
    if (videoProvider === "google_veo") {
      const result = await generateWithGoogleVeo(providerApiKey, videoPrompt, useFastModel);
      success = result.success;
      videoUrl = result.videoUrl;
      thumbnailUrl = result.thumbnailUrl;
      modelUsed = result.modelUsed;
      debugLog("GOOGLE_VEO", "Result", { success, hasVideoUrl: !!videoUrl, modelUsed });
    } else {
      const result = await generateWithOpenAISora(providerApiKey, videoPrompt);
      success = result.success;
      videoUrl = result.videoUrl;
      thumbnailUrl = result.thumbnailUrl;
      modelUsed = "sora";
      debugLog("OPENAI_SORA", "Result", { success, hasVideoUrl: !!videoUrl });
    }

    // If video generation succeeded, return the video
    if (success && videoUrl) {
      const elapsed = Date.now() - startTime;
      debugLog("SUCCESS", `Video generated in ${elapsed}ms using ${videoProvider} (${modelUsed})`);

      // Generate a summary for AI context
      const visualSummary = await generateVisualSummary(
        openaiApiKey || apiKey || process.env.OPENAI_API_KEY,
        concept,
        prompt
      );

      // Check if the video URL is a data URL (already proxied/downloaded)
      const isProxied = videoUrl.startsWith("data:");

      return NextResponse.json({
        success: true,
        videoUrl,
        thumbnailUrl,
        concept,
        visualSummary,
        generationTime: elapsed,
        fallback: false,
        provider: videoProvider,
        isProxied,
        modelUsed,
      } as VideoGenerationResult);
    }

    // Fallback: Use DALL-E 3 for static image
    debugLog("FALLBACK", "Video generation failed, falling back to DALL-E 3");
    
    const dalleKey = openaiApiKey || apiKey || process.env.OPENAI_API_KEY;
    if (!dalleKey) {
      debugLog("ERROR", "No OpenAI key available for DALL-E fallback");
      return NextResponse.json(
        { error: "Video generation failed and no OpenAI key available for fallback" },
        { status: 500 }
      );
    }

    const fallbackResult = await generateDallEFallback(dalleKey, concept, prompt);
    
    if (!fallbackResult.success) {
      debugLog("ERROR", "DALL-E fallback also failed", { error: fallbackResult.error });
      return NextResponse.json(
        { error: fallbackResult.error || "Failed to generate visual" },
        { status: 500 }
      );
    }

    const elapsed = Date.now() - startTime;
    debugLog("FALLBACK_SUCCESS", `DALL-E fallback generated in ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      videoUrl: fallbackResult.imageUrl,
      concept,
      visualSummary: fallbackResult.summary,
      generationTime: elapsed,
      fallback: true,
      provider: videoProvider,
      isProxied: fallbackResult.isProxied,
    } as VideoGenerationResult);

  } catch (error: any) {
    debugLog("FATAL_ERROR", "Unhandled error in video generation", {
      message: error?.message,
      stack: error?.stack?.slice(0, 500),
    });
    return NextResponse.json(
      { error: "Failed to generate visual", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * Build an optimized video prompt for educational content
 * CRITICAL: Keep prompts SHORT and FOCUSED for fast generation
 * Veo 3 generates faster with concise, direct prompts (under 200 chars ideal)
 */
function buildVideoPrompt(
  concept: string, 
  prompt: string,
  provider: VideoProvider,
  _context?: {
    userQuestion?: string;
    aiResponse?: string;
    paperTitle?: string;
  }
): string {
  // Extract the core visual description from the prompt (first 150 chars)
  const corePrompt = prompt.slice(0, 150).replace(/\.+$/, '');
  
  // ULTRA-CONCISE prompt format for maximum speed
  // Veo 3 responds best to direct, visual descriptions without excessive instructions
  return `${concept}: ${corePrompt}. Animated diagram, dark background, glowing elements, smooth motion, looping.`;
}

/**
 * Download a video from URL and convert to base64 data URL
 * This is necessary because Google Veo video URLs require authentication
 */
async function downloadVideoAsBase64(
  videoUrl: string,
  apiKey: string
): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
  try {
    debugLog("DOWNLOAD", `Downloading video from: ${videoUrl.slice(0, 100)}...`);
    
    if (videoUrl.startsWith("data:")) {
      return { success: true, dataUrl: videoUrl };
    }

    const authorizedResponse = await fetch(videoUrl, {
      headers: {
        Accept: "video/mp4,video/*,*/*",
        "x-goog-api-key": apiKey,
      },
    });

    const response = authorizedResponse.ok
      ? authorizedResponse
      : await fetch(videoUrl, {
          headers: { Accept: "video/mp4,video/*,*/*" },
        });

    if (!response.ok) {
      debugLog("DOWNLOAD", `Failed to download video: ${response.status}`);
      return { success: false, error: `Failed to download video: ${response.status}` };
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "video/mp4";
    
    debugLog("DOWNLOAD", `Video downloaded successfully: ${buffer.byteLength} bytes`);
    return { success: true, dataUrl: `data:${contentType};base64,${base64}` };
  } catch (error: any) {
    debugLog("DOWNLOAD", `Error downloading video: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Generate video using Google Veo 3 via Gemini API
 * Uses stable production model for reliability
 * Returns video as base64 data URL for CORS-free playback
 */
async function generateWithGoogleVeo(
  apiKey: string, 
  prompt: string,
  useFastModel: boolean = true
): Promise<{ success: boolean; videoUrl?: string; thumbnailUrl?: string; error?: string; modelUsed?: string }> {
  // Model priority: fast preview first, then quality, then stable fallback
  const modelsToTry = [
    VIDEO_CONFIG.veo.models.fast,
    VIDEO_CONFIG.veo.models.standard,
    VIDEO_CONFIG.veo.models.stable,
  ].filter((model, index, self) => self.indexOf(model) === index); // Remove duplicates

  let lastError: string | undefined;

  for (const model of modelsToTry) {
    const pollInterval = VIDEO_CONFIG.veo.pollIntervalFast;
    debugLog("GOOGLE_VEO", `Trying model: ${model}`);
    
    const result = await requestVeoModel({ 
      apiKey, 
      prompt, 
      model, 
      pollInterval,
      maxAttempts: VIDEO_CONFIG.veo.maxPollAttempts,
    });
    
    if (result.success) {
      debugLog("GOOGLE_VEO", `Success with model: ${model}`);
      return { ...result, modelUsed: model };
    }
    
    lastError = result.error;
    
    // If the error is about model not found or access denied, try next model
    if (lastError?.includes("not found") || lastError?.includes("403") || lastError?.includes("404")) {
      debugLog("GOOGLE_VEO", `Model ${model} not available, trying next...`);
      continue;
    }
    
    // For other errors, log and continue to next model
    debugLog("GOOGLE_VEO", `Model ${model} failed: ${lastError}`);
  }

  return { success: false, error: lastError || "Veo generation failed - check your Google API key has Veo access" };
}

interface VeoModelAttempt {
  apiKey: string;
  prompt: string;
  model: string;
  pollInterval: number;
  maxAttempts?: number;
}

async function requestVeoModel({
  apiKey,
  prompt,
  model,
  pollInterval,
  maxAttempts = 90,
}: VeoModelAttempt): Promise<{ success: boolean; videoUrl?: string; thumbnailUrl?: string; error?: string }> {
  try {
    debugLog("GOOGLE_VEO", `Starting Veo generation with model: ${model}`);

    // Optimized payload for speed
    const payload = {
      instances: [{ prompt }],
      parameters: {
        aspectRatio: VIDEO_CONFIG.veo.aspectRatio,
        durationSeconds: VIDEO_CONFIG.veo.duration,
        // Request direct video bytes when possible (faster than URL)
        outputOptions: {
          mimeType: "video/mp4",
        },
      },
    };

    debugLog("GOOGLE_VEO", "Request", { model, promptLength: prompt.length });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${apiKey}`;

    let response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Retry with minimal payload if parameters are rejected (400)
    if (!response.ok && response.status === 400) {
      debugLog("GOOGLE_VEO", "Retrying with minimal payload...");
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instances: [{ prompt }] }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      debugLog("GOOGLE_VEO", `API error: ${response.status}`, { error: errorText.slice(0, 300) });
      try {
        const errorJson = JSON.parse(errorText);
        const errorMessage = errorJson?.error?.message || `API error ${response.status}`;
        return { success: false, error: errorMessage };
      } catch {
        return { success: false, error: `API error ${response.status}` };
      }
    }

    const data = await response.json();
    debugLog("GOOGLE_VEO", "Response received", { hasName: !!data.name, keys: Object.keys(data) });

    // Long-running operation - need to poll
    if (data.name) {
      const pollResult = await pollGoogleOperation(apiKey, data.name, pollInterval, maxAttempts);
      
      // If we got a URL, download it (for CORS-free playback)
      if (pollResult.success && pollResult.videoUrl && !pollResult.videoUrl.startsWith("data:")) {
        debugLog("GOOGLE_VEO", "Converting video to base64 for playback...");
        const downloadResult = await downloadVideoAsBase64(pollResult.videoUrl, apiKey);
        if (downloadResult.success && downloadResult.dataUrl) {
          return {
            success: true,
            videoUrl: downloadResult.dataUrl,
            thumbnailUrl: pollResult.thumbnailUrl,
          };
        }
        // Fallback to direct URL if download fails
        debugLog("GOOGLE_VEO", "Download failed, using direct URL");
        return pollResult;
      }
      return pollResult;
    }

    // Direct response (no polling needed)
    const directVideo = findVideoInResponse(data);

    if (directVideo?.bytesBase64Encoded) {
      debugLog("GOOGLE_VEO", "Got direct base64 video");
      return {
        success: true,
        videoUrl: `data:video/mp4;base64,${directVideo.bytesBase64Encoded}`,
      };
    }

    if (directVideo?.uri) {
      debugLog("GOOGLE_VEO", "Got direct video URI, downloading...");
      const downloadResult = await downloadVideoAsBase64(directVideo.uri, apiKey);
      if (downloadResult.success && downloadResult.dataUrl) {
        return { success: true, videoUrl: downloadResult.dataUrl };
      }
      return { success: true, videoUrl: directVideo.uri };
    }

    debugLog("GOOGLE_VEO", "No video in response", { responseKeys: Object.keys(data) });
    return { success: false, error: "No video in response" };
  } catch (error: any) {
    debugLog("GOOGLE_VEO", `Exception: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Helper to find video data in various response formats
 */
function findVideoInResponse(data: any): { uri?: string; bytesBase64Encoded?: string } | null {
  const paths = [
    data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video,
    data?.generatedSamples?.[0]?.video,
    data?.response?.generatedSamples?.[0]?.video,
    data?.generatedVideos?.[0]?.video,
    data?.generatedVideos?.[0],
    data?.videos?.[0],
  ];
  
  for (const video of paths) {
    if (video?.uri || video?.bytesBase64Encoded) {
      return video;
    }
  }
  return null;
}

/**
 * Poll Google long-running operation for completion
 * Aggressive polling for fast completion detection
 */
async function pollGoogleOperation(
  apiKey: string,
  operationName: string,
  pollInterval: number = 800,
  maxAttempts: number = 90
): Promise<{ success: boolean; videoUrl?: string; thumbnailUrl?: string; error?: string }> {
  const startTime = Date.now();
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait before polling (except first attempt)
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    try {
      const statusResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
      );
      
      if (!statusResponse.ok) {
        if (statusResponse.status === 404) {
          debugLog("GOOGLE_POLL", "Operation not found - may have expired");
          return { success: false, error: "Operation not found" };
        }
        continue; // Retry on transient errors
      }
      
      const statusData = await statusResponse.json();
      
      if (statusData.done) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        
        // Check for errors first
        if (statusData.error) {
          debugLog("GOOGLE_POLL", `Failed after ${elapsed}s`, { error: statusData.error.message });
          return { success: false, error: statusData.error.message || "Video generation failed" };
        }

        // Find video in response (handles multiple response formats)
        const responseData = statusData.response || statusData.result || statusData;
        const videoData = findVideoInPollResponse(responseData);

        if (videoData) {
          const videoUri = videoData.uri || videoData.url;
          const videoBytes = videoData.bytesBase64Encoded || videoData.bytes;
          
          debugLog("GOOGLE_POLL", `Video ready in ${elapsed}s!`, { 
            hasUri: !!videoUri, 
            hasBytes: !!videoBytes,
          });
          
          let videoUrl: string;
          if (videoBytes) {
            // Direct base64 - fastest path
            videoUrl = `data:video/mp4;base64,${videoBytes}`;
          } else if (videoUri) {
            videoUrl = videoUri;
          } else {
            return { success: false, error: "Video data incomplete" };
          }
          
          // Get thumbnail if available
          const thumbnailData = findThumbnailInResponse(responseData);
          
          return {
            success: true,
            videoUrl,
            thumbnailUrl: thumbnailData,
          };
        }
        
        // Operation done but no video found
        debugLog("GOOGLE_POLL", "No video in completed response", { 
          responseKeys: responseData ? Object.keys(responseData).slice(0, 5) : [],
        });
        return { success: false, error: "No video returned" };
      }
      
      // Log progress every 15 attempts (~12 seconds)
      if (attempt > 0 && attempt % 15 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        debugLog("GOOGLE_POLL", `Still generating... (${elapsed}s)`);
      }
    } catch (error: any) {
      // Network errors - retry silently
      if (attempt % 10 === 0) {
        debugLog("GOOGLE_POLL", `Network error, retrying: ${error.message}`);
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  debugLog("GOOGLE_POLL", `Timeout after ${totalTime}s`);
  return { success: false, error: `Generation timed out after ${totalTime}s` };
}

/**
 * Find video data in poll response (handles various formats)
 */
function findVideoInPollResponse(data: any): { uri?: string; url?: string; bytesBase64Encoded?: string; bytes?: string } | null {
  if (!data) return null;
  
  const paths = [
    // Veo 3 paths
    data?.generateVideoResponse?.generatedSamples?.[0]?.video,
    data?.generatedSamples?.[0]?.video,
    // Alternative paths
    data?.videos?.[0],
    // Veo 2 paths
    data?.generatedVideos?.[0]?.video,
    data?.generatedVideos?.[0],
  ];
  
  for (const video of paths) {
    if (video && (video.uri || video.url || video.bytesBase64Encoded || video.bytes)) {
      return video;
    }
  }
  return null;
}

/**
 * Find thumbnail URL in response
 */
function findThumbnailInResponse(data: any): string | undefined {
  const paths = [
    data?.generateVideoResponse?.generatedSamples?.[0]?.thumbnail,
    data?.generatedSamples?.[0]?.thumbnail,
    data?.generatedVideos?.[0]?.thumbnail,
  ];
  
  for (const thumb of paths) {
    if (thumb?.uri || thumb?.url) {
      return thumb.uri || thumb.url;
    }
  }
  return undefined;
}

/**
 * Alternative: Try Imagen 3 for image generation
 */
async function tryGeminiImagenVideo(
  apiKey: string,
  prompt: string
): Promise<{ success: boolean; videoUrl?: string; thumbnailUrl?: string; error?: string }> {
  try {
    debugLog("IMAGEN", "Trying Gemini Imagen fallback...");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: VIDEO_CONFIG.veo.aspectRatio,
        },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.predictions?.[0]?.bytesBase64Encoded) {
        debugLog("IMAGEN", "Generated image successfully");
        return {
          success: true,
          videoUrl: `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`,
        };
      }
    } else {
      const errorText = await response.text();
      debugLog("IMAGEN", `Error: ${response.status}`, { errorText: errorText.slice(0, 300) });
    }

    return { success: false, error: "Imagen generation failed" };
  } catch (error: any) {
    debugLog("IMAGEN", `Exception: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Generate video using OpenAI Sora
 */
async function generateWithOpenAISora(
  apiKey: string, 
  prompt: string
): Promise<{ success: boolean; videoUrl?: string; thumbnailUrl?: string; error?: string }> {
  try {
    debugLog("SORA", "Starting OpenAI Sora video generation...");

    const response = await fetch("https://api.openai.com/v1/videos/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sora",
        prompt,
        n: 1,
        size: VIDEO_CONFIG.sora.resolution,
        duration: VIDEO_CONFIG.sora.duration,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      debugLog("SORA", `API error: ${response.status}`, { error: errorData?.error?.message });
      return { success: false, error: errorData?.error?.message || `HTTP ${response.status}` };
    }

    const data = await response.json();
    debugLog("SORA", "Initial response", { hasData: !!data?.data, hasId: !!data?.id });
    
    // Direct response with video URL
    if (data?.data?.[0]?.url) {
      debugLog("SORA", "Video completed immediately");
      return {
        success: true,
        videoUrl: data.data[0].url,
        thumbnailUrl: data.data[0].thumbnail_url,
      };
    }
    
    // Async job - poll for completion
    if (data?.id) {
      return await pollSoraJob(apiKey, data.id);
    }

    debugLog("SORA", "Unexpected response format");
    return { success: false, error: "Unexpected response format" };
  } catch (error: any) {
    debugLog("SORA", `Exception: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Poll OpenAI Sora job for completion
 */
async function pollSoraJob(
  apiKey: string,
  jobId: string
): Promise<{ success: boolean; videoUrl?: string; thumbnailUrl?: string; error?: string }> {
  const maxAttempts = 90;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const statusResponse = await fetch(
        `https://api.openai.com/v1/videos/generations/${jobId}`,
        { headers: { "Authorization": `Bearer ${apiKey}` } }
      );
      
      if (!statusResponse.ok) {
        debugLog("SORA_POLL", `Status check failed: ${statusResponse.status}`);
        continue;
      }
      
      const statusData = await statusResponse.json();
      
      if (statusData?.status === "succeeded" || statusData?.status === "completed") {
        const videoUrl = statusData.data?.[0]?.url || statusData.output?.url || statusData.url;
        if (videoUrl) {
          debugLog("SORA_POLL", "Video completed!");
          return {
            success: true,
            videoUrl,
            thumbnailUrl: statusData.data?.[0]?.thumbnail_url || statusData.thumbnail_url,
          };
        }
      } else if (statusData?.status === "failed") {
        debugLog("SORA_POLL", "Generation failed", { error: statusData.error?.message });
        return { success: false, error: statusData.error?.message || "Video generation failed" };
      }
      
      if (attempt % 10 === 0) {
        debugLog("SORA_POLL", `Attempt ${attempt + 1}/${maxAttempts}, status: ${statusData?.status}`);
      }
    } catch (error: any) {
      debugLog("SORA_POLL", `Poll error: ${error.message}`);
    }
  }

  debugLog("SORA_POLL", "Timed out waiting for video");
  return { success: false, error: "Video generation timed out" };
}

/**
 * Generate DALL-E 3 fallback image
 * Downloads the image and returns as base64 to avoid CORS issues
 */
async function generateDallEFallback(
  apiKey: string,
  concept: string,
  prompt: string
): Promise<{ success: boolean; imageUrl?: string; summary?: string; error?: string; isProxied?: boolean }> {
  try {
    debugLog("DALLE", "Starting DALL-E 3 image generation...");
    
    const openai = new OpenAI({ apiKey });

    const imagePrompt = `Educational infographic diagram explaining "${concept}".
Style: Clean, minimalist, dark background (deep blue/purple gradient).
Content: ${prompt}
Visual elements: Simple geometric shapes (circles, rectangles), connecting arrows with glowing effects, clear visual hierarchy.
Color scheme: Bright cyan, green, and orange elements on dark background.
No text labels. Professional, modern design. High contrast colors.
Landscape orientation, widescreen format.`;

    debugLog("DALLE", "Generating image...");

    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
      style: "vivid",
      response_format: "b64_json", // Get base64 directly to avoid CORS
    });

    const imageData = imageResponse.data[0];
    
    if (!imageData?.b64_json) {
      debugLog("DALLE", "No image data in response");
      return { success: false, error: "No image data returned" };
    }

    debugLog("DALLE", "Image generated successfully, creating data URL");
    
    // Return as data URL to avoid CORS issues
    const imageUrl = `data:image/png;base64,${imageData.b64_json}`;

    // Generate summary
    debugLog("DALLE", "Generating summary...");
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Generate a 1-sentence description of what a diagram shows. Be specific. Don't say 'The image shows' - describe it directly.",
        },
        {
          role: "user",
          content: `Concept: ${concept}\nDiagram: ${prompt}\n\nDescribe what the diagram illustrates.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 60,
    });

    const summary = summaryResponse.choices[0]?.message?.content ||
      `A diagram explaining ${concept}`;

    debugLog("DALLE", "Fallback complete");
    return { success: true, imageUrl, summary, isProxied: true };
  } catch (error: any) {
    debugLog("DALLE", `Exception: ${error.message}`, { stack: error.stack?.slice(0, 300) });
    return { success: false, error: error.message };
  }
}

/**
 * Generate visual summary using GPT-4o-mini
 */
async function generateVisualSummary(
  apiKey: string | undefined,
  concept: string,
  prompt: string
): Promise<string> {
  if (!apiKey) {
    return `An animated diagram explaining ${concept}`;
  }

  try {
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Generate a 1-sentence description of what an animated diagram shows. Be specific. Don't say 'The video shows' - describe it directly.",
        },
        {
          role: "user",
          content: `Concept: ${concept}\nAnimation: ${prompt}\n\nDescribe what the animation illustrates.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 60,
    });

    return response.choices[0]?.message?.content || `An animated diagram explaining ${concept}`;
  } catch (error: any) {
    debugLog("SUMMARY", `Error generating summary: ${error.message}`);
    return `An animated diagram explaining ${concept}`;
  }
}
