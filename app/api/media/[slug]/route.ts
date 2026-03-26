import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'media');

interface MediaItem {
  id: string;
  type: 'image' | 'video-link';
  // image fields
  filename?: string;
  originalName?: string;
  mimeType?: string;
  // video-link fields
  url?: string;
  title?: string;
  thumbnail?: string | null;
  date?: string | null;
  // common
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

// Extract YouTube video ID from common URL formats
function getYouTubeThumbnail(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
  }
  return null;
}

// Fetch Open Graph metadata (same approach as press route)
async function fetchOGMeta(url: string): Promise<{ title: string | null; date: string | null; thumbnail: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; portfolio-bot/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();

    const getMetaContent = (property: string): string | null => {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
        new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i'),
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m) return m[1];
      }
      return null;
    };

    let title = getMetaContent('og:title');
    if (!title) {
      const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = m ? m[1].trim() : null;
    }

    // For YouTube, thumbnail comes directly; for others, use og:image
    const ogThumbnail = getMetaContent('og:image');

    const rawDate =
      getMetaContent('article:published_time') ||
      getMetaContent('og:article:published_time') ||
      getMetaContent('date') ||
      getMetaContent('pubdate') ||
      getMetaContent('DC.date');

    let date: string | null = null;
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) date = parsed.toISOString();
    }

    return { title, date, thumbnail: ogThumbnail };
  } catch {
    return { title: null, date: null, thumbnail: null };
  }
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];

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
// JSON body { url, title }  → video-link with background OG fetch
// FormData with 'file'      → image upload
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contentType = request.headers.get('content-type') || '';

  // ── Video link ──────────────────────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    const { url, title: manualTitle } = await request.json() as { url?: string; title?: string };
    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const id = Date.now().toString();

    // For YouTube, we can get the thumbnail instantly without a fetch
    const ytThumb = getYouTubeThumbnail(url.trim());

    const item: MediaItem = {
      id,
      type:      'video-link',
      url:       url.trim(),
      title:     manualTitle?.trim() || url.trim(),
      thumbnail: ytThumb,   // null for non-YouTube until OG fetch completes
      date:      null,
      uploadedAt: new Date().toISOString(),
    };

    const items = await readIndex(slug);
    items.unshift(item);
    await writeIndex(slug, items);

    // Enrich with OG metadata in the background (non-blocking)
    fetchOGMeta(url.trim()).then(async ({ title: ogTitle, date, thumbnail: ogThumb }) => {
      try {
        const current = await readIndex(slug);
        const idx = current.findIndex((i) => i.id === id);
        if (idx !== -1) {
          current[idx] = {
            ...current[idx],
            title:     manualTitle?.trim() || ogTitle || url.trim(),
            date,
            // YouTube thumb already set; only override with OG if we don't have one
            thumbnail: current[idx].thumbnail || ogThumb || null,
          };
          await writeIndex(slug, current);
        }
      } catch { /* best-effort */ }
    });

    return NextResponse.json(item);
  }

  // ── Image upload ────────────────────────────────────────────────────────────
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const MAX_BYTES = 50 * 1024 * 1024; // 50 MB for images
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image too large — 50 MB max' }, { status: 413 });
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only image files are accepted here' }, { status: 400 });
  }

  const id = Date.now().toString();
  const safeOriginalName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const storedFilename = `${id}-${safeOriginalName}`;

  const dir = path.join(DATA_DIR, slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, storedFilename), Buffer.from(await file.arrayBuffer()));

  const item: MediaItem = {
    id,
    type:         'image',
    filename:     storedFilename,
    originalName: file.name,
    mimeType:     file.type,
    uploadedAt:   new Date().toISOString(),
  };

  const items = await readIndex(slug);
  items.unshift(item);
  await writeIndex(slug, items);

  return NextResponse.json(item);
}

// PATCH /api/media/[slug] — update date and/or thumbnail for a video-link
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { id, date, thumbnail } = await request.json() as {
    id: string;
    date?: string | null;
    thumbnail?: string | null;
  };

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const items = await readIndex(slug);
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (date !== undefined)      items[idx].date      = date ?? null;
  if (thumbnail !== undefined) items[idx].thumbnail = thumbnail ?? null;

  await writeIndex(slug, items);
  return NextResponse.json(items[idx]);
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

  // Only try to delete file for image uploads
  if (target?.type === 'image' && target.filename) {
    try {
      await fs.unlink(path.join(DATA_DIR, slug, target.filename));
    } catch { /* already gone */ }
  }

  await writeIndex(slug, items.filter((i) => i.id !== id));
  return NextResponse.json({ success: true });
}
