// src/app/api/rt/audio-commit/route.ts
import { NextResponse } from "next/server";
import { rtSessionManager } from "@/lib/realtimeSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let sessionId = 'default';
  
  try {
    const { sessionId: reqSessionId = 'default' } = await req.json().catch(() => ({}));
    sessionId = reqSessionId;
    
    console.log(`[DEBUG] Committing audio turn`, { sessionId });
    
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
          console.error(`[ERROR] Session did not reach active state for audio commit`, { sessionId, error: message });
          return NextResponse.json({ error: message, sessionId }, { status: 503 });
        }
      }

      if (status !== 'active') {
        console.log(`[WARN] Session not ready for audio commit`, { sessionId, status });
        return NextResponse.json({
          error: 'Session not ready - start session first',
          status,
          sessionId
        }, { status: 503 });
      }
    }
    
    await manager.commitTurn();
    
    console.log(`[INFO] Audio turn committed successfully`, { sessionId });
    
    return NextResponse.json({ 
      ok: true,
      sessionId,
      message: 'Audio turn committed successfully' 
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to commit audio turn';
    console.error(`[ERROR] Failed to commit audio turn`, {
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
