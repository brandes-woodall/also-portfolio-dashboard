import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password === process.env.DASHBOARD_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('auth', password, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 });
    return res;
  }
  return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
}