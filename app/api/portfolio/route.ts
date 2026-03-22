import { NextResponse } from 'next/server';

const parseNum = (s: string) => parseFloat((s || '').replace(/[$, ]/g, '')) || 0;

export async function GET() {
  const apiKey  = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
  const sheetId = process.env.NEXT_PUBLIC_SHEET_ID;
  const range   = 'Sheet1!B3:S100'; // extended to column S
  const url     = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

  try {
    const res  = await fetch(url, { next: { revalidate: 0 } }); // no caching
    const data = await res.json();
    const rows = data.values || [];

    if (rows.length === 0) return NextResponse.json([]);

    const companies = rows
      .slice(1)
      .filter((row: string[]) => row[0])
      .map((row: string[]) => ({
        name:               row[0]  || '',
        foundingTeam:       row[1]  || '',
        linkedin:           row[2]  || '',
        emails:             row[3]  || '',
        website:            row[4]  || '',
        fund:               row[5]  || '',
        category:           row[6]  || '',
        // ── AC2 ──────────────────────────────
        ac2Investment:      parseNum(row[7]),   // col I
        ac2SafeCap:         parseNum(row[8]),   // col J
        ac2Shares:          parseNum(row[9]),   // col K
        // ── AC3 ──────────────────────────────
        ac3Investment:      parseNum(row[10]),  // col L
        ac3SafeCap:         parseNum(row[11]),  // col M
        ac3Shares:          parseNum(row[12]),  // col N
        // ── Catalyst ─────────────────────────
        catalystInvestment: parseNum(row[13]),  // col O
        catalystSafeCap:    parseNum(row[14]),  // col P
        catalystShares:     parseNum(row[15]),  // col Q
        // ── Priced round shared fields ───────
        pricePerShare:      parseNum(row[16]),  // col R
        sharesOutstanding:  parseNum(row[17]),  // col S
      }));

    return NextResponse.json(companies);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}