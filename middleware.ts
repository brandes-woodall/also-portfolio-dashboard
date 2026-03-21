import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get('auth')?.value;
  if (cookie === password) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/api/login')) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|logos).*)'],
};