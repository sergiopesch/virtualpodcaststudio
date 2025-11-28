import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow 60 seconds for PDF processing

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { arxivUrl } = body;

    if (!arxivUrl || typeof arxivUrl !== "string") {
      // Return 200 with null text to avoid console errors
      return NextResponse.json({ text: null, error: "Invalid arXiv URL" });
    }

    // Convert abstract URL to PDF URL if needed
    let pdfUrl = arxivUrl.replace("/abs/", "/pdf/");
    if (!pdfUrl.endsWith(".pdf") && !pdfUrl.includes("pdf/")) {
      pdfUrl += ".pdf";
    }

    console.log(`[INFO] Fetching PDF from: ${pdfUrl}`);

    const response = await fetch(pdfUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/pdf,application/x-download,*/*"
      },
    });

    if (!response.ok) {
      console.warn(`[WARN] PDF fetch failed with status: ${response.status}`);
      return NextResponse.json({ text: null, error: `Failed to fetch PDF: ${response.status}` });
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      console.warn("[WARN] arXiv returned HTML instead of PDF (likely blocked or captcha)");
      return NextResponse.json({ text: null, error: "arXiv access blocked (HTML response)" });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
       return NextResponse.json({ text: null, error: "Empty PDF received" });
    }

    // Check for PDF signature (%PDF)
    const isPdf = buffer.indexOf(Buffer.from("%PDF")) !== -1;
    if (!isPdf) {
      console.warn("[WARN] Response buffer does not appear to be a PDF (missing signature)");
      // Log first 100 bytes for debug
      console.log("[DEBUG] First 100 bytes:", buffer.subarray(0, 100).toString('utf-8'));
      return NextResponse.json({ text: null, error: "Invalid PDF format" });
    }

    console.log(`[INFO] PDF downloaded (${buffer.length} bytes), parsing...`);
    
    let textResult;
    try {
      // pdf-parse v2.x uses a class-based API
      const parser = new PDFParse({ data: buffer });
      textResult = await parser.getText();
      await parser.destroy(); // Clean up resources
    } catch (parseError) {
      console.error("[ERROR] pdf-parse failed:", parseError);
      return NextResponse.json({ text: null, error: "Failed to parse PDF content" });
    }

    // Clean the text
    const cleanText = (textResult.text || "")
      .replace(/\u0000/g, "") // Remove null bytes
      .replace(/\s+/g, " ")   // Collapse whitespace
      .trim();

    // Use a reasonable limit (e.g. 40k chars)
    const truncatedText = cleanText.slice(0, 40000);

    console.log(`[INFO] Successfully extracted ${cleanText.length} characters.`);

    return NextResponse.json({ text: truncatedText });
  } catch (error) {
    console.error("[ERROR] Failed to fetch/parse PDF:", error);
    // Return 200 with null text so the frontend doesn't crash/show error, just continues without text
    return NextResponse.json(
      { text: null, error: "Processing failed" },
      { status: 200 }
    );
  }
}
