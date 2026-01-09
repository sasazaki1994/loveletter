'use client';

import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorAlertProps {
  error: string;
  loading?: boolean;
  onRetry?: () => void;
  onReload?: () => void;
  onDismiss?: () => void;
}

export function ErrorAlert({ error, loading, onRetry, onReload, onDismiss }: ErrorAlertProps) {
  const showReconnectActions = error.includes("接続が回復");

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className="pointer-events-auto fixed left-1/2 top-4 z-40 w-full max-w-md -translate-x-1/2"
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-4 flex items-start gap-3 rounded-xl border border-[rgba(215,120,110,0.4)] bg-[rgba(60,20,18,0.85)] px-4 py-3 shadow-lg backdrop-blur-sm">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-warn-light)]" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-[var(--color-warn-light)]">{error}</p>
          {showReconnectActions && onRetry && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onRetry}
                disabled={loading}
                className="h-7 text-xs"
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                再試行
              </Button>
              {onReload && (
                <Button
                  variant="ghost"
                  onClick={onReload}
                  className="h-7 text-xs"
                >
                  ページを再読み込み
                </Button>
              )}
            </div>
          )}
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            onClick={onDismiss}
            className="h-7 w-7 shrink-0 p-0 text-[var(--color-warn-light)] hover:bg-[rgba(215,120,110,0.15)]"
            aria-label="エラーを閉じる"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
