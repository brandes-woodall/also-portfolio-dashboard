import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'emails');

const CONTENT_TYPES: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.bmp':  'image/bmp',
  '.tiff': 'image/tiff',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; emailId: string; filename: string }> }
) {
  const { slug, emailId, filename } = await params;
  const filePath = path.join(DATA_DIR, slug, `${emailId}-attachments`, filename);

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
    return new NextResponse(data, {
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
