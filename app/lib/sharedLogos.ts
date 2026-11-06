// Drive logo library — maps slug → Drive file ID, served via lh3.googleusercontent.com
// Source folders:
//   Investors: https://drive.google.com/drive/folders/1QseEiCC11A5XnRNInl6nDFCUoPpONpK-
//   Companies: https://drive.google.com/drive/folders/1tbsbP6OjKT_8qm-cAcqHdrMcPVaNfckY
//
// To add new logos: add the file to the Drive folder and update driveManifest.json
// with the new slug → file ID entry. File IDs are visible in the Drive URL when
// you open a file.

import manifest from './driveManifest.json';

type Manifest = { investors: Record<string, string>; companies: Record<string, string> };
const m = manifest as Manifest;

// In-memory cache: fileId → { buf, mime }
const imageCache = new Map<string, { buf: Buffer; mime: string }>();

export async function sharedLogo(
  kind: 'investors' | 'companies',
  slug: string
): Promise<{ buf: Buffer; mime: string } | null> {
  // Try exact slug, then slug with hyphens removed
  const fileId = m[kind]?.[slug] ?? m[kind]?.[slug.replace(/-/g, '')];
  if (!fileId) return null;

  const cached = imageCache.get(fileId);
  if (cached) return cached;

  try {
    // lh3 serves publicly-shared Drive images without auth
    const res = await fetch(`https://lh3.googleusercontent.com/d/${fileId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(typeof (globalThis as any).Request !== 'undefined' ? {} : { cache: 'no-store' }),
    });
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') || 'image/png';
    const result = { buf, mime };
    imageCache.set(fileId, result);
    return result;
  } catch {
    return null;
  }
}
