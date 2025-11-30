import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 30; // 30 seconds for analysis

type VideoProvider = "openai_sora" | "google_veo";

interface PregenerateRequest {
  paperTitle: string;
  paperAbstract: string;
  paperFullText?: string;
  apiKey?: string;
  maxConcepts?: number; // Default 3
}

interface ConceptForVisualization {
  concept: string;
  keywords: string[]; // Keywords to detect when AI mentions this concept
  prompt: string; // Video generation prompt
  priority: "high" | "medium" | "low";
  reason: string;
}

interface PregenerateResponse {
  success: boolean;
  concepts: ConceptForVisualization[];
  analysisTime: number;
  error?: string;
}

// System prompt for identifying visual concepts from a paper
const SYSTEM_PROMPT = `You are an Expert Visual Education Designer analyzing research papers to identify concepts that MUST be visualized for proper understanding.

## Your Task
Analyze the research paper and identify the TOP 3-5 concepts that are:
1. COMPLEX enough to require visual explanation
2. CENTRAL to the paper's contribution
3. LIKELY to be discussed in a podcast conversation about the paper

## What Makes a Good Visual Concept
✅ GENERATE for:
- Novel algorithms or methods introduced in the paper
- Multi-step processes (e.g., training procedures, inference pipelines)
- Architectural innovations (e.g., new neural network components)
- Data flow and transformations
- Key mathematical relationships that benefit from geometric visualization
- Comparisons between the paper's approach and prior work

❌ SKIP:
- Background concepts well-known in the field
- Simple definitions
- Results/metrics (tables, numbers)
- General ML/AI concepts already widely understood

## Output Format
For each concept, provide:
1. concept: The specific concept name (short, 2-5 words)
2. keywords: 5-10 keywords/phrases that would indicate the AI is explaining this concept
3. prompt: A detailed video animation prompt (describe shapes, colors, motion, flow)
4. priority: "high" (must visualize), "medium" (helpful), or "low" (nice to have)
5. reason: Why this specific concept needs visualization

Respond ONLY in JSON format with a "concepts" array.`;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: PregenerateRequest = await request.json();
    const {
      paperTitle,
      paperAbstract,
      paperFullText,
      apiKey,
      maxConcepts = 3,
    } = body;

    if (!paperTitle || !paperAbstract) {
      return NextResponse.json(
        { error: "Paper title and abstract are required" },
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

    // Build the user prompt with paper content
    const userPrompt = buildPaperAnalysisPrompt({
      title: paperTitle,
      abstract: paperAbstract,
      fullText: paperFullText,
      maxConcepts,
    });

    console.log(`[PREGENERATE] Analyzing paper: "${paperTitle.slice(0, 50)}..."`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Use full GPT-4o for better analysis
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for consistent results
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({
        success: false,
        concepts: [],
        analysisTime: Date.now() - startTime,
        error: "No response from analysis",
      } as PregenerateResponse);
    }

    const parsed = JSON.parse(content);
    const concepts: ConceptForVisualization[] = parsed.concepts || [];

    // Sort by priority and limit
    const sortedConcepts = concepts
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, maxConcepts);

    console.log(`[PREGENERATE] ✓ Found ${sortedConcepts.length} concepts:`, 
      sortedConcepts.map(c => c.concept).join(", ")
    );

    return NextResponse.json({
      success: true,
      concepts: sortedConcepts,
      analysisTime: Date.now() - startTime,
    } as PregenerateResponse);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[PREGENERATE] Error:", errorMessage);
    return NextResponse.json(
      { 
        success: false, 
        concepts: [],
        analysisTime: Date.now() - startTime,
        error: errorMessage,
      } as PregenerateResponse,
      { status: 500 }
    );
  }
}

function buildPaperAnalysisPrompt(params: {
  title: string;
  abstract: string;
  fullText?: string;
  maxConcepts: number;
}): string {
  const { title, abstract, fullText, maxConcepts } = params;

  let prompt = `# Research Paper Analysis

## Paper Title
${title}

## Abstract
${abstract}
`;

  // Include key sections from full text if available (truncated for token efficiency)
  if (fullText && fullText.length > 500) {
    // Extract first ~3000 chars which usually includes intro and method overview
    const introSection = fullText.slice(0, 3000);
    prompt += `
## Paper Content (Introduction/Methods excerpt)
${introSection}...
`;
  }

  prompt += `
## Task
Identify the TOP ${maxConcepts} concepts from this paper that would MOST benefit from visual animation.

For each concept, ensure the "keywords" array contains specific phrases the AI tutor would use when explaining it.

Respond in JSON:
{
  "concepts": [
    {
      "concept": "Concept Name",
      "keywords": ["keyword1", "phrase 1", "technical term", ...],
      "prompt": "Detailed animation description with shapes, colors, motion...",
      "priority": "high",
      "reason": "Why this needs visualization"
    }
  ]
}`;

  return prompt;
}

