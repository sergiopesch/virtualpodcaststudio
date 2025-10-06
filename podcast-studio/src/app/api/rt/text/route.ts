// src/app/api/rt/text/route.ts
import { NextResponse } from "next/server";
import { rtSessionManager } from "@/lib/realtimeSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let sessionId = 'default';
  
  try {
    const { text, sessionId: reqSessionId = 'default' } = await req.json();
    sessionId = reqSessionId;
    
    if (!text) {
      console.log(`[WARN] Missing text in request`, { sessionId });
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }
    
    console.log(`[DEBUG] Sending text message`, { sessionId, textLength: text.length });
    
    const manager = rtSessionManager.getSession(sessionId);
    let status = manager.getStatus();

    // Check if session is ready
    if (status !== 'active') {
      if (status === 'starting') {
        try {
          await manager.waitUntilReady();
          status = manager.getStatus();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Session failed to become ready';
          console.error(`[ERROR] Session did not reach active state for text message`, { sessionId, error: message });
          return NextResponse.json({ error: message, sessionId }, { status: 503 });
        }
      }

      if (status !== 'active') {
        console.log(`[WARN] Session not ready for text message`, { sessionId, status });
        return NextResponse.json({
          error: 'Session not ready - start session first',
          status,
          sessionId
        }, { status: 503 });
      }
    }
    
    await manager.sendText(text);
    
    console.log(`[INFO] Text message sent successfully`, { sessionId });
    
    return NextResponse.json({ 
      ok: true,
      sessionId,
      textLength: text.length,
      message: 'Text sent successfully' 
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send text';
    console.error(`[ERROR] Failed to send text`, {
      sessionId,
      error: message,
      stack: error instanceof Error ? error.stack : undefined
    });

    let status = 500;
    const errorMessage = message;
    
    if (errorMessage.includes('Session not ready')) {
      status = 503;
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      sessionId 
    }, { status });
  }
}
