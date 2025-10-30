'use client';

import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border border-[rgba(215,178,110,0.35)] bg-[rgba(11,30,28,0.8)] px-3 text-sm text-[var(--color-text)] shadow-inner shadow-[rgba(0,0,0,0.25)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(12,30,28,0.6)]",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

