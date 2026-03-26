import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'media');

const CONTENT_TYPES: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.bmp':  'image/bmp',
  '.mp4':  'video/mp4',
  '.mov':  'video/quicktime',
  '.webm': 'video/webm',
  '.avi':  'video/avi',
  '.mkv':  'video/x-matroska',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; filename: string }> }
) {
  const { slug, filename } = await params;

  // Prevent path traversal
  const safeFilename = path.basename(filename);
  const filePath = path.join(DATA_DIR, slug, safeFilename);

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
    return new NextResponse(data, {
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
