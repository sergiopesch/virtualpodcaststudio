# Visual Agent API Routes – Agent Guide

## Overview

The Visual Agent is a background system that analyzes conversations and generates **video visualizations**
using AI video providers to help users understand complex concepts. Videos are rendered inline
below the AI's text response.

**Supported Video Providers:**

- **Google Veo 3.0** (Implemented) - High-quality video generation via Gemini API
- **OpenAI Sora** - Not currently implemented (planned for future)

All providers fall back to **DALL-E 3** for static image generation when video fails.

```text
src/app/api/visual-agent/
├── analyze/route.ts           # Analyzes transcript to detect visual opportunities
├── generate-video/route.ts    # Multi-provider video generation
└── AGENT.md                   # This guide
```

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CONVERSATION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Dr. Sarah: "Transformers use attention mechanisms to weigh..."             │
│       │                                                                      │
│       ├──► Visual Agent: Detects complex concept                            │
│       │    └──► Generates 3s video via Google Veo 3                         │
│       │        (Falls back to DALL-E 3 image if video fails)                │
│       │                                                                      │
│  ┌────────────────────────────────────────────────────────────┐             │
│  │  🎬 Attention Mechanism                              [▶️] │             │
│  │  ┌─────────────────────────────────────────────────────┐  │             │
│  │  │  [3-second animated video explaining the concept]  │  │             │
│  │  └─────────────────────────────────────────────────────┘  │             │
│  │  Generated in 8.2s via Google Veo                         │             │
│  └────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  Dr. Sarah: "As you can see in the visualization, the attention..."         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## User Settings

Users can configure video generation in **Workspace Settings**:

1. **Video Model Selector** - Currently only Google Veo 3 is available:
   - Google Veo 3 (Implemented)
   - OpenAI Sora (Not yet implemented)

2. **API Keys**:
   - **OpenAI API key** (required for voice, text, and Sora video)
   - **Google API key** (required for Veo 3 video)

The selected video provider determines which API key is used for video generation.

## Context-Aware Prompt Architecture

The Visual Agent uses a **two-stage context-aware prompting system**:

### Stage 1: Analysis (GPT-4o-mini)

Analyzes the full conversation context to decide if a visual is needed:

```text
┌─────────────────────────────────────────────────────────────┐
│ CONTEXT PASSED TO ANALYSIS                                  │
├─────────────────────────────────────────────────────────────┤
│ • Paper Title: "Attention Is All You Need"                  │
│ • Paper Topic: (from abstract)                              │
│ • Conversation History: Last 3 exchanges                    │
│ • User's Question: "How does attention work?"               │
│ • AI's Response: "The attention mechanism computes..."      │
└─────────────────────────────────────────────────────────────┘
```

### Stage 2: Video Generation

The prompt from analysis is enhanced with context:

```text
┌─────────────────────────────────────────────────────────────┐
│ VIDEO PROMPT INCLUDES                                       │
├─────────────────────────────────────────────────────────────┤
│ • The user's original question                              │
│ • Key technical terms extracted from AI's explanation       │
│ • Paper context (if discussing a paper)                     │
│ • Detailed visual description from Stage 1                  │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### `/api/visual-agent/analyze` (POST)

Analyzes transcript with full conversation context.

```typescript
// Request (Context-Aware)
{
  "userQuestion": "How does the attention mechanism work?",
  "aiResponse": "The attention mechanism computes weighted sums...",
  "conversationHistory": "User: What is a transformer?\nAI: A transformer is...",
  "paperTitle": "Attention Is All You Need",
  "paperTopic": "Self-attention for sequence modeling",
  "apiKey": "sk-..."
}

// Response
{
  "shouldGenerate": true,
  "concept": "Attention Weight Computation",
  "visualType": "animation",
  "prompt": "Show query vectors (blue spheres) and key vectors (green spheres) 
            computing dot products. Animate softmax normalization with flowing 
            particles showing probability distribution. Connect to value vectors 
            (orange) with weighted arrows showing the final attention output...",
  "reason": "User asked about attention mechanism, AI is explaining weighted sums - 
            this is much clearer with animation showing the flow",
  "priority": "high"
}
```

### `/api/visual-agent/generate-video` (POST) ⭐ PRIMARY

Generates a video using the selected provider with DALL-E 3 fallback.

**Request:**

```typescript
{
  "prompt": "Educational diagram animation explaining attention mechanism...",
  "concept": "Attention Mechanism",
  "openaiApiKey": "sk-...",      // For Sora & DALL-E fallback
  "googleApiKey": "AIza...",     // For Veo (if provided, Veo is tried first)
  "apiKey": "sk-...",            // Alternative OpenAI key (fallback)
  "userQuestion": "How does attention work?", // Optional context
  "aiResponse": "The attention mechanism...", // Optional context
  "paperTitle": "Attention Is All You Need"  // Optional context
}
```

**Note:** The provider is determined automatically:

- If `googleApiKey` is provided, Google Veo 3 is tried first
- If Veo fails or no Google key, falls back to DALL-E 3 (requires OpenAI key)
- OpenAI Sora is not currently implemented in this endpoint

**Response (Video success):**

```typescript
{
  "success": true,
  "videoUrl": "data:video/mp4;base64,...", // Base64-encoded video or URL
  "concept": "Attention Mechanism",
  "visualSummary": "Animated visualization: Attention Mechanism",
  "generationTime": 12000,
  "fallback": false,
  "provider": "google_veo",
  "isProxied": true, // true if base64, false if external URL
  "modelUsed": "veo-3.0-generate-preview"
}
```

**Response (DALL-E 3 fallback):**

```typescript
{
  "success": true,
  "videoUrl": "data:image/png;base64,...", // Static image as base64
  "concept": "Attention Mechanism",
  "visualSummary": "Diagram illustrating Attention Mechanism",
  "generationTime": 3500,
  "fallback": true,
  "provider": "dall-e-3",
  "isProxied": true,
  "modelUsed": "dall-e-3"
}
```

## Provider Configuration

### Google Veo 3.0 (Recommended)

| Setting | Value | Reason |
| ------- | ----- | ------ |
| Model | `veo-3.0-generate-preview` | Latest Veo 3 model (~10-20s) |
| Duration | 3 seconds | Shorter = faster generation |
| Resolution | 720p | Standard for Veo 3 |
| Aspect Ratio | 16:9 | Widescreen display |

> **Speed optimization** — The `/api/visual-agent/generate-video` endpoint uses `veo-3.0-generate-preview` for fastest generation (~10-20s). Falls back to `veo-2.0-generate-001` if unavailable, then to Imagen 3 for image fallback.

**API Endpoints:**

- Primary: `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview:generateContent`
- Fallback: `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview:predictLongRunning`

**Features:**

- High-quality video output
- Supports person generation controls
- Long-running operation with polling

### OpenAI Sora

> **Note:** Sora is not currently implemented in the codebase. The endpoint only supports Google Veo 3 with DALL-E 3 fallback.

**Planned Implementation:**

- Model: `sora` (when available)
- Duration: 4 seconds
- Resolution: 480p
- API Endpoint: `https://api.openai.com/v1/videos/generations`

**Current Status:** Only Google Veo 3 is implemented. All video generation uses Veo 3, falling back to DALL-E 3 images if video generation fails.

## Cost & Speed Optimization

| Provider | Estimated Cost | Duration | Generation Time | Status |
| -------- | -------------- | -------- | --------------- | ------ |
| Google Veo 3 | ~$0.10-0.25 | 3s | ~10-20s | ✅ Implemented |
| OpenAI Sora | ~$0.40 (4s × $0.10/s) | 4s | ~30-60s | ❌ Not implemented |
| DALL-E 3 fallback | ~$0.04 | static | ~3-5s | ✅ Implemented |
| Analysis (GPT-4o-mini) | ~$0.001 | N/A | ~1-2s | ✅ Implemented |

**Cost Controls in `useVisualAgent`:**

- `minSecondsBetweenVisuals`: 20 seconds (rate limiting, default)
- `onlyHighPriority`: true (only generate for complex concepts)
- Concept deduplication (avoid regenerating similar visuals)

## Frontend Components

### VisualCard Component

Supports both video and image display:

```tsx
import { VisualCard } from "@/components/visual-agent/VisualCard";

<VisualCard 
  visual={visual} 
  onDismiss={() => removeVisual(id)}
  compact // For inline display below AI message
/>
```

Features:

- **Auto-play on loop** - Videos play automatically like GIFs
- Video playback with play/pause controls
- Mute/unmute toggle
- Fullscreen expansion
- Loading states with spinner
- Error handling with retry option
- Fallback image support
- Generation time display

### useVisualAgent Hook

```typescript
const {
  visuals,
  isAnalyzing,
  isGenerating,
  analyzeTranscript,
  removeVisual,
  reset,
} = useVisualAgent({
  enabled: true,
  apiKey: "sk-...",              // OpenAI for analysis
  sessionId: "session_123",      // Required for context injection
  minTranscriptLength: 150,
  minSecondsBetweenVisuals: 20,
  onlyHighPriority: true,
  // Multi-provider settings
  videoProvider: "google_veo",   // Currently only "google_veo" is supported
  openaiApiKey: "sk-...",        // For DALL-E fallback
  googleApiKey: "AIza...",       // For Veo 3
});
```

## Inline Rendering

Visuals are rendered **inline below the AI message** that triggered them:

```tsx
// In studio/page.tsx
{entries.map((entry, entryIndex) => {
  // Find visuals for this AI message
  const entryVisuals = !isHost ? visuals.filter(v => {
    const afterThis = v.timestamp >= entry.startedAt;
    const beforeNext = !nextEntry || v.timestamp < nextEntry.startedAt;
    return afterThis && beforeNext;
  }) : [];

  return (
    <div key={entry.id}>
      {/* AI message bubble */}
      <div className="message-bubble">{entry.text}</div>
      
      {/* Visuals rendered inline below */}
      {entryVisuals.map(visual => (
        <VisualCard key={visual.id} visual={visual} compact />
      ))}
    </div>
  );
})}
```

## AI Context Injection

When a visual is ready, the Visual Agent injects context to the AI so it can reference the visual:

```typescript
// In realtimeSession.ts
private pendingVisualContext: string | null = null;

async injectContext(context: string): Promise<boolean> {
  this.pendingVisualContext = context;
  this.pushSessionUpdate(); // Updates AI instructions
  return true;
}

// buildInstructions() includes:
if (this.pendingVisualContext) {
  baseInstructions += `
=== VISUAL NOTIFICATION ===
An interactive visualization has just appeared on the user's screen.
Visual Details: ${this.pendingVisualContext}
IMPORTANT: In your NEXT response, briefly acknowledge this visual.
=== END VISUAL NOTIFICATION ===`;
}
```

## Testing

1. Start a live session with a research paper
2. Configure your preferred video provider in Workspace Settings
3. Ask about a complex concept: *"Explain how attention mechanisms work"*
4. Watch for:
   - Status shows "Generating video..."
   - Video/image appears inline below AI message
   - AI references the visual in its response
5. Click play to watch the video (or view the fallback image)
6. Click expand for fullscreen view

## Troubleshooting

### Video not playing

- Check browser console for media errors
- Verify the video URL is accessible
- Check if the browser supports the video format

### Provider-specific issues

**Google Veo:**

- Ensure you have Gemini API access with video generation enabled
- Check your Google AI Studio API key is valid
- Check for `google_veo` in server logs

**OpenAI Sora:**

- Sora is not currently implemented in the codebase
- Only Google Veo 3 is supported for video generation
- All requests fall back to DALL-E 3 if video generation fails

### Fallback to image

- All providers may fall back to DALL-E 3 if video generation fails
- The `fallback: true` flag indicates image mode
- DALL-E requires an OpenAI API key

### AI doesn't reference the visual

- Check server logs for context injection
- Verify `sessionId` is passed to `useVisualAgent`
- Look for `[VISUAL NOTIFICATION]` in AI instructions

### Generation takes too long

- Google Veo 3.0 typically generates in 10-20 seconds
- If taking longer, check your API key has Veo access enabled
- The UI shows "Generating video..." during this time
- DALL-E fallback is faster (~3-5 seconds) if video fails
- Video duration is set to 3 seconds for faster generation
