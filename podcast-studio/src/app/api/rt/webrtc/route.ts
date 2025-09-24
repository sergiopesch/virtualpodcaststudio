// src/app/api/rt/webrtc/route.ts
import { NextResponse } from "next/server";
import { handleRealtimeSdpExchange, realtimeErrorToHttpResponse } from "@/lib/realtimeSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const result = await handleRealtimeSdpExchange({
      request: req,
      sdpOffer: body,
    });

    return new NextResponse(result.answerSdp, {
      status: 200,
      headers: { "Content-Type": "application/sdp" },
    });
  } catch (error: unknown) {
    return realtimeErrorToHttpResponse(error);
  }
}


