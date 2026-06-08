'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Company } from '../lib/portfolio';

// Load the Leaflet map only on the client (Leaflet needs `window`)
const MapClient = dynamic(() => import('./MapClient'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading map…</p>
    </div>
  ),
});

export default function MapPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data.companies || []);
        setLoading(false);
      });
  }, []);

  return (
    <main className="h-screen flex flex-col bg-white">

      {/* ── Header ── */}
      <div className="px-8 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Image
            src="/logos/also-capital.png"
            alt="Also Capital"
            width={130}
            height={32}
            className="object-contain"
          />
          <span className="text-gray-200">|</span>
          <h1
            className="text-lg font-semibold text-gray-900"
            style={{ fontFamily: 'var(--font-eb-garamond)' }}
          >
            Portfolio Map
          </h1>
        </div>
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Portfolio
        </Link>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Loading portfolio…</p>
          </div>
        ) : (
          <MapClient companies={companies} />
        )}
      </div>

    </main>
  );
}
