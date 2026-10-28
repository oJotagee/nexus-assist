import { NextResponse } from 'next/server';

import { auth, homeFor } from '@/lib/auth';

const EMPLOYEE_AREAS = ['/atendimento', '/perfil'];
const ANALYST_AREAS = ['/console'];

/** Protege as áreas por papel: funcionário não entra no console e vice-versa. */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  if (pathname === '/login' || pathname === '/') {
    if (role) return NextResponse.redirect(new URL(homeFor(role), req.nextUrl));
    if (pathname === '/') return NextResponse.redirect(new URL('/login', req.nextUrl));
    return;
  }

  if (!role) return NextResponse.redirect(new URL('/login', req.nextUrl));

  const wrongArea =
    (role === 'ANALYST' && EMPLOYEE_AREAS.some((area) => pathname.startsWith(area))) ||
    (role === 'EMPLOYEE' && ANALYST_AREAS.some((area) => pathname.startsWith(area)));

  if (wrongArea) return NextResponse.redirect(new URL(homeFor(role), req.nextUrl));
});

export const config = {
  matcher: ['/', '/login', '/atendimento/:path*', '/perfil/:path*', '/console/:path*'],
};
