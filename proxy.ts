import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = request.cookies.get('auth')?.value;
  if (auth === password) return NextResponse.next();

  const path = request.nextUrl.pathname;
  if (path === '/login' || path.startsWith('/api/login')) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos).*)'],
};