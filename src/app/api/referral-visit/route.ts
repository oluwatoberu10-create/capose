import { NextResponse } from "next/server";
import { logReferralVisit } from "@/server/services/agents";

/** Records that someone opened an agent's referral link (shown as "link visits" on the agent dashboard). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { code?: unknown; path?: unknown };
    const code = typeof body.code === "string" ? body.code : "";
    const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path : "/";
    const slug = /^\/cars\/([a-z0-9-]+)$/.exec(path.split("?")[0])?.[1] ?? null;
    const ok = await logReferralVisit(code, path, slug);
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
