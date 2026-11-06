// Shared "Also Logos" library: a Google Drive folder managed by the Strategy Builder's sheet script.
// Enable by setting LOGO_BRIDGE_URL and LOGO_BRIDGE_TOKEN (the sheet script's web app URL and APP_TOKEN).
// Local logos still take priority; this is the fallback.

type Entry = { id: string; url: string; updated: number };
type Manifest = { investors: Record<string, Entry>; companies: Record<string, Entry> };

const URL_ = process.env.LOGO_BRIDGE_URL;
const TOKEN = process.env.LOGO_BRIDGE_TOKEN;
let cache: { at: number; m: Manifest } | null = null;
const images = new Map<string, { buf: Buffer; mime: string }>(); // `${id}:${updated}` -> image

async function call<T>(action: string, args: Record<string, unknown> = {}): Promise<T | null> {
  if (!URL_ || !TOKEN) return null;
  try {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: TOKEN, action, ...args }),
      redirect: 'follow',
      cache: 'no-store',
    });
    const d = await res.json();
    return d.ok ? (d.result as T) : null;
  } catch {
    return null;
  }
}

async function manifest(): Promise<Manifest | null> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.m;
  const m = await call<Manifest>('logoManifest');
  if (m) cache = { at: Date.now(), m };
  return m ?? cache?.m ?? null;
}

export async function sharedLogo(kind: 'investors' | 'companies', slug: string): Promise<{ buf: Buffer; mime: string } | null> {
  const m = await manifest();
  const entry = m?.[kind]?.[slug] ?? m?.[kind]?.[slug.replace(/-/g, '')];
  if (!entry) return null;
  const key = `${entry.id}:${entry.updated}`;
  const hit = images.get(key);
  if (hit) return hit;
  const r = await call<{ mime: string; base64: string }>('logoBytes', { id: entry.id });
  if (!r) return null;
  const img = { buf: Buffer.from(r.base64, 'base64'), mime: r.mime };
  images.set(key, img);
  return img;
}
