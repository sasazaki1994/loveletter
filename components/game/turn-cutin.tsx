'use client';

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSoundEffects } from "@/lib/hooks/use-sound-effects";

interface TurnCutinProps {
  show: boolean;
  text?: string;
}

export function TurnCutin({ show, text = "YOUR TURN" }: TurnCutinProps) {
  const { play } = useSoundEffects(0.6);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      play("turn_chime");
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [show, play]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* 背景の薄暗がり + ブラー */}
          <motion.div 
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* メインテキスト */}
          <div className="relative">
            <motion.h1
              className="font-heading text-6xl font-bold tracking-[0.2em] text-[var(--color-accent-light)] sm:text-8xl"
              style={{ textShadow: "0 4px 24px rgba(215, 178, 110, 0.6)" }}
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ 
                scale: [0.8, 1.1, 1], 
                opacity: [0, 1, 1],
                y: [20, 0, 0]
              }}
              exit={{ scale: 1.1, opacity: 0, filter: "blur(10px)" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              {text}
            </motion.h1>

            {/* 光のライン演出 */}
            <motion.div
              className="absolute left-0 top-1/2 h-[2px] w-full bg-[var(--color-accent)] shadow-[0_0_12px_var(--color-accent)]"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ scaleX: 0, opacity: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            />
            
            {/* 上下の装飾テキスト */}
            <motion.div
              className="absolute -top-6 left-0 right-0 text-center text-xs uppercase tracking-[0.8em] text-[var(--color-accent)] opacity-80"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 0.8 }}
              transition={{ delay: 0.3 }}
            >
              Make your move
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

