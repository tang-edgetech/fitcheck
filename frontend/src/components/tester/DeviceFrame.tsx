"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Frame } from "@/lib/types";

export function hostOf(u: string) {
  try { return new URL(u).host; } catch { return u; }
}

/** Scale that fits a device (with its frame) inside a box. */
export function fitScale(availW: number, availH: number, w: number, h: number, shape: Frame, max = 1) {
  const bz = shape === "tablet" ? 32 : shape === "browser" || shape === "none" ? 0 : 24;
  const extraH = shape === "browser" ? 30 : shape === "home" ? 46 : shape === "tv" ? 30 : 0;
  const s = Math.min((availW - bz) / w, (availH - bz - extraH) / h, max);
  return Math.max(0.05, Math.round(s * 1000) / 1000);
}

interface Props {
  url: string; w: number; h: number; s: number; shape: Frame; rot?: boolean; scrolling?: boolean; label?: string; emptyText?: string;
}

/** A device frame with the site inside. Changing w/h/s only updates CSS variables, so the page never reloads. */
export default function DeviceFrame({ url, w, h, s, shape, rot = false, scrolling = true, label = "Preview", emptyText = "Paste a link above" }: Props) {
  const style = { "--w": w, "--h": h, "--s": s } as CSSProperties;
  // Keyed so the loading state and iframe reset when the link or scrolling setting changes
  return <Inner key={`${url}|${scrolling}`} {...{ url, shape, rot, scrolling, label, emptyText, style }} />;
}

function Inner({ url, shape, rot, scrolling, label, emptyText, style }: { url: string; shape: Frame; rot: boolean; scrolling: boolean; label: string; emptyText: string; style: CSSProperties }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!url) return;
    const t = setTimeout(() => setLoaded(true), 12000); // some sites never fire load
    return () => clearTimeout(t);
  }, [url]);
  const host = url ? hostOf(url) : "";
  return (
    <div className={`device-frame device-frame--${shape} fc-vp fc-${shape}${rot ? " fc-rot" : ""}${loaded ? " fc-loaded" : ""}`} style={style}>
      <div className="fc-bar"><i /><i /><i /><span>{host || "fitcheck"}</span></div>
      <div className="device-screen fc-screen">
        {url && (
          <iframe
            src={url}
            title={`${label}: ${url}`}
            scrolling={scrolling ? "yes" : "no"}
            style={scrolling ? undefined : { overflow: "hidden" }}
            onLoad={() => setLoaded(true)}
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
        <div className="fc-load">{url ? `Loading ${host}…` : emptyText}</div>
        <div className="fc-cut" />
      </div>
      <div className="fc-homebtn" />
      <div className="fc-stand" />
    </div>
  );
}
