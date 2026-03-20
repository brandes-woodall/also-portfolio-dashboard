import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
  const sheetId = process.env.NEXT_PUBLIC_SHEET_ID;
  const range = 'Sheet1!B3:H100';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length === 0) return NextResponse.json([]);

    const companies = rows.slice(1)
      .filter((row: string[]) => row[0])
      .map((row: string[]) => ({
        name: row[0] || '',
        foundingTeam: row[1] || '',
        linkedin: row[2] || '',
        emails: row[3] || '',
        website: row[4] || '',
        fund: row[5] || '',
        category: row[6] || '',
      }));

    return NextResponse.json(companies);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}