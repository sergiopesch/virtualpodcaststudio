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
    let status = manager.getStatus();
    console.log(`[INFO] Session status for transcript stream`, { sessionId, status });

    if (status !== 'active') {
      if (status === 'starting') {
        try {
          await manager.waitUntilReady();
          status = manager.getStatus();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Session failed to become ready';
          console.error(`[ERROR] Session did not reach active state for transcript stream`, { sessionId, error: message });
          return new Response(`event: error\ndata: ${message}\n\n`, {
            status: 503,
            headers: { "Content-Type": "text/event-stream" }
          });
        }
      }

      if (status !== 'active') {
        console.log(`[WARN] Session not active for transcript stream`, { sessionId, status });
        return new Response(`event: error\ndata: Session not active (status: ${status})\n\n`, {
          status: 503,
          headers: { "Content-Type": "text/event-stream" }
        });
      }
    }
    
    let cleanup: (() => void) | undefined;

    const stream = new ReadableStream<string>({
      start(controller) {
        console.log(`[INFO] Transcript stream started`, { sessionId });
        
        const send = (text: string) => {
          try {
            const lines = `${text}`.split(/\r?\n/);
            const payload = lines.map((line) => `data: ${line}`).join("\n");
            controller.enqueue(`${payload}\n\n`);
            // Skip per-delta logging for performance
          } catch (error) {
            console.error(`[ERROR] Failed to send transcript`, { sessionId, error });
          }
        };
        
        const onTranscript = (text: string) => {
          // Skip per-delta logging for performance
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
          cleanup?.();
          try {
            controller.close();
          } catch (error) {
            console.error(`[ERROR] Failed to close transcript stream`, { sessionId, error });
          }
        };
        
        const onError = (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[ERROR] Session error in transcript stream`, { sessionId, error: message });
          try {
            controller.enqueue(`event: error\ndata: ${message}\n\n`);
          } catch (e) {
            console.error(`[ERROR] Failed to send error to transcript stream`, { sessionId, e });
          }
        };
        
        // Wire up event listeners
        manager.on("transcript", onTranscript);
        manager.on("assistant_done", onDone);
        manager.once("close", onClose);
        manager.on("error", onError);
        
        // Send initial connection confirmation as an SSE comment so the client ignores it
        controller.enqueue(`: connected\n\n`);
        
        // Keep-alive ping every 15 seconds
        const interval = setInterval(() => {
          try {
            controller.enqueue(`: keep-alive\n\n`);
          } catch {
            console.log(`[DEBUG] Keep-alive failed (stream likely closed)`, { sessionId });
            clearInterval(interval);
          }
        }, 15000);

        cleanup = () => {
          console.log(`[INFO] Cleaning up transcript stream`, { sessionId });
          clearInterval(interval);
          manager.off("transcript", onTranscript);
          manager.off("assistant_done", onDone);
          manager.off("error", onError);
          manager.off("close", onClose);
        };
      },
      cancel() {
        console.log(`[INFO] Transcript stream cancelled`, { sessionId });
        cleanup?.();
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
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create transcript stream';
    console.error(`[ERROR] Failed to create transcript stream`, { sessionId, error: message });
    return new Response(`event: error\ndata: ${message}\n\n`, {
      status: 500,
      headers: { "Content-Type": "text/event-stream" }
    });
  }
}
