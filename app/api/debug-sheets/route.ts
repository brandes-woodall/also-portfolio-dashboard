import { NextResponse } from 'next/server';

const TRACK_RECORD_SHEET_ID = process.env.TRACK_RECORD_SHEET_ID || '1nSd8etGuisML2tUxM0gYyv8tbx-helISuLQeEzhb5Rw';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY!;

export async function GET() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${TRACK_RECORD_SHEET_ID}?key=${API_KEY}&fields=sheets.properties`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  const data = await res.json();
  const tabs = (data.sheets || []).map((s: { properties: { title: string; sheetId: number } }) => ({
    title: s.properties.title,
    gid: s.properties.sheetId,
  }));
  return NextResponse.json({ tabs });
}
