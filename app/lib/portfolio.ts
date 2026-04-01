// ── Shared types & helpers for the portfolio dashboard ───────────────────────

export interface TrancheDetail {
  instrument: string;
  type: string;
  investDate: string;
  amount: number;
  postMoneyCap: number;
  shares: number;
  currentPrice: number;
  value: number;
  moic: number;
  vehicleName: string;
  stage: string;
}

export interface Company {
  name: string;
  foundingTeam: string;
  linkedin: string;
  emails: string;
  website: string;
  fund: string;
  category: string;
  currentStage: string;
  legalName: string;
  // ── AC2 (Fund II) ─────────────────────
  ac2Investment: number;
  ac2SafeCap: number;
  ac2Shares: number;
  ac2CurrentValue: number;
  ac2MOIC: number;
  ac2Ownership: number;
  ac2Tranches: TrancheDetail[];
  // ── AC3 (Fund III) ────────────────────
  ac3Investment: number;
  ac3SafeCap: number;
  ac3Shares: number;
  ac3CurrentValue: number;
  ac3MOIC: number;
  ac3Ownership: number;
  ac3Tranches: TrancheDetail[];
  // ── Catalyst (Co-Investments) ─────────
  catalystInvestment: number;
  catalystSafeCap: number;
  catalystShares: number;
  catalystCurrentValue: number;
  catalystMOIC: number;
  catalystOwnership: number;
  catalystTranches: TrancheDetail[];
  // ── Shared ────────────────────────────
  pricePerShare: number;
  sharesOutstanding: number;
}

export interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  textBody: string;
  htmlBody: string;
  filename: string;
  isPdf?: boolean;
  pdfFile?: string;
}

export interface BoxFolder {
  id: string;
  url: string;
  title: string;
  addedAt: string;
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
  n >= 1_000_000_000
    ? `$${(n / 1_000_000_000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}B`
    : n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toFixed(0)}`;

export const fmtUSDRoundM = (n: number) =>
  n >= 1_000_000_000
    ? `$${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
    : n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    : n >= 1_000
    ? `$${Math.round(n / 1_000)}K`
    : `$${Math.round(n)}`;

export const fmtUSDFull = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US');

export const fmtPct  = (n: number) => `${(n * 100).toFixed(1)}%`;
export const fmtMOIC = (n: number) => `${n.toFixed(1)}x`;

export const toSlug = (name: string) =>
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// ── SAFE helpers ─────────────────────────────────────────────────────────────
export const isSafe = (shares: number, safeCap: number) => shares === 0 && safeCap > 0;

// ── Fund constants ───────────────────────────────────────────────────────────
export const AC2_FUND_SIZE = 22_080_641;
export const AC3_FUND_SIZE = 52_000_000;
