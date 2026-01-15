import { NextRequest, NextResponse } from "next/server";
import { rtSessionManager } from "@/lib/realtimeSession";

export const runtime = "nodejs";

interface InjectContextRequest {
  sessionId: string;
  context: string;
  type: "visual_ready" | "system_message" | "user_context";
}

/**
 * Injects context into an active realtime session.
 * This allows the Visual Agent to notify the AI when a visual is ready,
 * so the AI can naturally reference it in the conversation.
 */
export async function POST(request: NextRequest) {
  try {
    const body: InjectContextRequest = await request.json();
    const { sessionId, context, type } = body;

    console.log(`[INJECT-CONTEXT] Request received`, { sessionId, type, contextLength: context?.length });

    if (!sessionId || !context) {
      console.log(`[INJECT-CONTEXT] Missing required fields`);
      return NextResponse.json(
        { error: "sessionId and context are required" },
        { status: 400 }
      );
    }

    const manager = rtSessionManager.getExistingSession(sessionId);
    if (!manager) {
      console.log(`[INJECT-CONTEXT] Session not found: ${sessionId}`);
      // This is not necessarily an error - the session might have ended
      return NextResponse.json(
        { error: "Session not found", warning: "Session may have ended" },
        { status: 404 }
      );
    }

    if (!manager.isActive()) {
      console.log(`[INJECT-CONTEXT] Session not active: ${sessionId}`);
      return NextResponse.json(
        { error: "Session not active", warning: "Session is no longer active" },
        { status: 400 }
      );
    }

    // Check if the injectContext method exists (handles hot reload issues)
    if (typeof manager.injectContext !== 'function') {
      console.error(`[INJECT-CONTEXT] injectContext method not found on manager - likely hot reload issue`);
      return NextResponse.json(
        { 
          error: "Server needs restart", 
          warning: "The server encountered a hot reload issue. Please restart the dev server." 
        },
        { status: 500 }
      );
    }

    // Inject the context into the session's instructions
    // The RTManager will update its instructions and push a session.update
    try {
      const success = await manager.injectContext(context);

      if (success) {
        console.log(`[INJECT-CONTEXT] ✓ Successfully injected ${type} context to session ${sessionId}`);
        return NextResponse.json({ success: true });
      } else {
        console.warn(`[INJECT-CONTEXT] ✗ Failed to inject context to session ${sessionId} - method returned false`);
        return NextResponse.json(
          { error: "Failed to inject context - session may not be ready", success: false },
          { status: 200 } // Return 200 but with success: false - visual still works
        );
      }
    } catch (injectError: unknown) {
      console.error(`[INJECT-CONTEXT] Error calling injectContext:`, injectError);
      const errorMessage = injectError instanceof Error ? injectError.message : String(injectError);
      return NextResponse.json(
        { 
          error: "Error during context injection", 
          details: errorMessage,
          success: false 
        },
        { status: 200 } // Return 200 but with success: false - visual still works
      );
    }
  } catch (error: unknown) {
    console.error("[INJECT-CONTEXT] Unhandled error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to inject context", details: errorMessage },
      { status: 500 }
    );
  }
}
