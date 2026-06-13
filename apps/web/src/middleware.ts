import { NextResponse, type NextRequest } from 'next/server';

// UX gate only: redirect based on the *presence* of the session cookie. The API
// does the real validation: a forged cookie passes here but is rejected there.
const AUTH_PAGES = ['/login'];

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('sid');
  const { pathname } = req.nextUrl;
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // No cookie on a protected page -> go to login. We do NOT bounce away from the
  // auth pages when a cookie is present: a present-but-invalid cookie (e.g. after
  // a session is revoked/DB reset) must still be able to reach /login to re-auth.
  const res =
    !hasSession && !isAuthPage
      ? NextResponse.redirect(new URL('/login', req.url))
      : NextResponse.next();

  // Baseline security headers (defense-in-depth against clickjacking and sniffing).
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  return res;
}

export const config = {
  // Run on everything except Next internals and static assets (incl. the icon).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
