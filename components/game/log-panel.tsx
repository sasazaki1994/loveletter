'use client';

import { useEffect, useRef } from "react";
import { 
  Swords, Shield, Eye, Crown, Skull, MessageSquare, 
  Target, AlertTriangle, Info, HelpCircle, RefreshCw, Hand
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useGameContext } from "@/components/game/game-provider";
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

export function LogPanel() {
  const { state } = useGameContext();
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [state?.logs.length]);

  return (
    <aside
      className="pointer-events-auto w-full overflow-hidden rounded-xl border border-[rgba(215,178,110,0.2)] bg-[rgba(10,28,26,0.9)] shadow-[0_18px_46px_rgba(0,0,0,0.4)] backdrop-blur-sm"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="flex items-center justify-between border-b border-[rgba(215,178,110,0.15)] bg-[rgba(15,35,33,0.95)] px-4 py-3">
        <div>
          <h3 className="font-heading text-lg text-[var(--color-accent-light)] flex items-center gap-2">
            <MessageSquare className="h-4 w-4 opacity-70" />
            Battle Log
          </h3>
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)] opacity-60">
          Latest {state?.logs.length ?? 0}
        </span>
      </div>
      
      <ScrollArea className="h-64">
        <div ref={viewportRef} className="space-y-3 px-3 py-3">
          {state?.logs.map((log) => {
            const Icon = LOG_ICONS[log.icon || 'info'] ?? Info;
            // サーバー側でtypeが判定されるが、未反映の古いログや一時的な状態のためにフォールバックを残す
            const isElimination = log.type === 'elimination' || log.icon === 'flame' || /脱落|自滅/.test(log.message);
            const isWin = log.type === 'win' || log.icon === 'crown';
            
            return (
              <div
                key={log.id}
                className={cn(
                  "relative flex gap-3 rounded-lg border p-2.5 text-sm transition-all",
                  isElimination 
                    ? "border-[rgba(247,184,184,0.3)] bg-[rgba(60,20,20,0.4)]" 
                    : isWin
                      ? "border-[rgba(215,178,110,0.5)] bg-[rgba(215,178,110,0.1)]"
                      : "border-[rgba(215,178,110,0.1)] bg-[rgba(12,32,30,0.4)] hover:bg-[rgba(15,35,33,0.6)]"
                )}
              >
                <div className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm",
                  isElimination 
                    ? "border-[rgba(247,184,184,0.4)] bg-[rgba(60,20,20,0.6)] text-[var(--color-warn-light)]"
                    : isWin
                      ? "border-[var(--color-accent)] bg-[rgba(215,178,110,0.2)] text-[var(--color-accent)]"
                      : "border-[rgba(215,178,110,0.2)] bg-[rgba(20,45,40,0.5)] text-[var(--color-accent-light)]"
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-[10px] uppercase tracking-wider font-medium",
                      isElimination ? "text-[var(--color-warn-light)]" : "text-[rgba(215,178,110,0.7)]"
                    )}>
                      {log.icon?.toUpperCase() ?? "INFO"}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] opacity-50 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                  <p className={cn(
                    "leading-relaxed",
                    isElimination ? "text-[var(--color-warn-light)]" : "text-[var(--color-text)]"
                  )}>
                    {log.message}
                  </p>
                </div>
              </div>
            );
          })}
          
          {(!state?.logs || state.logs.length === 0) && (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-[var(--color-text-muted)] opacity-50">
              <Info className="h-8 w-8" />
              <p className="text-xs">ログはまだありません</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
