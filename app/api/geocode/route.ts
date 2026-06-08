import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'data', 'geocache.json');

// Module-level timestamp so we rate-limit Nominatim across concurrent requests
// (Next.js API routes share the same Node.js process)
let lastNominatimCall = 0;

type GeoResult = { lat: number; lng: number } | null;

async function readCache(): Promise<Record<string, GeoResult>> {
  try {
    return JSON.parse(await fs.readFile(CACHE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

async function writeCache(cache: Record<string, GeoResult>) {
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const address: string = (body.address || '').trim();
  if (!address) return NextResponse.json({ error: 'No address' }, { status: 400 });

  const key = address.toLowerCase();
  const cache = await readCache();

  // Return cached result immediately (null means previously not found)
  if (key in cache) {
    const result = cache[key];
    return result
      ? NextResponse.json({ ...result, cached: true })
      : NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Rate-limit: Nominatim requires max 1 req/sec
  const now = Date.now();
  const msToWait = 1150 - (now - lastNominatimCall);
  if (msToWait > 0) await new Promise((r) => setTimeout(r, msToWait));
  lastNominatimCall = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AlsoCapitalPortfolio/1.0 (brandes@alsocapital.com)' },
    });

    if (!res.ok) throw new Error(`Nominatim ${res.status}`);

    const results = await res.json();
    if (!results?.length) {
      cache[key] = null;
      await writeCache(cache);
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    const coords: GeoResult = {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
    };
    cache[key] = coords;
    await writeCache(cache);
    return NextResponse.json(coords);
  } catch (err) {
    console.error('Geocode error:', err);
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 });
  }
}
