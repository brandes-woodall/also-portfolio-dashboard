'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Company, Email, PressLink, MediaItem, BoxFolder,
  fmtUSD, fmtUSDRoundM, fmtPct, fmtMOIC, toSlug,
  isSafe,
} from '../../lib/portfolio';

// ── Video embed helpers ──────────────────────────────────────────────────────
function getEmbedUrl(url: string): string | null {
  const ytPatterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of ytPatterns) {
    const m = url.match(re);
    if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1`;
  }
  const boxMatch = url.match(/box\.com\/s\/([a-zA-Z0-9]+)/);
  if (boxMatch) return `https://app.box.com/embed/preview/${boxMatch[1]}?direction=ASC&theme=dark`;
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  return null;
}

// ── InvestorLogo ─────────────────────────────────────────────────────────────
function InvestorLogo({ firmName }: { firmName: string }) {
  const slug = firmName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const [imgFailed, setImgFailed] = useState(false);
  const [version, setVersion]     = useState(0);
  const [hovered, setHovered]     = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const fileRef  = useRef<HTMLInputElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    await fetch(`/api/investor-logos/${slug}`, { method: 'POST', body: form });
    setImgFailed(false);
    setVersion((v) => v + 1);
    setMenuOpen(false);
    e.target.value = '';
  };

  const handleRemove = async () => {
    await fetch(`/api/investor-logos/${slug}`, { method: 'DELETE' });
    setImgFailed(true);
    setMenuOpen(false);
  };

  // ── Text mode (no logo yet) — click to upload ──────────────────────────────
  if (imgFailed) {
    return (
      <span className="relative inline-flex items-center">
        <button
          onClick={() => fileRef.current?.click()}
          className="text-xs text-gray-600 hover:text-amber-600 transition-colors"
          title={`Upload logo for ${firmName}`}
        >
          {firmName}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </span>
    );
  }

  // ── Logo mode — hover shows name, click opens replace/remove menu ──────────
  return (
    <span className="relative inline-flex items-center">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={version}
          src={`/api/investor-logos/${slug}?v=${version}`}
          alt={firmName}
          className="h-7 object-contain max-w-[105px]"
          onError={() => setImgFailed(true)}
        />
        {hovered && !menuOpen && (
          <span className="absolute inset-0 bg-black/50 rounded flex items-center justify-center px-1">
            <span className="text-white text-[10px] font-medium leading-tight text-center">{firmName}</span>
          </span>
        )}
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[130px]"
        >
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 text-gray-700"
          >
            Replace image
          </button>
          <button
            onClick={handleRemove}
            className="w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 text-red-500"
          >
            Remove image
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </span>
  );
}

// ── EmailModal ───────────────────────────────────────────────────────────────
function EmailModal({ email, slug, onClose }: { email: Email; slug: string; onClose: () => void }) {
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
            <h3 className="font-semibold text-gray-900">
              {email.isPdf && <span className="text-xs font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded mr-2">PDF</span>}
              {email.subject}
            </h3>
            {email.from && <p className="text-xs text-gray-400 mt-1">From: {email.from}</p>}
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
          {email.isPdf && email.pdfFile ? (
            <iframe
              src={`/api/email-pdf/${slug}/${email.pdfFile}`}
              className="w-full border-0 rounded-b-2xl"
              style={{ minHeight: '400px', height: '60vh' }}
              title={email.subject}
            />
          ) : email.htmlBody ? (
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

// ── EmailSection ─────────────────────────────────────────────────────────────
function EmailSection({ slug }: { slug: string }) {
  const [emails, setEmails]       = useState<Email[]>([]);
  const [showAll, setShowAll]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openEmail, setOpenEmail] = useState<Email | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/emails/${slug}`).then(r => r.json()).then(setEmails);
  }, [slug]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    const res   = await fetch(`/api/emails/${slug}`, { method: 'POST', body: form });
    const email = await res.json();
    setEmails((prev) => [email, ...prev]);
    setUploading(false);
    e.target.value = '';
  };

  const saveOrder = async (ordered: Email[]) => {
    await fetch(`/api/emails/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: ordered.map((e) => e.id) }),
    });
  };

  const moveEmail = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= emails.length) return;
    const next = [...emails];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setEmails(next);
    await saveOrder(next);
  };

  const deleteEmail = async (email: Email) => {
    if (!confirm(`Remove "${email.subject}"?\n\nThis cannot be undone.`)) return;
    await fetch(`/api/emails/${slug}?id=${email.id}`, { method: 'DELETE' });
    setEmails((prev) => prev.filter((e) => e.id !== email.id));
  };

  const visible = showAll ? emails : emails.slice(0, 3);

  const EmailRow = ({ email, index }: { email: Email; index: number }) => (
    <div
      className="flex items-center rounded-lg bg-gray-50 hover:bg-yellow-50 border border-transparent hover:border-yellow-200 transition-colors group"
      onMouseEnter={() => setHoveredId(email.id)}
      onMouseLeave={() => setHoveredId(null)}
    >
      <button
        onClick={() => setOpenEmail(email)}
        className="flex-1 min-w-0 text-left text-xs px-3 py-2.5"
      >
        <p className="font-medium text-gray-700 truncate">
          {email.isPdf && <span className="text-xs font-medium text-red-500 bg-red-50 px-1 py-0.5 rounded mr-1.5">PDF</span>}
          {email.subject}
        </p>
        <p className="text-gray-400 mt-0.5 truncate">
          {email.from ? `${email.from} · ` : ''}
          {new Date(email.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </button>
      <div className={`flex items-center gap-0.5 pr-2 shrink-0 transition-opacity ${hoveredId === email.id ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); moveEmail(index, 'up'); }}
          disabled={index === 0}
          title="Move up"
          className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-default leading-none"
        >↑</button>
        <button
          onClick={(e) => { e.stopPropagation(); moveEmail(index, 'down'); }}
          disabled={index === emails.length - 1}
          title="Move down"
          className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-default leading-none"
        >↓</button>
        <button
          onClick={(e) => { e.stopPropagation(); deleteEmail(email); }}
          title="Remove"
          className="p-1 ml-0.5 text-gray-300 hover:text-red-500 leading-none"
        >×</button>
      </div>
    </div>
  );

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Emails</h3>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-xs text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-40"
          >
            {uploading ? 'Uploading…' : '↑ Upload .eml / .pdf'}
          </button>
          <input ref={fileRef} type="file" accept=".eml,.pdf,application/pdf" className="hidden" onChange={handleFile} />
        </div>

        {emails.length === 0 ? (
          <p className="text-xs text-gray-300 py-1">No emails yet</p>
        ) : (
          <div className="space-y-1.5">
            {visible.map((email) => {
              const index = emails.indexOf(email);
              return <EmailRow key={email.id} email={email} index={index} />;
            })}
            {emails.length > 3 && (
              <button
                onClick={() => setShowAll((s) => !s)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors pt-0.5"
              >
                {showAll ? '▲ Show less' : `▼ ${emails.length - 3} more`}
              </button>
            )}
          </div>
        )}
      </div>

      {openEmail && <EmailModal email={openEmail} slug={slug} onClose={() => setOpenEmail(null)} />}
    </>
  );
}

// ── InvestmentMaterials (Box folder embeds) ──────────────────────────────────
function getBoxEmbedUrl(url: string): string | null {
  // app.box.com/s/HASH or *.box.com/s/HASH
  const shareMatch = url.match(/box\.com\/s\/([a-zA-Z0-9]+)/);
  if (shareMatch) return `https://app.box.com/embed/s/${shareMatch[1]}?sortColumn=date&view=list`;
  // app.box.com/folder/ID
  const folderMatch = url.match(/box\.com\/folder\/(\d+)/);
  if (folderMatch) return `https://app.box.com/embed/folder/${folderMatch[1]}?sortColumn=date&view=list`;
  return null;
}

function InvestmentMaterials({ slug }: { slug: string }) {
  const [folders, setFolders] = useState<BoxFolder[]>([]);
  const [adding, setAdding]   = useState(false);
  const [url, setUrl]         = useState('');
  const [title, setTitle]     = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    fetch(`/api/box-folders/${slug}`).then((r) => r.json()).then(setFolders);
  }, [slug]);

  const save = async () => {
    if (!url.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/box-folders/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim(), title: title.trim() || 'Investment Materials' }),
    });
    const folder = await res.json();
    setFolders((prev) => [folder, ...prev]);
    setUrl('');
    setTitle('');
    setAdding(false);
    setSaving(false);
  };

  const remove = async (id: string) => {
    await fetch(`/api/box-folders/${slug}?id=${id}`, { method: 'DELETE' });
    setFolders((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Investment Materials</h3>
        <button
          onClick={() => setAdding((a) => !a)}
          className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
        >
          {adding ? 'Cancel' : '+ Box Folder'}
        </button>
      </div>

      {adding && (
        <div className="mb-3 space-y-1">
          <input
            type="url"
            placeholder="https://app.box.com/s/… or https://app.box.com/folder/…"
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
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {folders.length === 0 && !adding ? (
        <p className="text-xs text-gray-300 py-1">No folders linked yet.</p>
      ) : (
        <div className="space-y-4">
          {folders.map((folder) => {
            const embedUrl = getBoxEmbedUrl(folder.url);
            return (
              <div key={folder.id} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <a
                    href={folder.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-gray-600 hover:text-amber-600"
                  >
                    {folder.title}
                  </a>
                  <button
                    onClick={() => remove(folder.id)}
                    className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
                {embedUrl ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <iframe
                      src={embedUrl}
                      className="w-full border-0"
                      style={{ height: '400px' }}
                      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                      title={folder.title}
                    />
                  </div>
                ) : (
                  <a
                    href={folder.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-gray-400 bg-gray-50 rounded-xl p-4 text-center hover:bg-yellow-50 hover:text-amber-600 transition-colors"
                  >
                    Open in Box →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── VideoModal ───────────────────────────────────────────────────────────────
function VideoModal({ title, embedUrl, onClose }: { title: string; embedUrl: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-white/60 text-xs truncate flex-1 mr-4">{title}</p>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none shrink-0"
          >
            ×
          </button>
        </div>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full rounded-xl"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

// ── MediaLightbox ────────────────────────────────────────────────────────────
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={item.originalName}
          className="max-h-[80vh] max-w-full rounded-xl object-contain"
        />
      </div>
    </div>
  );
}

// ── MediaSection ─────────────────────────────────────────────────────────────
function MediaSection({ slug }: { slug: string }) {
  const [items, setItems]           = useState<MediaItem[]>([]);
  const [showAll, setShowAll]       = useState(false);
  const [addMode, setAddMode]       = useState<'none' | 'link' | 'image'>('none');
  const [url, setUrl]               = useState('');
  const [title, setTitle]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [lightbox, setLightbox]     = useState<MediaItem | null>(null);
  const [videoModal, setVideoModal] = useState<MediaItem | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editDate, setEditDate]     = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const fileRef  = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/media/${slug}`).then((r) => r.json()).then(setItems);
  }, [slug]);

  const saveLink = async () => {
    if (!url.trim()) return;
    setSaving(true);
    const res  = await fetch(`/api/media/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim(), title: title.trim() || url.trim() }),
    });
    const item = await res.json();
    setItems((prev) => [item, ...prev]);
    setUrl('');
    setTitle('');
    setAddMode('none');
    setSaving(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    const res  = await fetch(`/api/media/${slug}`, { method: 'POST', body: form });
    const item = await res.json();
    if (!item.error) setItems((prev) => [item, ...prev]);
    setUploading(false);
    setAddMode('none');
    e.target.value = '';
  };

  const remove = async (id: string) => {
    await fetch(`/api/media/${slug}?id=${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const openEdit = (item: MediaItem) => {
    setEditingId(item.id);
    setEditDate(item.date ? new Date(item.date).toISOString().split('T')[0] : '');
  };
  const closeEdit = () => { setEditingId(null); setEditDate(''); };

  const saveDate = async (id: string) => {
    setEditSaving(true);
    const res = await fetch(`/api/media/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, date: editDate ? new Date(editDate + 'T12:00:00').toISOString() : null }),
    });
    const updated = await res.json();
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, date: updated.date } : i));
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
    await fetch(`/api/media/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, thumbnail }),
    });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, thumbnail } : i));
    setEditSaving(false);
    e.target.value = '';
  };

  const visible = showAll ? items : items.slice(0, 6);

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Media</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddMode((m) => m === 'link' ? 'none' : 'link')}
              className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
            >
              {addMode === 'link' ? 'Cancel' : '+ Link'}
            </button>
            <button
              onClick={() => { setAddMode('none'); fileRef.current?.click(); }}
              disabled={uploading}
              className="text-xs text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-40"
            >
              {uploading ? 'Uploading…' : '↑ Image'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        </div>

        {addMode === 'link' && (
          <div className="mb-2 space-y-1">
            <input
              type="url"
              placeholder="https://youtube.com/watch?v=… or drive.google.com/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveLink()}
              autoFocus
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400"
            />
            <input
              type="text"
              placeholder="Title (optional — auto-fetched)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveLink()}
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400"
            />
            <button
              onClick={saveLink}
              disabled={!url.trim() || saving}
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving…' : 'Save link'}
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-xs text-gray-300 py-1">No media yet</p>
        ) : (
          <div className="space-y-1.5">
            {visible.map((item) => (
              <div key={item.id} className="rounded-lg bg-gray-50 group overflow-hidden border border-transparent hover:border-yellow-200 transition-colors">
                {item.type === 'image' ? (
                  <div className="flex items-center gap-2.5 p-2.5">
                    <button
                      onClick={() => setLightbox(item)}
                      className="w-10 h-10 rounded overflow-hidden bg-gray-200 shrink-0 hover:opacity-80 transition-opacity"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/media-files/${slug}/${item.filename}`}
                        alt={item.originalName}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <button
                      onClick={() => setLightbox(item)}
                      className="flex-1 text-xs font-medium text-gray-700 hover:text-amber-600 truncate text-left"
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
                ) : (
                  <>
                    <div className="flex items-start gap-2.5 p-2.5">
                      <button
                        onClick={() => {
                          const embed = getEmbedUrl(item.url!);
                          if (embed) setVideoModal(item);
                          else window.open(item.url, '_blank', 'noopener,noreferrer');
                        }}
                        className="flex items-start gap-2.5 flex-1 min-w-0 text-left"
                      >
                        <div className="w-12 h-12 rounded overflow-hidden bg-gray-800 shrink-0 flex items-center justify-center relative">
                          {item.thumbnail ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.thumbnail}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              <span className="absolute inset-0 flex items-center justify-center text-white/80 text-xs bg-black/20">▶</span>
                            </>
                          ) : (
                            <span className="text-white text-xs">▶</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 hover:text-amber-600 line-clamp-2 leading-snug">
                            {item.title}
                          </p>
                          {item.date && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                          {(!item.thumbnail || !item.date) && editingId !== item.id && (
                            <p className="text-xs text-gray-300 mt-0.5">missing details</p>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => editingId === item.id ? closeEdit() : openEdit(item)}
                          className="text-xs text-gray-400 hover:text-amber-600"
                        >
                          {editingId === item.id ? 'Cancel' : 'Edit'}
                        </button>
                        <button
                          onClick={() => remove(item.id)}
                          className="text-gray-300 hover:text-red-400 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {editingId === item.id && (
                      <div className="px-2.5 pb-2.5 pt-1 border-t border-gray-100 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-16 shrink-0">Thumbnail</span>
                          <div className="flex items-center gap-2">
                            {item.thumbnail && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.thumbnail} alt="" className="w-8 h-8 rounded object-cover bg-gray-200" />
                            )}
                            <button
                              onClick={() => thumbRef.current?.click()}
                              disabled={editSaving}
                              className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-500 hover:border-yellow-400 hover:text-amber-600 disabled:opacity-40"
                            >
                              {item.thumbnail ? 'Replace' : 'Upload image'}
                            </button>
                            <input
                              ref={thumbRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleThumbUpload(item.id, e)}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-16 shrink-0">Date</span>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400 flex-1"
                          />
                          <button
                            onClick={() => saveDate(item.id)}
                            disabled={editSaving}
                            className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded hover:bg-gray-700 disabled:opacity-40"
                          >
                            {editSaving ? '…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {items.length > 6 && (
              <button
                onClick={() => setShowAll((s) => !s)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors pt-0.5"
              >
                {showAll ? '▲ Show less' : `▼ ${items.length - 6} more`}
              </button>
            )}
          </div>
        )}
      </div>

      {lightbox && (
        <MediaLightbox item={lightbox} slug={slug} onClose={() => setLightbox(null)} />
      )}
      {videoModal && (() => {
        const embedUrl = getEmbedUrl(videoModal.url!);
        return embedUrl ? (
          <VideoModal
            title={videoModal.title ?? ''}
            embedUrl={embedUrl}
            onClose={() => setVideoModal(null)}
          />
        ) : null;
      })()}
    </>
  );
}

// ── PressSection ─────────────────────────────────────────────────────────────
function PressSection({ slug }: { slug: string }) {
  const [links, setLinks]           = useState<PressLink[]>([]);
  const [showAll, setShowAll]       = useState(false);
  const [adding, setAdding]         = useState(false);
  const [url, setUrl]               = useState('');
  const [title, setTitle]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editDate, setEditDate]     = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const thumbRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/press/${slug}`).then((r) => r.json()).then(setLinks);
  }, [slug]);

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
    setUrl('');
    setTitle('');
    setAdding(false);
    setSaving(false);
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
      body: JSON.stringify({ id, date: editDate ? new Date(editDate + 'T12:00:00').toISOString() : null }),
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

  const visibleLinks = showAll ? links : links.slice(0, 6);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Press</h3>
        <button
          onClick={() => setAdding((a) => !a)}
          className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
        >
          {adding ? 'Cancel' : '+ Link'}
        </button>
      </div>

      {adding && (
        <div className="mb-2 space-y-1">
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

      <div className="space-y-1.5">
        {links.length === 0 && !adding ? (
          <p className="text-xs text-gray-300 py-1">No press links yet.</p>
        ) : (
          visibleLinks.map((link) => (
            <div
              key={link.id}
              className="rounded-lg bg-gray-50 group overflow-hidden border border-transparent hover:border-yellow-200 transition-colors"
            >
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
                    <p className="text-xs font-medium text-gray-700 hover:text-amber-600 line-clamp-2 leading-snug">
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
                    className="text-xs text-gray-400 hover:text-amber-600"
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

              {editingId === link.id && (
                <div className="px-2.5 pb-2.5 pt-1 border-t border-gray-100 space-y-2">
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
                        className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-500 hover:border-yellow-400 hover:text-amber-600 disabled:opacity-40"
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
        {links.length > 6 && (
          <button
            onClick={() => setShowAll((s) => !s)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors pt-0.5"
          >
            {showAll ? '▲ Show less' : `▼ ${links.length - 6} more`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Company Detail Page ──────────────────────────────────────────────────────
export default function CompanyPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [company, setCompany]       = useState<Company | null>(null);
  const [loading, setLoading]       = useState(true);
  const [logoKey, setLogoKey]       = useState(0);
  const [logoHovered, setLogoHovered] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((data: { companies: Company[] }) => {
        const match = (data.companies || []).find((c) => toSlug(c.name) === slug);
        setCompany(match ?? null);
        setLoading(false);
      });
  }, [slug]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    await fetch(`/api/logos/${slug}`, { method: 'POST', body: form });
    setLogoKey((k) => k + 1);
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-400 text-lg">Loading…</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <p className="text-gray-400 text-lg">Company not found.</p>
        <Link href="/" className="text-sm text-amber-600 hover:text-amber-700 hover:underline">
          ← Back to portfolio
        </Link>
      </div>
    );
  }

  const founders  = company.foundingTeam.split(',').map((s) => s.trim()).filter(Boolean);
  const linkedins = company.linkedin.split(',').map((s) => s.trim()).filter(Boolean);
  const emails    = company.emails.split(',').map((s) => s.trim()).filter(Boolean);

  const funds = [
    { label: 'AC1',      investment: company.ac1Investment,      value: company.ac1CurrentValue,      moic: company.ac1MOIC,      ownership: company.ac1Ownership,      shares: company.ac1Shares,      safeCap: company.ac1SafeCap,      tranches: company.ac1Tranches || []      },
    { label: 'AC2',      investment: company.ac2Investment,      value: company.ac2CurrentValue,      moic: company.ac2MOIC,      ownership: company.ac2Ownership,      shares: company.ac2Shares,      safeCap: company.ac2SafeCap,      tranches: company.ac2Tranches || []      },
    { label: 'AC3',      investment: company.ac3Investment,      value: company.ac3CurrentValue,      moic: company.ac3MOIC,      ownership: company.ac3Ownership,      shares: company.ac3Shares,      safeCap: company.ac3SafeCap,      tranches: company.ac3Tranches || []      },
    { label: 'Catalyst', investment: company.catalystInvestment, value: company.catalystCurrentValue, moic: company.catalystMOIC, ownership: company.catalystOwnership, shares: company.catalystShares, safeCap: company.catalystSafeCap, tranches: company.catalystTranches || [] },
  ].filter((f) => f.investment > 0);

  const companyInvested  = funds.reduce((s, f) => s + f.investment, 0);
  const companyValue     = funds.reduce((s, f) => s + f.value, 0);
  const companyOwnership = funds.reduce((s, f) => s + f.ownership, 0);
  const companyMOIC = companyInvested > 0 ? companyValue / companyInvested : 0;

  return (
    <main className="min-h-screen bg-white px-8 py-10 max-w-4xl mx-auto">

      {/* ── Back link ── */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-8"
      >
        ← Portfolio
      </Link>

      {/* ── Company header ── */}
      <div className="flex items-center gap-4 mb-6">
        {/* Logo — click to upload a new image */}
        <button
          onClick={() => logoFileRef.current?.click()}
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
          title="Upload logo"
          className="relative w-14 h-14 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden focus:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={logoKey}
            src={`/api/logos/${slug}?v=${logoKey}`}
            alt={company.name}
            width={56}
            height={56}
            className="object-contain w-full h-full"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {logoHovered && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-xl">
              <span className="text-white text-lg leading-none">↑</span>
            </div>
          )}
        </button>
        <input
          ref={logoFileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          className="hidden"
          onChange={handleLogoUpload}
        />
        <div className="min-w-0 flex-1">
          <h1
            className="text-3xl font-semibold text-gray-900"
            style={{ fontFamily: 'var(--font-eb-garamond)' }}
          >
            {company.name}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            {company.website && (
              <a
                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                {company.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {company.address && (
              <>
                {company.website && <span className="text-sm text-gray-300">|</span>}
                <a
                  href={`https://maps.apple.com/?q=${encodeURIComponent(company.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  {company.address}
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Tags ── */}
      <div className="flex gap-1.5 flex-wrap mb-6">
        {funds.map((f) => (
          <span key={f.label} className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {f.label}
          </span>
        ))}
        {company.category && (
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow-50 text-amber-700">
            {company.category}
          </span>
        )}
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Invested</p>
          <p className="text-xl font-medium text-gray-900">{fmtUSD(companyInvested)}</p>
        </div>
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ownership</p>
          <p className="text-xl font-medium text-gray-900">{fmtPct(companyOwnership)}</p>
        </div>
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">MOIC</p>
          <p className="text-xl font-medium text-gray-900">{fmtMOIC(companyMOIC)}</p>
        </div>
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Current Stage</p>
          {company.currentStage ? (
            <p className="text-xl font-medium text-gray-900">{company.currentStage}</p>
          ) : (
            <p className="text-xl text-gray-300">—</p>
          )}
        </div>
      </div>

      {/* ── Fund breakdown ── */}
      <div className="mb-8">
          <div className="space-y-4">
            {funds.map((f) => {
              const safe = isSafe(f.shares, f.safeCap);

              return (
                <div key={f.label} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">{f.label}</span>
                    {safe && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium">
                        SAFE
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div>
                      <span className="text-xs text-gray-400">Invested</span>
                      <p className="text-xs font-medium text-gray-700">{fmtUSD(f.investment)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">Value</span>
                      <p className="text-xs font-medium text-gray-700">{fmtUSD(f.value)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">Ownership</span>
                      <p className="text-xs font-medium text-gray-700">{fmtPct(f.ownership)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">MOIC</span>
                      <p className="text-xs font-medium text-gray-700">{fmtMOIC(f.moic)}</p>
                    </div>
                  </div>
                  {/* Tranche detail */}
                  {f.tranches.length > 0 && (
                    <div className="border-t border-gray-200 pt-2 space-y-2">
                      <p className="text-xs text-gray-400 mb-1">Tranches</p>
                      {f.tranches.map((t, i) => {
                        const leads = (t.leadInvestor || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                        return (
                        <div key={i} className="bg-white rounded p-2.5 border border-gray-100">
                          <div className="flex items-center gap-4">
                            {/* Left: stage/date + invested */}
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {t.stage && (
                                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow-50 text-amber-700">
                                    {t.stage}
                                  </span>
                                )}
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  {t.investDate && <span>{t.investDate}</span>}
                                  {(t.type || t.instrument) && <span>· {t.type || t.instrument}</span>}
                                </div>
                              </div>
                              {f.label === 'Catalyst' && t.vehicleName && (
                                <p className="text-xs text-gray-500">{t.vehicleName}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs">
                                <div>
                                  <span className="text-gray-400">Invested </span>
                                  <span className="text-gray-700 font-medium">{fmtUSD(t.amount)}</span>
                                </div>
                                {t.postMoneyCap > 0 && (
                                  <div>
                                    <span className="text-gray-400">Post-Money Valuation </span>
                                    <span className="text-gray-700 font-medium">{fmtUSDRoundM(t.postMoneyCap)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Right: lead investors + co-investors */}
                            {(() => {
                              const coinvestors = (t.notableCoInvestors || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                              return (leads.length > 0 || coinvestors.length > 0) ? (
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {leads.length > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                      <span>Lead Investor{leads.length > 1 ? 's' : ''}:</span>
                                      {leads.map((name: string, li: number) => (
                                        <span key={name} className="flex items-center gap-1.5">
                                          {li > 0 && <span>{li === leads.length - 1 ? 'and' : ','}</span>}
                                          <InvestorLogo firmName={name} />
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {coinvestors.length > 0 && (
                                    <div className="flex items-center gap-3 flex-wrap justify-end">
                                      {coinvestors.map((name: string) => (
                                        <InvestorLogo key={name} firmName={name} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      </div>

      {/* ── Founding Team ── */}
      {founders.length > 0 && (
        <div className="mb-8">
          <h2
            className="text-xl font-semibold text-gray-900 mb-4"
            style={{ fontFamily: 'var(--font-eb-garamond)' }}
          >
            Founding Team
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {founders.map((founder, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 hover:border-yellow-300 transition-colors">
                {linkedins[i] ? (
                  <a
                    href={linkedins[i].startsWith('http') ? linkedins[i] : `https://${linkedins[i]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-900 hover:text-amber-600 hover:underline"
                  >
                    {founder}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-gray-900">{founder}</p>
                )}
                {emails[i] && (
                  <div className="mt-1.5">
                    <a
                      href={`mailto:${emails[i]}`}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      {emails[i]}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Investment Materials (Box folders) ── */}
      <div className="mb-8">
        <h2
          className="text-xl font-semibold text-gray-900 mb-4"
          style={{ fontFamily: 'var(--font-eb-garamond)' }}
        >
          Investment Materials
        </h2>
        <InvestmentMaterials slug={slug} />
      </div>

      {/* ── Press, Emails, Media ── */}
      <div className="space-y-8">
        <PressSection slug={slug} />
        <EmailSection slug={slug} />
        <MediaSection slug={slug} />
      </div>
    </main>
  );
}
