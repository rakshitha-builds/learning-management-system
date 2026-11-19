import { NextRequest, NextResponse } from "next/server";

// Cheap first line of defence: pages that need a session redirect to /login when no session cookie is present.
// The real check happens on the API (every request is verified server-side).
export function middleware(req: NextRequest) {
  if (!req.cookies.get("cw_token")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/w/:path*", "/profile/:path*"] };
