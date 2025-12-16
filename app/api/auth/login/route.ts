import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { users } from "@/drizzle/schema";
import { buildUserSessionCookies, createUserSession, verifyPassword } from "@/lib/server/user-auth";
import { eq } from "drizzle-orm";

const schema = z.object({
  username: z.string().min(1).max(32),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    const username = parsed.username.trim();

    const row = (await db.select().from(users).where(eq(users.username, username)).limit(1))[0];
    if (!row || !(await verifyPassword(parsed.password, row.passwordHash))) {
      return NextResponse.json({ error: "ユーザー名またはパスワードが違います。" }, { status: 401 });
    }

    const { sessionToken } = await createUserSession(row.id);
    const res = NextResponse.json({ user: { id: row.id, username: row.username } }, { status: 200, headers: { "Cache-Control": "no-store" } });
    for (const c of buildUserSessionCookies(sessionToken)) res.headers.append("Set-Cookie", c);
    return res;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "入力が不正です。" }, { status: 400 });
    }
    const isDev = process.env.NODE_ENV === "development";
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "ログインに失敗しました。", ...(isDev && { detail: errorMessage, stack: (error as any)?.stack }) },
      { status: 500 },
    );
  }
}


