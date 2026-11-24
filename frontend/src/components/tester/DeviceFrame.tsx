"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  /** Called once when this frame has loaded (or stopped waiting for it) */
  onReady?: () => void;
  /** Set by a parent that shows several frames together; without it the frame shows as soon as it loads */
  reveal?: boolean;
}

/** A device frame with the site inside. Changing w/h/s only updates CSS variables, so the page never reloads. */
export default function DeviceFrame({ url, w, h, s, shape, rot = false, scrolling = true, label = "Preview", emptyText = "Paste a link above", onReady, reveal }: Props) {
  const style = { "--w": w, "--h": h, "--s": s } as CSSProperties;
  // Keyed so the loading state and iframe reset when the link or scrolling setting changes
  return <Inner key={`${url}|${scrolling}`} {...{ url, shape, rot, scrolling, label, emptyText, style, onReady, reveal }} />;
}

function Inner({ url, shape, rot, scrolling, label, emptyText, style, onReady, reveal }: {
  url: string; shape: Frame; rot: boolean; scrolling: boolean; label: string; emptyText: string; style: CSSProperties; onReady?: () => void; reveal?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const readyRef = useRef(onReady);
  const reported = useRef(false);
  useEffect(() => { readyRef.current = onReady; }, [onReady]);
  const finish = () => {
    setLoaded(true);
    if (!reported.current) { reported.current = true; readyRef.current?.(); }
  };
  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; });
  useEffect(() => {
    if (!url) return;
    const t = setTimeout(() => finishRef.current(), 12000); // some sites never fire load
    return () => clearTimeout(t);
  }, [url]);
  const host = url ? hostOf(url) : "";
  const shown = reveal ?? loaded;
  return (
    <div className={`device-frame device-frame--${shape} fc-vp fc-${shape}${rot ? " fc-rot" : ""}${shown ? " fc-loaded" : ""}`} style={style}>
      <div className="fc-bar"><i /><i /><i /><span>{host || "fitcheck"}</span></div>
      <div className="device-screen fc-screen">
        {url && (
          <iframe
            src={url}
            title={`${label}: ${url}`}
            scrolling={scrolling ? "yes" : "no"}
            style={scrolling ? undefined : { overflow: "hidden" }}
            onLoad={finish}
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
        <div className="fc-load">{!url ? emptyText : loaded ? "Loaded. Waiting for the other devices…" : `Loading ${host}…`}</div>
        <div className="fc-cut" />
      </div>
      <div className="fc-homebtn" />
      <div className="fc-stand" />
    </div>
  );
}
