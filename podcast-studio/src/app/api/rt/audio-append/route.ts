// src/app/api/rt/audio-append/route.ts
import { NextResponse } from "next/server";
import { rtSessionManager } from "@/lib/realtimeSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let sessionId = 'default';
  
  try {
    const { base64, sessionId: reqSessionId = 'default' } = await req.json();
    sessionId = reqSessionId;
    
    if (!base64) {
      console.log(`[WARN] Missing base64 audio data`, { sessionId });
      return NextResponse.json({ error: 'Base64 audio data is required' }, { status: 400 });
    }
    
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
          console.error(`[ERROR] Session did not reach active state for audio append`, { sessionId, error: message });
          return NextResponse.json({ error: message, sessionId }, { status: 503 });
        }
      }

      if (status !== 'active') {
        console.log(`[WARN] Session not ready for audio append`, { sessionId, status });
        return NextResponse.json({
          error: 'Session not ready - start session first',
          status,
          sessionId
        }, { status: 503 });
      }
    }
    
    const buf = Buffer.from(base64, "base64");
    // Skip per-chunk logging - too noisy, slows down audio pipeline
    await manager.appendPcm16(new Uint8Array(buf));
    
    return NextResponse.json({ 
      ok: true,
      sessionId,
      chunkSize: buf.length,
      message: 'Audio chunk appended successfully' 
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to append audio';
    console.error(`[ERROR] Failed to append audio`, {
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
