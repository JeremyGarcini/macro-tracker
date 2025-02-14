import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get access level from cookie
  const accessLevel = request.cookies.get('accessLevel')?.value;
  const path = request.nextUrl.pathname;

  // Allow access to the login page
  if (path === '/') {
    return NextResponse.next();
  }

  // Allow access to static files
  if (path.startsWith('/_next') || path.includes('.')) {
    return NextResponse.next();
  }

  // Basic access paths (only dashboard and calendar)
  const basicPaths = ['/dashboard', '/calendar'];
  const fullPaths = ['/progress', '/settings', '/help'];

  // If no access level, redirect to login
  if (!accessLevel) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If basic access, only allow dashboard and calendar
  if (accessLevel === 'basic' && !basicPaths.includes(path)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Full access can access everything
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};