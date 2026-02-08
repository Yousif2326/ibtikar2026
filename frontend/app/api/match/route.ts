/**
 * Next.js API route: Proxy match requests to the backend.
 * Runs server-side to keep the backend URL off the client.
 * Authentication is handled by the Next.js middleware (WorkOS AuthKit)
 * before this route is reached — no token is forwarded to the backend.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const backendRes = await fetch(`${BACKEND_URL}/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const contentType = backendRes.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await backendRes.text();
      console.error('Match backend returned non-JSON response:', backendRes.status, text);
      return NextResponse.json(
        { detail: text || 'Backend returned a non-JSON response' },
        { status: backendRes.status >= 400 ? backendRes.status : 502 }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error) {
    console.error('Match proxy error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
