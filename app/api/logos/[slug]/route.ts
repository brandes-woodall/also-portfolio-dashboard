import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const VOLUME_DIR = path.join(process.cwd(), 'data', 'logos');
const STATIC_DIR = path.join(process.cwd(), 'public', 'logos');

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
};

// GET /api/logos/[slug] — serve from volume (user-uploaded) or fall back to built-in static
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safe = slug.replace(/[^a-z0-9-]/g, '');

  // Try volume first (all extensions), then static (png only)
  const candidates: { file: string; mime: string }[] = [
    ...Object.keys(MIME).map((ext) => ({
      file: path.join(VOLUME_DIR, `${safe}.${ext}`),
      mime: MIME[ext],
    })),
    { file: path.join(STATIC_DIR, `${safe}.png`), mime: 'image/png' },
  ];

  for (const { file, mime } of candidates) {
    try {
      const buf = await fs.readFile(file);
      return new NextResponse(buf, {
        headers: { 'Content-Type': mime, 'Cache-Control': 'no-cache' },
      });
    } catch { /* try next */ }
  }

  return new NextResponse(null, { status: 404 });
}

// POST /api/logos/[slug] — upload a new logo image
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safe = slug.replace(/[^a-z0-9-]/g, '');

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/gif': 'gif',
  };
  const ext = extMap[file.type];
  if (!ext) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.mkdir(VOLUME_DIR, { recursive: true });

  // Remove any previous logo for this slug across all extensions
  for (const e of Object.values(extMap)) {
    try { await fs.unlink(path.join(VOLUME_DIR, `${safe}.${e}`)); } catch { /* ok */ }
  }

  await fs.writeFile(path.join(VOLUME_DIR, `${safe}.${ext}`), buffer);
  return NextResponse.json({ success: true });
}
