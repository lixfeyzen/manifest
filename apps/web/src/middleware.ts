import { NextResponse, type NextRequest } from 'next/server';

// UX gate only: redirect based on the *presence* of the session cookie. The API
// does the real validation — a forged cookie passes here but is rejected there.
const AUTH_PAGES = ['/login', '/register'];

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('sid');
  const { pathname } = req.nextUrl;
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
