'use client';
import { useEffect, useState } from 'react';

interface Company {
  name: string; foundingTeam: string; linkedin: string;
  emails: string; website: string; fund: string; category: string;
  ac2Investment: number; ac2Shares: number;
  ac3Investment: number; ac3Shares: number;
  catalystInvestment: number; catalystShares: number;
  pricePerShare: number; sharesOutstanding: number;
}

interface Founder { name: string; linkedin: string; email: string; }

function getDomain(website: string) {
  try { return new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace('www.', ''); }
  catch { return ''; }
}

function parseFounders(foundingTeam: string, linkedin: string, emails: string): Founder[] {
  const names = foundingTeam.split(',').map(s => s.trim()).filter(Boolean);
  const links = linkedin.split(',').map(s => s.trim()).filter(Boolean);
  const mails = emails.split(',').map(s => s.trim()).filter(Boolean);
  return names.map((name, i) => ({ name, linkedin: links[i] || '', email: mails[i] || '' }));
}

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function fmtMOIC(n: number) { return `${n.toFixed(1)}x`; }

type FundFilter = 'All' | 'AC2' | 'AC3' | 'Catalyst';
type CategoryFilter = 'All' | 'Core' | 'Opportunistic';

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-600 border-yellow-200 hover:border-yellow-500'
      }`}
    >
      {label}
    </button>
  );
}

function CompanyCard({ company, fundFilter }: { company: Company; fundFilter: FundFilter }) {
  const domain = getDomain(company.website);
  const [logoError, setLogoError] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const fundTags = company.fund.split(',').map(f => f.trim()).filter(Boolean);
  const founders = parseFounders(company.foundingTeam, company.linkedin, company.emails);
  const websiteUrl = company.website.startsWith('http') ? company.website : `https://${company.website}`;

  const totalInvested = company.ac2Investment + company.ac3Investment + company.catalystInvestment;
  const totalShares = company.ac2Shares + company.ac3Shares + company.catalystShares;
  const totalOwnership = company.sharesOutstanding > 0 ? totalShares / company.sharesOutstanding : 0;
  const moic = totalInvested > 0 ? (totalShares * company.pricePerShare) / totalInvested : 0;
  const hasStats = totalInvested > 0;

  const fundBreakdown = [
    { name: 'AC2', investment: company.ac2Investment, shares: company.ac2Shares },
    { name: 'AC3', investment: company.ac3Investment, shares: company.ac3Shares },
    { name: 'Catalyst', investment: company.catalystInvestment, shares: company.catalystShares },
  ].filter(f => f.investment > 0 || f.shares > 0).map(f => ({
    ...f,
    ownership: company.sharesOutstanding > 0 ? f.shares / company.sharesOutstanding : 0,
    moic: f.investment > 0 ? (f.shares * company.pricePerShare) / f.investment : 0,
  }));

  return (
    <div style={{ backgroundColor: '#fffef5' }} className="rounded-xl border border-yellow-100 p-5 hover:border-yellow-500 transition-colors">
      <div className="flex items-center gap-3 mb-4">
        <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
          {domain && !logoError ? (
            <img
              src={`/logos/${company.name.toLowerCase().replace(/\s+/g, '-')}.png`}
              alt={company.name}
              className="w-10 h-10 rounded-lg object-contain bg-white p-1 border border-yellow-100 hover:bg-[#fffef5] hover:border-yellow-500 transition-all duration-200"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white border border-yellow-100 flex items-center justify-center text-sm font-bold text-gray-500 hover:bg-[#fffef5] hover:border-yellow-500 transition-all duration-200">
              {company.name.charAt(0)}
            </div>
          )}
        </a>
        <div>
          <h3 className="font-semibold text-gray-900">{company.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {fundTags.map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white border border-yellow-200 text-gray-600 font-medium">{tag}</span>
            ))}
            {company.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-yellow-200 text-gray-500">{company.category}</span>
            )}
          </div>
        </div>
      </div>

      {hasStats && (
        <div className="mb-4">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full bg-white border border-yellow-100 rounded-lg p-3 hover:border-yellow-500 transition-colors text-left"
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Total Invested</p>
                <p className="text-sm font-semibold text-gray-800">{fmt$(totalInvested)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Ownership</p>
                <p className="text-sm font-semibold text-gray-800">{fmtPct(totalOwnership)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">MOIC</p>
                <p className="text-sm font-semibold text-gray-800">{fmtMOIC(moic)}</p>
              </div>
            </div>
            {fundBreakdown.length > 1 && (
              <p className="text-xs text-gray-400 text-center mt-2">{showBreakdown ? '▲ hide breakdown' : '▼ view by fund'}</p>
            )}
          </button>

          {showBreakdown && fundBreakdown.length > 1 && (
            <div className="mt-2 space-y-1">
              {fundBreakdown.map(f => (
                <div key={f.name} className="bg-white border border-yellow-100 rounded-lg px-3 py-2 hover:border-yellow-500 transition-colors">
                  <div className="grid grid-cols-4 gap-2 items-center">
                    <span className="text-xs font-medium text-gray-600">{f.name}</span>
                    <span className="text-xs text-gray-700 text-center">{fmt$(f.investment)}</span>
                    <span className="text-xs text-gray-700 text-center">{fmtPct(f.ownership)}</span>
                    <span className="text-xs text-gray-700 text-center">{fmtMOIC(f.moic)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {founders.length > 0 && (
        <div className="space-y-2">
          {founders.map((founder, i) => (
            <div key={i} className="bg-white rounded-lg p-3 border border-yellow-100 hover:bg-[#fffef5] hover:border-yellow-500 transition-all duration-200">
              {founder.linkedin ? (
                <a href={founder.linkedin} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-800 hover:text-yellow-500 hover:underline transition-colors">
                  {founder.name}
                </a>
              ) : (
                <p className="text-sm font-medium text-gray-800">{founder.name}</p>
              )}
              <div className="flex gap-3 mt-1 flex-wrap">
                {founder.email && (
                  <a href={`mailto:${founder.email}`} className="text-xs text-gray-500 hover:text-yellow-500 hover:underline transition-colors">
                    {founder.email}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [fundFilter, setFundFilter] = useState<FundFilter>('All');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');

  useEffect(() => {
    fetch('/api/portfolio').then(r => r.json())
      .then(d => { setCompanies(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filteredCompanies = companies.filter(c => {
    if (fundFilter === 'AC2' && !(c.ac2Investment > 0 || c.ac2Shares > 0)) return false;
    if (fundFilter === 'AC3' && !(c.ac3Investment > 0 || c.ac3Shares > 0)) return false;
    if (fundFilter === 'Catalyst' && !(c.catalystInvestment > 0 || c.catalystShares > 0)) return false;
    if (categoryFilter !== 'All' && !c.category.toLowerCase().includes(categoryFilter.toLowerCase())) return false;
    return true;
  });

  const portfolioStats = filteredCompanies.reduce((acc, c) => {
    let invested = 0;
    let currentValue = 0;
    if (fundFilter === 'All' || fundFilter === 'AC2') { invested += c.ac2Investment; currentValue += c.ac2Shares * c.pricePerShare; }
    if (fundFilter === 'All' || fundFilter === 'AC3') { invested += c.ac3Investment; currentValue += c.ac3Shares * c.pricePerShare; }
    if (fundFilter === 'All' || fundFilter === 'Catalyst') { invested += c.catalystInvestment; currentValue += c.catalystShares * c.pricePerShare; }
    return { invested: acc.invested + invested, currentValue: acc.currentValue + currentValue };
  }, { invested: 0, currentValue: 0 });

  const portfolioMOIC = portfolioStats.invested > 0 ? portfolioStats.currentValue / portfolioStats.invested : 0;

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Portfolio Dashboard</h1>

        {/* Portfolio Stats */}
        <div style={{ backgroundColor: '#fffef5' }} className="rounded-xl border border-yellow-100 p-6 mb-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Invested Capital</p>
              <p className="text-2xl font-bold text-gray-900">{fmt$(portfolioStats.invested)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Current Value</p>
              <p className="text-2xl font-bold text-gray-900">{fmt$(portfolioStats.currentValue)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">MOIC</p>
              <p className="text-2xl font-bold text-gray-900">{fmtMOIC(portfolioMOIC)}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8 items-center">
          <div className="flex gap-2">
            {(['All', 'AC2', 'AC3', 'Catalyst'] as FundFilter[]).map(f => (
              <FilterButton key={f} label={f} active={fundFilter === f} onClick={() => setFundFilter(f)} />
            ))}
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex gap-2">
            {(['All', 'Core', 'Opportunistic'] as CategoryFilter[]).map(c => (
              <FilterButton key={c} label={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} />
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-20">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCompanies.map(c => <CompanyCard key={c.name} company={c} fundFilter={fundFilter} />)}
          </div>
        )}
      </div>
    </main>
  );
}