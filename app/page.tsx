'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Company,
  fmtUSD, fmtUSDFull, fmtPct, fmtMOIC, toSlug,
  isSafe,
} from './lib/portfolio';

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [companies, setCompanies]   = useState<Company[]>([]);
  const [fundSizes, setFundSizes]   = useState({ ac2: 0, ac3: 0 });
  const [loading, setLoading]       = useState(true);
  const [fundFilter, setFundFilter] = useState('All');
  const [catFilter, setCatFilter]   = useState('All');
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((data) => { setCompanies(data.companies || []); setFundSizes(data.fundSizes || { ac2: 0, ac3: 0 }); setLoading(false); });
  }, []);

  const toggleExpand = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  // ── Firm AUM ─────────────────────────────────────────────────────────────
  let ac2Invested = 0, ac2Value = 0;
  let ac3Invested = 0, ac3Value = 0;
  let catalystValue = 0;
  for (const c of companies) {
    if (c.ac2Investment) {
      ac2Invested += c.ac2Investment;
      ac2Value    += c.ac2CurrentValue;
    }
    if (c.ac3Investment) {
      ac3Invested += c.ac3Investment;
      ac3Value    += c.ac3CurrentValue;
    }
    if (c.catalystInvestment) {
      catalystValue += c.catalystCurrentValue;
    }
  }
  const firmAUM =
    (fundSizes.ac2 - ac2Invested + ac2Value) +
    (fundSizes.ac3 - ac3Invested + ac3Value) +
    catalystValue;

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = companies.filter((c) => {
    const fundOk =
      fundFilter === 'All' ||
      (fundFilter === 'AC2'      && c.ac2Investment > 0)      ||
      (fundFilter === 'AC3'      && c.ac3Investment > 0)      ||
      (fundFilter === 'Catalyst' && c.catalystInvestment > 0);
    const cat = c.category.toLowerCase();
    const catOk =
      catFilter === 'All' ||
      cat === catFilter.toLowerCase() ||
      (catFilter.toLowerCase() === 'opportunistic' && cat.includes('scout fund'));
    return fundOk && catOk;
  });

  // ── Portfolio stats ───────────────────────────────────────────────────────
  let totalInvested = 0;
  let totalValue    = 0;
  for (const c of filtered) {
    if ((fundFilter === 'All' || fundFilter === 'AC2') && c.ac2Investment) {
      totalInvested += c.ac2Investment;
      totalValue    += c.ac2CurrentValue;
    }
    if ((fundFilter === 'All' || fundFilter === 'AC3') && c.ac3Investment) {
      totalInvested += c.ac3Investment;
      totalValue    += c.ac3CurrentValue;
    }
    if ((fundFilter === 'All' || fundFilter === 'Catalyst') && c.catalystInvestment) {
      totalInvested += c.catalystInvestment;
      totalValue    += c.catalystCurrentValue;
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
        <Image
          src="/logos/also-capital.png"
          alt="Also Capital"
          width={160}
          height={40}
          className="object-contain mb-3"
        />
        <h1
          className="text-4xl font-semibold text-gray-900"
          style={{ fontFamily: 'var(--font-eb-garamond)' }}
        >
          Portfolio Dashboard
        </h1>
        <p className="text-gray-400 text-sm mt-1">{filtered.length} companies</p>
      </div>

      {/* ── Portfolio Stats ── */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Total Invested', value: fmtUSDFull(totalInvested) },
          { label: 'Current Value',  value: fmtUSDFull(totalValue)    },
          { label: 'Portfolio MOIC', value: fmtMOIC(portfolioMOIC)    },
        ].map((stat) => (
          <div key={stat.label} className="border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{stat.label}</p>
            <p className="text-2xl font-medium text-gray-900">{stat.value}</p>
          </div>
        ))}
        <div className="border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Firm AUM</p>
          <p className="text-2xl font-medium text-gray-900">{fmtUSDFull(firmAUM)}</p>
        </div>
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
          const slug   = toSlug(company.name);
          const isOpen = expanded.has(company.name);

          const funds = [
            { label: 'AC2',      investment: company.ac2Investment,      value: company.ac2CurrentValue,      moic: company.ac2MOIC,      ownership: company.ac2Ownership,      shares: company.ac2Shares,      safeCap: company.ac2SafeCap      },
            { label: 'AC3',      investment: company.ac3Investment,      value: company.ac3CurrentValue,      moic: company.ac3MOIC,      ownership: company.ac3Ownership,      shares: company.ac3Shares,      safeCap: company.ac3SafeCap      },
            { label: 'Catalyst', investment: company.catalystInvestment, value: company.catalystCurrentValue, moic: company.catalystMOIC, ownership: company.catalystOwnership, shares: company.catalystShares, safeCap: company.catalystSafeCap },
          ].filter((f) => f.investment > 0);

          const companyInvested  = funds.reduce((s, f) => s + f.investment, 0);
          const companyValue     = funds.reduce((s, f) => s + f.value, 0);
          const companyOwnership = funds.reduce((s, f) => s + f.ownership, 0);
          const companyMOIC = companyInvested > 0 ? companyValue / companyInvested : 0;

          return (
            <div
              key={company.name}
              className="border border-gray-200 rounded-xl hover:border-yellow-500 hover:bg-[#fffef5] transition-all duration-150 flex flex-col"
            >
              {/* Clickable area → company detail page */}
              <Link
                href={`/company/${slug}`}
                className="p-5 pb-3 flex flex-col flex-1"
              >
                {/* Card header */}
                <div className="flex items-center gap-3 mb-4">
                  {company.website ? (
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="w-10 h-10 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden hover:border-amber-300 transition-colors"
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
                  ) : (
                    <div className="w-10 h-10 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <Image
                        src={`/logos/${slug}.png`}
                        alt={company.name}
                        width={40}
                        height={40}
                        className="object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-gray-900 truncate">{company.name}</h2>
                    {company.website && (
                      <p className="text-xs text-gray-400 truncate">
                        {company.website.replace(/^https?:\/\//, '')}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-300 text-sm shrink-0">→</span>
                </div>

                {/* Tags */}
                <div className="flex gap-1.5 flex-wrap mb-4">
                  {funds.map((f) => (
                    <span key={f.label} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {f.label}
                    </span>
                  ))}
                  {company.category && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-amber-700">
                      {company.category}
                    </span>
                  )}
                </div>

                {/* Company-level summary stats */}
                <div className="grid grid-cols-4 gap-2">
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
                  <div>
                    <p className="text-xs text-gray-400">Current Stage</p>
                    {company.currentStage ? (
                      <p className="text-sm font-medium text-gray-800">{company.currentStage}</p>
                    ) : (
                      <p className="text-sm text-gray-300">—</p>
                    )}
                  </div>
                </div>
              </Link>

              {/* Fund breakdown toggle (below the clickable area) */}
              <div className="px-5 pb-4">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleExpand(company.name);
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 text-left"
                >
                  {isOpen ? '▲ Hide' : '▼ Show'} fund breakdown
                </button>

                {isOpen && (
                  <div className="space-y-2 mt-2">
                    {funds.map((f) => {
                      const safe = isSafe(f.shares, f.safeCap);

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
                              <p className="text-xs font-medium text-gray-700">{fmtPct(f.ownership)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">MOIC</p>
                              <p className="text-xs font-medium text-gray-700">{fmtMOIC(f.moic)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
