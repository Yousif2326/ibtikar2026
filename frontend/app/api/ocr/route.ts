/**
 * Next.js API route: OCR via OpenAI Vision (GPT-4o).
 * Accepts an uploaded image, sends it to GPT-4o with vision capabilities
 * to extract text, and returns the result.
 *
 * Runs server-side so the OpenAI API key never reaches the browser.
 * Authentication is handled by the Next.js middleware (WorkOS AuthKit)
 * before this route is reached.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
]);

function getOpenAIClient(): OpenAI {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey: OPENAI_API_KEY });
}

export async function POST(request: NextRequest) {
  try {
    // --- Parse the uploaded file ---
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { detail: 'No file provided' },
        { status: 400 }
      );
    }

    // --- Validate file type ---
    const contentType = file.type || '';
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        {
          detail: `Unsupported file type: ${contentType}. Allowed: ${[...ALLOWED_TYPES].join(', ')}`,
        },
        { status: 400 }
      );
    }

    // --- Validate file size ---
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          detail: `File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 10 MB.`,
        },
        { status: 400 }
      );
    }

    // --- Convert to base64 for OpenAI Vision ---
    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mediaType = contentType as 'image/jpeg' | 'image/png' | 'image/webp';

    // --- Call OpenAI Vision ---
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an OCR assistant. Extract ALL visible text from the provided image exactly as it appears. ' +
            'Preserve the original layout, line breaks, and formatting as closely as possible. ' +
            'Do not summarize, interpret, or add any commentary. Return ONLY the extracted text.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${base64Image}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: 'Extract all text from this document image.',
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const extractedText =
      response.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({
      extracted_text: extractedText,
      confidence_note:
        'Text extracted via OpenAI Vision (GPT-4o). Please review for accuracy.',
    });
  } catch (error) {
    console.error('OCR Vision error:', error);

    const message =
      error instanceof Error ? error.message : 'OCR processing failed';

    return NextResponse.json(
      { detail: message },
      { status: 500 }
    );
  }
}
