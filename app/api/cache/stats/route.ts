import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { getCacheStats, resetCacheStats } from "@/lib/server/game-state-cache";

/**
 * キャッシュ統計を取得するAPI（開発環境のみ）
 * GET /api/cache/stats - 統計を取得
 * POST /api/cache/stats - 統計をリセット
 */
export async function GET() {
  // 本番環境では無効化
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_CACHE_STATS) {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 },
    );
  }

  const stats = getCacheStats();
  
  // ヒット率を計算
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? (stats.hits / total) * 100 : 0;

  return NextResponse.json({
    ...stats,
    hitRate: `${hitRate.toFixed(2)}%`,
    totalRequests: total,
  });
}

export async function POST() {
  // 本番環境では無効化
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_CACHE_STATS) {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 },
    );
  }

  resetCacheStats();
  
  return NextResponse.json({
    success: true,
    message: "Cache stats reset",
  });
}

