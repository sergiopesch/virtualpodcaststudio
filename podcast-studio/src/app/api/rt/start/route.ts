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

    const provider: 'openai' | 'google' =
      typeof body.provider === 'string' && body.provider.toLowerCase() === 'google'
        ? 'google'
        : 'openai';
    const incomingKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    const resolvedKey = provider === 'openai'
      ? incomingKey || process.env.OPENAI_API_KEY || ''
      : incomingKey;
    const model = typeof body.model === 'string' ? body.model.trim() : undefined;

    if (!resolvedKey) {
      const label = provider === 'openai' ? 'OpenAI' : 'Google';
      return NextResponse.json({
        error: `Missing API key for ${label}`,
        sessionId,
      }, { status: 400 });
    }

    const configChanged = manager.configure({ provider, apiKey: resolvedKey, model });

    console.log(`[INFO] Current session status`, {
      sessionId,
      status: currentStatus,
      provider,
      configChanged,
    });

    if (currentStatus === 'active' && !configChanged) {
      console.log(`[INFO] Session already active with same configuration`, { sessionId });
      return NextResponse.json({
        ok: true,
        sessionId,
        status: 'active',
        message: 'Session already active',
        provider,
      });
    }

    if (currentStatus === 'active' && configChanged) {
      console.log(`[INFO] Configuration changed, restarting session`, { sessionId, provider });
      await manager.stop();
    }

    if (manager.getStatus() === 'starting') {
      console.log(`[INFO] Session already starting, waiting...`, { sessionId, provider });
    }

    await manager.start();

    const duration = Date.now() - startTime;
    console.log(`[INFO] Session started successfully`, { sessionId, duration, provider });

    return NextResponse.json({
      ok: true,
      sessionId,
      status: 'active',
      duration,
      provider,
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
