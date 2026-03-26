import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'media');

interface MediaItem {
  id: string;
  filename: string;        // stored filename on disk: [id]-[originalName]
  originalName: string;
  type: 'image' | 'video';
  mimeType: string;
  uploadedAt: string;
}

const indexPath = (slug: string) => path.join(DATA_DIR, slug, 'index.json');

const readIndex = async (slug: string): Promise<MediaItem[]> => {
  try {
    const raw = await fs.readFile(indexPath(slug), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const writeIndex = async (slug: string, items: MediaItem[]) => {
  await fs.mkdir(path.join(DATA_DIR, slug), { recursive: true });
  await fs.writeFile(indexPath(slug), JSON.stringify(items, null, 2));
};

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mov', 'video/avi'];

// GET /api/media/[slug]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const items = await readIndex(slug);
  return NextResponse.json(items);
}

// POST /api/media/[slug]
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const MAX_BYTES = 500 * 1024 * 1024; // 500 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'File too large — 500 MB max' },
      { status: 413 }
    );
  }

  const mimeType = file.type;
  const isImage = ACCEPTED_IMAGE_TYPES.includes(mimeType);
  const isVideo = ACCEPTED_VIDEO_TYPES.includes(mimeType) || file.name.match(/\.(mp4|mov|webm|avi|mkv)$/i);

  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: 'Only images and videos are accepted' },
      { status: 400 }
    );
  }

  const id = Date.now().toString();
  const safeOriginalName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const storedFilename = `${id}-${safeOriginalName}`;

  const dir = path.join(DATA_DIR, slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, storedFilename),
    Buffer.from(await file.arrayBuffer())
  );

  const item: MediaItem = {
    id,
    filename:     storedFilename,
    originalName: file.name,
    type:         isImage ? 'image' : 'video',
    mimeType,
    uploadedAt:   new Date().toISOString(),
  };

  const items = await readIndex(slug);
  items.unshift(item);
  await writeIndex(slug, items);

  return NextResponse.json(item);
}

// DELETE /api/media/[slug]?id=...
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const items = await readIndex(slug);
  const target = items.find((i) => i.id === id);

  if (target) {
    try {
      await fs.unlink(path.join(DATA_DIR, slug, target.filename));
    } catch { /* already gone */ }
  }

  await writeIndex(slug, items.filter((i) => i.id !== id));
  return NextResponse.json({ success: true });
}
