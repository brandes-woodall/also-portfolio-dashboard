'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// ── Read-only investor logo for dashboard cards ───────────────────────────────
function LeadLogoSmall({ firmName }: { firmName: string }) {
  const slug = firmName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const [imgFailed, setImgFailed] = useState(false);
  const [hovered, setHovered]     = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {imgFailed ? (
        <span className="text-[10px] text-gray-400 leading-tight">{firmName}</span>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={`/api/investor-logos/${slug}`}
          alt={firmName}
          className="h-5 object-contain max-w-[70px]"
          onError={() => setImgFailed(true)}
        />
      )}
      {hovered && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <span className="block whitespace-nowrap bg-white border border-gray-200 shadow-md rounded-md px-2 py-1 text-xs font-medium text-gray-800">
            {firmName}
          </span>
        </span>
      )}
    </span>
  );
}
import {
  Company,
  fmtUSD, fmtUSDFull, fmtPct, fmtMOIC, toSlug,
  isSafe,
} from './lib/portfolio';

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [companies, setCompanies]   = useState<Company[]>([]);
  const [fundSizes, setFundSizes]   = useState({ ac1: 0, ac2: 0, ac3: 0 });
  const [loading, setLoading]       = useState(true);
  const [fundFilter, setFundFilter]         = useState('All');
  const [catFilter, setCatFilter]           = useState('All');
  const [coinvestorFilter, setCoinvestorFilter] = useState('All');
  const [expanded, setExpanded]             = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((data) => { setCompanies(data.companies || []); setFundSizes(data.fundSizes || { ac1: 0, ac2: 0, ac3: 0 }); setLoading(false); });
  }, []);

  const toggleExpand = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  // ── Firm AUM ─────────────────────────────────────────────────────────────
  let ac1Invested = 0, ac1Value = 0;
  let ac2Invested = 0, ac2Value = 0;
  let ac3Invested = 0, ac3Value = 0;
  let catalystValue = 0;
  for (const c of companies) {
    if (c.ac1Investment) {
      ac1Invested += c.ac1Investment;
      ac1Value    += c.ac1CurrentValue;
    }
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
  // For AC1, only treat it as a fund (with undeployed capital) when a committed
  // capital figure is set; otherwise just count its current value.
  const ac1AUM = fundSizes.ac1 > 0
    ? (fundSizes.ac1 - ac1Invested + ac1Value)
    : ac1Value;
  const ac2AUM = fundSizes.ac2 - ac2Invested + ac2Value;
  const ac3AUM = fundSizes.ac3 - ac3Invested + ac3Value;
  const firmAUM = ac1AUM + ac2AUM + ac3AUM + catalystValue;

  // Per-fund breakdown shown in the Firm AUM hover tooltip. `dryPowder` is
  // null for funds that don't have committed capital (Catalyst always; AC1
  // until Fund I committed capital is added to the Track Record summary).
  const aumBreakdown: {
    label: string;
    dryPowder: number | null;
    deployedValue: number;
    total: number;
  }[] = [
    {
      label: 'AC1',
      dryPowder: fundSizes.ac1 > 0 ? fundSizes.ac1 - ac1Invested : null,
      deployedValue: ac1Value,
      total: ac1AUM,
    },
    {
      label: 'AC2',
      dryPowder: fundSizes.ac2 > 0 ? fundSizes.ac2 - ac2Invested : null,
      deployedValue: ac2Value,
      total: ac2AUM,
    },
    {
      label: 'AC3',
      dryPowder: fundSizes.ac3 > 0 ? fundSizes.ac3 - ac3Invested : null,
      deployedValue: ac3Value,
      total: ac3AUM,
    },
    {
      label: 'Catalyst',
      dryPowder: null,
      deployedValue: catalystValue,
      total: catalystValue,
    },
  ];

  // ── Filter ────────────────────────────────────────────────────────────────
  // Returns the dollars invested in a company that count under the current
  // fund filter (e.g. when the filter is "AC2", only AC2 dollars; when "All",
  // sum across all funds). Used both for filtering and for sort order.
  const investedUnderFilter = (c: Company) => {
    if (fundFilter === 'AC1')      return c.ac1Investment;
    if (fundFilter === 'AC2')      return c.ac2Investment;
    if (fundFilter === 'AC3')      return c.ac3Investment;
    if (fundFilter === 'Catalyst') return c.catalystInvestment;
    return c.ac1Investment + c.ac2Investment + c.ac3Investment + c.catalystInvestment;
  };

  // Collect all unique investors (leads + co-investors) across every company's tranches
  const allCoInvestors = useMemo(() => {
    const set = new Set<string>();
    for (const c of companies) {
      const allTranches = [
        ...(c.ac1Tranches || []),
        ...(c.ac2Tranches || []),
        ...(c.ac3Tranches || []),
        ...(c.catalystTranches || []),
      ];
      for (const t of allTranches) {
        (t.leadInvestor || '').split(',').map((s: string) => s.trim()).filter(Boolean)
          .forEach((name: string) => set.add(name));
        (t.notableCoInvestors || '').split(',').map((s: string) => s.trim()).filter(Boolean)
          .forEach((name: string) => set.add(name));
      }
    }
    return Array.from(set)
      .filter((name) => name.toLowerCase() !== 'also capital')
      .sort();
  }, [companies]);

  const getAllTranches = (c: Company) => [
    ...(c.ac1Tranches || []),
    ...(c.ac2Tranches || []),
    ...(c.ac3Tranches || []),
    ...(c.catalystTranches || []),
  ];

  const filtered = companies
    .filter((c) => {
      const fundOk =
        fundFilter === 'All' ||
        (fundFilter === 'AC1'      && c.ac1Investment > 0)      ||
        (fundFilter === 'AC2'      && c.ac2Investment > 0)      ||
        (fundFilter === 'AC3'      && c.ac3Investment > 0)      ||
        (fundFilter === 'Catalyst' && c.catalystInvestment > 0);
      const cat = c.category.toLowerCase();
      const catOk =
        catFilter === 'All' ||
        cat === catFilter.toLowerCase() ||
        (catFilter.toLowerCase() === 'opportunistic' && cat.includes('scout fund'));
      const splitNames = (csv: string) => (csv || '').split(',').map((s: string) => s.trim());
      const coinvestorOk =
        coinvestorFilter === 'All' ||
        getAllTranches(c).some((t) =>
          splitNames(t.leadInvestor).includes(coinvestorFilter) ||
          splitNames(t.notableCoInvestors).includes(coinvestorFilter)
        );
      return fundOk && catOk && coinvestorOk;
    })
    .sort((a, b) => investedUnderFilter(b) - investedUnderFilter(a));

  // ── Portfolio stats ───────────────────────────────────────────────────────
  let totalInvested = 0;
  let totalValue    = 0;
  for (const c of filtered) {
    if ((fundFilter === 'All' || fundFilter === 'AC1') && c.ac1Investment) {
      totalInvested += c.ac1Investment;
      totalValue    += c.ac1CurrentValue;
    }
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
        <div className="flex items-start justify-between">
          <Image
            src="/logos/also-capital.png"
            alt="Also Capital"
            width={160}
            height={40}
            className="object-contain mb-3"
          />
          <Link
            href="/map"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-amber-600 transition-colors mt-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M8.157 2.175a1.5 1.5 0 0 0-1.147 0l-4.084 1.69A1.5 1.5 0 0 0 2 5.251v10.877a1.5 1.5 0 0 0 2.074 1.386l3.51-1.452 4.26 1.763a1.5 1.5 0 0 0 1.146 0l4.083-1.69A1.5 1.5 0 0 0 18 14.748V3.873a1.5 1.5 0 0 0-2.073-1.386l-3.51 1.452-4.26-1.763ZM7.58 5a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5A.75.75 0 0 1 7.58 5Zm5.59 1.75a.75.75 0 0 0-1.5 0v6.5a.75.75 0 0 0 1.5 0v-6.5Z" clipRule="evenodd" />
            </svg>
            Map view
          </Link>
        </div>
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
        <div className="border border-gray-200 rounded-xl p-5 relative group">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Firm AUM</p>
          <p className="text-2xl font-medium text-gray-900">{fmtUSDFull(firmAUM)}</p>

          {/* Hover breakdown */}
          <div
            className="
              absolute top-full right-0 mt-2 z-50 w-[26rem]
              bg-white border border-gray-200 rounded-xl shadow-lg p-4
              opacity-0 invisible pointer-events-none
              group-hover:opacity-100 group-hover:visible
              transition-opacity duration-150
            "
          >
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
              AUM Breakdown
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left font-normal pb-2">Fund</th>
                  <th className="text-right font-normal pb-2">Uninvested</th>
                  <th className="text-right font-normal pb-2">Deployed Value</th>
                  <th className="text-right font-normal pb-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {aumBreakdown.map((row) => (
                  <tr key={row.label} className="text-gray-900">
                    <td className="py-1">{row.label}</td>
                    <td className="text-right py-1 text-gray-500">
                      {row.dryPowder === null ? '—' : fmtUSDFull(row.dryPowder)}
                    </td>
                    <td className="text-right py-1">
                      {fmtUSDFull(row.deployedValue)}
                    </td>
                    <td className="text-right py-1 font-medium">
                      {fmtUSDFull(row.total)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-gray-200">
                  <td className="pt-2 font-medium">Firm AUM</td>
                  <td colSpan={2}></td>
                  <td className="text-right pt-2 font-medium">
                    {fmtUSDFull(firmAUM)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 flex-wrap mb-8">
        {['All', 'AC1', 'AC2', 'AC3', 'Catalyst'].map((f) => (
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
        {allCoInvestors.length > 0 && (
          <>
            <div className="w-px h-6 bg-gray-200 mx-1" />
            <select
              value={coinvestorFilter}
              onChange={(e) => setCoinvestorFilter(e.target.value)}
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors cursor-pointer focus:outline-none ${
                coinvestorFilter !== 'All'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              <option value="All">Co-Investor</option>
              {allCoInvestors.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* ── Company Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((company) => {
          const slug   = toSlug(company.name);
          const isOpen = expanded.has(company.name);

          const funds = [
            { label: 'AC1',      investment: company.ac1Investment,      value: company.ac1CurrentValue,      moic: company.ac1MOIC,      ownership: company.ac1Ownership,      shares: company.ac1Shares,      safeCap: company.ac1SafeCap      },
            { label: 'AC2',      investment: company.ac2Investment,      value: company.ac2CurrentValue,      moic: company.ac2MOIC,      ownership: company.ac2Ownership,      shares: company.ac2Shares,      safeCap: company.ac2SafeCap      },
            { label: 'AC3',      investment: company.ac3Investment,      value: company.ac3CurrentValue,      moic: company.ac3MOIC,      ownership: company.ac3Ownership,      shares: company.ac3Shares,      safeCap: company.ac3SafeCap      },
            { label: 'Catalyst', investment: company.catalystInvestment, value: company.catalystCurrentValue, moic: company.catalystMOIC, ownership: company.catalystOwnership, shares: company.catalystShares, safeCap: company.catalystSafeCap },
          ].filter((f) => f.investment > 0);

          const companyInvested  = funds.reduce((s, f) => s + f.investment, 0);
          const companyValue     = funds.reduce((s, f) => s + f.value, 0);
          const companyOwnership = funds.reduce((s, f) => s + f.ownership, 0);
          const companyMOIC = companyInvested > 0 ? companyValue / companyInvested : 0;

          // Collect unique lead investors across all tranches for this company
          const leadNames = Array.from(new Set(
            getAllTranches(company)
              .flatMap((t) => (t.leadInvestor || '').split(',').map((s: string) => s.trim()).filter(Boolean))
          ));

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
                <div className="flex items-start gap-3 mb-4">
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
                  {leadNames.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap justify-end shrink-0 max-w-[170px]">
                      {leadNames.slice(0, 6).map((name) => (
                        <LeadLogoSmall key={name} firmName={name} />
                      ))}
                    </div>
                  )}
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
