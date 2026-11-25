"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { App, AutoComplete, Button, Checkbox, ConfigProvider, Input, Modal, Popover, Segmented, Switch, Tooltip } from "antd";
import { AppstoreOutlined, ColumnWidthOutlined, DownOutlined, LeftOutlined, LinkOutlined, QuestionCircleOutlined, ReloadOutlined, RightOutlined } from "@ant-design/icons";
import DeviceFrame, { fitScale, hostOf } from "./DeviceFrame";
import type { Device, PublicFamily } from "@/lib/types";
import { API_BASE } from "@/lib/api";

type SizeMode = "true" | "fill";
type View = "scroll" | "grid";
type Card = "s" | "m" | "l";
/** Grid view: target device height per card size (CSS px on screen) */
const CARD_H: Record<Card, number> = { s: 340, m: 480, l: 640 };

const RECENT_KEY = "fitcheck-recent";
const VIEW_KEY = "fitcheck-view";
const SYNC_KEY = "fitcheck-sync-scroll";
const DEVICE_VIEW_KEY = "fitcheck-device-view";

interface SiteInfo { name: string; default_view: View; default_size: SizeMode; banner: string | null; help_email: string | null }
const DEFAULT_SITE: SiteInfo = { name: "Fitcheck", default_view: "scroll", default_size: "true", banner: null, help_email: null };

function normalize(u: string) {
  u = u.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; }
}
function readRecent(): string[] { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 8); } catch { return []; } }
function dims(d: Device, rot: boolean) { return rot ? { w: d.h, h: d.w } : { w: d.w, h: d.h }; }
/** A page address without the site's host or #part, to tell whether two devices are on the same page */
function pageKey(u: string) {
  try { const x = new URL(u); return x.pathname.replace(/\/+$/, "") + x.search; } catch { return u; }
}
/** Which browser identity the device view uses for this device (see DeviceViewController on the API) */
function agentOf(d: Device) {
  const apple = /apple|iphone|ipad|mac/i.test(`${d.brand} ${d.name}`);
  if (d.type === "Mobile") return apple ? "iphone" : "android";
  if (d.type === "Tablet") return apple ? "ipad" : "android-tablet";
  if (d.type === "TV") return "tv";
  return apple ? "mac" : "desktop";
}

const theme = {
  token: { colorPrimary: "#e0532b", colorText: "#2a1d17", colorTextSecondary: "#7a6a60", colorBorder: "#f0dfd3", borderRadius: 12, fontFamily: "var(--font-dm-sans), system-ui, sans-serif" },
  components: { Segmented: { itemSelectedBg: "#fde6dc", itemSelectedColor: "#e0532b", trackBg: "#fff" } },
};

export default function Tester() {
  return (
    <ConfigProvider theme={theme}>
      <App><TesterInner /></App>
    </ConfigProvider>
  );
}

function TesterInner() {
  const { message } = App.useApp();
  const [families, setFamilies] = useState<PublicFamily[] | null>(null);
  /** Settings > General and Extra, from the public endpoint */
  const [site, setSite] = useState<SiteInfo>(DEFAULT_SITE);
  const [loadError, setLoadError] = useState("");
  const [url, setUrl] = useState("");
  const [input, setInput] = useState("");
  const [group, setGroup] = useState("");
  const [size, setSize] = useState<SizeMode>("true");
  const [view, setView] = useState<View>("scroll");
  const [card, setCard] = useState<Card>("m");
  const [scrolling, setScrolling] = useState(true);
  const [rot, setRot] = useState(false);
  const [focus, setFocus] = useState(-1);
  const [reloadKey, setReloadKey] = useState(0);
  /** Device view: each device loads the page as that device (through the API), so server-side mobile detection works */
  const [deviceView, setDeviceView] = useState(true);
  const [recent, setRecent] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  /** Devices ticked in the active group's checklist; null = all of them */
  const [only, setOnly] = useState<string[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const stripRef = useRef<HTMLElement>(null);
  const [box, setBox] = useState({ w: 1200, h: 600 });

  /* Read ?url=&group=&size=&view=&scrolling=&rotate= once on load */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    let v: View | "" = (q.get("view") as View) || "";
    if (!v) { try { v = (localStorage.getItem(VIEW_KEY) as View) || ""; } catch { v = ""; } }
    const askedSize = q.get("size");
    const u = normalize(q.get("url") || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the address bar
    setUrl(u); setInput(u); setGroup(q.get("group") || ""); setSize(askedSize === "fill" ? "fill" : "true");
    let dv = q.get("as");
    if (!dv) { try { dv = localStorage.getItem(DEVICE_VIEW_KEY); } catch { dv = null; } }
    setDeviceView(dv !== "browser");
    setView(v === "grid" ? "grid" : "scroll"); setCard((["s", "m", "l"].includes(q.get("card") ?? "") ? q.get("card") : "m") as Card); setScrolling(q.get("scrolling") !== "no"); setRot(q.get("rotate") === "yes");
    const o = (q.get("only") || "").split(",").filter(Boolean); setOnly(o.length ? o : null);
    setRecent(readRecent());
    fetch(API_BASE + "/api/public/screen-views", { headers: { Accept: "application/json" }, cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { families: PublicFamily[]; all?: Device[]; site?: Partial<SiteInfo> }) => {
        if (!Array.isArray(d?.families)) throw new Error("bad shape");
        const st = { ...DEFAULT_SITE, ...(d.site ?? {}) };
        setSite(st);
        // The visitor's link or saved choice wins; otherwise use the defaults from Settings > General
        if (!v) setView(st.default_view === "grid" ? "grid" : "scroll");
        if (!askedSize) setSize(st.default_size === "fill" ? "fill" : "true");
        // "All devices": every active screen view in one tab, after the admin's own menu groups
        const all = Array.isArray(d.all) && d.all.length ? [{ id: "all", name: "All devices", is_default: false, devices: d.all }] : [];
        setFamilies([...d.families.filter((f) => Array.isArray(f.devices)), ...all]);
      })
      .catch(() => setLoadError("Could not load the device list. Check that the Fitcheck API is running, then reload."));
  }, []);

  /* Does the site allow being shown in frames? If not, say why instead of leaving blank screens. */
  const [frameCheck, setFrameCheck] = useState<{ url: string; embeddable: boolean | null; reason: string | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    const ctl = new AbortController();
    fetch(API_BASE + "/api/public/frame-check?url=" + encodeURIComponent(url), { headers: { Accept: "application/json" }, signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d === "object") setFrameCheck({ url, embeddable: d.embeddable ?? null, reason: d.reason ?? null }); })
      .catch(() => { /* the check is only a hint; frames load regardless */ });
    return () => ctl.abort();
  }, [url]);
  const blocked = frameCheck && frameCheck.url === url && frameCheck.embeddable === false ? frameCheck : null;

  /* Load together: every frame loads at once, and all are shown together when the last one is ready (or after 12 s). */
  // A new device group, or switching device view, loads every frame again (all shown together)
  const gen = `${url}|${scrolling}|${reloadKey}|${group}|${deviceView}`;
  const [ready, setReady] = useState<{ gen: string; ids: string[] }>({ gen: "", ids: [] });
  const [revealedGen, setRevealedGen] = useState("");
  const markReady = useCallback((g: string, id: string) => setReady((r) => (r.gen === g ? { gen: g, ids: [...r.ids, id] } : { gen: g, ids: [id] })), []);

  /* Scroll sync. Browsers never let a page read or move the scroll of another site inside a frame,
     so the tested site must include /sync.js, which reports its scroll and follows the others (postMessage). */
  const [syncScroll, setSyncScroll] = useState(true);
  const syncRef = useRef(true);
  useEffect(() => { syncRef.current = syncScroll; }, [syncScroll]);
  /** Frames whose page has sync.js, counted per load (gen) */
  const linked = useRef({ gen: "", set: new WeakSet<Window>() });
  const genRef = useRef(gen);
  useEffect(() => { genRef.current = gen; }, [gen]);
  /** Where the pages were last scrolled to (0–1) and on which page, so frames that load later start at the same place */
  const lastScroll = useRef({ url: "", page: "", ratio: 0 });
  /** The page each frame is on now (frames report it), and the frame the visitor last used */
  const frameUrl = useRef(new WeakMap<Window, string>());
  const lastActor = useRef<{ win: Window | null; at: number }>({ win: null, at: 0 });
  const urlRef = useRef(url);
  useEffect(() => { urlRef.current = url; }, [url]);
  /** Frames report scrolls only once the set is shown; before that, a page settling itself isn't the visitor scrolling */
  const shownRef = useRef(false);
  const [linkedState, setLinkedState] = useState({ gen: "", n: 0 });
  const linkedCount = linkedState.gen === gen ? linkedState.n : 0;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved choice once after hydration
    try { if (localStorage.getItem(SYNC_KEY) === "no") setSyncScroll(false); } catch { /* storage blocked */ }
  }, []);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { fitcheck?: unknown; ratio?: unknown; url?: unknown } | null;
      if (!d || typeof d !== "object" || typeof d.fitcheck !== "string") return;
      const frames = [...(stripRef.current?.querySelectorAll("iframe") ?? [])];
      const from = frames.find((f) => f.contentWindow === e.source);
      if (!from) return; // only the frames in the device list
      const g = genRef.current;
      if (linked.current.gen !== g) linked.current = { gen: g, set: new WeakSet() };
      const set = linked.current.set;
      set.add(e.source as Window);
      setLinkedState({ gen: g, n: frames.filter((f) => f.contentWindow && set.has(f.contentWindow)).length });
      const src = e.source as Window;
      const page = typeof d.url === "string" ? d.url : "";
      if (page) frameUrl.current.set(src, page);
      const ls = lastScroll.current;
      const last = ls.url === urlRef.current && ls.page === pageKey(page) ? ls.ratio : 0;
      if (d.fitcheck === "hello" && syncRef.current && last > 0) src.postMessage({ fitcheck: "scrollTo", ratio: last }, "*");
      // Taps, swipes, typing, keys and inner scrolling in one device are repeated in the others
      if (d.fitcheck === "act" && shownRef.current) {
        lastActor.current = { win: src, at: Date.now() };
        if (syncRef.current) for (const f of frames) if (f !== from) f.contentWindow?.postMessage({ ...d, fitcheck: "actAt" }, "*");
      }
      // The device the visitor is using went to another page: the others follow, unless a repeated tap already took them there
      if ((d.fitcheck === "hello" || d.fitcheck === "url") && page && syncRef.current && shownRef.current
        && lastActor.current.win === src && Date.now() - lastActor.current.at < 15000) {
        setTimeout(() => {
          for (const f of stripRef.current?.querySelectorAll("iframe") ?? []) {
            const w = f.contentWindow;
            if (w && w !== src && pageKey(frameUrl.current.get(w) ?? "") !== pageKey(page)) w.postMessage({ fitcheck: "go", url: page }, "*");
          }
        }, 1500);
      }
      if (d.fitcheck === "scroll" && shownRef.current && typeof d.ratio === "number") {
        lastScroll.current = { url: urlRef.current, page: pageKey(page), ratio: d.ratio };
        if (syncRef.current) for (const f of frames) if (f !== from) f.contentWindow?.postMessage({ fitcheck: "scrollTo", ratio: d.ratio }, "*");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  const changeDeviceView = (on: boolean) => { setDeviceView(on); try { localStorage.setItem(DEVICE_VIEW_KEY, on ? "device" : "browser"); } catch { /* storage blocked */ } };
  const changeSync = (on: boolean) => { setSyncScroll(on); try { localStorage.setItem(SYNC_KEY, on ? "yes" : "no"); } catch { /* storage blocked */ } };
  const syncTag = typeof window !== "undefined" ? `<script src="${window.location.origin}/sync.js" defer></script>` : `<script src="https://fitcheck.smartsitecp.com/sync.js" defer></script>`;

  // Set after the device list loads, so it lands after Next.js applies the page's static title
  useEffect(() => { if (families) document.title = `${site.name} · Responsive tester`; }, [site.name, families]);

  /* Keep the address bar shareable */
  useEffect(() => {
    if (!families) return;
    const q = new URLSearchParams();
    if (url) q.set("url", url);
    if (group) q.set("group", group);
    if (only) q.set("only", only.join(","));
    if (size !== site.default_size) q.set("size", size);
    if (view !== site.default_view) q.set("view", view);
    if (view === "grid" && card !== "m") q.set("card", card);
    q.set("scrolling", scrolling ? "yes" : "no");
    if (rot) q.set("rotate", "yes");
    if (!deviceView) q.set("as", "browser");
    window.history.replaceState(null, "", window.location.pathname + "?" + q.toString());
  }, [families, site, url, group, only, size, view, card, scrolling, rot, deviceView]);

  /* Measure the device area */
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [families]);

  /* The device strip moves only when the visitor moves it. Pages inside the frames often take focus while loading
     (autofocus, sliders, popups), and the browser then scrolls the strip to show that frame: put it back. */
  const userMoved = useRef(0);
  const stripPos = useRef({ left: 0, top: 0 });
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const mark = () => { userMoved.current = Date.now(); };
    const onScroll = () => {
      if (Date.now() - userMoved.current < 2000) stripPos.current = { left: el.scrollLeft, top: el.scrollTop };
      else if (el.scrollLeft !== stripPos.current.left || el.scrollTop !== stripPos.current.top) el.scrollTo(stripPos.current.left, stripPos.current.top);
    };
    const opts = { capture: true, passive: true } as const;
    for (const t of ["wheel", "pointerdown", "touchstart", "touchmove", "keydown"]) el.addEventListener(t, mark, opts);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      for (const t of ["wheel", "pointerdown", "touchstart", "touchmove", "keydown"]) el.removeEventListener(t, mark, opts);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const active = useMemo(() => {
    if (!families?.length) return null;
    return families.find((f) => f.id === group) ?? families.find((f) => f.is_default) ?? families[0];
  }, [families, group]);
  const allDevices = useMemo(() => active?.devices ?? [], [active]);
  const devices = useMemo(() => (only ? allDevices.filter((d) => only.includes(d.id)) : allDevices), [allDevices, only]);
  /** Laptops, desktops and TVs are wide already: for them the switch turns them upright (Portrait) */
  const wideGroup = devices.length > 0 && devices.filter((d) => d.w > d.h).length > devices.length / 2;
  const turnLabel = wideGroup ? "Portrait" : "Landscape";
  const pickDevices = (ids: string[]) => setOnly(ids.length === allDevices.length ? null : allDevices.map((d) => d.id).filter((id) => ids.includes(id)));
  const selectGroup = (id: string) => {
    if (id === active?.id) return; // the open tab toggles its device checklist (handled by the Popover)
    setGroup(id); setOnly(null); setPickerOpen(false); setFocus(-1);
    stripPos.current = { left: 0, top: 0 };
    stripRef.current?.scrollTo({ left: 0, top: 0 });
  };

  const readyCount = url && ready.gen === gen ? devices.filter((d) => ready.ids.includes(d.id)).length : 0;
  if (url && devices.length > 0 && readyCount === devices.length && revealedGen !== gen) setRevealedGen(gen);
  const revealed = revealedGen === gen;
  const srcFor = (d: Device) => (deviceView && url ? `${API_BASE}/api/public/view?url=${encodeURIComponent(url)}&ua=${agentOf(d)}&r=${reloadKey}` : url);
  /* When a new set of frames is shown (new group, reload, …), put them all where the pages were scrolled to */
  useEffect(() => {
    shownRef.current = revealed;
    if (!revealed || !syncScroll) return;
    const ls = lastScroll.current;
    if (ls.url !== url || ls.ratio <= 0) return;
    for (const f of stripRef.current?.querySelectorAll("iframe") ?? []) {
      const at = f.contentWindow && frameUrl.current.get(f.contentWindow);
      if (!at || pageKey(at) === ls.page) f.contentWindow?.postMessage({ fitcheck: "scrollTo", ratio: ls.ratio }, "*");
    }
  }, [revealed, gen, url, syncScroll]);

  /* Scale for each device. Scroll view: fit the row height. Grid view: a comfortable card height. */
  const scales = useMemo(() => {
    const ds = devices.map((d) => ({ d, ...dims(d, rot) }));
    if (!ds.length) return [];
    const rowH = view === "scroll" ? box.h - 70 : Math.min(CARD_H[card], Math.max(260, box.h - 90));
    const maxH = Math.max(...ds.map((x) => x.h + (x.d.shape === "browser" ? 30 : 0)));
    const maxW = Math.max(...ds.map((x) => x.w));
    return ds.map((x) => {
      let s = size === "true" ? Math.min(1, (rowH - 30) / maxH) : fitScale(99999, rowH, x.w, x.h, x.d.shape);
      if (view === "grid") s = Math.min(s, (box.w - 40) / (size === "true" ? maxW + 30 : x.w + 30)); // never wider than the page
      return Math.max(0.05, s);
    });
  }, [devices, rot, view, size, box, card]);

  const submit = useCallback((value: string) => {
    const u = normalize(value);
    if (!u) { message.error("Enter a link like example.com or https://example.com"); return; }
    setUrl(u); setInput(u);
    try { const r = [u, ...readRecent().filter((x) => x !== u)].slice(0, 8); localStorage.setItem(RECENT_KEY, JSON.stringify(r)); setRecent(r); } catch { /* storage blocked */ }
  }, [message]);

  const changeView = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ } };
  const scrollBy = (dir: number) => { userMoved.current = Date.now(); stripRef.current?.scrollBy({ left: dir * (stripRef.current.clientWidth * 0.8), behavior: "smooth" }); };

  /* Drag to scroll with the mouse (touch already scrolls natively). Frames stop taking the pointer while dragging. */
  const drag = useRef<{ x: number; y: number; left: number; top: number; id: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = e.currentTarget;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, id: e.pointerId, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const el = e.currentTarget, dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(dx) + Math.abs(dy) < 6) return;
      d.moved = true;
      el.setPointerCapture(d.id);
      el.classList.add("is-dragging");
    }
    el.scrollLeft = d.left - dx;
    el.scrollTop = d.top - dy;
  };
  const endDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    justDragged.current = true; // swallow the click that ends a drag
    setTimeout(() => { justDragged.current = false; }, 0);
    e.currentTarget.classList.remove("is-dragging");
    if (e.currentTarget.hasPointerCapture(d.id)) e.currentTarget.releasePointerCapture(d.id);
  };

  /* Keyboard: ← → move the strip, or step through devices in the focus view */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if (focus >= 0) {
        if (e.key === "ArrowLeft") setFocus((i) => (i - 1 + devices.length) % devices.length);
        if (e.key === "ArrowRight") setFocus((i) => (i + 1) % devices.length);
        return;
      }
      if (view === "scroll" && e.key === "ArrowLeft") scrollBy(-1);
      if (view === "scroll" && e.key === "ArrowRight") scrollBy(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, devices.length, view]);

  const fd = focus >= 0 ? devices[focus] : null;
  const fdim = fd ? dims(fd, rot) : null;

  return (
    <div className={`tester-page tester-page--${view} grid h-dvh grid-cols-[minmax(0,1fr)] ${site.banner || (blocked && !deviceView) ? "grid-rows-[auto_auto_auto_auto_minmax(0,1fr)_auto]" : "grid-rows-[auto_auto_auto_minmax(0,1fr)_auto]"} bg-cream font-sans text-ink`}>
      {/* Header */}
      <header className="site-header flex flex-wrap items-center gap-4 px-6 pb-2.5 pt-4 max-md:px-4">
        <Link href="/" className="site-logo text-[22px] font-bold tracking-tight text-ink no-underline">
          {site.name.toLowerCase() === "fitcheck" ? <>fit<b className="text-coral">check</b></> : site.name}
        </Link>
        <form className="url-form order-3 flex min-w-0 flex-1 basis-full gap-2 md:order-none md:max-w-[780px] md:basis-auto" onSubmit={(e) => { e.preventDefault(); submit(input); }}>
          <AutoComplete
            className="url-input min-w-0 flex-1"
            value={input}
            onChange={setInput}
            onSelect={(v: string) => submit(v)}
            options={recent.map((r) => ({ value: r, label: hostOf(r) }))}
          >
            <Input size="large" prefix={<LinkOutlined className="text-muted" />} placeholder="Paste a link to see it on a whole group of devices" aria-label="Website link" inputMode="url" autoComplete="off" spellCheck={false}
              onPaste={(e) => {
                // Pasting something that looks like a web address loads it straight away (no need to press Show)
                const text = e.clipboardData.getData("text").trim();
                if (/^(https?:\/\/)?[^\s/]+\.[^\s]+$/i.test(text) && normalize(text)) { e.preventDefault(); submit(text); }
              }} />
          </AutoComplete>
          <Button type="primary" size="large" htmlType="submit" className="url-submit font-bold">Show</Button>
        </form>
      </header>

      {(site.banner || (blocked && !deviceView)) && (
        <div className="site-notices mx-6 mb-1 grid gap-1.5 max-md:mx-4">
          {site.banner && (
            <div role="status" className="site-banner rounded-xl border border-solid border-[#f5c3ae] bg-coral-soft px-4 py-2 text-[14px] text-ink">
              <span className="site-banner-text">{site.banner}</span>
            </div>
          )}
          {blocked && !deviceView && (
            <div role="alert" className="frame-blocked-notice rounded-xl border border-solid border-[#f3c969] bg-[#fff8e1] px-4 py-2 text-[14px] text-ink">
              <b className="frame-blocked-title">{hostOf(blocked.url)} doesn&apos;t allow being shown inside other websites</b>, so the screens stay blank.
              {blocked.reason && <> It sends <code className="frame-blocked-reason rounded bg-white/70 px-1 text-[13px]">{blocked.reason}</code>.</>}
              {" "}Only the site&apos;s owner can change that.{" "}
              <button type="button" className="frame-blocked-help cursor-pointer border-0 bg-transparent p-0 text-[14px] font-semibold text-coral underline" onClick={() => setHelpOpen(true)}>How to allow it</button>
            </div>
          )}
        </div>
      )}

      {/* Families + size + view */}
      <div className="toolbar flex flex-wrap items-center gap-3.5 px-6 pb-3 pt-1.5 max-md:px-4">
        <nav className="menu-navigation flex min-w-0 flex-1 overflow-x-auto max-md:basis-full [scrollbar-width:none]" aria-label="Device groups">
          <ul className="nav-tabs m-0 flex list-none gap-1 p-0">
            {families?.map((f) => {
              const on = f.id === active?.id;
              const tab = (
                <button type="button" onClick={() => selectGroup(f.id)}
                  aria-pressed={on} aria-haspopup={on ? "dialog" : undefined} aria-expanded={on ? pickerOpen : undefined} data-family={f.id}
                  title={on ? "Choose which devices to show" : undefined}
                  className={`nav-tab${on ? " nav-tab--active" : ""}${on && only ? " nav-tab--filtered" : ""} inline-flex cursor-pointer items-center whitespace-nowrap rounded-full border-0 px-3.5 py-1.5 font-semibold transition-colors ${on ? "bg-ink text-cream" : "bg-transparent text-muted hover:text-ink"}`}>
                  <span className="nav-tab-label">{f.name}</span>
                  <small className="nav-tab-count ml-1.5 font-mono text-[11px] opacity-70">{on && only ? `${devices.length}/${f.devices.length}` : f.devices.length}</small>
                  {on && <DownOutlined className={`nav-tab-caret ml-1.5 text-[10px] transition-transform ${pickerOpen ? "rotate-180" : ""}`} />}
                </button>
              );
              return (
                <li key={f.id} className={`menu-item${on ? " menu-item--active" : ""}`}>
                  {on ? (
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen} trigger="click" placement="bottomLeft" arrow={false}
                      content={<DevicePicker devices={allDevices} selected={devices.map((d) => d.id)} onChange={pickDevices} rot={rot} />}>
                      {tab}
                    </Popover>
                  ) : tab}
                </li>
              );
            })}
          </ul>
        </nav>
        <span className="control-label text-[13px] text-muted">Size</span>
        <Segmented<SizeMode> className="size-control" value={size} onChange={setSize} options={[
          { value: "true", label: <Tooltip title="Every device at the same scale, so you see real size differences">True scale</Tooltip> },
          { value: "fill", label: <Tooltip title={view === "grid" ? "Every device the same height" : "Every device as tall as the row"}>Fill height</Tooltip> },
        ]} />
        <span className="control-label text-[13px] text-muted">View</span>
        <Segmented<View> className="view-control" value={view} onChange={changeView} aria-label="Layout" options={[
          { value: "scroll", icon: <ColumnWidthOutlined />, label: "Scroll" },
          { value: "grid", icon: <AppstoreOutlined />, label: "Grid" },
        ]} />
        {view === "grid" && (
          <Segmented<Card> className="card-size-control" value={card} onChange={setCard} aria-label="Card size" options={[
            { value: "s", label: <Tooltip title="Small cards: more devices per row">S</Tooltip> },
            { value: "m", label: <Tooltip title="Medium cards">M</Tooltip> },
            { value: "l", label: <Tooltip title="Large cards: easier to read">L</Tooltip> },
          ]} />
        )}
      </div>

      {/* Load progress: fills as each device finishes, then fades out once all are shown. Always 3px tall, so nothing shifts. */}
      <div className="load-progress h-[3px] flex-none overflow-hidden">
        {url && devices.length > 0 && (
          // Two bars in one: one creeps forward on its own (so it never looks stuck), the other jumps with each device that finishes; the longer one shows
          <div key={gen} role="progressbar" aria-label="Loading devices" aria-valuemin={0} aria-valuemax={devices.length} aria-valuenow={revealed ? devices.length : readyCount}
            className={`load-progress-track relative h-full${revealed ? " opacity-0" : ""}`} style={{ transition: "opacity .4s ease .4s" }}>
            {!revealed && <div className="load-progress-trickle absolute inset-y-0 left-0 rounded-r-full bg-coral" />}
            <div className="load-progress-bar absolute inset-y-0 left-0 rounded-r-full bg-coral"
              style={{ width: `${revealed ? 100 : (readyCount / devices.length) * 100}%`, transition: "width .3s ease" }} />
          </div>
        )}
      </div>

      {/* Devices */}
      <main
        ref={stripRef}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => { if (justDragged.current) { e.preventDefault(); e.stopPropagation(); } }}
        onDragStart={(e) => e.preventDefault()}
        aria-label={`${active?.name ?? "Devices"}, ${view === "grid" ? "grid" : "scrolling row"}`}
        className={`site-main device-list device-list--${view} ` + (view === "scroll"
          ? "flex snap-x snap-proximity scroll-px-6 items-end gap-10 overflow-x-auto overflow-y-hidden px-6 pb-4 pt-2.5 max-md:scroll-px-4 max-md:gap-6 max-md:px-4"
          : "flex flex-wrap content-start items-end justify-center gap-x-10 gap-y-12 overflow-y-auto px-6 pb-10 pt-2.5 max-md:gap-x-6 max-md:px-4")}
      >
        {loadError && <p className="device-list-message m-auto max-w-md text-center text-muted">{loadError}</p>}
        {!families && !loadError && <p className="device-list-message m-auto text-muted">Loading devices…</p>}
        {families && !allDevices.length && <p className="device-list-message m-auto text-muted">No devices in this group yet. Add some in the admin panel.</p>}
        {families && allDevices.length > 0 && !devices.length && (
          <p className="device-list-message m-auto text-center text-muted">No devices ticked.<br />
            <Button type="link" className="p-0" onClick={() => setOnly(null)}>Show all {allDevices.length}</Button> or pick some from the {active?.name} menu.</p>
        )}
        {devices.map((d, i) => {
          const r = dims(d, rot);
          return (
            <section key={`${d.id}-${reloadKey}-${group}`} aria-label={d.name} data-device={d.id} data-type={d.type}
              className={`device-item device-item--${d.type.toLowerCase()} flex flex-none snap-start flex-col items-center gap-2.5`}>
              <div className="device-label flex flex-col items-center text-center">
                <span className="device-number font-mono text-[11px] text-coral">{String(i + 1).padStart(2, "0")}</span>
                <button type="button" onClick={() => setFocus(i)} title={`Open ${d.name} large`}
                  className="device-name cursor-pointer rounded-md border-0 bg-transparent px-1.5 py-0.5 font-bold text-ink hover:bg-coral-soft hover:text-coral">{d.name}</button>
                <small className="device-size font-mono text-[11.5px] text-muted">{r.w} × {r.h}</small>
              </div>
              <DeviceFrame url={url} src={srcFor(d)} w={r.w} h={r.h} s={scales[i] ?? 0.3} shape={d.shape} rot={rot} scrolling={scrolling} label={d.name}
                onReady={() => markReady(gen, d.id)} reveal={revealed ? undefined : false} />
            </section>
          );
        })}
        {view === "scroll" && <span className="device-list-end w-px flex-none" />}
      </main>

      {/* Footer */}
      <footer className="site-footer flex flex-wrap items-center gap-2.5 border-0 border-t border-solid border-sand bg-white px-6 py-2.5 max-md:px-4">
        {view === "scroll" && (
          <div className="footer-nav flex gap-1">
            <Button className="footer-nav-prev" icon={<LeftOutlined />} onClick={() => scrollBy(-1)} aria-label="Scroll left" />
            <Button className="footer-nav-next" icon={<RightOutlined />} onClick={() => scrollBy(1)} aria-label="Scroll right" />
          </div>
        )}
        <span className="footer-status text-sm text-muted"><b className="text-ink">{devices.length} devices</b> · {size === "true" ? "same scale" : "same height"} · {view === "grid" ? "grid" : "scroll"}{rot ? ` · ${turnLabel.toLowerCase()}` : ""}
          {url && devices.length > 0 && !revealed && <span className="footer-loading text-coral"> · loading {readyCount}/{devices.length}</span>}</span>
        <span className="flex-1" />
        <div className="footer-actions flex flex-wrap items-center gap-2">
          <Tooltip title={scrolling ? "Each page scrolls inside its frame. Turn off to see only the first screen." : "Only the first screen is shown. Turn on to scroll inside each page."}>
            <label className={`footer-option footer-option--page-scroll${scrolling ? " footer-option--on" : ""}`}>
              <Switch size="small" checked={scrolling} onChange={setScrolling} />Scroll inside pages
            </label>
          </Tooltip>
          <Tooltip title={deviceView ? "Each device opens the site as that device would (phone, tablet, computer, TV), so sites that choose their mobile or desktop layout on the server show the right one. Turn off to load the site straight into every frame." : "Every frame loads the site straight from your browser, as your computer. Sites that choose their layout on the server show the desktop version everywhere."}>
            <label className={`footer-option footer-option--device-view${deviceView ? " footer-option--on" : ""}`}>
              <Switch size="small" checked={deviceView} onChange={changeDeviceView} />Device view
            </label>
          </Tooltip>
          <Tooltip title={!syncScroll ? "Each device is used on its own." : linkedCount ? `What you do in one device happens in all of them: scrolling, taps (closing a popup everywhere), swipes, typing and page changes (${linkedCount} of ${devices.length} connected).` : deviceView ? "Scroll, tap, swipe or type in one device and the others follow." : "Scroll, tap, swipe or type in one device and the others follow. Without Device view, the site needs a one-line script: click Blank screen? for how."}>
            <label className={`footer-option footer-option--sync-scroll${syncScroll ? " footer-option--on" : ""}`}>
              <Switch size="small" checked={syncScroll} onChange={changeSync} />Mirror actions
              {syncScroll && url && revealed && <span className={`footer-sync-state text-[12px] ${linkedCount ? "text-[#2e8b57]" : "text-muted"}`}>{linkedCount ? `${linkedCount}/${devices.length}` : "not connected"}</span>}
            </label>
          </Tooltip>
          <Tooltip title={wideGroup ? "Turn every device upright" : "Turn every device sideways"}>
            <label className={`footer-option footer-option--landscape footer-option--${turnLabel.toLowerCase()}${rot ? " footer-option--on" : ""}`}>
              <Switch size="small" checked={rot} onChange={setRot} />{turnLabel}
            </label>
          </Tooltip>
          <span className="footer-divider max-md:hidden" aria-hidden />
          <Tooltip title="Load the link again in every frame">
            <Button className="footer-reload" icon={<ReloadOutlined />} onClick={() => setReloadKey((k) => k + 1)}>Reload pages</Button>
          </Tooltip>
          <Button className="footer-help" type="text" icon={<QuestionCircleOutlined />} onClick={() => setHelpOpen(true)}>Blank screen?</Button>
        </div>
      </footer>

      {/* Focus view */}
      {fd && fdim && (
        <FocusView device={fd} w={fdim.w} h={fdim.h} url={url} src={srcFor(fd)} rot={rot} scrolling={scrolling}
          onClose={() => setFocus(-1)} onPrev={() => setFocus((i) => (i - 1 + devices.length) % devices.length)} onNext={() => setFocus((i) => (i + 1) % devices.length)} />
      )}

      <Modal className="help-modal" open={helpOpen} onCancel={() => setHelpOpen(false)} footer={<Button type="primary" onClick={() => setHelpOpen(false)}>Got it</Button>} title="Blank screen?">
        <p>Fitcheck shows the site inside a frame, like every online responsive tester. A blank screen usually means one of these:</p>
        <ul className="grid gap-2 pl-5">
          <li><b>The site blocks framing.</b> It sends <code>X-Frame-Options</code> or a <code>Content-Security-Policy</code> with <code>frame-ancestors</code>. To allow this tester on <b>your own</b> site, remove <code>X-Frame-Options</code> and send:<br /><code className="help-frame-header mt-1 inline-block break-all rounded bg-[#f6efe9] px-1.5 py-0.5">Content-Security-Policy: frame-ancestors &apos;self&apos; {typeof window !== "undefined" ? window.location.origin : "https://fitcheck.smartsitecp.com"}</code><br />Sites behind Cloudflare&apos;s bot check may still refuse.</li>
          <li><b>The link is http:// on an https:// page.</b> Browsers block mixed content. Use the https:// address.</li>
          <li><b>The site needs a login or cookie consent.</b> Third-party cookies are often blocked inside frames.</li>
          <li className="help-sync-scroll"><b>Mirror actions without Device view needs one line on the site.</b> With Device view on, it works on any site. Browsers don&apos;t let a page see or repeat what you do in another site shown in a frame. On <b>your own</b> site, add this before <code>&lt;/body&gt;</code>, and scrolling, tapping, swiping or typing in one device does the same in all the others:<br />
            <code className="help-sync-tag mt-1 inline-block break-all rounded bg-[#f6efe9] px-1.5 py-0.5">{syncTag}</code><br />It only runs inside Fitcheck&apos;s frames and only shares the scroll position.</li>
          <li><b>Local addresses.</b> <code>localhost</code> links only work on the computer running that site.</li>
        </ul>
        <p className="text-muted">Sizes are CSS pixels: the width the phone&apos;s browser uses for media queries.</p>
        {site.help_email && <p className="help-modal-contact">Still stuck? Email <a href={`mailto:${site.help_email}`}>{site.help_email}</a>.</p>}
      </Modal>
    </div>
  );
}

/** Checklist of the active group's devices: tick the ones to show. */
function DevicePicker({ devices, selected, onChange, rot }: { devices: Device[]; selected: string[]; onChange: (ids: string[]) => void; rot: boolean }) {
  const all = selected.length === devices.length;
  return (
    <div className="device-picker w-64 max-w-[80vw]">
      <div className="device-picker-head flex items-center justify-between border-0 border-b border-solid border-sand pb-2">
        <Checkbox className="device-picker-all font-semibold" checked={all} indeterminate={!all && selected.length > 0}
          onChange={(e) => onChange(e.target.checked ? devices.map((d) => d.id) : [])}>All devices</Checkbox>
        <span className="font-mono text-[11px] text-muted">{selected.length}/{devices.length}</span>
      </div>
      <Checkbox.Group className="device-picker-list mt-1 flex max-h-72 flex-col flex-nowrap overflow-y-auto" value={selected} onChange={(v) => onChange(v as string[])}>
        {devices.map((d) => {
          const r = dims(d, rot);
          return (
            <Checkbox key={d.id} value={d.id} className="device-picker-item m-0 w-full rounded-md px-1 py-1.5 hover:bg-cream">
              <span className="flex w-full items-baseline justify-between gap-3">
                <span>{d.name}</span><small className="font-mono text-[11px] text-muted">{r.w}×{r.h}</small>
              </span>
            </Checkbox>
          );
        })}
      </Checkbox.Group>
    </div>
  );
}

function FocusView({ device, w, h, url, src, rot, scrolling, onClose, onPrev, onNext }: {
  device: Device; w: number; h: number; url: string; src: string; rot: boolean; scrolling: boolean; onClose: () => void; onPrev: () => void; onNext: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(0.3);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setS(fitScale(e.contentRect.width - 20, e.contentRect.height - 20, w, h, device.shape)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, device.shape]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={device.name} className="focus-view fixed inset-0 z-50 grid grid-rows-[auto_minmax(0,1fr)] bg-[rgba(42,29,23,.55)] p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mx-auto mb-3 flex w-full max-w-[1100px] items-center gap-2.5 text-white">
        <Button ghost onClick={onPrev} aria-label="Previous device" icon={<LeftOutlined />} />
        <div><h2 className="m-0 text-lg">{device.name}</h2><small className="font-mono text-xs opacity-80">{w} × {h} · {device.type}</small></div>
        <Button ghost onClick={onNext} aria-label="Next device" icon={<RightOutlined />} />
        <span className="flex-1" />
        <Button ghost onClick={onClose} autoFocus>Close · Esc</Button>
      </div>
      <div ref={ref} className="flex min-h-0 overflow-auto" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="m-auto"><DeviceFrame url={url} src={src} w={w} h={h} s={s} shape={device.shape} rot={rot} scrolling={scrolling} label={device.name} /></div>
      </div>
    </div>
  );
}
