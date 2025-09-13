# OpenAI Realtime API — Track B (WebSocket, Next.js Local) Implementation Guide

This document adapts the **server‑side WebSocket realtime flow** for a **Next.js** application running locally (e.g., `npm run dev`). It assumes you are using Next.js 14 (App Router) with TypeScript.

---

## 0) High‑Level Architecture

```
[next.js API Route /api/realtime]
        │
        ▼
[RealtimeSession (WebSocket)]  ←→  OpenAI Realtime API (model: gpt-realtime)
        │                        ▲
        │ audio out (PCM16)      │ audio in/out (events)
        ▼                        │
[Player/Recorder/SIP bridge]     │
```

---

## 1) Prerequisites

- Node.js **18+** (20+ preferred)
- Next.js 14 (with `app/` directory)
- An **OpenAI API key** stored in `.env.local`

```env
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-realtime
OPENAI_REALTIME_VOICE=alloy
```

---

## 2) Install Dependencies

```bash
npm i @openai/agents @openai/agents-realtime ws
npm i -D typescript ts-node @types/node
```

---

## 3) Create a Next.js API Route

In `app/api/realtime/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';

export async function GET() {
  try {
    const agent = new RealtimeAgent({
      name: 'NextHost',
      instructions: 'You are a concise, friendly voice agent in a Next.js app.'
    });

    const session = new RealtimeSession(agent, {
      model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime',
      transport: 'websocket'
    });

    await session.connect({ apiKey: process.env.OPENAI_API_KEY! });

    // Example greeting
    session.transport.sendEvent({
      type: 'response.create',
      response: {
        instructions: 'Hello from Next.js local server!'
      }
    });

    // Collect audio frames into a buffer (for demo only)
    const chunks: Uint8Array[] = [];
    session.on('audio', (evt) => chunks.push(evt.data as Uint8Array));

    // Wait a few seconds for a response then close
    await new Promise((r) => setTimeout(r, 5000));
    session.close();

    return NextResponse.json({ ok: true, message: 'Realtime session completed' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

Now you can hit `http://localhost:3000/api/realtime` and it will:
1. Start a server‑side Realtime session
2. Send a greeting
3. Capture audio output frames (currently buffered in memory)
4. Close after ~5s

---

## 4) Handling Audio Files

For local testing, write the session’s audio output to a `.wav` file:

```typescript
import fs from 'fs';
import path from 'path';

const outPath = path.join(process.cwd(), 'out.wav');
const stream = fs.createWriteStream(outPath);

session.on('audio', (evt) => {
  stream.write(Buffer.from(evt.data as Uint8Array));
});

session.on('close', () => {
  stream.end();
  console.log('Saved audio to', outPath);
});
```

---

## 5) Sending User Audio from Next.js

If you want to POST audio from the browser and relay it:

- Add a `POST` handler to `/api/realtime` that accepts file/blob.
- Transcode input to **PCM16 mono 16kHz** (FFmpeg or Web Audio API).
- Send frames with `input_audio_buffer.append` → `commit` → `response.create`.

Example snippet inside `POST`:

```typescript
const pcm16 = new Uint8Array(await req.arrayBuffer());
session.transport.sendEvent({ type: 'input_audio_buffer.append', audio: pcm16 });
session.transport.sendEvent({ type: 'input_audio_buffer.commit' });
session.transport.sendEvent({ type: 'response.create', response: {} });
```

---

## 6) Local Development Workflow

- Run Next.js: `npm run dev`
- Visit `/api/realtime` in browser → triggers server session
- Inspect console logs for session events
- Check `out.wav` for audio

---

## 7) Extending

- **Multiple hosts**: run multiple `RealtimeSession`s inside the route handler or a long‑lived server module.
- **Tool calls**: register tools in the `RealtimeAgent` definition.
- **Realtime UI**: build a frontend page that fetches `/api/realtime` and displays live transcript deltas.

---

## 8) Notes

- This example runs **synchronously** inside a route (blocks until finished). For real streaming, use a **WebSocket API route** (e.g., `nextjs-websocket-server`) or a persistent Node process alongside Next.js.
- Keep API keys server‑side only.
- For production: add logging, error handling, backpressure, and silence detection.

---

### Testing Checklist (Next.js Local)

- [ ] GET `/api/realtime` → returns `{ ok: true }`
- [ ] Logs show session events
- [ ] Audio saved to `out.wav`
- [ ] POST audio buffer → model replies with transcription + voice output



---

## Next.js (App Router) Integration — Running Locally

This section adapts Track B (server‑side WebSocket) for a **Next.js 14+** app using the **App Router** and standard Node runtime. It exposes a small set of API routes to manage a single Realtime session, send text/audio, and consume transcripts/audio from the browser for local testing.

### 1) Project setup

```bash
npx create-next-app@latest my-realtime-app --ts --eslint
cd my-realtime-app
npm i @openai/agents @openai/agents-realtime ws
```

Add `.env.local`:

```
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-realtime
OPENAI_REALTIME_VOICE=alloy
```

> Use **Node** runtime for these routes (not Edge) because we rely on Node libs and sockets.

---

### 2) Global singleton session manager

Create `src/lib/realtimeSession.ts` (kept hot‑reload safe with `globalThis`). This manages **one** server‑side session for local dev. Extend to a pool keyed by user/session ID for multi‑user.

```typescript
// src/lib/realtimeSession.ts
import { RealtimeAgent, RealtimeSession } from "@openai/agents-realtime";
import { EventEmitter } from "node:events";

export type RTSignals = {
  audio: (data: Uint8Array) => void;
  transcript: (text: string) => void;
  close: () => void;
  error: (err: unknown) => void;
};

class RTManager extends EventEmitter {
  session: RealtimeSession | null = null;
  starting = false;

  async start() {
    if (this.session || this.starting) return this.session;
    this.starting = true;

    const agent = new RealtimeAgent({
      name: "NextServerHost",
      instructions: "You are a concise, friendly voice agent. Keep replies brief.",
    });

    const session = new RealtimeSession(agent, {
      model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime",
      transport: "websocket",
    });

    await session.connect({ apiKey: process.env.OPENAI_API_KEY! });

    // Optional voice
    await session.transport.sendEvent({
      type: "session.update",
      session: { voice: process.env.OPENAI_REALTIME_VOICE || "alloy" },
    });

    // Wire events → EventEmitter so API routes can stream
    session.on("audio", (evt) => this.emit("audio", evt.data as Uint8Array));
    session.on("transcript.delta", (evt) => this.emit("transcript", (evt as any).text || ""));
    session.on("close", () => this.emit("close"));
    session.on("error", (e) => this.emit("error", e));

    this.session = session;
    this.starting = false;
    return session;
  }

  async stop() {
    if (!this.session) return;
    try { await this.session.close(); } catch {}
    this.session = null;
  }

  async sendText(text: string) {
    if (!this.session) throw new Error("No session");
    await this.session.transport.sendEvent({
      type: "response.create",
      response: { instructions: text },
    });
  }

  async appendPcm16(chunk: Uint8Array) {
    if (!this.session) throw new Error("No session");
    await this.session.transport.sendEvent({ type: "input_audio_buffer.append", audio: chunk });
  }

  async commitTurn() {
    if (!this.session) throw new Error("No session");
    await this.session.transport.sendEvent({ type: "input_audio_buffer.commit" });
    await this.session.transport.sendEvent({ type: "response.create", response: {} });
  }
}

// hot‑reload safe singleton
const g = globalThis as any;
export const rt = g.__rtmanager || (g.__rtmanager = new RTManager());
```

---

### 3) API routes (App Router)

Create these under `src/app/api/rt/`.

**Start / Stop / Send Text**

```typescript
// src/app/api/rt/start/route.ts
import { NextResponse } from "next/server";
import { rt } from "@/lib/realtimeSession";
export const runtime = "nodejs";
export async function POST() {
  await rt.start();
  return NextResponse.json({ ok: true });
}
```

```typescript
// src/app/api/rt/stop/route.ts
import { NextResponse } from "next/server";
import { rt } from "@/lib/realtimeSession";
export const runtime = "nodejs";
export async function POST() { await rt.stop(); return NextResponse.json({ ok: true }); }
```

```typescript
// src/app/api/rt/text/route.ts
import { NextResponse } from "next/server";
import { rt } from "@/lib/realtimeSession";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const { text } = await req.json();
  await rt.start();
  await rt.sendText(text || "Say hello and ask me a question.");
  return NextResponse.json({ ok: true });
}
```

**Audio In (PCM16, base64 body)**

```typescript
// src/app/api/rt/audio-append/route.ts
import { NextResponse } from "next/server";
import { rt } from "@/lib/realtimeSession";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const { base64 } = await req.json();
  const buf = Buffer.from(base64, "base64");
  await rt.start();
  await rt.appendPcm16(new Uint8Array(buf));
  return NextResponse.json({ ok: true });
}
```

```typescript
// src/app/api/rt/audio-commit/route.ts
import { NextResponse } from "next/server";
import { rt } from "@/lib/realtimeSession";
export const runtime = "nodejs";
export async function POST() { await rt.commitTurn(); return NextResponse.json({ ok: true }); }
```

**Transcripts as SSE** (simple live captions in the browser)

```typescript
// src/app/api/rt/transcripts/route.ts
import { rt } from "@/lib/realtimeSession";
export const runtime = "nodejs";

export async function GET() {
  await rt.start();
  const stream = new ReadableStream({
    start(controller) {
      const send = (t: string) => controller.enqueue(`data: ${t}

`);
      const onT = (t: string) => send(t);
      const onC = () => controller.close();
      const onE = () => controller.enqueue(`event: error
data: err

`);
      rt.on("transcript", onT);
      rt.once("close", onC);
      rt.on("error", onE);
      // send a ping to keep-alive
      const interval = setInterval(() => controller.enqueue(`: keep-alive

`), 15000);
      (controller as any)._cleanup = () => {
        clearInterval(interval);
        rt.off("transcript", onT); rt.off("error", onE);
      };
    },
    cancel() { (this as any)._cleanup?.(); }
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
```

**Audio Out as chunked WAV** (quick demo playback)

```typescript
// src/app/api/rt/audio/route.ts
import { rt } from "@/lib/realtimeSession";
export const runtime = "nodejs";

function wavHeader(sampleRate: number) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(0xffffffff, 4); // chunk size unknown (streaming)
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28); // byte rate
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(0xffffffff, 40);
  return h;
}

export async function GET() {
  await rt.start();
  const SAMPLE_RATE = 16000;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(wavHeader(SAMPLE_RATE));
      const onA = (pcm: Uint8Array) => controller.enqueue(pcm);
      const onC = () => controller.close();
      rt.on("audio", onA);
      rt.once("close", onC);
      (controller as any)._cleanup = () => { rt.off("audio", onA); };
    },
    cancel() { (this as any)._cleanup?.(); }
  });
  return new Response(stream, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-cache" } });
}
```

---

### 4) Minimal client page (local dev)

Create `src/app/realtime/page.tsx` with basic controls + live captions + audio element.

```tsx
// src/app/realtime/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";

export default function Page() {
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!connected) return;
    const es = new EventSource("/api/rt/transcripts");
    es.onmessage = (e) => setLog((l) => [...l.slice(-100), e.data]);
    es.onerror = () => {/* keep-alive errors are expected sometimes */};
    return () => es.close();
  }, [connected]);

  const start = async () => {
    await fetch("/api/rt/start", { method: "POST" });
    setConnected(true);
    if (audioRef.current) audioRef.current.src = "/api/rt/audio"; // begin streaming playback
  };

  const stop = async () => {
    await fetch("/api/rt/stop", { method: "POST" });
    setConnected(false);
  };

  const say = async (text: string) => {
    await fetch("/api/rt/text", { method: "POST", body: JSON.stringify({ text }), headers: { "Content-Type": "application/json" } });
  };

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Realtime (Track B) — Next.js Local</h1>
      <div className="space-x-2">
        <button className="px-3 py-2 rounded bg-black text-white" onClick={start} disabled={connected}>Start</button>
        <button className="px-3 py-2 rounded bg-gray-200" onClick={stop} disabled={!connected}>Stop</button>
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => say("Introduce yourself briefly.")} disabled={!connected}>Say hello</button>
      </div>

      <audio ref={audioRef} controls autoPlay className="w-full" />

      <div className="border rounded p-3 h-64 overflow-auto font-mono text-sm whitespace-pre-wrap">
        {log.map((l, i) => (<div key={i}>{l}</div>))}
      </div>
    </main>
  );
}
```

---

### 5) Run locally

```bash
npm run dev
# open http://localhost:3000/realtime
```

Click **Start** to spin up the server‑side Realtime session. Click **Say hello** to send a text turn and hear audio streamed to the `<audio>` element. Use the caption pane for live transcript deltas (SSE).

> For **microphone/telephony input**, capture PCM16 in your client/bridge, POST chunks to `/api/rt/audio-append`, then call `/api/rt/audio-commit` to end the turn. (The example client above is text‑only to keep things minimal.)

---

### 6) Notes & extensions

- The demo uses a **single global session**; in a real app, key sessions by user/auth and route events accordingly.
- For stability, add backoff/reconnect inside `RTManager.start()` and ensure `stop()` is called on page unload.
- Replace the WAV header with a proper streaming WAV mux or stream **raw PCM** to a custom `AudioWorklet` for lower latency.
- Add **tools** by defining them in the `RealtimeAgent` and handling `tool.call` events (see earlier section).
- Logging/metrics: emit per‑turn timings and byte counts from `RTManager`.

