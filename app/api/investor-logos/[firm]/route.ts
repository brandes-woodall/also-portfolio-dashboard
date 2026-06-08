import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const VOLUME_DIR = path.join(process.cwd(), 'data', 'investor-logos');

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
};

// GET /api/investor-logos/[firm] — serve an investor firm's logo
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ firm: string }> }
) {
  const { firm } = await params;
  const safe = firm.replace(/[^a-z0-9-]/g, '');

  for (const [ext, mime] of Object.entries(MIME)) {
    try {
      const buf = await fs.readFile(path.join(VOLUME_DIR, `${safe}.${ext}`));
      return new NextResponse(buf, {
        headers: { 'Content-Type': mime, 'Cache-Control': 'no-cache' },
      });
    } catch { /* try next */ }
  }

  return new NextResponse(null, { status: 404 });
}

// POST /api/investor-logos/[firm] — upload a logo for an investor firm
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ firm: string }> }
) {
  const { firm } = await params;
  const safe = firm.replace(/[^a-z0-9-]/g, '');

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

  // Remove any previous logo for this firm across all extensions
  for (const e of Object.values(extMap)) {
    try { await fs.unlink(path.join(VOLUME_DIR, `${safe}.${e}`)); } catch { /* ok */ }
  }

  await fs.writeFile(path.join(VOLUME_DIR, `${safe}.${ext}`), buffer);
  return NextResponse.json({ success: true });
}
