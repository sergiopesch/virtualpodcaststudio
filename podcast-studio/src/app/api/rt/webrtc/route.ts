// src/app/api/rt/webrtc/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let model = process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-10-01";
  try {
    const url = new URL(req.url);
    model = url.searchParams.get('model') || model;

    const sdp = await req.text();
    if (!sdp || !sdp.includes("v=0")) {
      return new NextResponse(JSON.stringify({ error: "Invalid SDP offer" }), { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return new NextResponse(JSON.stringify({ error: "Server missing OPENAI_API_KEY" }), { status: 500 });
    }

    const resp = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/sdp',
        'Accept': 'application/sdp',
        'OpenAI-Beta': 'realtime=v1'
      },
      body: sdp
    });

    const answer = await resp.text();
    if (!resp.ok) {
      return new NextResponse(JSON.stringify({ error: "OpenAI SDP exchange failed", status: resp.status, details: answer }), { status: 502 });
    }

    return new NextResponse(answer, { status: 200, headers: { 'Content-Type': 'application/sdp' } });
  } catch (error: any) {
    return new NextResponse(JSON.stringify({ error: error.message || 'Failed to exchange SDP' }), { status: 500 });
  }
}


