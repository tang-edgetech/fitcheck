/**
 * Draws simplified illustrations of each admin screen for the user guide (in-app help and the PDF handbook).
 * Run: node docs/handbook/illustrations.mjs   → writes frontend/public/help/*.svg
 * Numbered orange markers match the numbered steps in frontend/src/lib/help.ts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "frontend", "public", "help");
mkdirSync(OUT, { recursive: true });

const W = 960, H = 600;
const C = {
  blue: "#2f5bea", blueBg: "#e6ecfd", bg: "#f3f5f8", line: "#e3e8ee", ink: "#17202b", muted: "#5c6978", faint: "#8a96a5", white: "#fff",
  green: "#389e0d", greenBg: "#f6ffed", greenLine: "#b7eb8f", red: "#cf1322", redBg: "#fff1f0", redLine: "#ffa39e",
  orange: "#d46b08", orangeBg: "#fff7e6", orangeLine: "#ffd591", purple: "#531dab", purpleBg: "#f9f0ff", purpleLine: "#d3adf7",
  yellowBg: "#fffbe6", yellowLine: "#ffe58f", marker: "#fa541c",
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tw = (s, size = 13) => String(s).length * size * 0.55;

const text = (x, y, s, { size = 13, weight = 400, fill = C.ink, anchor = "start", mono = false } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${mono ? ' font-family="Consolas, monospace"' : ""}>${esc(s)}</text>`;
const rect = (x, y, w, h, { fill = C.white, stroke = C.line, r = 8, sw = 1, opacity = 1, dash = "" } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
const line = (x1, y1, x2, y2, { stroke = C.line, sw = 1 } = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"/>`;

const btn = (x, y, label, { primary = false, danger = false, w, h = 30, disabled = false, link = false } = {}) => {
  const width = w ?? tw(label) + 28;
  if (link) return text(x, y + 20, label, { fill: C.blue });
  const fill = primary ? C.blue : C.white;
  const stroke = primary ? C.blue : danger ? C.redLine : "#d0d7e0";
  const color = disabled ? C.faint : primary ? C.white : danger ? C.red : C.ink;
  return rect(x, y, width, h, { fill: disabled ? "#f5f6f8" : fill, stroke, r: 6 }) + text(x + width / 2, y + h / 2 + 4.5, label, { anchor: "middle", fill: color, weight: primary ? 600 : 400 });
};
const btnW = (label, w) => w ?? tw(label) + 28;

const TAGS = {
  green: [C.greenBg, C.greenLine, C.green], red: [C.redBg, C.redLine, C.red], orange: [C.orangeBg, C.orangeLine, C.orange],
  blue: [C.blueBg, "#adc0f7", C.blue], purple: [C.purpleBg, C.purpleLine, C.purple], grey: ["#fafafa", "#d9d9d9", "#595959"],
};
const tag = (x, y, label, kind = "grey") => {
  const [bg, ln, fg] = TAGS[kind]; const w = tw(label, 12) + 14;
  return rect(x, y, w, 20, { fill: bg, stroke: ln, r: 4 }) + text(x + w / 2, y + 14, label, { size: 12, fill: fg, anchor: "middle" });
};
const tagW = (label) => tw(label, 12) + 14;
const toggle = (x, y, on = true, { small = true } = {}) => {
  const w = small ? 28 : 40, h = small ? 16 : 22, r = h / 2;
  return rect(x, y, w, h, { fill: on ? C.blue : "#bfbfbf", stroke: "none", r }) + `<circle cx="${on ? x + w - r : x + r}" cy="${y + r}" r="${r - 2}" fill="#fff"/>`;
};
const checkbox = (x, y, on = false) => rect(x, y, 14, 14, { fill: on ? C.blue : C.white, stroke: on ? C.blue : "#c5ccd6", r: 3 }) +
  (on ? `<path d="M${x + 3} ${y + 7} l3 3 l5 -6" stroke="#fff" stroke-width="2" fill="none"/>` : "");
const radio = (x, y, on = false, disabled = false) => `<circle cx="${x + 7}" cy="${y + 7}" r="7" fill="${disabled ? "#f5f5f5" : "#fff"}" stroke="${on ? C.blue : "#c5ccd6"}"/>` + (on ? `<circle cx="${x + 7}" cy="${y + 7}" r="3.5" fill="${C.blue}"/>` : "");
const input = (x, y, w, label, value = "", { placeholder = "", disabled = false, h = 32, hint = "" } = {}) =>
  (label ? text(x, y, label, { size: 12, fill: C.muted }) : "") +
  rect(x, y + 6, w, h, { fill: disabled ? "#f5f6f8" : C.white, stroke: "#d0d7e0", r: 6 }) +
  text(x + 10, y + 6 + h / 2 + 4.5, value || placeholder, { fill: value ? (disabled ? C.faint : C.ink) : C.faint }) +
  (hint ? text(x, y + h + 22, hint, { size: 11, fill: C.faint }) : "");
const select = (x, y, w, label, value, opts = {}) => input(x, y, w, label, value, opts) + `<path d="M${x + w - 18} ${y + 20} l4 4 l4 -4" stroke="${C.faint}" fill="none" stroke-width="1.5"/>`;
const segmented = (x, y, items, active) => {
  let out = "", cx = x;
  const widths = items.map((i) => tw(i) + 24);
  out += rect(x, y, widths.reduce((a, b) => a + b, 0) + 4, 30, { fill: "#f0f2f5", stroke: "none", r: 6 });
  items.forEach((it, i) => {
    if (i === active) out += rect(cx + 2, y + 2, widths[i], 26, { fill: C.white, stroke: "none", r: 5 });
    out += text(cx + 2 + widths[i] / 2, y + 19.5, it, { anchor: "middle", fill: i === active ? C.ink : C.muted, weight: i === active ? 600 : 400 });
    cx += widths[i];
  });
  return out;
};
const grip = (x, y) => [0, 1, 2].map((r) => [0, 1].map((c) => `<circle cx="${x + c * 5}" cy="${y + r * 5}" r="1.6" fill="${C.faint}"/>`).join("")).join("");
const icon = {
  edit: (x, y) => `<path d="M${x} ${y + 12} l0 -3 l8 -8 l3 3 l-8 8 z" stroke="${C.muted}" fill="none" stroke-width="1.4"/>`,
  del: (x, y) => `<path d="M${x + 1} ${y + 3} h10 M${x + 3} ${y + 3} v9 h6 v-9 M${x + 4} ${y + 1} h4" stroke="${C.red}" fill="none" stroke-width="1.4"/>`,
  copy: (x, y) => rect(x + 3, y, 9, 10, { fill: "none", stroke: C.muted, r: 1.5 }) + rect(x, y + 3, 9, 10, { fill: C.white, stroke: C.muted, r: 1.5 }),
  more: (x, y) => [0, 1, 2].map((i) => `<circle cx="${x + i * 5}" cy="${y}" r="1.6" fill="${C.muted}"/>`).join(""),
  info: (x, y) => `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${C.faint}" stroke-width="1.3"/>` + text(x, y + 4, "i", { size: 11, fill: C.faint, anchor: "middle", weight: 700 }),
};
/** Orange numbered marker pointing at a feature; numbers match the guide's steps */
const marker = (x, y, n) => `<g><circle cx="${x}" cy="${y}" r="12" fill="${C.marker}" stroke="#fff" stroke-width="2.5"/>${text(x, y + 4.5, String(n), { size: 13, weight: 700, fill: "#fff", anchor: "middle" })}</g>`;

const MENU = ["Dashboard", "Screen views", "Menu groups", "Users", "Audit log", "Settings"];
const SB = 180, HD = 56, CX = SB + 32, CW = W - SB - 64;

function shell(active, body, { dim = false } = {}) {
  let s = rect(0, 0, W, H, { fill: C.bg, stroke: "none", r: 0 });
  s += rect(0, 0, SB, H, { fill: C.white, stroke: "none", r: 0 }) + line(SB, 0, SB, H);
  s += rect(18, 18, 24, 24, { fill: C.blue, stroke: "none", r: 6 }) + text(30, 35, "F", { fill: "#fff", weight: 700, anchor: "middle" });
  s += text(50, 35, "Fitcheck", { weight: 700 }) + text(110, 35, "Admin", { fill: C.muted });
  MENU.forEach((m, i) => {
    const y = 72 + i * 40;
    if (m === active) s += rect(10, y, SB - 20, 34, { fill: C.blueBg, stroke: "none", r: 6 });
    s += rect(24, y + 11, 12, 12, { fill: "none", stroke: m === active ? C.blue : C.faint, r: 3, sw: 1.4 });
    s += text(46, y + 22, m, { fill: m === active ? C.blue : C.ink, weight: m === active ? 600 : 400 });
  });
  s += rect(SB, 0, W - SB, HD, { fill: C.white, stroke: "none", r: 0 }) + line(SB, HD, W, HD);
  s += text(W - 340, 33, "? User guide", { fill: C.muted }) + text(W - 245, 33, "Open tester ↗", { fill: C.muted });
  s += `<circle cx="${W - 140}" cy="28" r="14" fill="${C.blue}"/>` + text(W - 140, 33, "S", { fill: "#fff", anchor: "middle", weight: 600 });
  s += text(W - 120, 25, "Super Admin", { size: 12, weight: 600 }) + text(W - 120, 40, "Admin", { size: 11, fill: C.muted });
  s += `<g>${body}</g>`;
  if (dim) s += rect(0, 0, W, H, { fill: "#000", stroke: "none", r: 0, opacity: 0.35 });
  return s;
}
const pageHead = (title, sub, actions = []) => {
  let s = text(CX, 98, title, { size: 20, weight: 600 }) + icon.info(CX + tw(title, 20) + 14, 92);
  if (sub) s += text(CX, 120, sub, { fill: C.muted });
  let x = W - 32;
  [...actions].reverse().forEach((a) => { const w = btnW(a.label); x -= w; s += btn(x, 80, a.label, a); x -= 8; });
  return s;
};
const card = (x, y, w, h, title) => rect(x, y, w, h) + (title ? text(x + 16, y + 28, title, { size: 14, weight: 600 }) + line(x, y + 44, x + w, y + 44) : "");

/** Table: cols [{title, w}], rows = arrays of cells (string or function (x, y) => svg) */
function table(x, y, cols, rows, { rowH = 46, highlight = -1, lifted = -1, dropAfter = -1 } = {}) {
  const w = cols.reduce((a, c) => a + c.w, 0);
  let s = rect(x, y, w, 40 + rows.length * rowH, { r: 8 });
  s += rect(x + 1, y + 1, w - 2, 39, { fill: "#fafbfc", stroke: "none", r: 7 }) + line(x, y + 40, x + w, y + 40);
  let cx = x;
  cols.forEach((c) => { s += text(cx + 12, y + 25, c.title, { size: 12, weight: 600, fill: C.muted }); cx += c.w; });
  rows.forEach((r, i) => {
    const ry = y + 40 + i * rowH;
    if (i === highlight) s += rect(x + 1, ry, w - 2, rowH, { fill: "#f4f7ff", stroke: "none", r: 0 });
    if (i === lifted) s += rect(x + 1, ry, w - 2, rowH, { fill: "#f7f9fb", stroke: "none", r: 0, opacity: 0.9 });
    if (i > 0) s += line(x, ry, x + w, ry, { stroke: "#eef1f5" });
    let cx2 = x;
    r.forEach((cell, j) => {
      const op = i === lifted ? ' opacity="0.45"' : "";
      s += `<g${op}>${typeof cell === "function" ? cell(cx2 + 12, ry) : text(cx2 + 12, ry + rowH / 2 + 4.5, cell)}</g>`;
      cx2 += cols[j].w;
    });
    if (i === dropAfter) s += line(x + 2, ry + rowH, x + w - 2, ry + rowH, { stroke: C.blue, sw: 3 });
  });
  return s;
}
const two = (a, b, { mono = false } = {}) => (x, y) => text(x, y + 20, a, { weight: 500 }) + text(x, y + 36, b, { size: 11, fill: C.faint, mono });
const svg = (name, body) => {
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, 'Segoe UI', Arial, sans-serif">${body}</svg>`;
  writeFileSync(join(OUT, `${name}.svg`), out);
  console.log("wrote", name + ".svg");
};
const drawer = (title, body, { w = 420, actions = ["Cancel", "Save"] } = {}) => {
  const x = W - w;
  let s = rect(x, 0, w, H, { fill: C.white, stroke: "none", r: 0 }) + line(x, 56, W, 56);
  s += text(x + 24, 34, title, { size: 15, weight: 600 });
  let bx = W - 20;
  [...actions].reverse().forEach((a, i) => { const bw = btnW(a); bx -= bw; s += btn(bx, 14, a, { primary: i === 0 }); bx -= 8; });
  return s + body(x + 24, 76, w - 48);
};
const modal = (x, y, w, h, title, body, actions = ["Cancel", "Save"]) => {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#fff" filter="url(#sh)"/>`;
  s += text(x + 24, y + 34, title, { size: 15, weight: 600 }) + text(x + w - 26, y + 34, "×", { size: 18, fill: C.faint });
  s += body(x + 24, y + 58, w - 48);
  let bx = x + w - 24;
  [...actions].reverse().forEach((a, i) => { const bw = btnW(a); bx -= bw; s += btn(bx, y + h - 50, a, { primary: i === 0 }); bx -= 8; });
  return s;
};
const SHADOW = `<defs><filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-opacity="0.18"/></filter></defs>`;
const tabs = (items, active) => {
  let s = "", x = CX;
  items.forEach((t, i) => {
    s += text(x, 158, t, { fill: i === active ? C.blue : C.ink, weight: i === active ? 600 : 400 });
    if (i === active) s += line(x - 2, 170, x + tw(t) + 4, 170, { stroke: C.blue, sw: 2 });
    x += tw(t) + 40;
  });
  return s + line(CX, 171, W - 32, 171);
};

/* ------------------------------------------------------------------ screens */

svg("dashboard", shell("Dashboard", (() => {
  let s = pageHead("Welcome, Super Admin", "What's live on the tester and how secure the panel is right now.");
  s += rect(CX, 140, CW, 40, { fill: C.yellowBg, stroke: C.yellowLine }) + `<circle cx="${CX + 20}" cy="160" r="8" fill="#faad14"/>` + text(CX + 36, 165, "Two-factor sign-in is optional · Accounts can sign in with only a password.", { size: 12 }) + text(W - 200, 165, "Require it for everyone", { size: 12, fill: C.blue });
  const cw = (CW - 36) / 4;
  const stats = [["Screen views live on the tester", "38", "of 38", ["Mobile 23", "Tablet 6"]], ["Menu groups (tester tabs)", "8", "active of 8", ["Manage menu groups"]], ["Accounts with 2FA", "1", "of 3", ["1 on a temporary password"]], ["Failed sign-ins, last 24 h", "2", "", ["5 failed actions in total"]]];
  stats.forEach(([t, v, suf, extra], i) => {
    const x = CX + i * (cw + 12);
    s += card(x, 194, cw, 112) + text(x + 14, 218, t, { size: 11, fill: C.muted }) + text(x + 14, 252, v, { size: 26, fill: i === 3 ? C.red : C.ink }) + text(x + 22 + tw(v, 26), 252, suf, { size: 12, fill: C.muted });
    if (i === 0) { let tx = x + 14; extra.forEach((e) => { s += tag(tx, 270, e); tx += tagW(e) + 4; }); }
    else s += text(x + 14, 285, extra[0], { size: 12, fill: i === 1 ? C.blue : C.muted });
    if (i === 2) s += rect(x + 14, 262, cw - 28, 5, { fill: "#f0f0f0", stroke: "none", r: 3 }) + rect(x + 14, 262, (cw - 28) / 3, 5, { fill: C.blue, stroke: "none", r: 3 });
    s += marker(x + cw - 14, 194, i + 1);
  });
  s += card(CX, 320, CW, 262, "Recent activity") + text(W - 130, 348, "Open audit log", { fill: C.blue, size: 12 });
  const acts = [["success", "super-admin signed in", "a few seconds ago"], ["success", "dev-admin added screen view iPhone 18", "12 minutes ago"], ["failed", "Someone couldn't sign in as \"admin\": wrong username or password", "1 hour ago"], ["success", "dev-admin changed the order of the menu groups", "2 hours ago"], ["success", "super-admin hid 3 screen views from the tester", "3 hours ago"]];
  acts.forEach(([st, msg, ago], i) => {
    const y = 378 + i * 40;
    if (i) s += line(CX + 16, y - 10, W - 48, y - 10, { stroke: "#eef1f5" });
    s += tag(CX + 16, y, st === "success" ? "Success" : "Failed", st === "success" ? "green" : "red") + text(CX + 90, y + 15, msg) + text(W - 48, y + 15, ago, { size: 12, fill: C.muted, anchor: "end" });
  });
  return s + marker(CX + CW - 8, 320, 5);
})()));

svg("setup", (() => {
  let s = rect(0, 0, W, H, { fill: C.bg, stroke: "none", r: 0 });
  s += rect(18, 18, 24, 24, { fill: C.blue, stroke: "none", r: 6 }) + text(30, 35, "F", { fill: "#fff", weight: 700, anchor: "middle" }) + text(50, 35, "Fitcheck", { weight: 700 }) + text(110, 35, "Admin", { fill: C.muted }) + btn(W - 110, 14, "Sign out");
  s += text(W / 2, 92, "Finish setting up your account", { size: 22, weight: 600, anchor: "middle" }) + text(W / 2, 116, "A few quick steps before you can use the admin panel.", { fill: C.muted, anchor: "middle" });
  const steps = ["Choose a password", "Your details", "Two-factor sign-in"];
  steps.forEach((t, i) => {
    const x = 230 + i * 200;
    s += `<circle cx="${x}" cy="160" r="14" fill="${i === 0 ? C.blue : "#fff"}" stroke="${i === 0 ? C.blue : "#c5ccd6"}"/>` + text(x, 165, String(i + 1), { anchor: "middle", fill: i === 0 ? "#fff" : C.muted, weight: 600 });
    s += text(x + 22, 165, t, { weight: i === 0 ? 600 : 400, fill: i === 0 ? C.ink : C.muted });
    if (i < 2) s += line(x + 22 + tw(t) + 10, 160, x + 186, 160);
    s += marker(x, 132, i + 1);
  });
  s += card(250, 200, 460, 360, "Choose your own password");
  s += text(266, 268, "You're signed in with a temporary password. Replace it with your own.", { size: 12, fill: C.muted });
  s += input(266, 296, 428, "Current (temporary) password", "••••••••••");
  s += input(266, 360, 428, "New password", "••••••••••••", { hint: "At least 8 characters, with upper and lower case letters, a number and a symbol." });
  s += input(266, 440, 428, "Repeat new password", "••••••••••••");
  return s + btn(266, 506, "Save password", { primary: true });
})());

const svTable = (sel = []) => table(CX, 222, [{ title: "", w: 36 }, { title: "Name", w: 170 }, { title: "Type", w: 74 }, { title: "Viewport", w: 92 }, { title: "Frame", w: 104 }, { title: "Menu groups", w: 128 }, { title: "On tester", w: 70 }, { title: "", w: CW - 674 }], [
  ["iPhone 17 Pro Max", "ip17pm", "Mobile", "440 × 956", "Dynamic Island", ["Popular", "iPhone"], true],
  ["iPhone 17 Pro", "ip17p", "Mobile", "402 × 874", "Dynamic Island", ["Popular", "iPhone"], true],
  ["Galaxy S25 Ultra", "s25u", "Mobile", "412 × 891", "Punch hole", ["Popular", "Galaxy"], true],
  ["iPad Pro 13", "ipadpro13", "Tablet", "1032 × 1376", "Tablet", ["Tablets"], true],
  ["Galaxy Note 20", "note20", "Mobile", "412 × 915", "Punch hole", [], false],
  ["MacBook Air 13", "mba13", "Desktop", "1280 × 832", "Browser", ["Laptops"], true],
].map(([n, slug, type, vp, fr, groups, on], i) => [
  (x, y) => checkbox(x, y + 16, sel.includes(i)), two(n, slug, { mono: true }), (x, y) => tag(x, y + 13, type, type === "Mobile" ? "blue" : type === "Tablet" ? "purple" : "grey"),
  (x, y) => text(x, y + 27, vp, { mono: true, size: 12 }), fr,
  (x, y) => groups.length ? groups.map((g, k) => tag(x + k * 62, y + 13, g)).join("") : text(x, y + 27, "None", { fill: C.faint }),
  (x, y) => toggle(x, y + 15, on), (x, y) => icon.edit(x - 4, y + 17) + icon.del(x + 18, y + 17),
]), { highlight: -1 });

svg("screen-views", shell("Screen views", (() => {
  let s = pageHead("Screen views", "Every device the tester can show. Hidden devices stay here but visitors don't see them.", [{ label: "+ Add screen view", primary: true }]);
  s += input(CX, 140, 220, "", "", { placeholder: "Search name, brand or width" }) + select(CX + 230, 140, 110, "", "Type") + select(CX + 350, 140, 120, "", "Brand") + select(CX + 480, 140, 120, "", "Status");
  s += marker(CX - 4, 146, 1);
  s += rect(CX, 182, CW, 34, { fill: C.blueBg, stroke: "none" }) + text(CX + 14, 204, "2 selected", { weight: 600 }) + btn(CX + 110, 184, "Show on tester", { h: 28 }) + btn(CX + 236, 184, "Hide", { h: 28 }) + btn(CX + 290, 184, "Delete", { h: 28, danger: true }) + text(W - 60, 204, "Clear", { fill: C.muted });
  s += marker(CX + 394, 199, 3);
  s += svTable([1, 2]);
  return s + marker(CX + 662, 222, 2);
})()));

svg("screen-view-edit", SHADOW + shell("Screen views", pageHead("Screen views", "", [{ label: "+ Add screen view", primary: true }]) + svTable(), { dim: true }) + drawer("Edit iPhone 17 Pro", (x, y, w) => {
  let s = input(x, y + 10, w / 2 - 8, "Name", "iPhone 17 Pro") + input(x + w / 2 + 8, y + 10, w / 2 - 8, "Brand", "Apple");
  s += marker(x - 10, y + 26, 2);
  s += select(x, y + 70, w / 2 - 8, "Type", "Mobile");
  s += text(x, y + 130, "Viewport (CSS pixels)", { size: 12, fill: C.muted }) + input(x, y + 130, 110, "", "402") + btn(x + 118, y + 137, "⇄", { w: 34 }) + input(x + 160, y + 130, 110, "", "874");
  s += marker(x - 10, y + 152, 3);
  s += select(x, y + 190, w, "Frame", "Dynamic Island");
  s += marker(x - 10, y + 212, 4);
  s += text(x, y + 250, "Menu groups", { size: 12, fill: C.muted }) + rect(x, y + 256, w, 32, { stroke: "#d0d7e0", r: 6 }) + tag(x + 8, y + 262, "Popular ×") + tag(x + 90, y + 262, "iPhone ×");
  s += marker(x - 10, y + 272, 5);
  s += text(x, y + 316, "Preview", { size: 12, fill: C.muted }) + rect(x, y + 324, w, 160, { fill: "#f7f9fb" });
  s += rect(x + w / 2 - 38, y + 334, 76, 140, { fill: "#2b201a", stroke: "none", r: 14 }) + rect(x + w / 2 - 33, y + 339, 66, 130, { fill: "#fff", stroke: "none", r: 10 }) + rect(x + w / 2 - 12, y + 344, 24, 6, { fill: "#000", stroke: "none", r: 3 });
  return s;
}) + marker(W - 16, 52, 5));

svg("menu-groups", shell("Menu groups", (() => {
  let s = pageHead("Menu groups", "The menu tabs on the tester. Drag a row by its grip to change the menu order.", [{ label: "+ Add group", primary: true }]);
  const rows = [["Popular", "popular", true, "9 iPhone 17 Pro Max, iPhone 17 Pro, …"], ["iPhone", "iphone", false, "7 iPhone 17 Pro Max, iPhone 17, …"], ["Galaxy", "galaxy", false, "5 Galaxy S25 Ultra, Galaxy S25, …"], ["Tablets", "tablets", false, "6 iPad Pro 13, iPad Air 11, …"], ["Pixel", "pixel", false, "3 Pixel 10, Pixel 10 Pro, …"], ["Laptops & desktops", "laptops", false, "6 MacBook Air 13, …"]];
  s += table(CX, 150, [{ title: "", w: 44 }, { title: "Name", w: 210 }, { title: "Devices", w: 230 }, { title: "On tester", w: 84 }, { title: "", w: CW - 568 }],
    rows.map(([n, slug, def, dev]) => [(x, y) => grip(x + 2, y + 18), (x, y) => text(x, y + 20, n, { weight: 500 }) + (def ? tag(x + tw(n) + 14, y + 7, "Opens first", "blue") : "") + text(x, y + 36, slug, { size: 11, fill: C.faint, mono: true }),
      (x, y) => text(x, y + 27, dev, { size: 12, fill: C.muted }), (x, y) => toggle(x, y + 15, true),
      (x, y) => (def ? "" : text(x, y + 27, "Make first", { size: 12, fill: C.blue })) + icon.edit(x + 80, y + 17) + icon.del(x + 104, y + 17)]),
    { lifted: 3, dropAfter: 0 });
  s += `<rect x="${CX + 40}" y="212" width="420" height="30" rx="6" fill="#fff" stroke="${C.blue}" filter="url(#sh)"/>` + grip(CX + 54, 222) + text(CX + 74, 232, "Tablets", { weight: 500 }) + text(CX + 160, 232, "6 iPad Pro 13, iPad Air 11, …", { size: 12, fill: C.muted });
  s += `<path d="M${CX + 300} 350 q40 -50 0 -100" stroke="${C.blue}" fill="none" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#arr)"/>`;
  return SHADOW + `<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="${C.blue}"/></marker></defs>` + s + marker(CX + 10, 336, 1) + marker(CX + 470, 228, 2);
})()));

svg("menu-group-edit", SHADOW + shell("Menu groups", pageHead("Menu groups", "", [{ label: "+ Add group", primary: true }]), { dim: true }) + drawer("Edit Popular", (x, y, w) => {
  let s = input(x, y + 10, w / 2 - 8, "Tab name", "Popular") + input(x + w / 2 + 8, y + 10, w / 2 - 8, "ID", "popular");
  s += marker(x - 10, y + 26, 2);
  s += text(x, y + 82, "Show on tester", { size: 12, fill: C.muted }) + toggle(x, y + 92, true, { small: false }) + text(x + w / 2 + 8, y + 82, "Opens first", { size: 12, fill: C.muted }) + toggle(x + w / 2 + 8, y + 92, true, { small: false });
  s += text(x, y + 150, "Devices in this group (9)", { size: 14, weight: 600 }) + text(x, y + 170, "Drag by the grip to set the order they appear on the tester.", { size: 12, fill: C.muted });
  s += select(x, y + 176, w, "", "", { placeholder: "Add a screen view…" }) + marker(x - 10, y + 198, 3);
  ["iPhone 17 Pro Max · 440×956", "iPhone 17 Pro · 402×874", "iPhone 16e · 390×844", "iPhone SE · 375×667", "Galaxy S25 Ultra · 412×891", "Galaxy S25 · 360×780"].forEach((d, i) => {
    const yy = y + 230 + i * 40;
    s += rect(x, yy, w, 34, { r: 6, stroke: i === 2 ? C.blue : C.line }) + grip(x + 12, yy + 12) + text(x + 32, yy + 22, String(i + 1).padStart(2, "0"), { size: 12, fill: C.faint, mono: true }) + text(x + 58, yy + 22, d) + text(x + w - 18, yy + 22, "×", { fill: C.faint, size: 15 });
  });
  return s + marker(x - 10, y + 327, 4);
}) + marker(W - 16, 52, 5));

const usersBody = () => {
  let s = pageHead("Users", "People who can sign in to this admin panel.", [{ label: "+ Add user", primary: true }]);
  s += input(CX, 136, 260, "", "", { placeholder: "Search name, username or email" });
  const rows = [["Super Admin", "super-admin · super@example.com", "Admin", "On", true, false, "a few seconds ago", true], ["Dev Admin", "dev-admin · dev@example.com", "Developer", "On", true, false, "2 hours ago", false], ["Dev Admin 1", "dev-admin-1", "Developer", "Off", true, true, "Never", false], ["Ana Lim", "ana · ana@example.com", "Admin", "Off", false, false, "3 days ago", false]];
  s += table(CX, 184, [{ title: "User", w: 200 }, { title: "Role", w: 88 }, { title: "Two-factor", w: 84 }, { title: "Status", w: 146 }, { title: "Last sign-in", w: 104 }, { title: "", w: CW - 622 }],
    rows.map(([n, acc, role, tfa, on, temp, last, you]) => [
      (x, y) => text(x, y + 22, n, { weight: 500 }) + (you ? tag(x + tw(n) + 12, y + 9, "You") : "") + text(x, y + 42, acc, { size: 11, fill: C.muted }),
      (x, y) => tag(x, y + 18, role, role === "Developer" ? "purple" : "blue"), (x, y) => tag(x, y + 18, tfa, tfa === "On" ? "green" : "grey"),
      (x, y) => toggle(x, y + (temp ? 10 : 20), on) + text(x + 36, y + (temp ? 23 : 33), on ? "Active" : "Disabled", { size: 12, fill: on ? C.ink : C.red }) + (temp ? tag(x, y + 32, "Temporary password", "orange") : ""),
      (x, y) => text(x, y + 33, last, { size: 12, fill: C.muted }),
      (x, y) => role === "Developer" ? text(x, y + 33, "Developer only", { size: 11, fill: C.faint }) : (you ? btn(x, y + 16, "Edit", { h: 26 }) : btn(x, y + 16, "Edit", { h: 26 }) + rect(x + 52, y + 16, 26, 26, { r: 6, stroke: "#d0d7e0" }) + icon.more(x + 60, y + 29)),
    ]), { rowH: 58 });
  return s;
};
svg("users", shell("Users", usersBody() + marker(CX - 2, 226, 1) + marker(CX + 368, 260, 2) + marker(CX + 368, 384, 3)));

svg("user-edit", SHADOW + shell("Users", usersBody(), { dim: true }) + modal(280, 40, 440, 520, "Edit ana", (x, y, w) => {
  let s = input(x, y, w, "Username", "ana", { disabled: true, hint: "Only a Developer can change a username." });
  s += input(x, y + 80, w, "Display name", "Ana Lim") + input(x, y + 138, w, "Email", "ana@example.com") + select(x, y + 196, w, "Role", "Admin");
  s += marker(x - 12, y + 102, 2);
  s += text(x, y + 256, "Can sign in", { size: 12, fill: C.muted }) + toggle(x, y + 264, false, { small: false });
  s += rect(x, y + 300, w, 98, { fill: "#f7f9fb" }) + text(x + 14, y + 324, "Password and two-factor", { weight: 600 }) + text(x + 14, y + 344, "Both sign them out everywhere. Two-factor is on for this account.", { size: 11, fill: C.muted });
  s += btn(x + 14, y + 356, "Reset password…") + btn(x + 160, y + 356, "Remove two-factor");
  return s + marker(x + 14, y + 356, 3) + marker(x + 160, y + 356, 4);
}));

svg("reset-password", SHADOW + shell("Users", usersBody(), { dim: true }) + modal(170, 70, 380, 380, "Reset password for ana", (x, y, w) => {
  let s = text(x, y, "How", { size: 12, fill: C.muted });
  s += radio(x, y + 14, true) + text(x + 22, y + 26, "Generate a temporary password", { weight: 600 }) + text(x + 22, y + 44, "You see it once and pass it on. They must replace it", { size: 11, fill: C.muted }) + text(x + 22, y + 58, "when they sign in.", { size: 11, fill: C.muted });
  s += radio(x, y + 80, false, true) + text(x + 22, y + 92, "Type a new password", { weight: 600, fill: C.faint }) + text(x + 22, y + 110, "Developers only", { size: 11, fill: C.faint });
  s += rect(x, y + 136, w, 36, { fill: "#e6f4ff", stroke: "#91caff" }) + text(x + 14, y + 159, "They are signed out on every device straight away.", { size: 12 });
  return s + marker(x - 10, y + 22, 1);
}, ["Cancel", "Generate password"]) + modal(580, 120, 350, 300, "Temporary password", (x, y, w) => {
  let s = text(x, y, "Give this password to ana through a private channel.", { size: 11, fill: C.muted }) + text(x, y + 16, "They must replace it the next time they sign in.", { size: 11, fill: C.muted });
  s += rect(x, y + 32, w, 44, { fill: "#f7f9fb" }) + text(x + 14, y + 60, "Kp7#mQ2v-Ws9x", { size: 17, mono: true }) + icon.copy(x + w - 30, y + 48);
  s += rect(x, y + 90, w, 34, { fill: C.orangeBg, stroke: C.orangeLine }) + text(x + 14, y + 112, "This password isn't shown again.", { size: 12 });
  return s + marker(x + w - 24, y + 32, 2);
}, ["Done"]));

const auditRows = [["11/23 16:42:10", "super-admin", "Signed in", "success", 200, "127.0.0.1"], ["11/23 16:40:02", "dev-admin", "Added screen view iPhone 18", "success", 201, "127.0.0.1"], ["11/23 16:31:47", "admin", "Couldn't sign in as \"admin\": wrong username or password", "failed", 422, "10.0.0.24"], ["11/23 15:58:13", "dev-admin", "Changed the order of the menu groups", "success", 200, "127.0.0.1"], ["11/23 15:20:05", "super-admin", "Couldn't edit menu group Popular: The name field is required.", "failed", 422, "127.0.0.1"], ["11/23 14:02:44", "super-admin", "Exported 120 rows of the audit log as CSV", "success", 200, "127.0.0.1"]];
const auditTable = (sel = [], y0 = 222, expandAt = -1) => {
  const cols = [{ title: "", w: 28 }, { title: "", w: 30 }, { title: "Time", w: 112 }, { title: "User", w: 92 }, { title: "Activity", w: 226 }, { title: "Status", w: 76 }, { title: "HTTP", w: 56 }, { title: "IP", w: CW - 620 }];
  const rows = auditRows.map(([t, u, a, st, h, ip], i) => [(x, y) => text(x - 4, y + 27, i === expandAt ? "−" : "+", { fill: C.muted, size: 15 }), (x, y) => checkbox(x, y + 16, sel.includes(i)), (x, y) => text(x, y + 27, t, { size: 12 }), u,
    (x, y) => text(x, y + 27, a.length > 34 ? a.slice(0, 33) + "…" : a, { size: 12 }), (x, y) => tag(x, y + 13, st === "success" ? "Success" : "Failed", st === "success" ? "green" : "red"),
    (x, y) => tag(x, y + 13, String(h), h >= 400 ? "orange" : "green"), (x, y) => text(x, y + 27, ip, { size: 11, mono: true })]);
  return table(CX, y0, cols, rows);
};
svg("audit-log", shell("Audit log", (() => {
  let s = pageHead("Audit log", "Every sign-in, change, export and denied request. Rows can't be edited or deleted.", [{ label: "Check integrity" }, { label: "Export all matching" }]);
  s += input(CX, 140, 210, "", "", { placeholder: "Search user, target or IP" }) + select(CX + 220, 140, 100, "", "Status") + select(CX + 330, 140, 150, "", "Activity") + select(CX + 490, 140, 200, "", "Start date → End date");
  s += auditTable();
  return s + marker(CX + 400, 236, 1) + marker(CX - 4, 146, 2) + marker(CX - 8, 296, 3);
})()));

svg("audit-details", shell("Audit log", (() => {
  let s = pageHead("Audit log", "", [{ label: "Check integrity" }, { label: "Export all matching" }]);
  s += rect(CX, 136, CW, 34, { fill: C.blueBg, stroke: "none" }) + text(CX + 14, 158, "2 selected", { weight: 600 }) + btn(CX + 104, 138, "↓ Export JSON", { h: 28 }) + btn(CX + 222, 138, "↓ Export CSV", { h: 28 }) + text(W - 60, 158, "Clear", { fill: C.muted });
  s += marker(CX + 330, 153, 1) + marker(W - 30, 80, 2);
  s += auditTable([1, 2], 182, 2);
  const dy = 182 + 40 + 3 * 46;
  s += rect(CX + 30, dy + 4, CW - 44, 138, { fill: "#fafbfc" });
  const kv = [["Action code", "auth.login"], ["Target", "—"], ["Request", "POST /api/auth/login"], ["HTTP status", "422 Invalid input"], ["IP address", "10.0.0.24"], ["Browser", "Mozilla/5.0 (Windows NT 10.0…"]];
  kv.forEach(([k, v], i) => {
    const cx = CX + 44 + (i % 2) * ((CW - 60) / 2), cy = dy + 30 + Math.floor(i / 2) * 26;
    s += text(cx, cy, k, { size: 12, fill: C.muted }) + text(cx + 100, cy, v, { size: 12, mono: k !== "Browser" });
  });
  s += text(CX + 44, dy + 116, "Details", { size: 12, fill: C.muted }) + text(CX + 144, dy + 116, '{ "username": "admin", "reason": "wrong credentials" }', { size: 12, mono: true });
  return s;
})()));

const settingsTabs = (active) => tabs(["General", "Security", "Extra"], active);
svg("settings-general", shell("Settings", (() => {
  let s = pageHead("Settings", "Changes apply straight away and are recorded in the audit log.") + settingsTabs(0);
  s += card(CX, 190, 560, 350, "Site and tester defaults");
  s += input(CX + 16, 258, 528, "Site name", "Fitcheck", { hint: "Shown in the tester's header and browser tab." }) + marker(CX + 6, 274, 1);
  s += text(CX + 16, 340, "Tester opens in", { size: 12, fill: C.muted }) + segmented(CX + 16, 348, ["Scroll", "Grid"], 0) + marker(CX + 6, 362, 2);
  s += text(CX + 16, 410, "Device size", { size: 12, fill: C.muted }) + segmented(CX + 16, 418, ["True scale", "Fill height"], 0) + marker(CX + 6, 432, 3);
  s += btn(CX + 16, 480, "Save", { primary: true }) + marker(CX + 6, 494, 4);
  return s;
})()));

svg("settings-security", shell("Settings", (() => {
  let s = pageHead("Settings", "Changes apply straight away and are recorded in the audit log.") + settingsTabs(1);
  s += card(CX, 190, 600, 110, "Two-factor sign-in") + toggle(CX + 16, 250, true, { small: false }) + text(CX + 70, 262, "Require two-factor sign-in for everyone", { weight: 600 }) + text(CX + 70, 282, "Every account must enter a 6-digit code from an authenticator app after its password.", { size: 12, fill: C.muted });
  s += marker(CX + 6, 252, 1);
  s += card(CX, 314, 600, 266, "Sign-in and sessions");
  s += input(CX + 16, 380, 276, "Sign out after inactivity (minutes)", "30", { hint: "5 to 720" }) + input(CX + 308, 380, 276, "Minimum password length", "8", { hint: "8 to 64" });
  s += input(CX + 16, 466, 276, "Failed sign-ins before lockout", "5") + input(CX + 308, 466, 276, "Lockout length (minutes)", "15");
  s += btn(CX + 16, 530, "Save", { primary: true });
  return s + marker(CX + 6, 396, 2) + marker(CX + 298, 396, 3) + marker(CX + 6, 482, 4) + marker(CX + 6, 544, 5);
})()));

svg("settings-extra", shell("Settings", (() => {
  let s = pageHead("Settings", "Changes apply straight away and are recorded in the audit log.") + settingsTabs(2);
  s += card(CX, 190, 600, 370, "Tester extras");
  s += text(CX + 16, 254, "Announcement banner", { size: 12, fill: C.muted }) + toggle(CX + 16, 264, true, { small: false }) + text(CX + 16, 308, "A short message across the top of the tester, e.g. planned maintenance.", { size: 11, fill: C.faint });
  s += text(CX + 16, 336, "Banner text", { size: 12, fill: C.muted }) + rect(CX + 16, 342, 568, 58, { stroke: "#d0d7e0", r: 6 }) + text(CX + 26, 364, "The tester will be unavailable on Saturday 10:00–11:00.", {}) + text(CX + 574, 392, "57 / 300", { size: 11, fill: C.faint, anchor: "end" });
  s += marker(CX + 6, 270, 1);
  s += input(CX + 16, 424, 568, "Help contact email", "support@example.com", { hint: "Shown in the tester's “Blank screen?” help. Leave empty to hide." }) + marker(CX + 6, 440, 2);
  s += btn(CX + 16, 504, "Save", { primary: true }) + marker(CX + 6, 518, 3);
  return s;
})()));

svg("profile", shell(null, (() => {
  let s = pageHead("My profile", "Signed in as super-admin · Admin · last sign-in 23 Nov 2026, 16:42");
  s += card(CX, 140, 600, 140, "Your details") + input(CX + 16, 206, 276, "Display name", "Super Admin") + input(CX + 308, 206, 276, "Email", "super@example.com") + btn(CX + 16, 246, "Save details", { primary: true, h: 26 });
  s += card(CX, 292, 600, 196, "Change password") + input(CX + 16, 358, 568, "Current password", "••••••••") + input(CX + 16, 412, 276, "New password", "") + input(CX + 308, 412, 276, "Repeat new password", "") + btn(CX + 16, 456, "Change password", { primary: true, h: 26 });
  s += card(CX, 498, 600, 92) + text(CX + 16, 524, "Two-factor sign-in", { size: 14, weight: 600 }) + tag(CX + 160, 510, "Off") + text(CX + 16, 546, "Protect your account with a 6-digit code from an authenticator app.", { size: 12, fill: C.muted }) + btn(CX + 470, 532, "Set up", { primary: true, h: 28 });
  return s + marker(W - 140, 54, 1) + marker(CX + 6, 222, 2) + marker(CX + 6, 374, 3);
})()));

console.log("done");
