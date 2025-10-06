// Test OpenAI connection
import { NextResponse } from "next/server";
import { SecureEnv } from "@/lib/secureEnv";

export const runtime = "nodejs";

export async function GET() {
  try {
    console.log('[TEST] Checking OpenAI configuration...');
    
    // Check if API key exists
    const apiKey = SecureEnv.get("OPENAI_API_KEY");
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'OpenAI API key not found in environment variables',
        hasKey: false 
      }, { status: 500 });
    }
    
    const keyInfo = SecureEnv.getInfo("OPENAI_API_KEY");
    console.log('[TEST] API key found, length:', keyInfo.length);
    console.log('[TEST] API key starts with:', apiKey.substring(0, 7) + '...');
    
    // Test a simple OpenAI API call first
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('[TEST] Models API response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.log('[TEST] Models API error:', errorData);
      return NextResponse.json({ 
        error: 'OpenAI API key validation failed',
        status: response.status,
        details: errorData,
        hasKey: true 
      }, { status: 500 });
    }
    
    const models = await response.json() as { data?: Array<{ id: string }> };
    const modelList = Array.isArray(models.data) ? models.data : [];
    console.log('[TEST] Found', modelList.length, 'models');

    // Check if gpt-realtime-mini model is available
    const realtimeModels = modelList.filter((model) => typeof model.id === 'string' && model.id.includes('realtime'));
    console.log('[TEST] Realtime models found:', realtimeModels.map((model) => model.id));
    
    return NextResponse.json({ 
      success: true,
      hasKey: true,
      keyLength: apiKey.length,
      modelsCount: modelList.length,
      realtimeModels: realtimeModels.map((model) => model.id)
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reach OpenAI';
    console.error('[TEST] Error testing OpenAI connection:', error);
    return NextResponse.json({
      error: message,
      hasKey: SecureEnv.exists("OPENAI_API_KEY")
    }, { status: 500 });
  }
}
