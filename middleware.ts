import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  const cookie = req.cookies.get('auth')?.value;
  if (cookie === process.env.DASHBOARD_PASSWORD) return NextResponse.next();

  if (req.nextUrl.pathname === '/login') return NextResponse.next();

  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|logos).*)'],
};