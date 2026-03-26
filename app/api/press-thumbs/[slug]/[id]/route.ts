import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const THUMB_DIR = path.join(process.cwd(), 'data', 'press-thumbs');
const PRESS_DIR = path.join(process.cwd(), 'data', 'press');

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png',  '.gif':  'image/gif',
  '.webp': 'image/webp',
};

// GET /api/press-thumbs/[slug]/[id] — serve the stored thumbnail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const dir = path.join(THUMB_DIR, slug);
  try {
    const files = await fs.readdir(dir);
    const match = files.find((f) => f.startsWith(`${id}.`));
    if (!match) return new NextResponse('Not found', { status: 404 });
    const data = await fs.readFile(path.join(dir, match));
    const ext  = path.extname(match).toLowerCase();
    return new NextResponse(data, {
      headers: { 'Content-Type': CONTENT_TYPES[ext] || 'image/jpeg' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}

// POST /api/press-thumbs/[slug]/[id] — upload a custom thumbnail for a press link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase() || '.jpg';
  const dir = path.join(THUMB_DIR, slug);
  await fs.mkdir(dir, { recursive: true });

  // Remove any previous thumbnail for this link id
  try {
    const existing = await fs.readdir(dir);
    for (const f of existing.filter((f) => f.startsWith(`${id}.`))) {
      await fs.unlink(path.join(dir, f));
    }
  } catch { /* ok if not found */ }

  await fs.writeFile(path.join(dir, `${id}${ext}`), Buffer.from(await file.arrayBuffer()));

  const thumbUrl = `/api/press-thumbs/${slug}/${id}`;

  // Also update the thumbnail field in the press JSON so it persists on reload
  const pressFile = path.join(PRESS_DIR, `${slug}.json`);
  try {
    const raw   = await fs.readFile(pressFile, 'utf-8');
    const links = JSON.parse(raw);
    const idx   = links.findIndex((l: { id: string }) => l.id === id);
    if (idx !== -1) {
      links[idx].thumbnail = thumbUrl;
      await fs.writeFile(pressFile, JSON.stringify(links, null, 2));
    }
  } catch { /* best-effort */ }

  return NextResponse.json({ thumbnail: thumbUrl });
}
