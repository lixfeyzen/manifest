import { NextResponse, type NextRequest } from 'next/server';

// UX gate only: redirect based on the *presence* of the session cookie. The API
// does the real validation — a forged cookie passes here but is rejected there.
const AUTH_PAGES = ['/login', '/register'];

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('sid');
  const { pathname } = req.nextUrl;
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // No cookie on a protected page → go to login. We do NOT bounce away from the
  // auth pages when a cookie is present: a present-but-invalid cookie (e.g. after
  // a session is revoked/DB reset) must still be able to reach /login to re-auth.
  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets (incl. the icon).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
