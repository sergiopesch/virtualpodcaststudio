import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenerateRequest {
  prompt: string;
  concept: string;
  visualType: "diagram" | "illustration" | "chart" | "animation";
  originalExplanation?: string; // The AI's explanation that triggered this visual
  apiKey?: string;
}

const STYLE_MODIFIERS: Record<string, string> = {
  diagram: "Clean, minimalist technical diagram with clear labels, white background, professional infographic style, vector-like appearance, educational illustration",
  illustration: "Beautiful, modern digital illustration, soft gradients, professional scientific visualization, clean and elegant, educational style",
  chart: "Clean data visualization, modern infographic style, clear labels and legends, professional business chart aesthetic",
  animation: "Single frame from an animated sequence, dynamic motion lines, clear visual flow, educational animation style frame",
};

// Generate a summary of what the visual shows for the AI to reference
async function generateVisualSummary(
  openai: OpenAI,
  concept: string,
  visualType: string,
  originalPrompt: string,
  revisedPrompt: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are helping an AI podcast host reference a visual that just appeared on screen. 
Generate a brief, natural description (1-2 sentences) of what the visual shows.
The host will use this to smoothly reference the visual in their explanation.
Be specific about what elements are visible and how they relate to the concept.
Do NOT use phrases like "The image shows" - describe it as if you're pointing to it.`,
        },
        {
          role: "user",
          content: `Concept: ${concept}
Visual type: ${visualType}
Original prompt: ${originalPrompt}
DALL-E's interpretation: ${revisedPrompt}

Generate a brief description the AI host can use to reference this visual.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    return response.choices[0]?.message?.content || `A ${visualType} illustrating ${concept}`;
  } catch (error) {
    console.error("[VISUAL-AGENT] Failed to generate summary:", error);
    return `A ${visualType} illustrating ${concept}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { prompt, concept, visualType, apiKey } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "OpenAI API key required" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: key });

    // Enhance the prompt with style modifiers
    const styleModifier = STYLE_MODIFIERS[visualType] || STYLE_MODIFIERS.illustration;
    const enhancedPrompt = `${prompt}. Style: ${styleModifier}. No text or labels in the image unless absolutely necessary for understanding.`;

    console.log("[VISUAL-AGENT] Generating image for:", concept);

    const startTime = Date.now();

    // Generate image
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid",
    });

    const imageUrl = imageResponse.data[0]?.url;
    const revisedPrompt = imageResponse.data[0]?.revised_prompt || prompt;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image generated" },
        { status: 500 }
      );
    }

    // Generate a summary for the AI to reference (in parallel would be ideal, but we need the revised prompt)
    const visualSummary = await generateVisualSummary(
      openai,
      concept,
      visualType,
      prompt,
      revisedPrompt
    );

    const elapsed = Date.now() - startTime;
    console.log(`[VISUAL-AGENT] Image + summary generated in ${elapsed}ms`);
    console.log(`[VISUAL-AGENT] Summary: "${visualSummary}"`);

    return NextResponse.json({
      success: true,
      imageUrl,
      concept,
      visualType,
      revisedPrompt,
      visualSummary, // NEW: Summary for AI to reference
      generationTime: elapsed,
    });
  } catch (error: unknown) {
    console.error("[VISUAL-AGENT] Generation error:", error);
    
    // Handle specific OpenAI errors
    if (error && typeof error === 'object' && 'error' in error) {
      const openaiError = error as { error?: { code?: string } };
      if (openaiError.error?.code === "content_policy_violation") {
        return NextResponse.json(
          { error: "Content policy violation - prompt was rejected", code: "policy_violation" },
          { status: 400 }
        );
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to generate image", details: errorMessage },
      { status: 500 }
    );
  }
}
