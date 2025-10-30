'use client';

import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = ({
  className,
  align = "center",
  sideOffset = 8,
  ...props
}: PopoverPrimitive.PopoverContentProps) => {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-xl border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.96)] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.45)] backdrop-blur-lg",
          "animate-fade-in",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
};

