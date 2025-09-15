import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

async function findBackendPort(): Promise<string> {
  // Try common ports for the backend
  const ports = [8000, 8001, 8002, 8003, 8004];
  
  for (const port of ports) {
    try {
      const response = await fetch(`http://localhost:${port}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000) // 1 second timeout
      });
      if (response.ok) {
        return `http://localhost:${port}`;
      }
    } catch (error) {
      // Continue to next port
      continue;
    }
  }
  
  throw new Error('Backend server not found on any common ports (8000-8004)');
}

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

<<<<<<< Current (Your changes)
    // Find the backend port dynamically
    const backendUrl = await findBackendPort();
=======
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
>>>>>>> Incoming (Background Agent changes)

    // Forward request to FastAPI backend
    const response = await fetch(`${backendUrl}/api/papers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      console.error('Backend error:', errorData);
      
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch papers' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('API route error:', error);
    
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Backend service is not available. Please ensure the FastAPI server is running.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
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
