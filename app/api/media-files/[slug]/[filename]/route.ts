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

const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB chunks

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; filename: string }> }
) {
  const { slug, filename } = await params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(DATA_DIR, slug, safeFilename);
  const ext = path.extname(safeFilename).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

  let fileSize: number;
  try {
    const stats = await fs.stat(filePath);
    fileSize = stats.size;
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  const rangeHeader = request.headers.get('range');

  if (rangeHeader) {
    // Parse "bytes=start-end"
    const [, rangeValue] = rangeHeader.split('=');
    const [startStr, endStr] = rangeValue.split('-');
    const start = parseInt(startStr, 10);
    const end   = endStr ? parseInt(endStr, 10) : Math.min(start + CHUNK_SIZE - 1, fileSize - 1);

    if (start >= fileSize || end >= fileSize || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const chunkSize  = end - start + 1;
    const fileHandle = await fs.open(filePath, 'r');
    const buffer     = Buffer.allocUnsafe(chunkSize);
    await fileHandle.read(buffer, 0, chunkSize, start);
    await fileHandle.close();

    return new NextResponse(buffer, {
      status: 206,
      headers: {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type':   contentType,
      },
    });
  }

  // No range header — serve full file (fine for images; browser will use ranges for video)
  const data = await fs.readFile(filePath);
  return new NextResponse(data, {
    headers: {
      'Content-Type':   contentType,
      'Accept-Ranges':  'bytes',
      'Content-Length': fileSize.toString(),
    },
  });
}
