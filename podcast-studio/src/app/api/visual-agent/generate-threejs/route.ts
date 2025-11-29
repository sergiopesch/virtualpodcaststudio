import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 30;

interface GenerateRequest {
  prompt: string;
  concept: string;
  visualType: "diagram" | "illustration" | "chart" | "animation";
  apiKey?: string;
}

// Simplified scene configuration for SVG rendering
interface SimpleSceneConfig {
  type: "network" | "flowchart" | "layers" | "graph" | "architecture" | "comparison";
  title: string;
  description: string;
  elements: SimpleElement[];
  connections?: SimpleConnection[];
}

interface SimpleElement {
  id: string;
  type: "box" | "sphere" | "cylinder" | "node";
  label?: string;
  position: [number, number, number];
  size?: [number, number, number];
  color: string;
}

interface SimpleConnection {
  from: string;
  to: string;
  type: "line" | "arrow" | "curve" | "dashed";
  color?: string;
  label?: string;
  animated?: boolean;
}

// System prompt for generating scene configurations
const SYSTEM_PROMPT = `You are a diagram architect. Given a concept that needs visual explanation, generate a JSON configuration for a 2D/3D visualization.

Your output must be valid JSON matching this schema:
{
  "type": "network" | "flowchart" | "layers" | "graph" | "architecture" | "comparison",
  "title": "Short title (max 40 chars)",
  "description": "1-2 sentence description",
  "elements": [
    {
      "id": "unique_id",
      "type": "box" | "sphere" | "node",
      "label": "Short label (max 15 chars)",
      "position": [x, y, z],
      "size": [width, height, depth],
      "color": "#hexcolor"
    }
  ],
  "connections": [
    {
      "from": "element_id",
      "to": "element_id",
      "type": "arrow" | "line" | "dashed",
      "color": "#hexcolor",
      "label": "optional label",
      "animated": true/false
    }
  ]
}

IMPORTANT RULES:
1. Keep it SIMPLE: 4-8 elements maximum
2. Position elements in a grid-like pattern:
   - X axis: -3 to 3 (left to right)
   - Y axis: -2 to 2 (bottom to top)
   - Z axis: 0 (keep flat for 2D)
3. Use meaningful colors:
   - Blue (#3b82f6): inputs, data
   - Green (#22c55e): processing, success
   - Orange (#f97316): outputs, results
   - Purple (#a855f7): attention, focus
   - Red (#ef4444): errors, important
4. Labels should be SHORT (max 15 chars)
5. Connections show flow/relationships
6. Make it self-explanatory

Example for "Attention Mechanism":
{
  "type": "network",
  "title": "Attention Mechanism",
  "description": "Query, Key, Value vectors combine to produce weighted attention",
  "elements": [
    {"id": "q", "type": "sphere", "label": "Query", "position": [-2, 1, 0], "size": [1, 1, 1], "color": "#3b82f6"},
    {"id": "k", "type": "sphere", "label": "Key", "position": [-2, 0, 0], "size": [1, 1, 1], "color": "#22c55e"},
    {"id": "v", "type": "sphere", "label": "Value", "position": [-2, -1, 0], "size": [1, 1, 1], "color": "#f97316"},
    {"id": "attn", "type": "box", "label": "Attention", "position": [0, 0, 0], "size": [1.5, 1.5, 1], "color": "#a855f7"},
    {"id": "out", "type": "sphere", "label": "Output", "position": [2, 0, 0], "size": [1, 1, 1], "color": "#22c55e"}
  ],
  "connections": [
    {"from": "q", "to": "attn", "type": "arrow", "color": "#3b82f6"},
    {"from": "k", "to": "attn", "type": "arrow", "color": "#22c55e"},
    {"from": "v", "to": "attn", "type": "arrow", "color": "#f97316"},
    {"from": "attn", "to": "out", "type": "arrow", "color": "#a855f7", "animated": true}
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { prompt, concept, visualType, apiKey } = body;

    if (!prompt || !concept) {
      return NextResponse.json(
        { error: "Prompt and concept are required" },
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

    console.log("[VISUAL-AGENT] Generating scene for:", concept);

    const startTime = Date.now();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Generate a simple visualization for this concept:

Concept: ${concept}
Type: ${visualType}
Details: ${prompt}

Keep it SIMPLE with 4-8 elements. Output ONLY valid JSON.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No response from scene generator" },
        { status: 500 }
      );
    }

    let sceneConfig: SimpleSceneConfig;
    try {
      sceneConfig = JSON.parse(content);
    } catch (e) {
      console.error("[VISUAL-AGENT] Failed to parse scene config:", e);
      return NextResponse.json(
        { error: "Failed to parse scene configuration" },
        { status: 500 }
      );
    }

    // Validate and sanitize the scene config
    if (!sceneConfig.elements || !Array.isArray(sceneConfig.elements)) {
      sceneConfig.elements = [];
    }

    // Ensure all elements have valid positions
    sceneConfig.elements = sceneConfig.elements.map((el, idx) => ({
      ...el,
      id: el.id || `element_${idx}`,
      type: el.type || "node",
      position: Array.isArray(el.position) && el.position.length >= 3 
        ? [Number(el.position[0]) || 0, Number(el.position[1]) || 0, Number(el.position[2]) || 0] as [number, number, number]
        : [0, 0, 0] as [number, number, number],
      size: Array.isArray(el.size) && el.size.length >= 3
        ? [Number(el.size[0]) || 1, Number(el.size[1]) || 1, Number(el.size[2]) || 1] as [number, number, number]
        : [1, 1, 1] as [number, number, number],
      color: el.color || "#6366f1",
    }));

    // Ensure connections reference valid elements
    if (sceneConfig.connections && Array.isArray(sceneConfig.connections)) {
      const elementIds = new Set(sceneConfig.elements.map(e => e.id));
      sceneConfig.connections = sceneConfig.connections.filter(
        conn => conn.from && conn.to && elementIds.has(conn.from) && elementIds.has(conn.to)
      );
    }

    // Ensure required fields
    sceneConfig.type = sceneConfig.type || "diagram";
    sceneConfig.title = sceneConfig.title || concept;
    sceneConfig.description = sceneConfig.description || `Visualization of ${concept}`;

    console.log(`[VISUAL-AGENT] Validated scene with ${sceneConfig.elements.length} elements`);

    // Generate a summary for the AI to reference
    const elementsList = sceneConfig.elements.length > 0 
      ? sceneConfig.elements.map(e => e.label || e.type).join(", ")
      : "basic shapes";

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You help an AI podcast host reference a visualization. Generate a brief (1 sentence) description of what the diagram shows. Be specific. Do NOT use phrases like "The visualization shows" - describe it directly.`,
        },
        {
          role: "user",
          content: `Concept: ${concept}
Scene type: ${sceneConfig.type}
Elements: ${elementsList}
Description: ${sceneConfig.description}

Generate a 1-sentence description.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 60,
    });

    const visualSummary = summaryResponse.choices[0]?.message?.content || 
      `A ${sceneConfig.type} showing ${concept}`;

    const elapsed = Date.now() - startTime;
    console.log(`[VISUAL-AGENT] Scene generated in ${elapsed}ms`);
    console.log(`[VISUAL-AGENT] Summary: "${visualSummary}"`);

    return NextResponse.json({
      success: true,
      sceneConfig,
      concept,
      visualType,
      visualSummary,
      generationTime: elapsed,
    });
  } catch (error: any) {
    console.error("[VISUAL-AGENT] Generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate scene", details: error?.message },
      { status: 500 }
    );
  }
}
