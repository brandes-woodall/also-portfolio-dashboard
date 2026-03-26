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

// POST /api/emails/[slug] — upload a .eml file, parse it, and save metadata + attachments
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
  const parsed = await simpleParser(buffer);

  const emailId = Date.now().toString();
  let htmlBody = parsed.html || '';

  // Extract and save embedded (CID) images so they load in the HTML view
  if (parsed.attachments && parsed.attachments.length > 0) {
    const attachmentDir = path.join(DATA_DIR, slug, `${emailId}-attachments`);
    await fs.mkdir(attachmentDir, { recursive: true });

    for (const attachment of parsed.attachments) {
      if (attachment.cid && attachment.content) {
        // Sanitise the CID into a safe filename
        const safeName = attachment.cid.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        await fs.writeFile(path.join(attachmentDir, safeName), attachment.content);

        // Rewrite cid: references in the HTML so the browser can load them
        const escaped = attachment.cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        htmlBody = htmlBody.replace(
          new RegExp(`cid:${escaped}`, 'gi'),
          `/api/email-attachments/${slug}/${emailId}/${safeName}`
        );
      }
    }
  }

  const emailData = {
    id:       emailId,
    subject:  parsed.subject  || '(No subject)',
    from:     parsed.from?.text || '',
    date:     parsed.date?.toISOString() || new Date().toISOString(),
    textBody: parsed.text  || '',
    htmlBody,
    filename: file.name,
  };

  const dir = path.join(DATA_DIR, slug);
  await fs.mkdir(dir, { recursive: true });
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
  const attachmentDir = path.join(DATA_DIR, slug, `${id}-attachments`);
  try {
    await fs.unlink(file);
    // Clean up attachments if they exist
    await fs.rm(attachmentDir, { recursive: true, force: true });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
