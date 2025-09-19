import { NextResponse } from "next/server";
import { SecureEnv } from "@/lib/secureEnv";

const MODELS_ENDPOINT = "https://api.openai.com/v1/models";
const ERROR_SNIPPET_LIMIT = 160;

export const runtime = "nodejs";

const sanitizeSnippet = (input: string): string =>
  input.replace(/\s+/g, " ").trim().slice(0, ERROR_SNIPPET_LIMIT);

export async function GET() {
  const apiKey = SecureEnv.get("OPENAI_API_KEY");
  const keyInfo = SecureEnv.getInfo("OPENAI_API_KEY");

  if (!apiKey) {
    console.warn("[test-openai] Missing OpenAI API key");
    return NextResponse.json({ ok: false, error: "missing_api_key" }, { status: 500 });
  }

  try {
    console.info("[test-openai] Checking OpenAI connectivity", {
      hasKey: keyInfo.exists,
      keyLength: keyInfo.length,
      fingerprint: keyInfo.fingerprint,
    });

    const response = await fetch(MODELS_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
    });

    if (!response.ok) {
      const rawBody = await response.text();
      const snippet = sanitizeSnippet(rawBody);
      console.warn("[test-openai] Models endpoint returned non-2xx status", {
        status: response.status,
        snippet,
      });

      return NextResponse.json({ ok: false, error: "upstream_error" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, hasKey: true });
  } catch (error) {
    console.error("[test-openai] Connectivity check failed", {
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ ok: false, error: "network_error" }, { status: 502 });
  }
}
