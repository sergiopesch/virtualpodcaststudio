// src/app/api/rt/webrtc/route.ts
import { NextResponse } from "next/server";
import { SecureEnv } from "@/lib/secureEnv";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let model = SecureEnv.getWithDefault('OPENAI_REALTIME_MODEL', "gpt-4o-realtime-preview-2024-10-01");
  try {
    const url = new URL(req.url);
    model = url.searchParams.get('model') || model;

    const sdp = await req.text();
    if (!sdp || !sdp.includes("v=0")) {
      return new NextResponse(JSON.stringify({ error: "Invalid SDP offer" }), { status: 400 });
    }

    const providerHeader = req.headers.get('x-llm-provider')?.toLowerCase();
    const provider: 'openai' | 'google' = providerHeader === 'google' ? 'google' : 'openai';
    const headerModel = req.headers.get('x-llm-model');
    if (headerModel) {
      model = headerModel;
    }

    const headerKey = req.headers.get('x-llm-api-key')?.trim() || '';
    const resolvedKey = provider === 'openai'
      ? headerKey || SecureEnv.getWithDefault('OPENAI_API_KEY', '')
      : headerKey;

    if (!resolvedKey) {
      const label = provider === 'openai' ? 'OpenAI' : 'Google';
      return new NextResponse(JSON.stringify({ error: `Missing API key for ${label}` }), { status: 400 });
    }

    if (provider !== 'openai') {
      return new NextResponse(JSON.stringify({ error: 'Google provider does not support WebRTC conversations yet.' }), { status: 501 });
    }

    const resp = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resolvedKey}`,
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to exchange SDP';
    return new NextResponse(JSON.stringify({ error: message }), { status: 500 });
  }
}


