"use client";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { ICONS } from "@/components/Wheel";
import type { Reward } from "@/lib/shared";

/** Turn a pasted video link into something safe to embed. Only YouTube / Vimeo iframes and direct video files are allowed. */
export function videoSource(url: string): { kind: "iframe" | "file"; src: string } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}` };
    if (h === "youtube.com" || h === "m.youtube.com" || h === "youtube-nocookie.com") {
      const id = u.searchParams.get("v") ?? (u.pathname.startsWith("/embed/") || u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : null);
      return id ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
    }
    if (h === "vimeo.com" || h === "player.vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id) ? { kind: "iframe", src: `https://player.vimeo.com/video/${id}` } : null;
    }
    if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { kind: "file", src: url };
  } catch { /* not a URL */ }
  return null;
}

/** Pop-up for one prize: title, description and the image or video VTH attached to it. */
export default function PrizeModal({ reward, onClose }: { reward: Reward; onClose: () => void }) {
  const Icon = ICONS[reward.icon];
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const video = reward.mediaType === "video" && reward.mediaUrl ? videoSource(reward.mediaUrl) : null;
  const image = reward.mediaType === "image" && reward.mediaUrl ? reward.mediaUrl : null;
  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="prizemodal" role="dialog" aria-modal="true" aria-label={reward.name} onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}>
        <button className="icon-btn pm-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        {(image || video) && (
          <div className="pm-media">
            {image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={image} alt={reward.name} />}
            {video?.kind === "iframe" && <iframe src={video.src} title={reward.name} allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />}
            {video?.kind === "file" && <video src={video.src} controls playsInline preload="metadata" />}
          </div>
        )}
        <div className="pm-body">
          {!image && !video && <div className="medal pm-medal"><Icon size={34} strokeWidth={1.8} /></div>}
          <span className="eyebrow">Prize {String(reward.id).padStart(2, "0")}</span>
          <h2>{reward.name}</h2>
          <p>{reward.desc}</p>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 20 }} onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
