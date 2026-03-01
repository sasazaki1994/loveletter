'use client';

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSoundEffects } from "@/lib/hooks/use-sound-effects";
import { cn } from "@/lib/utils";

interface TurnCutinProps {
  show: boolean;
  text?: string;
}

export function TurnCutin({ show, text = "YOUR TURN" }: TurnCutinProps) {
  const { play } = useSoundEffects(0.6);
  const [visible, setVisible] = useState(false);
  const isRoundCutin = useMemo(() => /^ROUND\s+\d+/i.test(text.trim()), [text]);

  useEffect(() => {
    if (show) {
      setVisible(true);
      if (!isRoundCutin) {
        play("turn_chime");
      }
      const timer = setTimeout(() => setVisible(false), isRoundCutin ? 1400 : 1600);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isRoundCutin, play, show]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-4 sm:top-7"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <motion.div
            className={cn(
              "w-full max-w-lg rounded-2xl border px-5 py-3 text-center shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-md",
              isRoundCutin
                ? "border-[rgba(130,186,255,0.45)] bg-[rgba(14,36,48,0.86)]"
                : "border-[rgba(215,178,110,0.52)] bg-[rgba(20,42,38,0.9)]",
            )}
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <motion.p
              className={cn(
                "font-heading text-2xl tracking-[0.18em] sm:text-3xl",
                isRoundCutin ? "text-[#b8deff]" : "text-[var(--color-accent-light)]",
              )}
              initial={{ opacity: 0.6, letterSpacing: "0.1em" }}
              animate={{ opacity: 1, letterSpacing: "0.18em" }}
              exit={{ opacity: 0.5 }}
              transition={{ duration: 0.18 }}
            >
              {text}
            </motion.p>
            {!isRoundCutin && (
              <p className="pt-1 text-[11px] uppercase tracking-[0.24em] text-[rgba(215,178,110,0.72)]">
                Play your card
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

