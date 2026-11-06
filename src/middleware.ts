import { NextResponse, type NextRequest } from "next/server";

export const REF_COOKIE = "am_ref";

/**
 * Persists agent referral attribution: any public URL carrying ?ref=CODE sets
 * a 90-day cookie, so the order is still credited if the customer leaves and
 * comes back later. The code is validated against approved agents when the
 * order is placed, not here (no database access at the edge).
 */
export function middleware(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")?.trim().toUpperCase();
  const res = NextResponse.next();
  if (ref && /^[A-Z0-9]{4,16}$/.test(ref)) {
    res.cookies.set(REF_COOKIE, ref, { maxAge: 60 * 60 * 24 * 90, sameSite: "lax", path: "/", httpOnly: true, secure: req.nextUrl.protocol === "https:" });
  }
  return res;
}

export const config = { matcher: ["/((?!_next|media|demo|api|admin|favicon.ico).*)"] };
