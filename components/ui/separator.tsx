import * as React from "react";
import { cn } from "@/lib/utils";

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "h-px w-full bg-gradient-to-r from-transparent via-[rgba(215,178,110,0.35)] to-transparent",
        className,
      )}
      {...props}
    />
  );
}

