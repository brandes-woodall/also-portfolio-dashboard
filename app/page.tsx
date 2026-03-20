'use client';
import { useEffect, useState } from 'react';

interface Company {
  name: string;
  foundingTeam: string;
  linkedin: string;
  emails: string;
  website: string;
  fund: string;
  category: string;
}

interface Founder {
  name: string;
  linkedin: string;
  email: string;
}

function getDomain(website: string) {
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace('www.', '');
  } catch { return ''; }
}

function parseFounders(foundingTeam: string, linkedin: string, emails: string): Founder[] {
  const names = foundingTeam.split(',').map(s => s.trim()).filter(Boolean);
  const links = linkedin.split(',').map(s => s.trim()).filter(Boolean);
  const mails = emails.split(',').map(s => s.trim()).filter(Boolean);
  return names.map((name, i) => ({ name, linkedin: links[i] || '', email: mails[i] || '' }));
}

function CompanyCard({ company }: { company: Company }) {
  const domain = getDomain(company.website);
  const [logoError, setLogoError] = useState(false);
  const fundTags = company.fund.split(',').map(f => f.trim()).filter(Boolean);
  const founders = parseFounders(company.foundingTeam, company.linkedin, company.emails);
  const websiteUrl = company.website.startsWith('http') ? company.website : `https://${company.website}`;

  return (
    <div style={{ backgroundColor: '#fffef5' }} className="rounded-xl border border-yellow-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
          {domain && !logoError ? (
            <img
              src={`/logos/${company.name.toLowerCase().replace(/\s+/g, '-')}.png`}
              alt={company.name}
              className="w-10 h-10 rounded-lg object-contain bg-white p-1 border border-yellow-100 hover:opacity-80 transition-opacity"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white border border-yellow-100 flex items-center justify-center text-sm font-bold text-gray-500 hover:opacity-80 transition-opacity">
              {company.name.charAt(0)}
            </div>
          )}
        </a>
        <div>
          <h3 className="font-semibold text-gray-900">{company.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {fundTags.map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white border border-yellow-200 text-gray-600 font-medium">
                {tag}
              </span>
            ))}
            {company.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-yellow-200 text-gray-500">
                {company.category}
              </span>
            )}
          </div>
        </div>
      </div>

      {founders.length > 0 && (
        <div className="space-y-2">
          {founders.map((founder, i) => (
            <div key={i} className="bg-white rounded-lg p-3 border border-yellow-100">
              <p className="text-sm font-medium text-gray-800">{founder.name}</p>
              <div className="flex gap-3 mt-1 flex-wrap">
                {founder.email && (
                  <a href={`mailto:${founder.email}`} className="text-xs text-gray-500 hover:text-gray-800">
                    {founder.email}
                  </a>
                )}
                {founder.linkedin && (
                  <a href={founder.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                    LinkedIn →
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

  useEffect(() => {
    fetch('/api/portfolio')
      .then(r => r.json())
      .then(d => { setCompanies(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Portfolio Dashboard</h1>
        {loading ? (
          <div className="text-gray-400 text-center py-20">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map(c => <CompanyCard key={c.name} company={c} />)}
          </div>
        )}
      </div>
    </main>
  );
}