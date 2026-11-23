"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button, Drawer, Tooltip } from "antd";
import { BulbOutlined, FilePdfOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { helpForPath, type HelpTopic } from "@/lib/help";
import { useAdmin } from "./AdminProvider";

export const HANDBOOK_URL = "/help/Fitcheck-Admin-Handbook.pdf";

/** ⓘ next to a page title: opens this page's guide (from lib/help.ts) in a side panel. */
export default function HelpButton({ topic }: { topic?: HelpTopic }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const t = topic ?? helpForPath(path);
  if (!t) return null;
  return (
    <>
      <Tooltip title="How this page works">
        <Button className="help-btn" type="text" shape="circle" size="small" icon={<InfoCircleOutlined />} onClick={() => setOpen(true)} aria-label={`Help: ${t.title}`} />
      </Tooltip>
      <Drawer className="help-drawer" open={open} onClose={() => setOpen(false)} size={520} title={<span className="help-drawer-title">{t.title}</span>}
        footer={<a className="help-drawer-handbook inline-flex items-center gap-1.5 text-[14px]" href={HANDBOOK_URL} target="_blank" rel="noopener"><FilePdfOutlined /> Open the full handbook (PDF)</a>}>
        <HelpContent topic={t} />
      </Drawer>
    </>
  );
}

export function HelpContent({ topic }: { topic: HelpTopic }) {
  const { can } = useAdmin();
  return (
    <article className="help-article">
      <p className="help-summary mt-0 text-[15px] text-[#3d4a59]">{topic.summary}</p>
      {topic.blocks.filter((b) => !b.perm || can(b.perm)).map((b) => (
        <section key={b.heading} className="help-section mb-6">
          <h3 className="help-section-title mb-2 mt-0 text-[16px] font-semibold">{b.heading}</h3>
          {b.image && (
            <figure className="help-figure m-0 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- plain screenshots from /public, sized by CSS */}
              <img className="help-image block w-full rounded-lg border border-solid border-[#e3e8ee]" src={`/help/${b.image}`} alt={b.caption ?? b.heading} loading="lazy"
                onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
              {b.caption && <figcaption className="help-caption mt-1.5 text-[12px] text-[#5c6978]">{b.caption}</figcaption>}
            </figure>
          )}
          {b.text && <p className="help-text my-2 text-[14px] leading-relaxed">{b.text}</p>}
          {b.steps && (
            <ol className="help-steps my-2 grid gap-1.5 pl-5 text-[14px] leading-relaxed">
              {b.steps.map((s) => <li key={s} className="help-step">{s}</li>)}
            </ol>
          )}
          {b.tips?.map((tip) => (
            <p key={tip} className="help-tip my-2 flex gap-2 rounded-lg bg-[#fff8e6] px-3 py-2 text-[13px] leading-relaxed text-[#5a4a1e]">
              <BulbOutlined className="help-tip-icon mt-0.5 flex-none text-[#d48806]" /><span>{tip}</span>
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
