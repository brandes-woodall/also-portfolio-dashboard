'use client';

import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { Company, toSlug, fmtUSD } from '../lib/portfolio';

interface PinData {
  company: Company;
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  companies: Company[];
}

export default function MapClient({ companies }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markersRef   = useRef<L.Marker[]>([]);
  const [pins, setPins]   = useState<PinData[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, loading: true });

  // ── Initialise Leaflet map once ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [38.5, -96],
      zoom: 4,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Geocode addresses and build pins progressively ────────────────────────
  useEffect(() => {
    let mounted = true;

    async function run() {
      // Collect all (company, address) pairs — split on | ; or newlines only,
      // since commas appear within addresses themselves.
      const entries: { company: Company; address: string }[] = [];
      for (const c of companies) {
        if (!c.address?.trim()) continue;
        const parts = c.address
          .split(/\s*[|;\n]\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const addr of parts) {
          entries.push({ company: c, address: addr });
        }
      }

      if (!mounted) return;
      setProgress({ done: 0, total: entries.length, loading: true });

      for (const { company, address } of entries) {
        if (!mounted) break;
        try {
          const res = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address }),
          });
          if (res.ok) {
            const { lat, lng } = await res.json();
            if (mounted) setPins((prev) => [...prev, { company, address, lat, lng }]);
          }
        } catch { /* skip */ }

        if (mounted) setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
      }

      if (mounted) setProgress((prev) => ({ ...prev, loading: false }));
    }

    run();
    return () => { mounted = false; };
  }, [companies]);

  // ── Add a marker each time a new pin arrives ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pins.length === 0) return;

    const pin = pins[pins.length - 1]; // only the newest
    const slug = toSlug(pin.company.name);

    const initials = pin.company.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');

    // ── Custom circular logo icon ─────────────────────────────────────────
    const iconHtml = `
      <div style="
        width:40px;height:40px;border-radius:50%;
        border:2.5px solid white;
        box-shadow:0 2px 10px rgba(0,0,0,0.22);
        background:#f9fafb;overflow:hidden;
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;
      ">
        <img
          src="/api/logos/${slug}"
          style="width:100%;height:100%;object-fit:contain;"
          onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:11px;font-weight:700;color:#6b7280\\'>${initials}</span>'"
        />
      </div>
    `;

    const icon = L.divIcon({
      className: '',
      html: iconHtml,
      iconSize:   [40, 40],
      iconAnchor: [20, 20],
      popupAnchor:[0, -24],
    });

    // ── Fund tags ─────────────────────────────────────────────────────────
    const fundTags = [
      pin.company.ac1Investment      > 0 ? 'AC1'      : null,
      pin.company.ac2Investment      > 0 ? 'AC2'      : null,
      pin.company.ac3Investment      > 0 ? 'AC3'      : null,
      pin.company.catalystInvestment > 0 ? 'Catalyst' : null,
    ]
      .filter(Boolean)
      .map(
        (f) =>
          `<span style="display:inline-block;font-size:10px;padding:1px 6px;border-radius:9999px;background:#f3f4f6;color:#4b5563;margin-right:3px;">${f}</span>`
      )
      .join('');

    const totalInvested =
      pin.company.ac1Investment + pin.company.ac2Investment +
      pin.company.ac3Investment + pin.company.catalystInvestment;

    // ── Popup HTML ────────────────────────────────────────────────────────
    const popupHtml = `
      <div style="display:flex;align-items:flex-start;gap:10px;min-width:200px;max-width:260px;padding:4px 2px;">
        <img
          src="/api/logos/${slug}"
          style="width:38px;height:38px;object-fit:contain;border-radius:8px;border:1px solid #e5e7eb;flex-shrink:0;"
          onerror="this.style.display='none'"
        />
        <div style="min-width:0;">
          <p style="font-weight:600;font-size:14px;margin:0 0 3px;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${pin.company.name}
          </p>
          <p style="font-size:11px;color:#9ca3af;margin:0 0 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${pin.address}
          </p>
          <div style="margin-bottom:7px;">${fundTags}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-size:11px;color:#6b7280;">Invested: <strong style="color:#111827;">${fmtUSD(totalInvested)}</strong></span>
            <a href="/company/${slug}" style="font-size:11px;color:#d97706;font-weight:500;text-decoration:none;white-space:nowrap;">
              View details →
            </a>
          </div>
        </div>
      </div>
    `;

    const marker = L.marker([pin.lat, pin.lng], { icon })
      .bindPopup(popupHtml, { maxWidth: 300, minWidth: 220 })
      .addTo(map);

    markersRef.current.push(marker);
  }, [pins]);

  // ── Fit bounds once loading finishes ─────────────────────────────────────
  useEffect(() => {
    if (progress.loading || markersRef.current.length === 0 || !mapRef.current) return;
    const group = L.featureGroup(markersRef.current);
    const bounds = group.getBounds();
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds.pad(0.12), { maxZoom: 10, animate: true });
    }
  }, [progress.loading]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Progress indicator */}
      {progress.loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-xl shadow-md px-4 py-2 flex items-center gap-2.5 text-sm text-gray-600 pointer-events-none">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse inline-block" />
          Locating companies…
          {progress.total > 0 && (
            <span className="text-gray-400">{progress.done}/{progress.total}</span>
          )}
        </div>
      )}

      {/* Pin count badge */}
      {!progress.loading && pins.length > 0 && (
        <div className="absolute bottom-6 left-4 z-[1000] bg-white rounded-xl shadow-md px-3 py-1.5 text-xs text-gray-500 pointer-events-none">
          {pins.length} location{pins.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
