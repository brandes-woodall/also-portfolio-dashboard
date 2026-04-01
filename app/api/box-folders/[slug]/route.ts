import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'box-folders');

interface BoxFolder {
  id: string;
  url: string;
  title: string;
  addedAt: string;
}

const readFolders = async (slug: string): Promise<BoxFolder[]> => {
  const file = path.join(DATA_DIR, `${slug}.json`);
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const writeFolders = async (slug: string, folders: BoxFolder[]) => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(DATA_DIR, `${slug}.json`),
    JSON.stringify(folders, null, 2)
  );
};

// GET /api/box-folders/[slug]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const folders = await readFolders(slug);
  return NextResponse.json(folders);
}

// POST /api/box-folders/[slug]  — add a new Box folder
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { url, title } = await request.json();

  if (!url) {
    return NextResponse.json({ error: 'url required' }, { status: 400 });
  }

  const folder: BoxFolder = {
    id: Date.now().toString(),
    url: url.trim(),
    title: (title || '').trim() || 'Investment Materials',
    addedAt: new Date().toISOString(),
  };

  const folders = await readFolders(slug);
  folders.unshift(folder);
  await writeFolders(slug, folders);
  return NextResponse.json(folder);
}

// DELETE /api/box-folders/[slug]?id=...
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const folders = await readFolders(slug);
  const updated = folders.filter((f) => f.id !== id);
  await writeFolders(slug, updated);
  return NextResponse.json({ success: true });
}
