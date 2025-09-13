// src/app/api/rt/audio/route.ts
import { rtSessionManager } from "@/lib/realtimeSession";

export const runtime = "nodejs";

function wavHeader(sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); 
  header.writeUInt32LE(0xffffffff, 4); // chunk size unknown (streaming)
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); // PCM format chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24); // sample rate
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (sample rate * channels * bytes per sample)
  header.writeUInt16LE(2, 32); // block align (channels * bytes per sample)
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36); 
  header.writeUInt32LE(0xffffffff, 40); // data chunk size unknown
  return header;
}

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
    
    const stream = new ReadableStream({
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
          try {
            controller.close();
          } catch (error) {
            console.error(`[ERROR] Failed to close audio stream`, { sessionId, error });
          }
        };
        
        const onError = (error: any) => {
          console.error(`[ERROR] Session error in audio stream`, { sessionId, error });
          try {
            controller.enqueue(`event: error\ndata: ${error.message || 'Unknown error'}\n\n`);
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
          } catch (error) {
            console.log(`[DEBUG] Keep-alive failed (stream likely closed)`, { sessionId });
            clearInterval(interval);
          }
        }, 15000);
        
        // Cleanup function
        (controller as any)._cleanup = () => {
          console.log(`[INFO] Cleaning up audio stream`, { sessionId });
          clearInterval(interval);
          manager.off("audio", onAudio);
          manager.off("error", onError);
        };
      },
      cancel() { 
        console.log(`[INFO] Audio stream cancelled`, { sessionId });
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
    console.error(`[ERROR] Failed to create audio stream`, { sessionId, error: error.message });
    return new Response(`event: error\ndata: ${error.message}\n\n`, {
      status: 500,
      headers: { "Content-Type": "text/event-stream" }
    });
  }
}
