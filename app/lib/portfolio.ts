// ── Shared types & helpers for the portfolio dashboard ───────────────────────

export interface Company {
  name: string;
  foundingTeam: string;
  linkedin: string;
  emails: string;
  website: string;
  fund: string;
  category: string;
  ac2Investment: number;
  ac2Shares: number;
  ac3Investment: number;
  ac3Shares: number;
  catalystInvestment: number;
  catalystShares: number;
  pricePerShare: number;
  sharesOutstanding: number;
  ac2SafeCap: number;
  ac3SafeCap: number;
  catalystSafeCap: number;
}

export interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  textBody: string;
  htmlBody: string;
  filename: string;
}

export interface PressLink {
  id: string;
  url: string;
  title: string;
  date: string | null;
  thumbnail: string | null;
  addedAt: string;
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video-link';
  filename?: string;
  originalName?: string;
  mimeType?: string;
  url?: string;
  title?: string;
  thumbnail?: string | null;
  date?: string | null;
  uploadedAt: string;
}

// ── Formatters ───────────────────────────────────────────────────────────────
export const fmtUSD = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toFixed(0)}`;

export const fmtUSDFull = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US');

export const fmtPct  = (n: number) => `${(n * 100).toFixed(1)}%`;
export const fmtMOIC = (n: number) => `${n.toFixed(1)}x`;

export const toSlug = (name: string) =>
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// ── SAFE helpers ─────────────────────────────────────────────────────────────
export const isSafe = (shares: number, safeCap: number) => shares === 0 && safeCap > 0;

export const getCurrentValue = (
  investment: number,
  shares: number,
  safeCap: number,
  pricePerShare: number
): number => {
  if (!investment) return 0;
  if (isSafe(shares, safeCap)) return investment;
  if (!shares || !pricePerShare) return 0;
  return shares * pricePerShare;
};

export const getOwnership = (
  investment: number,
  shares: number,
  safeCap: number,
  sharesOutstanding: number
): number => {
  if (!investment) return 0;
  if (isSafe(shares, safeCap)) return safeCap > 0 ? investment / safeCap : 0;
  if (!shares || !sharesOutstanding) return 0;
  return shares / sharesOutstanding;
};

export const getMOIC = (
  investment: number,
  shares: number,
  safeCap: number,
  pricePerShare: number
): number => {
  if (!investment) return 0;
  if (isSafe(shares, safeCap)) return 1.0;
  if (!shares || !pricePerShare) return 0;
  return (shares * pricePerShare) / investment;
};

// ── Fund constants ───────────────────────────────────────────────────────────
export const AC2_FUND_SIZE = 22_080_641;
export const AC3_FUND_SIZE = 52_000_000;
