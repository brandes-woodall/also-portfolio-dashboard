import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { simpleParser } from 'mailparser';

const DATA_DIR = path.join(process.cwd(), 'data', 'emails');

// GET /api/emails/[slug] — return all emails for a company, sorted newest first
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const dir = path.join(DATA_DIR, slug);
  try {
    const files = await fs.readdir(dir);
    const emails = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          const raw = await fs.readFile(path.join(dir, f), 'utf-8');
          return JSON.parse(raw);
        })
    );
    emails.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return NextResponse.json(emails);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/emails/[slug] — upload a .eml or .pdf file, parse/save metadata
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const emailId = Date.now().toString();
  const dir = path.join(DATA_DIR, slug);
  await fs.mkdir(dir, { recursive: true });

  const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

  if (isPdf) {
    // Save the PDF file alongside the JSON metadata
    const pdfFilename = `${emailId}.pdf`;
    await fs.writeFile(path.join(dir, pdfFilename), buffer);

    const emailData = {
      id:       emailId,
      subject:  file.name.replace(/\.pdf$/i, ''),
      from:     '',
      date:     new Date().toISOString(),
      textBody: '',
      htmlBody: '',
      filename: file.name,
      isPdf:    true,
      pdfFile:  pdfFilename,
    };

    await fs.writeFile(
      path.join(dir, `${emailId}.json`),
      JSON.stringify(emailData, null, 2)
    );

    return NextResponse.json(emailData);
  }

  // .eml file — parse with mailparser
  const parsed = await simpleParser(buffer, { skipHtmlToText: true });

  // Strip unresolvable cid: image references from the HTML so they don't show
  // as broken image icons — external images (https://) will still load fine
  const htmlBody = (parsed.html || '').replace(/<img[^>]+src=["']cid:[^"']+["'][^>]*\/?>/gi, '');

  const emailData = {
    id:       emailId,
    subject:  parsed.subject || '(No subject)',
    from:     parsed.from?.text || '',
    date:     parsed.date?.toISOString() || new Date().toISOString(),
    textBody: parsed.text || '',
    htmlBody,
    filename: file.name,
  };

  await fs.writeFile(
    path.join(dir, `${emailId}.json`),
    JSON.stringify(emailData, null, 2)
  );

  return NextResponse.json(emailData);
}

// DELETE /api/emails/[slug]?id=... — remove a single email and its attachments
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const file = path.join(DATA_DIR, slug, `${id}.json`);
  try {
    await fs.unlink(file);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
