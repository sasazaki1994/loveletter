'use client';

import * as React from "react";

import { cn } from "@/lib/utils";

// Radix ScrollArea が再描画で無限ループを起こすことがあるため、
// e2e 安定性を優先してシンプルな実装に置き換える。
export const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("relative overflow-auto", className)} {...props}>
      {children}
    </div>
  ),
);
ScrollArea.displayName = "ScrollArea";

// API 互換のためにダミーの ScrollBar を残す（未使用でも安全）
export const ScrollBar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("hidden", className)} {...props} />
  ),
);
ScrollBar.displayName = "ScrollBar";
