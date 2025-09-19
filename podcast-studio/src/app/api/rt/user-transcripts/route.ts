// src/app/api/rt/user-transcripts/route.ts
import { rtSessionManager } from "@/lib/realtimeSession";

export const runtime = "nodejs";

export async function GET(req: Request) {
  let sessionId = 'default';
  
  try {
    const url = new URL(req.url);
    sessionId = url.searchParams.get('sessionId') || 'default';
    
    console.log(`[INFO] Starting user transcript stream`, { sessionId });
    
    const manager = rtSessionManager.getSession(sessionId);
    
    // Don't start session here - it should already be started
    const status = manager.getStatus();
    console.log(`[INFO] Session status for user transcript stream`, { sessionId, status });
    
    if (status !== 'active') {
      console.log(`[WARN] Session not active for user transcript stream`, { sessionId, status });
      return new Response(`event: error\ndata: Session not active (status: ${status})\n\n`, {
        status: 503,
        headers: { "Content-Type": "text/event-stream" }
      });
    }
    
    let cleanup: (() => void) | undefined;

    const stream = new ReadableStream<string>({
      start(controller) {
        console.log(`[INFO] User transcript stream started`, { sessionId });
        
        const send = (text: string, type: 'complete' | 'delta' = 'complete') => {
          try {
            const message = `event: ${type}\ndata: ${text}\n\n`;
            controller.enqueue(message);
            console.log(`[DEBUG] Sent user transcript ${type}`, { sessionId, text });
          } catch (error) {
            console.error(`[ERROR] Failed to send user transcript`, { sessionId, error });
          }
        };
        
        const onUserTranscript = (text: string) => {
          console.log(`[DEBUG] Received user transcript event`, { sessionId, text });
          send(text, 'complete');
        };

        const onUserTranscriptDelta = (text: string) => {
          console.log(`[DEBUG] Received user transcript delta`, { sessionId, text });
          send(text, 'delta');
        };
        
        const onClose = () => {
          console.log(`[INFO] Session closed - ending user transcript stream`, { sessionId });
          cleanup?.();
          try {
            controller.close();
          } catch (error) {
            console.error(`[ERROR] Failed to close user transcript stream`, { sessionId, error });
          }
        };

        const onError = (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[ERROR] Session error in user transcript stream`, { sessionId, error: message });
          try {
            controller.enqueue(`event: error\ndata: ${message}\n\n`);
          } catch (e) {
            console.error(`[ERROR] Failed to send error to user transcript stream`, { sessionId, e });
          }
        };
        
        // Wire up event listeners
        manager.on("user_transcript", onUserTranscript);
        manager.on("user_transcript_delta", onUserTranscriptDelta);
        manager.once("close", onClose);
        manager.on("error", onError);
        
        // Send initial connection confirmation
        send("Connected to user transcript stream", 'complete');
        
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
          console.log(`[INFO] Cleaning up user transcript stream`, { sessionId });
          clearInterval(interval);
          manager.off("user_transcript", onUserTranscript);
          manager.off("user_transcript_delta", onUserTranscriptDelta);
          manager.off("error", onError);
        };
      },
      cancel() {
        console.log(`[INFO] User transcript stream cancelled`, { sessionId });
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
    const message = error instanceof Error ? error.message : 'Failed to create user transcript stream';
    console.error(`[ERROR] Failed to create user transcript stream`, { sessionId, error: message });
    return new Response(`event: error\ndata: ${message}\n\n`, {
      status: 500,
      headers: { "Content-Type": "text/event-stream" }
    });
  }
}
