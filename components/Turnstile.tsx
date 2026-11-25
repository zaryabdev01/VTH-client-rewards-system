"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { turnstile?: any } }
export type TurnstileHandle = { reset: () => void };

/** Cloudflare Turnstile (bot protection). Only rendered when the server says a site key is configured. */
const Turnstile = forwardRef<TurnstileHandle, { siteKey: string; onToken: (t: string) => void }>(function Turnstile({ siteKey, onToken }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const id = useRef<string | undefined>(undefined);
  useImperativeHandle(ref, () => ({ reset() { if (id.current && window.turnstile) window.turnstile.reset(id.current); onToken(""); } }));

  useEffect(() => {
    const render = () => {
      if (!el.current || id.current || !window.turnstile) return;
      id.current = window.turnstile.render(el.current, {
        sitekey: siteKey, theme: "dark", callback: onToken, "expired-callback": () => onToken(""), "error-callback": () => onToken(""),
      });
    };
    if (window.turnstile) render();
    else {
      let s = document.getElementById("cf-turnstile") as HTMLScriptElement | null;
      if (!s) { s = document.createElement("script"); s.id = "cf-turnstile"; s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; document.head.appendChild(s); }
      s.addEventListener("load", render);
    }
    return () => { if (id.current && window.turnstile) { window.turnstile.remove(id.current); id.current = undefined; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={el} />;
});
export default Turnstile;
