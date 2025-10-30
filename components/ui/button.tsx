'use client';

import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "outline" | "ghost" | "secondary";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[var(--color-accent)] text-[var(--color-surface)] shadow-[0_0_12px_rgba(215,178,110,0.4)] hover:shadow-[0_0_16px_rgba(215,178,110,0.6)]",
  outline:
    "border-[var(--color-border)] bg-transparent text-[var(--color-accent-light)] hover:bg-[rgba(215,178,110,0.1)]",
  ghost:
    "border-transparent bg-transparent text-[var(--color-accent-light)] hover:bg-[rgba(255,255,255,0.06)]",
  secondary:
    "border-transparent bg-[rgba(18,40,38,0.85)] text-[var(--color-text-muted)] hover:bg-[rgba(25,52,48,0.9)]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", fullWidth = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          fullWidth && "w-full",
          "px-4 py-2 text-sm font-medium tracking-wide",
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

