// src/app/api/rt/start/route.ts
import { NextResponse } from "next/server";
import { rtSessionManager } from "@/lib/realtimeSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const startTime = Date.now();
  let sessionId = 'default';
  
  try {
    // For now, use a simple session ID. In production, extract from JWT/auth
    const body = await req.json().catch(() => ({}));
    sessionId = body.sessionId || 'default';
    
    console.log(`[INFO] Starting session API call`, { sessionId });
    
    const manager = rtSessionManager.getSession(sessionId);
    const currentStatus = manager.getStatus();
    
    console.log(`[INFO] Current session status`, { sessionId, status: currentStatus });
    
    // If already active, return success immediately
    if (currentStatus === 'active') {
      console.log(`[INFO] Session already active`, { sessionId });
      return NextResponse.json({ 
        ok: true, 
        sessionId,
        status: 'active',
        message: 'Session already active' 
      });
    }
    
    // If starting, wait for it to complete
    if (currentStatus === 'starting') {
      console.log(`[INFO] Session already starting, waiting...`, { sessionId });
    }
    
    // Start or wait for session
    await manager.start();
    
    const duration = Date.now() - startTime;
    console.log(`[INFO] Session started successfully`, { sessionId, duration });
    
    return NextResponse.json({ 
      ok: true, 
      sessionId,
      status: 'active',
      duration,
      message: 'Realtime session started successfully' 
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[ERROR] Failed to start session`, { 
      sessionId, 
      duration,
      error: error.message,
      stack: error.stack 
    });
    
    // Determine appropriate HTTP status
    let status = 500;
    let errorMessage = error.message || 'Failed to start realtime session';
    
    if (errorMessage.includes('API_KEY')) {
      status = 503;
      errorMessage = 'OpenAI API configuration error';
    } else if (errorMessage.includes('timeout')) {
      status = 504;
      errorMessage = 'Session connection timeout';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      sessionId,
      duration
    }, { status });
  }
}
