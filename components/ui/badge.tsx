import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "danger" | "shield";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const styles: Record<Required<BadgeProps>["variant"], string> = {
    default:
      "bg-[rgba(215,178,110,0.2)] text-[var(--color-accent-light)] border border-[rgba(215,178,110,0.45)]",
    outline:
      "border border-[rgba(215,178,110,0.4)] text-[var(--color-accent-light)]",
    danger:
      "bg-[rgba(180,40,40,0.35)] border border-[rgba(210,60,60,0.6)] text-[var(--color-warn-light)]",
    shield:
      "bg-[rgba(65,115,108,0.45)] border border-[rgba(108,185,176,0.6)] text-[rgba(174,227,221,0.95)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

