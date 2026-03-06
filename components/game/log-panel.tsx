'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Swords,
  Shield,
  Eye,
  Crown,
  Skull,
  MessageSquare,
  Target,
  AlertTriangle,
  Info,
  HelpCircle,
  RefreshCw,
  Hand,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useGameContext } from "@/components/game/game-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LOG_ICONS: Record<string, React.ElementType> = {
  mask: HelpCircle,
  eye: Eye,
  swords: Swords,
  shield: Shield,
  quill: MessageSquare,
  balance: RefreshCw,
  crown: Crown,
  flame: Skull,
  target: Target,
  info: Info,
  alert: AlertTriangle,
  hand: Hand,
};

const LOG_PANEL_COLLAPSED_KEY = "gameLogPanelCollapsed";

interface LogPanelProps {
  defaultCollapsed?: boolean;
  className?: string;
}

function resolveLogVisualState(log: { icon?: string; type?: string; message: string }) {
  const Icon = LOG_ICONS[log.icon || "info"] ?? Info;
  const isElimination = log.type === "elimination" || log.icon === "flame" || /脱落|自滅/.test(log.message);
  const isWin = log.type === "win" || log.icon === "crown";

  return { Icon, isElimination, isWin };
}

export function LogPanel({ defaultCollapsed = false, className }: LogPanelProps) {
  const { state } = useGameContext();
  const logs = useMemo(() => state?.logs ?? [], [state?.logs]);
  const latestLog = useMemo(() => logs[logs.length - 1], [logs]);

  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const prevLogCountRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LOG_PANEL_COLLAPSED_KEY);
    if (stored === "1") {
      setCollapsed(true);
    } else if (stored === "0") {
      setCollapsed(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOG_PANEL_COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const currentCount = logs.length;
    const previousCount = prevLogCountRef.current;
    const delta = currentCount - previousCount;

    if (delta > 0) {
      if (collapsed) {
        setUnreadCount((prev) => prev + delta);
      } else if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }

    prevLogCountRef.current = currentCount;
  }, [collapsed, logs]);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (!next) {
        setUnreadCount(0);
      }
      return next;
    });
  }, []);

  return (
    <aside
      className={cn(
        "pointer-events-auto w-full overflow-hidden rounded-xl border border-[rgba(215,178,110,0.24)] bg-[rgba(10,24,22,0.82)] shadow-[0_10px_24px_rgba(0,0,0,0.32)] backdrop-blur-md",
        className,
      )}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="flex items-center justify-between border-b border-[rgba(215,178,110,0.16)] bg-[rgba(16,36,33,0.82)] px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="font-heading text-lg text-[var(--color-accent-light)] flex items-center gap-2 drop-shadow-sm">
            <MessageSquare className="h-4 w-4 opacity-80" />
            ゲームログ
          </h3>
        </div>
        <div className="ml-2 flex items-center gap-2">
          <span className="rounded bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] opacity-80">
            {logs.length}件
          </span>
          {collapsed && unreadCount > 0 && (
            <span className="rounded bg-[rgba(215,178,110,0.25)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent-light)]">
              +{unreadCount}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={handleToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "ログを展開" : "ログを折りたたむ"}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {collapsed ? (
        <div className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
          {latestLog ? latestLog.message : "ログはまだありません"}
        </div>
      ) : (
        <ScrollArea ref={scrollAreaRef} className="h-64">
          <div className="space-y-3 px-3 py-3">
            {logs.map((log) => {
              const { Icon, isElimination, isWin } = resolveLogVisualState(log);

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22 }}
                  className={cn(
                    "relative flex gap-3 rounded-lg border p-2.5 text-sm transition-colors",
                    isElimination
                      ? "border-[rgba(247,184,184,0.28)] bg-[rgba(56,22,22,0.42)]"
                      : isWin
                        ? "border-[rgba(215,178,110,0.42)] bg-[rgba(70,56,28,0.34)]"
                        : "border-[rgba(215,178,110,0.14)] bg-[rgba(16,36,33,0.56)] hover:bg-[rgba(20,40,38,0.64)]",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                      isElimination
                        ? "border-[rgba(247,184,184,0.4)] bg-[rgba(60,20,20,0.62)] text-[var(--color-warn-light)]"
                        : isWin
                          ? "border-[rgba(215,178,110,0.55)] bg-[rgba(120,94,43,0.55)] text-[var(--color-accent-light)]"
                          : "border-[rgba(215,178,110,0.24)] bg-[rgba(20,45,40,0.7)] text-[var(--color-accent-light)]",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wider font-bold",
                          isElimination ? "text-[var(--color-warn-light)]" : "text-[rgba(215,178,110,0.8)]",
                        )}
                      >
                        {log.icon?.toUpperCase() ?? "情報"}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--color-text-muted)] opacity-55">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "leading-relaxed font-medium",
                        isElimination ? "text-[var(--color-warn-light)] text-shadow-sm" : "text-[var(--color-text)]",
                      )}
                    >
                      {log.message}
                    </p>
                  </div>
                </motion.div>
              );
            })}

            {logs.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-[var(--color-text-muted)] opacity-40">
                <Info className="h-8 w-8" />
                <p className="text-xs">ログはまだありません</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </aside>
  );
}
