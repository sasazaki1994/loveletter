import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/server/user-auth";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request as any);
  return NextResponse.json({ user }, { status: 200, headers: { "Cache-Control": "no-store" } });
}


