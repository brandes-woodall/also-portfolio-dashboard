import { NextRequest, NextResponse } from 'next/server';
import { sharedLogo } from '@/app/lib/sharedLogos';

// GET /api/logos/[slug] — serve company logo from Google Drive (driveManifest.json)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safe = slug.replace(/[^a-z0-9-]/g, '');

  const shared = await sharedLogo('companies', safe);
  if (shared) {
    return new NextResponse(new Uint8Array(shared.buf), {
      headers: { 'Content-Type': shared.mime, 'Cache-Control': 'public, max-age=3600' },
    });
  }

  return new NextResponse(null, { status: 404 });
}

