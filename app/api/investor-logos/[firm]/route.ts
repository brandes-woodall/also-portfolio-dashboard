import { NextRequest, NextResponse } from 'next/server';
import { sharedLogo } from '@/app/lib/sharedLogos';

// GET /api/investor-logos/[firm] — serve investor logo from Google Drive (driveManifest.json)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ firm: string }> }
) {
  const { firm } = await params;
  const safe = firm.replace(/[^a-z0-9-]/g, '');

  const shared = await sharedLogo('investors', safe);
  if (shared) {
    return new NextResponse(new Uint8Array(shared.buf), {
      headers: { 'Content-Type': shared.mime, 'Cache-Control': 'public, max-age=3600' },
    });
  }

  return new NextResponse(null, { status: 404 });
}
