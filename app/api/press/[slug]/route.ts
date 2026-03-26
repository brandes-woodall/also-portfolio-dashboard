import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'press');

interface PressLink {
  id: string;
  url: string;
  title: string;
  date: string | null;
  thumbnail: string | null;
  addedAt: string;
}

const readLinks = async (slug: string): Promise<PressLink[]> => {
  const file = path.join(DATA_DIR, `${slug}.json`);
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const writeLinks = async (slug: string, links: PressLink[]) => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(DATA_DIR, `${slug}.json`),
    JSON.stringify(links, null, 2)
  );
};

// Fetch Open Graph metadata from a URL to get title, date, and thumbnail
async function fetchOGMeta(url: string): Promise<{ title: string | null; date: string | null; thumbnail: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; portfolio-bot/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();

    const getMetaContent = (property: string): string | null => {
      // Matches both og:xxx and name="xxx" variants
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

    // Title: prefer og:title, fall back to <title>
    let title = getMetaContent('og:title');
    if (!title) {
      const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = m ? m[1].trim() : null;
    }

    // Thumbnail: prefer og:image
    const thumbnail = getMetaContent('og:image');

    // Date: try common meta fields
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

    return { title, date, thumbnail };
  } catch {
    return { title: null, date: null, thumbnail: null };
  }
}

// GET /api/press/[slug]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const links = await readLinks(slug);
  return NextResponse.json(links);
}

// POST /api/press/[slug]
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await request.json();
  const { url, title: manualTitle } = body as { url?: string; title?: string };

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  const id = Date.now().toString();
  const newLink: PressLink = {
    id,
    url:       url.trim(),
    title:     manualTitle?.trim() || url.trim(),
    date:      null,
    thumbnail: null,
    addedAt:   new Date().toISOString(),
  };

  // Save immediately so the UI responds instantly
  const links = await readLinks(slug);
  links.unshift(newLink);
  await writeLinks(slug, links);

  // Enrich with OG metadata in the background (non-blocking)
  fetchOGMeta(url.trim()).then(async ({ title: ogTitle, date, thumbnail }) => {
    try {
      const current = await readLinks(slug);
      const idx = current.findIndex((l) => l.id === id);
      if (idx !== -1) {
        current[idx] = {
          ...current[idx],
          title:     manualTitle?.trim() || ogTitle || url.trim(),
          date,
          thumbnail,
        };
        await writeLinks(slug, current);
      }
    } catch { /* best-effort */ }
  });

  return NextResponse.json(newLink);
}

// PATCH /api/press/[slug] — update date and/or thumbnail for a link
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

  const links = await readLinks(slug);
  const idx   = links.findIndex((l) => l.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (date !== undefined)      links[idx].date      = date ?? null;
  if (thumbnail !== undefined) links[idx].thumbnail = thumbnail ?? null;

  await writeLinks(slug, links);
  return NextResponse.json(links[idx]);
}

// DELETE /api/press/[slug]?id=...
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

  const links = await readLinks(slug);
  await writeLinks(slug, links.filter((l) => l.id !== id));

  return NextResponse.json({ success: true });
}
