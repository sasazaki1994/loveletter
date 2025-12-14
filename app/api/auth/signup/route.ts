import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { users } from "@/drizzle/schema";
import { createUserSession, hashPassword, buildUserSessionCookies } from "@/lib/server/user-auth";
import { eq } from "drizzle-orm";

const schema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "ユーザー名は英数字と_のみ使用できます"),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    const username = parsed.username.trim();

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: "そのユーザー名は既に使用されています。" }, { status: 409 });
    }

    const [user] = await db
      .insert(users)
      .values({ username, passwordHash: hashPassword(parsed.password) })
      .returning({ id: users.id, username: users.username });

    const { sessionToken } = await createUserSession(user.id);
    const res = NextResponse.json({ user }, { status: 200, headers: { "Cache-Control": "no-store" } });
    for (const c of buildUserSessionCookies(sessionToken)) res.headers.append("Set-Cookie", c);
    return res;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "入力が不正です。" }, { status: 400 });
    }
    const isDev = process.env.NODE_ENV === "development";
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "サインアップに失敗しました。", ...(isDev && { detail: errorMessage, stack: (error as any)?.stack }) },
      { status: 500 },
    );
  }
}


