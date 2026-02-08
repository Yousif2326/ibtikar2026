/**
 * Next.js API route: Proxy OCR requests to the backend.
 * This runs server-side so the backend URL and auth token
 * never reach the browser (HIPAA: minimize PHI exposure surface).
 */

import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await withAuth();

    if (!accessToken) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Forward the multipart form data to the backend
    const formData = await request.formData();
    const backendFormData = new FormData();
    const file = formData.get('file');
    if (file) {
      backendFormData.append('file', file);
    }

    const backendRes = await fetch(`${BACKEND_URL}/ocr`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: backendFormData,
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error) {
    console.error('OCR proxy error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
