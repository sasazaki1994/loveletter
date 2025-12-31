'use client';

import { useState } from "react";
import { AlertCircle, Check, Copy, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/client/clipboard";

interface RoomIdDisplayProps {
  roomId: string;
  label?: string;
  className?: string;
  showCopyButton?: boolean;
  variant?: 'default' | 'compact' | 'minimal';
}

export function RoomIdDisplay({
  roomId,
  label = "ルームID",
  className,
  showCopyButton = true,
  variant = 'default',
}: RoomIdDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    if (copying) return;
    
    setCopying(true);
    try {
      setCopyFailed(false);
      const result = await copyToClipboard(roomId);
      if (!result.ok) {
        setCopyFailed(true);
        setCopied(false);
        setTimeout(() => setCopyFailed(false), 2200);
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setCopying(false);
    }
  };

  const formatRoomId = (id: string) => {
    if (variant === 'minimal') {
      return id.slice(0, 8);
    }
    return id;
  };

  if (variant === 'minimal') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          {label}:
        </span>
        <button
          onClick={handleCopy}
          disabled={copying}
          className="font-mono text-sm text-[var(--color-accent-light)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50"
          title={`${roomId} をコピー`}
        >
          {formatRoomId(roomId)}
        </button>
        {showCopyButton && (
          <Button
            variant="ghost"
            onClick={handleCopy}
            disabled={copying}
            className="h-6 w-6 p-0"
            title="コピー"
          >
            {copying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : copied ? (
              <Check className="h-3 w-3 text-[var(--color-success-light)]" />
            ) : copyFailed ? (
              <AlertCircle className="h-3 w-3 text-[var(--color-warn-light)]" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.6)] px-3 py-2", className)}>
        <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          {label}:
        </span>
        <code className="flex-1 font-mono text-sm text-[var(--color-accent-light)] select-all">
          {formatRoomId(roomId)}
        </code>
        {showCopyButton && (
          <Button
            variant="ghost"
            onClick={handleCopy}
            disabled={copying}
            className="h-7 w-7 p-0 shrink-0"
            title="コピー"
          >
            {copying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : copied ? (
              <Check className="h-3.5 w-3.5 text-[var(--color-success-light)]" />
            ) : copyFailed ? (
              <AlertCircle className="h-3.5 w-3.5 text-[var(--color-warn-light)]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <label className="block text-xs uppercase tracking-[0.4em] text-[rgba(215,178,110,0.75)]">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2 rounded-xl border border-[rgba(215,178,110,0.35)] bg-[rgba(12,32,30,0.7)] px-4 py-3">
        <code className="flex-1 font-mono text-base text-[var(--color-accent-light)] select-all break-all">
          {formatRoomId(roomId)}
        </code>
        {showCopyButton && (
          <Button
            variant="outline"
            onClick={handleCopy}
            disabled={copying}
            className="shrink-0"
          >
            {copying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                コピー中...
              </>
            ) : copied ? (
              <>
                <Check className="mr-2 h-4 w-4 text-[var(--color-success-light)]" />
                コピーしました
              </>
            ) : copyFailed ? (
              <>
                <AlertCircle className="mr-2 h-4 w-4 text-[var(--color-warn-light)]" />
                コピー失敗
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                コピー
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

