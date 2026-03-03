import { NextResponse } from "next/server";

const CACHE_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
};

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  if (!client) {
    return new NextResponse("# ads.txt — NEXT_PUBLIC_ADSENSE_CLIENT is not configured.\n", {
      status: 200,
      headers: CACHE_HEADERS,
    });
  }

  const pubId = client.startsWith("ca-") ? client.slice(3) : client;

  const body = `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`;
  return new NextResponse(body, {
    status: 200,
    headers: CACHE_HEADERS,
  });
}
