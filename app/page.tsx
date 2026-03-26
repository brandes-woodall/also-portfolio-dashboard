'use client';

import { useEffect, useState, useRef } from 'react';
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

interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  textBody: string;
  htmlBody: string;
  filename: string;
}

interface PressLink {
  id: string;
  url: string;
  title: string;
  date: string | null;
  thumbnail: string | null;
  addedAt: string;
}

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtUSD = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toFixed(0)}`;

const fmtUSDFull = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US');

const fmtPct  = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtMOIC = (n: number) => `${n.toFixed(1)}x`;

const toSlug = (name: string) =>
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// ── SAFE helpers ──────────────────────────────────────────────────────────────
const isSafe = (shares: number, safeCap: number) => shares === 0 && safeCap > 0;

const getCurrentValue = (
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
  if (isSafe(shares, safeCap)) return 1.0;
  if (!shares || !pricePerShare) return 0;
  return (shares * pricePerShare) / investment;
};

// ── EmailModal ────────────────────────────────────────────────────────────────
function EmailModal({ email, onClose }: { email: Email; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900">{email.subject}</h3>
            <p className="text-xs text-gray-400 mt-1">From: {email.from}</p>
            <p className="text-xs text-gray-400">
              {new Date(email.date).toLocaleString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit',
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {email.htmlBody ? (
            <iframe
              srcDoc={email.htmlBody}
              sandbox="allow-same-origin"
              className="w-full border-0 rounded-b-2xl"
              style={{ minHeight: '400px', height: '60vh' }}
              title={email.subject}
            />
          ) : (
            <div className="p-5">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {email.textBody || '(No body)'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── EmailSection ──────────────────────────────────────────────────────────────
function EmailSection({ slug }: { slug: string }) {
  const [emails, setEmails]     = useState<Email[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [isOpen, setIsOpen]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openEmail, setOpenEmail] = useState<Email | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (loaded) return;
    setLoading(true);
    const res  = await fetch(`/api/emails/${slug}`);
    const data = await res.json();
    setEmails(data);
    setLoaded(true);
    setLoading(false);
  };

  const toggle = () => {
    if (!isOpen) load();
    setIsOpen((o) => !o);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    const res   = await fetch(`/api/emails/${slug}`, { method: 'POST', body: form });
    const email = await res.json();
    setEmails((prev) => [email, ...prev]);
    setLoaded(true);
    setIsOpen(true);
    setUploading(false);
    e.target.value = '';
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between">
          <button
            onClick={toggle}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {isOpen ? '▲' : '▼'} Emails
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-xs text-gray-400 hover:text-yellow-600 transition-colors disabled:opacity-40"
          >
            {uploading ? 'Uploading…' : '↑ .eml'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".eml"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        {isOpen && (
          <div className="mt-1.5 space-y-1">
            {loading ? (
              <p className="text-xs text-gray-400 py-1">Loading…</p>
            ) : emails.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">
                No emails yet — upload a .eml file.
              </p>
            ) : (
              emails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => setOpenEmail(email)}
                  className="w-full text-left text-xs px-2.5 py-2 rounded-lg bg-gray-50 hover:bg-yellow-50 border border-transparent hover:border-yellow-200 transition-colors"
                >
                  <p className="font-medium text-gray-700 truncate">{email.subject}</p>
                  <p className="text-gray-400 mt-0.5 truncate">
                    {email.from} ·{' '}
                    {new Date(email.date).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {openEmail && (
        <EmailModal email={openEmail} onClose={() => setOpenEmail(null)} />
      )}
    </>
  );
}

// ── MediaLightbox ─────────────────────────────────────────────────────────────
interface MediaItem {
  id: string;
  filename: string;
  originalName: string;
  type: 'image' | 'video';
  mimeType: string;
  uploadedAt: string;
}

function MediaLightbox({ item, slug, onClose }: { item: MediaItem; slug: string; onClose: () => void }) {
  const src = `/api/media-files/${slug}/${item.filename}`;
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-8 right-0 text-white/70 hover:text-white text-2xl leading-none"
        >
          ×
        </button>
        <p className="text-white/50 text-xs mb-2 truncate max-w-full">{item.originalName}</p>
        {item.type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.originalName}
            className="max-h-[80vh] max-w-full rounded-xl object-contain"
          />
        ) : (
          <video
            src={src}
            controls
            autoPlay
            className="max-h-[80vh] max-w-full rounded-xl"
          />
        )}
      </div>
    </div>
  );
}

// ── MediaSection ──────────────────────────────────────────────────────────────
function MediaSection({ slug }: { slug: string }) {
  const [items, setItems]         = useState<MediaItem[]>([]);
  const [loaded, setLoaded]       = useState(false);
  const [isOpen, setIsOpen]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox]   = useState<MediaItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (loaded) return;
    const res  = await fetch(`/api/media/${slug}`);
    const data = await res.json();
    setItems(data);
    setLoaded(true);
  };

  const toggle = () => {
    if (!isOpen) load();
    setIsOpen((o) => !o);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    const res  = await fetch(`/api/media/${slug}`, { method: 'POST', body: form });
    const item = await res.json();
    if (!item.error) {
      setItems((prev) => [item, ...prev]);
      setLoaded(true);
      setIsOpen(true);
    }
    setUploading(false);
    e.target.value = '';
  };

  const remove = async (id: string) => {
    await fetch(`/api/media/${slug}?id=${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between">
          <button
            onClick={toggle}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {isOpen ? '▲' : '▼'} Media
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-xs text-gray-400 hover:text-yellow-600 transition-colors disabled:opacity-40"
          >
            {uploading ? 'Uploading…' : '↑ Image / Video'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        {isOpen && (
          <div className="mt-1.5">
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">No media yet — upload an image or video.</p>
            ) : (
              <div className="space-y-1">
                {items.map((item) => (
                  <div key={item.id} className="rounded-lg bg-gray-50 group border border-transparent hover:border-yellow-200 transition-colors">
                    <div className="flex items-center gap-2.5 p-2">
                      <button
                        onClick={() => setLightbox(item)}
                        className="w-10 h-10 rounded overflow-hidden bg-gray-200 shrink-0 hover:opacity-80 transition-opacity"
                      >
                        {item.type === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/media-files/${slug}/${item.filename}`}
                            alt={item.originalName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                            <span className="text-white text-xs">▶</span>
                          </div>
                        )}
                      </button>
                      <button
                        onClick={() => setLightbox(item)}
                        className="flex-1 text-xs font-medium text-gray-700 hover:text-yellow-600 truncate text-left"
                      >
                        {item.originalName}
                      </button>
                      <button
                        onClick={() => remove(item.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {lightbox && (
        <MediaLightbox item={lightbox} slug={slug} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

// ── PressSection ──────────────────────────────────────────────────────────────
function PressSection({ slug }: { slug: string }) {
  const [links, setLinks]         = useState<PressLink[]>([]);
  const [loaded, setLoaded]       = useState(false);
  const [isOpen, setIsOpen]       = useState(false);
  const [adding, setAdding]       = useState(false);
  const [url, setUrl]             = useState('');
  const [title, setTitle]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate]   = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const thumbRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (loaded) return;
    const res  = await fetch(`/api/press/${slug}`);
    const data = await res.json();
    setLinks(data);
    setLoaded(true);
  };

  const toggle = () => {
    if (!isOpen) load();
    setIsOpen((o) => !o);
  };

  const save = async () => {
    if (!url.trim()) return;
    setSaving(true);
    const res  = await fetch(`/api/press/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim(), title: title.trim() || url.trim() }),
    });
    const link = await res.json();
    setLinks((prev) => [link, ...prev]);
    setLoaded(true);
    setUrl('');
    setTitle('');
    setAdding(false);
    setSaving(false);
    setIsOpen(true);
  };

  const remove = async (id: string) => {
    await fetch(`/api/press/${slug}?id=${id}`, { method: 'DELETE' });
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const openEdit = (link: PressLink) => {
    setEditingId(link.id);
    setEditDate(link.date ? new Date(link.date).toISOString().split('T')[0] : '');
  };

  const closeEdit = () => { setEditingId(null); setEditDate(''); };

  const saveDate = async (id: string) => {
    setEditSaving(true);
    const res = await fetch(`/api/press/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, date: editDate ? new Date(editDate).toISOString() : null }),
    });
    const updated = await res.json();
    setLinks((prev) => prev.map((l) => l.id === id ? { ...l, date: updated.date } : l));
    setEditSaving(false);
    closeEdit();
  };

  const handleThumbUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditSaving(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/press-thumbs/${slug}/${id}`, { method: 'POST', body: form });
    const { thumbnail } = await res.json();
    setLinks((prev) => prev.map((l) => l.id === id ? { ...l, thumbnail } : l));
    setEditSaving(false);
    e.target.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          onClick={toggle}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {isOpen ? '▲' : '▼'} Press
        </button>
        <button
          onClick={() => {
            setAdding((a) => !a);
            if (!isOpen) { load(); setIsOpen(true); }
          }}
          className="text-xs text-gray-400 hover:text-yellow-600 transition-colors"
        >
          {adding ? 'Cancel' : '+ Link'}
        </button>
      </div>

      {adding && (
        <div className="mt-1.5 space-y-1">
          <input
            type="url"
            placeholder="https://techcrunch.com/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            autoFocus
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400"
          />
          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400"
          />
          <button
            onClick={save}
            disabled={!url.trim() || saving}
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : 'Save link'}
          </button>
        </div>
      )}

      {isOpen && (
        <div className="mt-1.5 space-y-1">
          {links.length === 0 && !adding ? (
            <p className="text-xs text-gray-400 py-1">No press links yet.</p>
          ) : (
            links.map((link) => (
              <div
                key={link.id}
                className="rounded-lg bg-gray-50 group overflow-hidden border border-transparent hover:border-yellow-200 transition-colors"
              >
                {/* Link row */}
                <div className="flex items-start gap-2.5 p-2.5">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2.5 flex-1 min-w-0"
                  >
                    {link.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={link.thumbnail}
                        alt=""
                        className="w-12 h-12 rounded object-cover shrink-0 bg-gray-200"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 hover:text-yellow-600 line-clamp-2 leading-snug">
                        {link.title}
                      </p>
                      {link.date && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(link.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                      {(!link.thumbnail || !link.date) && editingId !== link.id && (
                        <p className="text-xs text-gray-300 mt-0.5">missing details</p>
                      )}
                    </div>
                  </a>
                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => editingId === link.id ? closeEdit() : openEdit(link)}
                      className="text-xs text-gray-400 hover:text-yellow-600"
                    >
                      {editingId === link.id ? 'Cancel' : 'Edit'}
                    </button>
                    <button
                      onClick={() => remove(link.id)}
                      className="text-gray-300 hover:text-red-400 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Inline edit form */}
                {editingId === link.id && (
                  <div className="px-2.5 pb-2.5 pt-1 border-t border-gray-100 space-y-2">
                    {/* Thumbnail */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16 shrink-0">Thumbnail</span>
                      <div className="flex items-center gap-2">
                        {link.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={link.thumbnail} alt="" className="w-8 h-8 rounded object-cover bg-gray-200" />
                        )}
                        <button
                          onClick={() => thumbRef.current?.click()}
                          disabled={editSaving}
                          className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-500 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40"
                        >
                          {link.thumbnail ? 'Replace' : 'Upload image'}
                        </button>
                        <input
                          ref={thumbRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleThumbUpload(link.id, e)}
                        />
                      </div>
                    </div>
                    {/* Date */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16 shrink-0">Date</span>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400 flex-1"
                      />
                      <button
                        onClick={() => saveDate(link.id)}
                        disabled={editSaving}
                        className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded hover:bg-gray-700 disabled:opacity-40"
                      >
                        {editSaving ? '…' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [companies, setCompanies]   = useState<Company[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fundFilter, setFundFilter] = useState('All');
  const [catFilter, setCatFilter]   = useState('All');
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());

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

  // ── Firm AUM ─────────────────────────────────────────────────────────────
  const AC2_FUND_SIZE = 22_080_641;
  const AC3_FUND_SIZE = 52_000_000;
  let ac2Invested = 0, ac2Value = 0;
  let ac3Invested = 0, ac3Value = 0;
  let catalystValue = 0;
  for (const c of companies) {
    if (c.ac2Investment) {
      ac2Invested += c.ac2Investment;
      ac2Value    += getCurrentValue(c.ac2Investment, c.ac2Shares, c.ac2SafeCap, c.pricePerShare);
    }
    if (c.ac3Investment) {
      ac3Invested += c.ac3Investment;
      ac3Value    += getCurrentValue(c.ac3Investment, c.ac3Shares, c.ac3SafeCap, c.pricePerShare);
    }
    if (c.catalystInvestment) {
      catalystValue += getCurrentValue(c.catalystInvestment, c.catalystShares, c.catalystSafeCap, c.pricePerShare);
    }
  }
  const firmAUM =
    (AC2_FUND_SIZE - ac2Invested + ac2Value) +
    (AC3_FUND_SIZE - ac3Invested + ac3Value) +
    catalystValue;

  // ── Filter ────────────────────────────────────────────────────────────────
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

  // ── Portfolio stats ───────────────────────────────────────────────────────
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
          const slug      = toSlug(company.name);
          const founders  = company.foundingTeam.split(',').map((s) => s.trim()).filter(Boolean);
          const linkedins = company.linkedin.split(',').map((s) => s.trim()).filter(Boolean);
          const emails    = company.emails.split(',').map((s) => s.trim()).filter(Boolean);
          const isOpen    = expanded.has(company.name);

          const funds = [
            { label: 'AC2',      investment: company.ac2Investment,      shares: company.ac2Shares,      safeCap: company.ac2SafeCap      },
            { label: 'AC3',      investment: company.ac3Investment,      shares: company.ac3Shares,      safeCap: company.ac3SafeCap      },
            { label: 'Catalyst', investment: company.catalystInvestment, shares: company.catalystShares, safeCap: company.catalystSafeCap },
          ].filter((f) => f.investment > 0);

          const companyInvested  = funds.reduce((s, f) => s + f.investment, 0);
          const companyValue     = funds.reduce(
            (s, f) => s + getCurrentValue(f.investment, f.shares, f.safeCap, company.pricePerShare), 0
          );
          const companyOwnership = funds.reduce(
            (s, f) => s + getOwnership(f.investment, f.shares, f.safeCap, company.sharesOutstanding), 0
          );
          const companyMOIC = companyInvested > 0 ? companyValue / companyInvested : 0;

          return (
            <div
              key={company.name}
              className="border border-gray-200 rounded-xl p-5 hover:border-yellow-500 hover:bg-[#fffef5] transition-all duration-150 flex flex-col"
            >
              {/* Card header */}
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

              {/* Fund breakdown */}
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
                <div className="border-t border-gray-100 pt-3 mt-auto space-y-2 mb-3">
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

              {/* ── Press, Emails & Media ── */}
              <div className={`border-t border-gray-100 pt-3 space-y-3 ${founders.length === 0 ? 'mt-auto' : ''}`}>
                <PressSection slug={slug} />
                <EmailSection slug={slug} />
                <MediaSection slug={slug} />
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
