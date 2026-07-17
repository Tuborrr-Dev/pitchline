import { NextResponse, type NextRequest } from "next/server";

const WALLET_AUTH_COOKIE = "pitchline_wallet_authorized";

export function proxy(request: NextRequest) {
  const isAuthorized = request.cookies.get(WALLET_AUTH_COOKIE)?.value === "true";

  if (isAuthorized) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("walletRequired", "1");

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/markets/:path*", "/match/:path*"],
};
