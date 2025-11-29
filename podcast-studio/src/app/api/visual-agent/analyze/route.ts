import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 15;

interface AnalyzeRequest {
  // New context-aware fields
  userQuestion: string;       // What the user asked
  aiResponse: string;         // The AI's current response
  conversationHistory?: string; // Recent conversation
  paperTitle?: string;        // Paper being discussed
  paperTopic?: string;        // Main topic
  apiKey?: string;
  // Legacy support
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

// Improved system prompt with context-awareness
const SYSTEM_PROMPT = `You are an Expert Visual Explanation Designer. Your job is to identify when a visual animation would SIGNIFICANTLY help explain a complex concept that an AI tutor is describing to a user.

## Your Role
You analyze conversations between a user and an AI tutor discussing research papers. When the AI explains something complex, you design a visual animation that would help the user understand.

## When to Suggest Visuals (BE SELECTIVE)
✅ GENERATE for:
- Multi-step processes or algorithms (e.g., backpropagation, attention mechanism, diffusion process)
- System architectures (e.g., transformer layers, encoder-decoder, neural network structure)
- Data flow and transformations (e.g., how embeddings are created, how gradients flow)
- Mathematical relationships that benefit from geometric visualization
- Comparisons between 3+ components that are hard to track mentally
- Spatial/structural concepts (e.g., latent spaces, attention patterns, feature maps)

❌ DO NOT GENERATE for:
- Simple definitions or explanations
- Lists or enumerations  
- Concepts that are already intuitive
- General overviews or introductions
- Anything easily understood from text alone
- Concepts already visualized earlier in the conversation

## Priority Levels (BE STRICT)
- "high": Complex concept that is VERY difficult to understand without visualization (e.g., how attention weights are computed across tokens)
- "medium": Complex but could be understood with effort from text (e.g., basic neural network forward pass)
- "low": Nice to have but not essential

## Visual Prompt Design
When suggesting a visual, create a DETAILED prompt that:
1. Identifies the KEY ELEMENTS from the AI's explanation
2. Describes SPECIFIC shapes/icons for each concept mentioned
3. Specifies HOW elements connect and flow based on what was explained
4. Describes ANIMATION that shows the process step-by-step
5. Uses COLOR CODING to distinguish different types of elements
6. References SPECIFIC TERMS from the user's question and AI's answer

Respond ONLY in JSON format.`;

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    
    // Support both new context-aware format and legacy format
    const userQuestion = body.userQuestion || "";
    const aiResponse = body.aiResponse || body.transcript || "";
    const conversationHistory = body.conversationHistory || body.recentContext || "";
    const paperTitle = body.paperTitle || "";
    const paperTopic = body.paperTopic || "";
    const apiKey = body.apiKey;

    if (!aiResponse || aiResponse.trim().length < 100) {
      return NextResponse.json({
        shouldGenerate: false,
        reason: "AI response too short for analysis",
      });
    }

    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "OpenAI API key required" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: key });

    // Build a rich, context-aware user prompt
    const userPrompt = buildContextAwarePrompt({
      userQuestion,
      aiResponse,
      conversationHistory,
      paperTitle,
      paperTopic,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({
        shouldGenerate: false,
        reason: "No response from analysis",
      });
    }

    const suggestion: VisualSuggestion = JSON.parse(content);
    
    // Log for monitoring
    if (suggestion.shouldGenerate) {
      console.log("[VISUAL-AGENT] ✓ Visual suggested:", {
        concept: suggestion.concept,
        priority: suggestion.priority,
        visualType: suggestion.visualType,
        userQuestion: userQuestion.slice(0, 50),
      });
    } else {
      console.log("[VISUAL-AGENT] ✗ No visual needed:", suggestion.reason?.slice(0, 50));
    }

    return NextResponse.json(suggestion);
  } catch (error) {
    console.error("[VISUAL-AGENT] Analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze transcript", shouldGenerate: false },
      { status: 500 }
    );
  }
}

/**
 * Build a context-aware prompt that includes:
 * - What the user asked
 * - What the AI is explaining
 * - The paper context
 * - Previous conversation for continuity
 */
function buildContextAwarePrompt(context: {
  userQuestion: string;
  aiResponse: string;
  conversationHistory: string;
  paperTitle: string;
  paperTopic: string;
}): string {
  const { userQuestion, aiResponse, conversationHistory, paperTitle, paperTopic } = context;

  let prompt = "";

  // Add paper context if available
  if (paperTitle || paperTopic) {
    prompt += `## Research Context\n`;
    if (paperTitle) prompt += `Paper: "${paperTitle}"\n`;
    if (paperTopic) prompt += `Topic: ${paperTopic}\n`;
    prompt += `\n`;
  }

  // Add conversation history if available
  if (conversationHistory && conversationHistory.length > 50) {
    prompt += `## Previous Conversation\n`;
    prompt += `${conversationHistory.slice(-500)}\n\n`;
  }

  // Add the current exchange
  prompt += `## Current Exchange\n`;
  
  if (userQuestion) {
    prompt += `**User's Question:** "${userQuestion}"\n\n`;
  }
  
  prompt += `**AI's Explanation:**\n${aiResponse}\n\n`;

  // Add analysis instructions
  prompt += `## Your Task
Analyze this AI explanation in context of what the user asked. Determine if a visual animation would SIGNIFICANTLY help the user understand.

If you suggest a visual:
1. The CONCEPT should be the specific thing from the AI's explanation that needs visualization
2. The PROMPT should describe an animation that directly illustrates what the AI is explaining
3. Reference SPECIFIC TERMS and PROCESSES mentioned in the explanation
4. Design the visual to answer the USER'S QUESTION visually

Respond in JSON:
{
  "shouldGenerate": boolean,
  "concept": "specific concept from the explanation" or null,
  "visualType": "diagram"|"illustration"|"chart"|"animation" or null,
  "prompt": "detailed visual description referencing specific terms from the explanation" or null,
  "reason": "why this visual would (or wouldn't) help answer the user's question",
  "priority": "high"|"medium"|"low" or null
}`;

  return prompt;
}
