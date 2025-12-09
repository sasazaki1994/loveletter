'use client';

import { useMemo, useState } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RoomQrShareProps {
  roomId: string;
  className?: string;
  compact?: boolean;
}

const buildJoinUrl = (roomId: string) => {
  try {
    if (typeof window === "undefined") {
      return `/?join=${encodeURIComponent(roomId)}`;
    }
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.pathname = "/";
    url.searchParams.set("join", roomId);
    return url.toString();
  } catch {
    return `/?join=${encodeURIComponent(roomId)}`;
  }
};

export function RoomQrShare({ roomId, className, compact = false }: RoomQrShareProps) {
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(() => buildJoinUrl(roomId), [roomId]);

  const handleCopyLink = async () => {
    if (copying) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("Failed to copy join URL:", error);
    } finally {
      setCopying(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.6)] p-3 shadow-inner sm:p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[var(--color-accent-light)]" />
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-[0.32em] text-[rgba(215,178,110,0.75)]">QRで参加</p>
            <p className="text-xs text-[var(--color-text-muted)]">スキャンするとロビーの参加フォームが開きます</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={handleCopyLink}
          disabled={copying}
        >
          {copying ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              コピー中
            </>
          ) : copied ? (
            <>
              <Check className="mr-2 h-3.5 w-3.5 text-[var(--color-success-light)]" />
              コピー済み
            </>
          ) : (
            <>
              <Copy className="mr-2 h-3.5 w-3.5" />
              リンクをコピー
            </>
          )}
        </Button>
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="self-start rounded-lg bg-[rgba(9,22,20,0.85)] p-3">
          <QRCodeSVG
            value={joinUrl}
            size={compact ? 156 : 184}
            bgColor="transparent"
            fgColor="#E7D6A0"
            includeMargin
            aria-label="ルーム参加用QRコード"
          />
        </div>
        <div className="flex-1 space-y-2 text-xs text-[var(--color-text-muted)]">
          <p className="break-all font-mono text-sm text-[var(--color-accent-light)]">{joinUrl}</p>
          <p className="text-[11px] leading-relaxed">
            共有用URLにはルームID <span className="font-mono text-[var(--color-accent-light)]">{roomId}</span> を埋め込んでいます。
            ブラウザのカメラからアクセスすると参加フォームが開きます。
          </p>
        </div>
      </div>
    </div>
  );
}


