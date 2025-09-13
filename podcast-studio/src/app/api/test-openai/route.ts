// Test OpenAI connection
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    console.log('[TEST] Checking OpenAI configuration...');
    
    // Check if API key exists
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'OpenAI API key not found in environment variables',
        hasKey: false 
      }, { status: 500 });
    }
    
    console.log('[TEST] API key found, length:', apiKey.length);
    console.log('[TEST] API key starts with:', apiKey.substring(0, 7));
    
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
    
    const models = await response.json();
    console.log('[TEST] Found', models.data?.length || 0, 'models');
    
    // Check if gpt-4o-realtime model is available
    const realtimeModels = models.data?.filter((m: any) => m.id.includes('realtime')) || [];
    console.log('[TEST] Realtime models found:', realtimeModels.map((m: any) => m.id));
    
    return NextResponse.json({ 
      success: true,
      hasKey: true,
      keyLength: apiKey.length,
      modelsCount: models.data?.length || 0,
      realtimeModels: realtimeModels.map((m: any) => m.id)
    });
    
  } catch (error: any) {
    console.error('[TEST] Error testing OpenAI connection:', error);
    return NextResponse.json({ 
      error: error.message,
      hasKey: !!process.env.OPENAI_API_KEY 
    }, { status: 500 });
  }
}
