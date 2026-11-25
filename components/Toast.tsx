"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import React, { createContext, useCallback, useContext, useState } from "react";

type Push = (msg: string, kind?: "ok" | "error") => void;
const T = createContext<Push>(() => {});
export const useToast = () => useContext(T);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: "ok" | "error" }[]>([]);
  const push = useCallback<Push>((msg, kind = "ok") => {
    const id = Date.now() + Math.random();
    setItems((i) => [...i, { id, msg, kind }]);
    setTimeout(() => setItems((i) => i.filter((x) => x.id !== id)), kind === "error" ? 5200 : 2800);
  }, []);
  return (
    <T.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} className={`toast ${t.kind === "error" ? "err" : ""}`} initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.95 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
              {t.kind === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </T.Provider>
  );
}
