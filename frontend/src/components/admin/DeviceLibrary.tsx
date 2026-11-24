"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Checkbox, Drawer, Empty, Input, Segmented, Select, Skeleton, Switch, Tag, Tooltip } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { api, ApiError } from "@/lib/api";
import type { Family } from "@/lib/types";

interface LibraryDevice {
  slug: string; name: string; brand: string; type: "Mobile" | "Tablet" | "Desktop" | "TV";
  width: number; height: number; frame: string; year: number; added: boolean;
}

const TYPES = ["All", "Mobile", "Tablet", "Desktop", "TV"] as const;

/**
 * "Add from library": a catalogue of phones, tablets, laptops, desktops and TVs (backend database/data/device-library.php).
 * Pick by brand, search, tick, choose menu groups, add. Devices already in Screen views show as "Added".
 */
export default function DeviceLibrary({ open, families, onClose, onAdded }: {
  open: boolean; families: Family[]; onClose: () => void; onAdded: () => void;
}) {
  const { message } = App.useApp();
  const [items, setItems] = useState<LibraryDevice[] | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const [brand, setBrand] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<number[]>([]);
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the picker each time the drawer opens
    setPicked(new Set()); setItems(null);
    api<{ data: LibraryDevice[] }>("/screen-views/library").then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [open]);

  const brands = useMemo(() => [...new Set((items ?? []).map((d) => d.brand))], [items]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? []).filter((d) => (type === "All" || d.type === type) && (!brand || d.brand === brand)
      && (!s || `${d.name} ${d.brand} ${d.width}x${d.height} ${d.year}`.toLowerCase().includes(s)));
  }, [items, q, type, brand]);
  const byBrand = useMemo(() => {
    const m = new Map<string, LibraryDevice[]>();
    shown.forEach((d) => m.set(d.brand, [...(m.get(d.brand) ?? []), d]));
    return [...m.entries()];
  }, [shown]);

  const toggle = (slugs: string[], on: boolean) => setPicked((p) => {
    const n = new Set(p);
    slugs.forEach((s) => (on ? n.add(s) : n.delete(s)));
    return n;
  });

  async function add() {
    setBusy(true);
    try {
      const r = await api<{ added: number; skipped: number }>("/screen-views/import", { method: "POST", body: { slugs: [...picked], family_ids: groups, is_active: visible } });
      message.success(`Added ${r.added} device${r.added === 1 ? "" : "s"}${r.skipped ? ` (${r.skipped} already there)` : ""}.`);
      onAdded();
    } catch (e) { message.error(e instanceof ApiError ? e.message : "Could not add the devices."); }
    finally { setBusy(false); }
  }

  const total = items?.length ?? 0, added = items?.filter((d) => d.added).length ?? 0;

  return (
    <Drawer className="device-library" open={open} onClose={onClose} size={720} destroyOnHidden
      title={<span className="device-library-title">Add from library <span className="font-normal text-[#5c6978]">· {total} devices, {added} already added</span></span>}
      footer={
        <div className="device-library-footer flex flex-wrap items-center gap-3">
          <Select className="device-library-groups min-w-64 flex-1" mode="multiple" allowClear placeholder="Also add to menu groups (optional)"
            value={groups} onChange={setGroups} options={families.map((f) => ({ value: f.id, label: f.name }))} maxTagCount="responsive" />
          <Tooltip title="Off: added hidden, switch them on later in the list">
            <span className="device-library-visible inline-flex items-center gap-2 text-[13px]"><Switch size="small" checked={visible} onChange={setVisible} /> On tester</span>
          </Tooltip>
          <Button className="device-library-add" type="primary" disabled={!picked.size} loading={busy} onClick={add}>
            Add {picked.size || ""} device{picked.size === 1 ? "" : "s"}
          </Button>
        </div>
      }>
      <div className="device-library-filters mb-3 grid gap-2">
        <Input className="device-library-search" allowClear prefix={<SearchOutlined className="text-[#8a96a5]" />} placeholder="Search model, brand, size or year, e.g. iPhone 15, Galaxy, 412"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented className="device-library-types" value={type} onChange={(v) => setType(v as (typeof TYPES)[number])} options={[...TYPES]} />
          <div className="device-library-brands flex flex-wrap gap-1">
            <Tag.CheckableTag className="device-library-brand" checked={!brand} onChange={() => setBrand(null)}>All brands</Tag.CheckableTag>
            {brands.map((b) => <Tag.CheckableTag key={b} className="device-library-brand" checked={brand === b} onChange={(on) => setBrand(on ? b : null)}>{b}</Tag.CheckableTag>)}
          </div>
        </div>
        <p className="device-library-note m-0 text-[12px] text-[#5c6978]">Sizes are each device&apos;s default browser size in CSS pixels (portrait). Android sizes depend on the phone&apos;s display-size setting; you can edit any device after adding it.</p>
      </div>

      {!items ? <Skeleton active /> : byBrand.length === 0 ? <Empty className="empty-state" description="No devices match" /> : byBrand.map(([b, list]) => {
        const free = list.filter((d) => !d.added).map((d) => d.slug);
        const allOn = free.length > 0 && free.every((s) => picked.has(s));
        return (
          <section key={b} className="device-library-group mb-4">
            <div className="device-library-group-head sticky top-0 z-10 mb-1 flex items-center gap-2 border-0 border-b border-solid border-[#eef1f5] bg-white py-1.5">
              <Checkbox className="device-library-group-check" disabled={!free.length} checked={allOn} indeterminate={!allOn && free.some((s) => picked.has(s))}
                onChange={(e) => toggle(free, e.target.checked)} />
              <b className="device-library-group-name">{b}</b>
              <span className="text-[12px] text-[#8a96a5]">{list.length}</span>
            </div>
            <ul className="device-library-list m-0 grid list-none grid-cols-1 gap-x-4 p-0 sm:grid-cols-2">
              {list.map((d) => (
                <li key={d.slug} className={`device-library-item${d.added ? " device-library-item--added" : ""}`}>
                  <label className={`flex items-center gap-2 rounded-md px-1.5 py-1 ${d.added ? "cursor-default opacity-60" : "cursor-pointer hover:bg-[#f7f9fb]"}`}>
                    <Checkbox disabled={d.added} checked={d.added || picked.has(d.slug)} onChange={(e) => toggle([d.slug], e.target.checked)} />
                    <span className="device-library-name min-w-0 flex-1 truncate">{d.name}</span>
                    <span className="device-library-size font-mono text-[11px] text-[#5c6978]">{d.width}×{d.height}</span>
                    <span className="device-library-year text-[11px] text-[#8a96a5]">{d.year}</span>
                    {d.added && <Tag className="device-library-added m-0" color="green">Added</Tag>}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Drawer>
  );
}
