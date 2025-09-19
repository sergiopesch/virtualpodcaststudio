// src/app/api/rt/audio/route.ts
import { rtSessionManager } from "@/lib/realtimeSession";

export const runtime = "nodejs";

export async function GET(req: Request) {
  let sessionId = 'default';
  
  try {
    const url = new URL(req.url);
    sessionId = url.searchParams.get('sessionId') || 'default';
    
    console.log(`[INFO] Starting audio stream`, { sessionId });
    
    const manager = rtSessionManager.getSession(sessionId);
    
    // Don't start session here - it should already be started
    const status = manager.getStatus();
    console.log(`[INFO] Session status for audio stream`, { sessionId, status });
    
    if (status !== 'active') {
      console.log(`[WARN] Session not active for audio stream`, { sessionId, status });
      return new Response(`event: error\ndata: Session not active (status: ${status})\n\n`, {
        status: 503,
        headers: { "Content-Type": "text/event-stream" }
      });
    }
    
    let cleanup: (() => void) | undefined;

    const stream = new ReadableStream<string>({
      start(controller) {
        console.log(`[INFO] Audio stream started`, { sessionId });

        const send = (audioData: Uint8Array) => {
          try {
            // Send audio as base64 in Server-Sent Events format
            const base64 = Buffer.from(audioData).toString('base64');
            const message = `data: ${base64}\n\n`;
            controller.enqueue(message);
            console.log(`[DEBUG] Sent audio data`, { sessionId, size: audioData.length });
          } catch (error) {
            console.error(`[ERROR] Failed to send audio`, { sessionId, error });
          }
        };
        
        const onAudio = (audioData: Uint8Array) => {
          console.log(`[DEBUG] Received audio event`, { sessionId, size: audioData.length });
          send(audioData);
        };
        
        const onClose = () => {
          console.log(`[INFO] Session closed - ending audio stream`, { sessionId });
          cleanup?.();
          try {
            controller.close();
          } catch (error) {
            console.error(`[ERROR] Failed to close audio stream`, { sessionId, error });
          }
        };
        
        const onError = (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[ERROR] Session error in audio stream`, { sessionId, error: message });
          try {
            controller.enqueue(`event: error\ndata: ${message}\n\n`);
          } catch (e) {
            console.error(`[ERROR] Failed to send error to audio stream`, { sessionId, e });
          }
        };

        // Wire up event listeners
        manager.on("audio", onAudio);
        manager.once("close", onClose);
        manager.on("error", onError);
        
        // Send initial connection confirmation
        controller.enqueue(`event: connected\ndata: Audio stream ready\n\n`);
        
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
          console.log(`[INFO] Cleaning up audio stream`, { sessionId });
          clearInterval(interval);
          manager.off("audio", onAudio);
          manager.off("error", onError);
        };
      },
      cancel() {
        console.log(`[INFO] Audio stream cancelled`, { sessionId });
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
    const message = error instanceof Error ? error.message : 'Failed to create audio stream';
    console.error(`[ERROR] Failed to create audio stream`, { sessionId, error: message });
    return new Response(`event: error\ndata: ${message}\n\n`, {
      status: 500,
      headers: { "Content-Type": "text/event-stream" }
    });
  }
}
