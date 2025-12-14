import { NextResponse } from "next/server";

import { buildUserSessionCookies, deleteUserSessionFromRequest } from "@/lib/server/user-auth";

export async function POST(request: Request) {
  await deleteUserSessionFromRequest(request as any);
  const res = NextResponse.json({ ok: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
  for (const c of buildUserSessionCookies(null)) res.headers.append("Set-Cookie", c);
  return res;
}


