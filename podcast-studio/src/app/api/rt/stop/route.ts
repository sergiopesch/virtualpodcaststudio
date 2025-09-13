// src/app/api/rt/stop/route.ts
import { NextResponse } from "next/server";
import { rtSessionManager } from "@/lib/realtimeSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { sessionId = 'default' } = await req.json().catch(() => ({}));
    
    rtSessionManager.removeSession(sessionId);
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Realtime session stopped successfully' 
    });
  } catch (error: any) {
    console.error('Error stopping realtime session:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to stop realtime session' 
    }, { status: 500 });
  }
}
