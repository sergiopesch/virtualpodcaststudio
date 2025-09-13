// src/app/api/rt/transcripts/route.ts
import { rtSessionManager } from "@/lib/realtimeSession";

export const runtime = "nodejs";

export async function GET(req: Request) {
  let sessionId = 'default';
  
  try {
    const url = new URL(req.url);
    sessionId = url.searchParams.get('sessionId') || 'default';
    
    console.log(`[INFO] Starting transcript stream`, { sessionId });
    
    const manager = rtSessionManager.getSession(sessionId);
    
    // Don't start session here - it should already be started
    const status = manager.getStatus();
    console.log(`[INFO] Session status for transcript stream`, { sessionId, status });
    
    if (status !== 'active') {
      console.log(`[WARN] Session not active for transcript stream`, { sessionId, status });
      return new Response(`event: error\ndata: Session not active (status: ${status})\n\n`, {
        status: 503,
        headers: { "Content-Type": "text/event-stream" }
      });
    }
    
    const stream = new ReadableStream({
      start(controller) {
        console.log(`[INFO] Transcript stream started`, { sessionId });
        
        const send = (text: string) => {
          try {
            const message = `data: ${text}\n\n`;
            controller.enqueue(message);
            console.log(`[DEBUG] Sent transcript`, { sessionId, text });
          } catch (error) {
            console.error(`[ERROR] Failed to send transcript`, { sessionId, error });
          }
        };
        
        const onTranscript = (text: string) => {
          console.log(`[DEBUG] Received transcript event`, { sessionId, text });
          send(text);
        };
        const onDone = () => {
          try {
            controller.enqueue(`event: done\ndata: ok\n\n`);
          } catch (e) {
            console.error(`[ERROR] Failed to send done event`, { sessionId, e });
          }
        };
        
        const onClose = () => {
          console.log(`[INFO] Session closed - ending transcript stream`, { sessionId });
          try {
            controller.close();
          } catch (error) {
            console.error(`[ERROR] Failed to close transcript stream`, { sessionId, error });
          }
        };
        
        const onError = (error: any) => {
          console.error(`[ERROR] Session error in transcript stream`, { sessionId, error });
          try {
            controller.enqueue(`event: error\ndata: ${error.message || 'Unknown error'}\n\n`);
          } catch (e) {
            console.error(`[ERROR] Failed to send error to transcript stream`, { sessionId, e });
          }
        };
        
        // Wire up event listeners
        manager.on("transcript", onTranscript);
        manager.on("assistant_done", onDone);
        manager.once("close", onClose);
        manager.on("error", onError);
        
        // Send initial connection confirmation
        send("Connected to AI transcript stream");
        
        // Keep-alive ping every 15 seconds
        const interval = setInterval(() => {
          try {
            controller.enqueue(`: keep-alive\n\n`);
          } catch (error) {
            console.log(`[DEBUG] Keep-alive failed (stream likely closed)`, { sessionId });
            clearInterval(interval);
          }
        }, 15000);
        
        // Cleanup function
        (controller as any)._cleanup = () => {
          console.log(`[INFO] Cleaning up transcript stream`, { sessionId });
          clearInterval(interval);
          manager.off("transcript", onTranscript);
          manager.off("assistant_done", onDone);
          manager.off("error", onError);
        };
      },
      cancel() { 
        console.log(`[INFO] Transcript stream cancelled`, { sessionId });
        (this as any)._cleanup?.(); 
      }
    });
    
    return new Response(stream, { 
      headers: { 
        "Content-Type": "text/event-stream", 
        "Cache-Control": "no-cache", 
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control"
      } 
    });
    
  } catch (error: any) {
    console.error(`[ERROR] Failed to create transcript stream`, { sessionId, error: error.message });
    return new Response(`event: error\ndata: ${error.message}\n\n`, {
      status: 500,
      headers: { "Content-Type": "text/event-stream" }
    });
  }
}
