import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    if (!body.topics || !Array.isArray(body.topics) || body.topics.length === 0) {
      return NextResponse.json(
        { error: 'Topics array is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Additional validation for topics
    if (body.topics.length > 10) {
      return NextResponse.json(
        { error: 'Too many topics (maximum 10 allowed)' },
        { status: 400 }
      );
    }

    // Validate each topic
    for (const topic of body.topics) {
      if (typeof topic !== 'string' || topic.length > 50 || !/^[a-zA-Z0-9.\-_]+$/.test(topic)) {
        return NextResponse.json(
          { error: 'Invalid topic format' },
          { status: 400 }
        );
      }
    }

    // Forward request to FastAPI backend
    let response: Response;
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      response = await fetch(`${BACKEND_URL}/api/papers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError) {
      console.error('Failed to connect to backend:', fetchError);
      
      // Check for specific connection errors
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError' || fetchError.message.includes('aborted')) {
          return NextResponse.json(
            { error: 'Backend request timed out. Please try again.' },
            { status: 504 }
          );
        }
        const errorMsg = fetchError.message.toLowerCase();
        if (errorMsg.includes('econnrefused') || 
            errorMsg.includes('fetch failed') ||
            errorMsg.includes('network') ||
            errorMsg.includes('connection')) {
          return NextResponse.json(
            { 
              error: 'Backend service is not available. The FastAPI server needs to be running on port 8000. Start it with: cd backend && uvicorn main:app --reload',
              backendUnavailable: true 
            },
            { status: 503 }
          );
        }
      }
      
      return NextResponse.json(
        { error: `Failed to connect to backend: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      console.error('Backend error:', errorData);
      
      return NextResponse.json(
        { error: errorData.detail || errorData.error || 'Failed to fetch papers' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('API route error:', error);
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid response from backend server' },
        { status: 502 }
      );
    }
    
    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
