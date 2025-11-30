import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 15;

interface AnalyzeRequest {
  userQuestion: string;
  aiResponse: string;
  conversationHistory?: string;
  paperTitle?: string;
  paperTopic?: string;
  apiKey?: string;
  transcript?: string;
  recentContext?: string;
}

interface VisualSuggestion {
  shouldGenerate: boolean;
  concept: string | null;
  visualType: "diagram" | "illustration" | "chart" | "animation" | null;
  prompt: string | null;
  reason: string;
  priority: "high" | "medium" | "low" | null;
}

// System prompt focused on creating visuals that DIRECTLY ENHANCE understanding
// Optimized for SELECTIVE, HIGH-VALUE visual generation
const SYSTEM_PROMPT = `You are a Visual Education Director for a science podcast. Your job is to identify the RARE moments when a visual would dramatically enhance understanding.

## STRICT Criteria - Only Generate When:

✅ GENERATE for these HIGH-VALUE moments:
1. **Complex Mechanisms** - The AI explains HOW something works step-by-step (e.g., "the virus binds to the receptor, then...")
2. **Spatial/Structural Concepts** - Architecture, molecular structures, neural networks, flow diagrams
3. **Dynamic Processes** - Things that change over time, feedback loops, cascading effects
4. **Counter-intuitive Ideas** - When the explanation might be confusing without a visual aid
5. **Rich Metaphors Used by AI** - If the AI says "like a lock and key" or "imagine a waterfall" - visualize it!

❌ NEVER Generate for:
- Simple facts or definitions ("X is defined as...")
- Historical context or background info
- Opinions, conclusions, or summaries
- When the AI is just agreeing or asking questions
- Concepts that are inherently abstract with no visual form
- Short responses under 100 words (not enough substance)

## Quality Prompt Guidelines

Write prompts that are:
1. **SPECIFIC** - Describe exactly what appears on screen, not vague concepts
2. **CINEMATIC** - Camera movements, lighting, atmosphere
3. **MOTION-FOCUSED** - Use verbs: flowing, expanding, connecting, transforming
4. **CONCISE** - Under 60 words for fastest generation
5. **NO TEXT** - Never ask for labels, titles, or words in the visual

Style: High-end documentary, photorealistic CGI, or elegant 3D scientific visualization.

EXAMPLE:
AI says: "The CRISPR system works like molecular scissors - the guide RNA finds the target DNA sequence, then Cas9 cuts both strands"
→ shouldGenerate: true
→ concept: "CRISPR Mechanism"  
→ prompt: "Photorealistic molecular animation: A glowing RNA strand (guide) winds through a double helix until it locks onto a matching sequence. A Cas9 protein scissors mechanism opens and precisely cuts through both DNA strands. Blue bioluminescent glow, cinematic macro lens."
→ priority: "high"

Respond ONLY with valid JSON. Be SELECTIVE - most explanations do NOT need visuals.`;

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    
    const userQuestion = body.userQuestion || "";
    const aiResponse = body.aiResponse || body.transcript || "";
    const paperTitle = body.paperTitle || "";
    const apiKey = body.apiKey || process.env.OPENAI_API_KEY;

    // Need substantial content to analyze - short responses rarely need visuals
    if (!aiResponse || aiResponse.trim().length < 120) {
      return NextResponse.json({
        shouldGenerate: false,
        reason: "Response too short for meaningful visual",
      });
    }

    // Quick heuristic checks before calling LLM
    const lowerResponse = aiResponse.toLowerCase();
    
    // Skip if it's just agreement or meta-commentary
    const skipPatterns = [
      /^(yes|no|exactly|right|correct|i agree|that's right)/i,
      /^(great question|good point|let me|i think)/i,
      /what (else )?would you like/i,
      /any (other )?questions/i,
    ];
    
    if (skipPatterns.some(p => p.test(aiResponse.trim()))) {
      return NextResponse.json({
        shouldGenerate: false,
        reason: "Meta-commentary or simple response",
      });
    }

    // Boost priority for explanations with visual/spatial language
    const hasVisualLanguage = /\b(structure|mechanism|process|flow|layer|connect|bind|transform|split|merge|network|pathway|cycle)\b/i.test(lowerResponse);
    const hasMetaphor = /\b(like a|imagine|think of it as|similar to|acts as|works like)\b/i.test(lowerResponse);

    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    // Build focused prompt with context hints
    const contextHints = [];
    if (hasVisualLanguage) contextHints.push("Contains spatial/structural language");
    if (hasMetaphor) contextHints.push("Contains metaphor that could be visualized");
    
    const userPrompt = `## Context
${paperTitle ? `Paper: "${paperTitle}"` : ''}
${contextHints.length > 0 ? `Hints: ${contextHints.join(", ")}` : ''}

## User Question
"${userQuestion || 'Continuing the discussion...'}"

## AI Explanation (analyze this)
${aiResponse.slice(-500)}

## Decision Required
Is this explanation COMPLEX ENOUGH to benefit from a visual? 
Most explanations do NOT need visuals. Only say yes for mechanisms, processes, structures, or vivid metaphors.

Respond with JSON:
{
  "shouldGenerate": true/false,
  "concept": "2-4 word concept name" or null,
  "visualType": "animation",
  "prompt": "Cinematic description with MOTION. Under 60 words." or null,
  "reason": "Why this visual helps (or why not needed)",
  "priority": "high" (essential) | "medium" (helpful) | "low" (nice-to-have)
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // Lower temperature for more consistent decisions
      max_tokens: 250,  // Reduced for faster response
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({
        shouldGenerate: false,
        reason: "No response from analysis",
      });
    }

    const suggestion: VisualSuggestion = JSON.parse(content);
    
    // Log decision
    if (suggestion.shouldGenerate) {
      console.log(`[VISUAL] ✓ Creating visual: "${suggestion.concept}" (${suggestion.priority})`);
    } else {
      console.log(`[VISUAL] ✗ Skipped: ${suggestion.reason?.slice(0, 50)}`);
    }

    return NextResponse.json(suggestion);
  } catch (error) {
    console.error("[VISUAL] Analysis error:", error);
    return NextResponse.json(
      { error: "Analysis failed", shouldGenerate: false },
      { status: 500 }
    );
  }
}
