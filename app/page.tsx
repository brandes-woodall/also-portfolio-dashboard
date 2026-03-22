'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface Company {
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

// ── Formatters ────────────────────────────────────────────────────────────────
// For company cards: abbreviated with 2 decimal places
const fmtUSD = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toFixed(0)}`;

// For dashboard totals: full number with commas, no cents
const fmtUSDFull = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US');

const fmtPct  = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtMOIC = (n: number) => `${n.toFixed(1)}x`;

const toSlug = (name: string) =>
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// ── SAFE helpers ──────────────────────────────────────────────────────────────
// A position is a SAFE when shares = 0 and a safe cap is present
const isSafe = (shares: number, safeCap: number) => shares === 0 && safeCap > 0;

const getCurrentValue = (
  investment: number,
  shares: number,
  safeCap: number,
  pricePerShare: number
): number => {
  if (!investment) return 0;
  if (isSafe(shares, safeCap)) return investment; // SAFEs carried at cost
  if (!shares || !pricePerShare) return 0;
  return shares * pricePerShare;
};

const getOwnership = (
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

const getMOIC = (
  investment: number,
  shares: number,
  safeCap: number,
  pricePerShare: number
): number => {
  if (!investment) return 0;
  if (isSafe(shares, safeCap)) return 1.0; // SAFEs always 1x
  if (!shares || !pricePerShare) return 0;
  return (shares * pricePerShare) / investment;
};

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [companies, setCompanies]       = useState<Company[]>([]);
  const [loading, setLoading]           = useState(true);
  const [fundFilter, setFundFilter]     = useState('All');
  const [catFilter, setCatFilter]       = useState('All');
  const [expanded, setExpanded]         = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((data) => { setCompanies(data); setLoading(false); });
  }, []);

  const toggleExpand = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = companies.filter((c) => {
    const fundOk =
      fundFilter === 'All' ||
      (fundFilter === 'AC2'      && c.ac2Investment > 0)      ||
      (fundFilter === 'AC3'      && c.ac3Investment > 0)      ||
      (fundFilter === 'Catalyst' && c.catalystInvestment > 0);
    const catOk =
      catFilter === 'All' ||
      c.category.toLowerCase() === catFilter.toLowerCase();
    return fundOk && catOk;
  });

  // ── Portfolio-level stats (based on filtered companies) ───────────────────
  let totalInvested = 0;
  let totalValue    = 0;
  for (const c of filtered) {
    if ((fundFilter === 'All' || fundFilter === 'AC2') && c.ac2Investment) {
      totalInvested += c.ac2Investment;
      totalValue    += getCurrentValue(c.ac2Investment, c.ac2Shares, c.ac2SafeCap, c.pricePerShare);
    }
    if ((fundFilter === 'All' || fundFilter === 'AC3') && c.ac3Investment) {
      totalInvested += c.ac3Investment;
      totalValue    += getCurrentValue(c.ac3Investment, c.ac3Shares, c.ac3SafeCap, c.pricePerShare);
    }
    if ((fundFilter === 'All' || fundFilter === 'Catalyst') && c.catalystInvestment) {
      totalInvested += c.catalystInvestment;
      totalValue    += getCurrentValue(c.catalystInvestment, c.catalystShares, c.catalystSafeCap, c.pricePerShare);
    }
  }
  const portfolioMOIC = totalInvested > 0 ? totalValue / totalInvested : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-400 text-lg">Loading portfolio…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white px-8 py-10 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-8">
        <h1
          className="text-4xl font-semibold text-gray-900"
          style={{ fontFamily: 'var(--font-eb-garamond)' }}
        >
          Also Capital Portfolio
        </h1>
        <p className="text-gray-400 text-sm mt-1">{companies.length} companies</p>
      </div>

      {/* ── Portfolio Stats ── */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { label: 'Total Invested',  value: fmtUSDFull(totalInvested) },
          { label: 'Current Value',   value: fmtUSDFull(totalValue)    },
          { label: 'Portfolio MOIC',  value: fmtMOIC(portfolioMOIC) },
        ].map((stat) => (
          <div key={stat.label} className="border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{stat.label}</p>
            <p className="text-2xl font-medium text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 flex-wrap mb-8">
        {['All', 'AC2', 'AC3', 'Catalyst'].map((f) => (
          <button
            key={f}
            onClick={() => setFundFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              fundFilter === f
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {f}
          </button>
        ))}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        {['All', 'Core', 'Opportunistic'].map((c) => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              catFilter === c
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* ── Company Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((company) => {
          const slug      = toSlug(company.name);
          const founders  = company.foundingTeam.split(',').map((s) => s.trim()).filter(Boolean);
          const linkedins = company.linkedin.split(',').map((s) => s.trim()).filter(Boolean);
          const emails    = company.emails.split(',').map((s) => s.trim()).filter(Boolean);
          const isOpen    = expanded.has(company.name);

          // Build active funds for this company
          const funds = [
            { label: 'AC2',      investment: company.ac2Investment,      shares: company.ac2Shares,      safeCap: company.ac2SafeCap      },
            { label: 'AC3',      investment: company.ac3Investment,      shares: company.ac3Shares,      safeCap: company.ac3SafeCap      },
            { label: 'Catalyst', investment: company.catalystInvestment, shares: company.catalystShares, safeCap: company.catalystSafeCap },
          ].filter((f) => f.investment > 0);

          // Company-level totals
          const companyInvested   = funds.reduce((s, f) => s + f.investment, 0);
          const companyValue      = funds.reduce(
            (s, f) => s + getCurrentValue(f.investment, f.shares, f.safeCap, company.pricePerShare), 0
          );
          const companyOwnership  = funds.reduce(
            (s, f) => s + getOwnership(f.investment, f.shares, f.safeCap, company.sharesOutstanding), 0
          );
          const companyMOIC = companyInvested > 0 ? companyValue / companyInvested : 0;

          return (
            <div
              key={company.name}
              className="border border-gray-200 rounded-xl p-5 hover:border-yellow-500 hover:bg-[#fffef5] transition-all duration-150 flex flex-col"
            >
              {/* Card header: logo + name + website */}
              <div className="flex items-center gap-3 mb-4">
                <a
                  href={company.website ? (company.website.startsWith('http') ? company.website : `https://${company.website}`) : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden hover:opacity-80 transition-opacity"
                >
                  <Image
                    src={`/logos/${slug}.png`}
                    alt={company.name}
                    width={40}
                    height={40}
                    className="object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </a>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-gray-900 truncate">{company.name}</h2>
                  {company.website && (
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:text-gray-600 truncate block"
                    >
                      {company.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="flex gap-1.5 flex-wrap mb-4">
                {funds.map((f) => (
                  <span key={f.label} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {f.label}
                  </span>
                ))}
                {company.category && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">
                    {company.category}
                  </span>
                )}
              </div>

              {/* Company-level summary stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <p className="text-xs text-gray-400">Invested</p>
                  <p className="text-sm font-medium text-gray-800">{fmtUSD(companyInvested)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Ownership</p>
                  <p className="text-sm font-medium text-gray-800">{fmtPct(companyOwnership)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">MOIC</p>
                  <p className="text-sm font-medium text-gray-800">{fmtMOIC(companyMOIC)}</p>
                </div>
              </div>

            {/* Fund breakdown (always expandable) */}
              <button
                onClick={() => toggleExpand(company.name)}
                className="text-xs text-gray-400 hover:text-gray-600 mb-2 text-left"
              >
                {isOpen ? '▲ Hide' : '▼ Show'} fund breakdown
              </button>

              {isOpen && (
                <div className="space-y-2 mb-3">
                  {funds.map((f) => {
                    const safe      = isSafe(f.shares, f.safeCap);
                    const value     = getCurrentValue(f.investment, f.shares, f.safeCap, company.pricePerShare);
                    const ownership = getOwnership(f.investment, f.shares, f.safeCap, company.sharesOutstanding);
                    const moic      = getMOIC(f.investment, f.shares, f.safeCap, company.pricePerShare);

                    return (
                      <div key={f.label} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-700">{f.label}</span>
                          {safe && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium">
                              SAFE
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-xs text-gray-400">Invested</p>
                            <p className="text-xs font-medium text-gray-700">{fmtUSD(f.investment)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Ownership</p>
                            <p className="text-xs font-medium text-gray-700">{fmtPct(ownership)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">MOIC</p>
                            <p className="text-xs font-medium text-gray-700">{fmtMOIC(moic)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Founder cards */}
              {founders.length > 0 && (
                <div className="border-t border-gray-100 pt-3 mt-auto space-y-2">
                  {founders.map((founder, i) => (
                    <div key={i} className="flex items-start justify-between">
                      <div>
                        {linkedins[i] ? (
                          <a
                            href={linkedins[i].startsWith('http') ? linkedins[i] : `https://${linkedins[i]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-800 hover:text-yellow-600 hover:underline"
                          >
                            {founder}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-gray-800">{founder}</p>
                        )}
                        {emails[i] && (
                          <p className="text-xs text-gray-400">{emails[i]}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          No companies match the selected filters.
        </div>
      )}
    </main>
  );
}
