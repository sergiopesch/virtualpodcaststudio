// src/app/api/rt/status/route.ts
import { NextResponse } from "next/server";
import { rtSessionManager } from "@/lib/realtimeSession";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId') || 'default';
    
    console.log(`[DEBUG] Status check`, { sessionId });
    
    const manager = rtSessionManager.getSession(sessionId);
    const status = manager.getStatus();
    const isActive = manager.isActive();
    const isStarting = manager.isStarting();
    const config = manager.getConfiguration();

    const response = {
      ok: true,
      sessionId,
      status,
      isActive,
      isStarting,
      activeSessionCount: rtSessionManager.getActiveSessionCount(),
      provider: config.provider,
      hasApiKey: config.hasApiKey,
      model: config.model,
      timestamp: new Date().toISOString()
    };

    console.log(`[DEBUG] Status response`, response);

    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error(`[ERROR] Status check failed`, { 
      error: error.message,
      stack: error.stack 
    });
    
    return NextResponse.json({ 
      error: error.message || 'Failed to check status' 
    }, { status: 500 });
  }
}
