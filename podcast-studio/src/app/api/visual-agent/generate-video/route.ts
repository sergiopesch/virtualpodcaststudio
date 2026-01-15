import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60; // Reduced for faster timeouts - we want quick fallback to DALL-E

interface GenerateVideoRequest {
  prompt: string;
  concept: string;
  apiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
  userQuestion?: string;
  aiResponse?: string;
  paperTitle?: string;
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
  provider?: string;
  isProxied?: boolean;
  modelUsed?: string;
}

// Debug logging
function log(stage: string, message: string, data?: Record<string, unknown>) {
  console.log(`[VEO3] [${stage}] ${message}`, data ? JSON.stringify(data) : '');
}

/**
 * Generate educational videos using Google Veo 3
 * Falls back to DALL-E 3 images if Veo fails
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: GenerateVideoRequest = await request.json();
    const { prompt, concept, apiKey, openaiApiKey, googleApiKey, aiResponse } = body;

    if (!prompt || !concept) {
      return NextResponse.json({ error: "Prompt and concept required" }, { status: 400 });
    }

    log("START", `Generating visual for: "${concept}"`);

    // Build a video prompt that DIRECTLY illustrates the AI's explanation
    const videoPrompt = buildEducationalPrompt(concept, prompt);

    // Try Google Veo 3 first
    const googleKey = googleApiKey || process.env.GOOGLE_API_KEY;
    
    if (googleKey) {
      log("VEO3", "Attempting Veo 3 video generation...");
      
      const veoResult = await generateWithVeo3(googleKey, videoPrompt);
      
      if (veoResult.success && veoResult.videoUrl) {
      const elapsed = Date.now() - startTime;
        log("VEO3_SUCCESS", `Video ready in ${(elapsed/1000).toFixed(1)}s`);

      return NextResponse.json({
        success: true,
          videoUrl: veoResult.videoUrl,
        concept,
          visualSummary: `Animated visualization: ${concept}`,
        generationTime: elapsed,
        fallback: false,
          provider: "google_veo",
          isProxied: veoResult.videoUrl.startsWith("data:"),
          modelUsed: veoResult.modelUsed || "veo-3",
      } as VideoGenerationResult);
    }

      log("VEO3_FAIL", `Veo failed: ${veoResult.error}`);
    }
    
    // Fallback to DALL-E 3 images
    const dalleKey = openaiApiKey || apiKey || process.env.OPENAI_API_KEY;
    
    if (dalleKey) {
      log("DALLE", "Falling back to DALL-E 3...");
      
      const dalleResult = await generateWithDallE(dalleKey, concept, prompt, aiResponse || "");
      
      if (dalleResult.success) {
    const elapsed = Date.now() - startTime;
        log("DALLE_SUCCESS", `Image ready in ${(elapsed/1000).toFixed(1)}s`);

    return NextResponse.json({
      success: true,
          videoUrl: dalleResult.imageUrl,
      concept,
          visualSummary: dalleResult.summary,
      generationTime: elapsed,
      fallback: true,
          provider: "dall-e-3",
          isProxied: true,
          modelUsed: "dall-e-3",
    } as VideoGenerationResult);
      }
    }

    return NextResponse.json(
      { error: "No API keys available for visual generation" },
      { status: 500 }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    log("ERROR", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Build a prompt that DIRECTLY illustrates what the AI is explaining
 */
function buildEducationalPrompt(concept: string, basePrompt: string): string {
  // Use the high-quality prompt from the analysis step directly
  // Just ensure it has high quality flags if not present
  let prompt = basePrompt;

  // Append technical quality constraints if they aren't already there
  if (!prompt.toLowerCase().includes("high quality")) {
    prompt += ", high quality, 4k, cinematic lighting";
  }

  // Ensure it's not too long for the API
  return prompt.slice(0, 400); 
}

/**
 * Extract key technical terms from the AI's explanation
 */
function extractKeyTerms(text: string): string {
  if (!text || text.length < 50) return "";
  
  // Find technical/scientific terms (capitalized words, compound terms)
  const words = text.split(/\s+/);
  const keyTerms: string[] = [];
  
  for (let i = 0; i < words.length && keyTerms.length < 5; i++) {
    const word = words[i].replace(/[^a-zA-Z0-9-]/g, '');
    // Look for technical terms (longer words, capitalized, hyphenated)
    if (word.length > 6 || word.includes('-') || (word[0] === word[0].toUpperCase() && word.length > 4)) {
      if (!['However', 'Although', 'Because', 'Therefore', 'Moreover'].includes(word)) {
        keyTerms.push(word.toLowerCase());
      }
    }
  }
  
  return [...new Set(keyTerms)].slice(0, 4).join(', ');
}

/**
 * Generate video using Google Veo 3 via Generative Language API
 * Uses the latest Veo 3 models for fast, high-quality video generation
 */
async function generateWithVeo3(
  apiKey: string, 
  prompt: string
): Promise<{ success: boolean; videoUrl?: string; error?: string; modelUsed?: string }> {
  
  // Prioritize speed over quality for real-time educational content
  // Veo 3 models with fastest generation times first
  const endpoints = [
    // Imagen Video / Veo 3 via generateContent (newest API pattern)
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview:generateContent`,
      model: "veo-3.0-generate-preview",
      useGenerateContent: true
    },
    // Veo 3 Long Running Operation (standard pattern)
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview:predictLongRunning`,
      model: "veo-3.0-generate-preview",
      useInstances: true
    },
    // Veo 2 as fallback (more widely available)
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning`,
      model: "veo-2.0-generate-001",
      useInstances: true
    },
    // Imagen 3 for image fallback (very fast)
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict`,
      model: "imagen-3.0-generate-001",
      useInstances: true,
      isImage: true
    }
  ];

  for (const endpoint of endpoints) {
    try {
      log("VEO3_TRY", `Trying ${endpoint.model}...`);
      
      let payload: Record<string, unknown>;
      
      if ((endpoint as { useGenerateContent?: boolean }).useGenerateContent) {
        // generateContent format for newer models
        payload = {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseModalities: ["VIDEO"],
            videoConfig: {
              aspectRatio: "16:9",
              durationSeconds: 3, // Shorter = faster generation
            }
          }
        };
      } else if ((endpoint as { isImage?: boolean }).isImage) {
        // Imagen format
        payload = {
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "16:9",
          }
        };
      } else if (endpoint.useInstances) {
        // Standard Veo instances format
        payload = {
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "16:9",
            durationSeconds: 3, // 3s for faster generation
            personGeneration: "allow_adult",
            }
        };
      } else {
        payload = {
            prompt,
            config: {
              aspectRatio: "16:9",
            durationSeconds: 3,
            }
          };
      }

      const response = await fetch(`${endpoint.url}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const status = response.status;
        log("VEO3_ERROR", `${status}: ${errorText.slice(0, 150)}`);
      
      if (status === 403 || status === 404) {
          // Skip to next endpoint quickly
          continue;
      }
      continue;
    }

    const data = await response.json();
      log("VEO3_RESPONSE", "Got response", { keys: Object.keys(data) });

      // Check for long-running operation
    if (data.name) {
        log("VEO3_PENDING", `Operation started: ${data.name}`);
        // Use faster polling for real-time app
        const pollResult = await pollOperation(apiKey, data.name, 30); // 30 max attempts = ~45s timeout
        if (pollResult.success) {
          return { ...pollResult, modelUsed: endpoint.model };
        }
        if (pollResult.error) {
             log("VEO3_POLL_ERR", pollResult.error);
        }
        continue;
      }

      // Check for direct video/image response
      const mediaUrl = findVideoUrl(data) || findImageUrl(data);
      if (mediaUrl) {
        const base64 = await downloadAsBase64(mediaUrl, apiKey);
      return {
        success: true,
          videoUrl: base64 || mediaUrl,
          modelUsed: endpoint.model 
        };
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown";
      log("VEO3_EXCEPTION", msg);
    }
  }

  return { success: false, error: "Veo 3 not available - ensure your Google API key has video generation access" };
}

/**
 * Poll a long-running operation for completion
 * Optimized for faster feedback in real-time apps
 */
async function pollOperation(
  apiKey: string,
  operationName: string,
  maxAttempts: number = 45
): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  const pollInterval = 1500; // 1.5 seconds - faster polling for responsiveness

  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, pollInterval));

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
      );
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data.done) {
        if (data.error) {
          return { success: false, error: data.error.message };
        }
        
        const videoUrl = findVideoUrl(data.response || data.result || data);
        if (videoUrl) {
          const base64 = await downloadAsBase64(videoUrl, apiKey);
          return { success: true, videoUrl: base64 || videoUrl };
        }
        
        return { success: false, error: "No video in completed response" };
      }
      
      if (i > 0 && i % 10 === 0) {
        log("POLL", `Still waiting... (${i}s)`);
      }
    } catch {
      // Retry on network errors
    }
  }

  return { success: false, error: "Video generation timed out" };
}

/**
 * Find video URL in various response formats
 */
function findVideoUrl(data: Record<string, unknown>): string | null {
  if (!data) return null;
  
  // Debug log the data keys to help diagnosis
  console.log("[VEO_DEBUG] Response keys:", Object.keys(data));
  
  // Check various paths where video data might be
  const paths = [
    // Standard LRO response
    (data as Record<string, unknown>)?.video,
    
    // Vertex AI Prediction format
    ((data as Record<string, unknown>)?.predictions as Array<Record<string, unknown>>)?.[0]?.video,
    ((data as Record<string, unknown>)?.predictions as Array<Record<string, unknown>>)?.[0],
    
    // Gemini/Generative Language formats
    ((data as Record<string, unknown>)?.generatedSamples as Array<Record<string, unknown>>)?.[0]?.video,
    ((data as Record<string, unknown>)?.videos as Array<Record<string, unknown>>)?.[0],
    ((data as Record<string, unknown>)?.generateVideoResponse as Record<string, unknown>)?.generatedSamples,
    
    // Result wrapper
    ((data as Record<string, unknown>)?.result as Record<string, unknown>)?.video,
  ];

  for (const item of paths) {
    if (!item) continue;
    
    const video = item as Record<string, unknown>;
    
    // Check for base64 data
    if (video.bytesBase64Encoded) {
      return `data:video/mp4;base64,${video.bytesBase64Encoded}`;
    }
    
    // Check for URL (uri, url, or gcsUri)
    if (video.uri) return video.uri as string;
    if (video.url) return video.url as string;
    if (video.gcsUri) return video.gcsUri as string;
  }

  return null;
}

/**
 * Find image URL in response (for Imagen fallback)
 */
function findImageUrl(data: Record<string, unknown>): string | null {
  if (!data) return null;
  
  // Type-safe path extraction
  const predictions = data?.predictions as Array<Record<string, unknown>> | undefined;
  const images = data?.images as Array<Record<string, unknown>> | undefined;
  const candidates = data?.candidates as Array<Record<string, unknown>> | undefined;
  
  const paths: Array<Record<string, unknown> | undefined> = [
    predictions?.[0],
    images?.[0],
  ];
  
  // Handle nested candidates structure
  if (candidates?.[0]) {
    const content = (candidates[0] as Record<string, unknown>)?.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;
    if (parts?.[0]) {
      paths.push(parts[0]);
    }
  }

  for (const item of paths) {
    if (!item) continue;
    const img = item as Record<string, unknown>;
    
    if (img.bytesBase64Encoded) {
      return `data:image/png;base64,${img.bytesBase64Encoded}`;
    }
    if (img.inlineData) {
      const inlineData = img.inlineData as Record<string, string>;
      if (inlineData.data) {
        const mimeType = inlineData.mimeType || "image/png";
        return `data:${mimeType};base64,${inlineData.data}`;
      }
    }
  }

  return null;
}

/**
 * Download video and convert to base64 for CORS-free playback
 */
async function downloadAsBase64(url: string, apiKey: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;
  
  try {
    const response = await fetch(url, {
      headers: { "x-goog-api-key": apiKey }
    });

    if (!response.ok) {
      // Try without auth
      const response2 = await fetch(url);
      if (!response2.ok) return null;
      const buffer = await response2.arrayBuffer();
      return `data:video/mp4;base64,${Buffer.from(buffer).toString("base64")}`;
    }
    
    const buffer = await response.arrayBuffer();
    return `data:video/mp4;base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Generate educational image with DALL-E 3
 */
async function generateWithDallE(
  apiKey: string,
  concept: string,
  prompt: string,
  aiResponse: string
): Promise<{ success: boolean; imageUrl?: string; summary?: string; error?: string }> {
  try {
    const openai = new OpenAI({ apiKey });

    // Build a prompt that directly illustrates the explanation
    const keyTerms = extractKeyTerms(aiResponse);
    
    const imagePrompt = `Educational 3D diagram illustrating "${concept}".
${prompt.slice(0, 200)}
${keyTerms ? `Show these elements clearly: ${keyTerms}.` : ''}
Style: Glowing neon scientific diagram on dark background, professional infographic quality, clear visual hierarchy showing the mechanism/process, luminescent cyan and purple elements.`;

    log("DALLE_PROMPT", imagePrompt.slice(0, 100));

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
      style: "vivid",
      response_format: "b64_json",
    });

    const imageData = response.data?.[0];
    if (!imageData?.b64_json) {
      return { success: false, error: "No image data" };
    }

    return {
      success: true,
      imageUrl: `data:image/png;base64,${imageData.b64_json}`,
      summary: `Diagram illustrating ${concept}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    return { success: false, error: msg };
  }
}
