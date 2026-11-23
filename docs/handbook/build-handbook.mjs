/**
 * Builds the Admin user handbook PDF from the same guide content the app's ⓘ help uses.
 *   node docs/handbook/build-handbook.mjs
 * Reads  frontend/src/lib/help.ts and the pictures in frontend/public/help/
 * Writes docs/handbook/handbook.html, docs/handbook/Fitcheck-Admin-Handbook.pdf
 *        and a copy at frontend/public/help/Fitcheck-Admin-Handbook.pdf (linked from the admin panel).
 * Needs Google Chrome or Microsoft Edge (prints the HTML to PDF in headless mode).
 */
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const HELP_DIR = join(ROOT, "frontend", "public", "help");
const { HELP } = await import(pathToFileURL(join(ROOT, "frontend", "src", "lib", "help.ts")).href);

// The Admin edition leaves out Developer-only blocks (they carry a `perm`), and topics left empty by that
const ORDER = ["getting-started", "dashboard", "screen-views", "menu-groups", "users", "audit-log", "settings-general", "settings-security", "settings-extra", "profile", "tester"];
const topics = ORDER.map((k) => HELP.find((t) => t.key === k))
  .filter(Boolean)
  .map((t) => ({ ...t, blocks: t.blocks.filter((b) => !b.perm) }))
  .filter((t) => t.blocks.length);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const img = (name) => pathToFileURL(join(HELP_DIR, name)).href;
const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const chapter = (t, i) => `
<section class="chapter" id="${t.key}">
  <div class="chapter-head"><span class="chapter-no">${i + 1}</span><div><h1>${esc(t.title)}</h1><p class="summary">${esc(t.summary)}</p></div></div>
  ${t.blocks.map((b) => `
  <div class="block">
    <h2>${esc(b.heading)}</h2>
    ${b.image ? `<figure><img src="${img(b.image)}" alt="${esc(b.caption ?? b.heading)}">${b.caption ? `<figcaption>${esc(b.caption)}${b.image.endsWith(".svg") ? " — numbers match the steps below" : ""}</figcaption>` : ""}</figure>` : ""}
    ${b.text ? `<p>${esc(b.text)}</p>` : ""}
    ${b.steps ? `<ol class="steps">${b.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
    ${(b.tips ?? []).map((tip) => `<p class="tip"><b>Tip</b>${esc(tip)}</p>`).join("")}
  </div>`).join("")}
</section>`;

const QUICK = [
  ["Sign in", "Admin address → username or email + password (+ 6-digit code)", "1"],
  ["Hide a device from visitors", "Screen views → turn off its On tester switch", "3"],
  ["Add a device", "Screen views → Add screen view → fill in → Save", "3"],
  ["Change the order of the tester's tabs", "Menu groups → drag a row by its grip", "4"],
  ["Choose which devices a tab shows", "Menu groups → pencil → add / drag / remove → Save", "4"],
  ["Add a person", "Users → Add user → copy the temporary password", "5"],
  ["Block someone's access at once", "Users → turn off their Status switch", "5"],
  ["Someone forgot their password", "Users → Edit → Reset password… → Generate", "5"],
  ["Someone lost their phone (2FA)", "Users → Edit → Remove two-factor", "5"],
  ["See who changed something", "Audit log → search or filter → expand the row", "6"],
  ["Export activity for a report", "Audit log → tick rows or Export all matching → CSV", "6"],
  ["Require two-factor for everyone", "Settings → Security → switch on", "8"],
  ["Show a maintenance message", "Settings → Extra → Announcement banner", "9"],
  ["Change your own password", "Your name (top right) → My profile", "10"],
];

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fitcheck Admin Handbook</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; @bottom-center { content: "Fitcheck Admin Handbook  ·  " counter(page); font: 9pt "Segoe UI", Arial, sans-serif; color: #8a96a5; } }
  @page :first { @bottom-center { content: none; } }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.55 "Segoe UI", Inter, Arial, sans-serif; color: #17202b; margin: 0; }
  h1, h2, h3 { line-height: 1.25; }
  .cover { height: 255mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
  .cover-top { display: flex; align-items: center; gap: 10px; font-size: 14pt; font-weight: 700; }
  .logo { width: 34px; height: 34px; border-radius: 8px; background: #2f5bea; color: #fff; display: grid; place-items: center; font-size: 16pt; }
  .cover h1 { font-size: 34pt; margin: 0 0 6mm; letter-spacing: -0.5px; }
  .cover .lead { font-size: 13pt; color: #3d4a59; max-width: 135mm; }
  .cover-art { border-radius: 10px; border: 1px solid #e3e8ee; width: 100%; box-shadow: 0 10px 30px rgba(23,32,43,.12); }
  .cover-foot { color: #5c6978; font-size: 10pt; border-top: 1px solid #e3e8ee; padding-top: 4mm; display: flex; justify-content: space-between; }
  .page { page-break-after: always; }
  .toc h1, .intro h1, .quick h1 { font-size: 20pt; margin: 0 0 6mm; }
  .toc ol { list-style: none; padding: 0; margin: 0; }
  .toc li { display: flex; gap: 10px; padding: 3.2mm 0; border-bottom: 1px solid #eef1f5; font-size: 11.5pt; }
  .toc .n { width: 24px; height: 24px; flex: none; border-radius: 50%; background: #e6ecfd; color: #2f5bea; font-weight: 700; display: grid; place-items: center; font-size: 10pt; }
  .toc a { color: inherit; text-decoration: none; } .toc small { display: block; color: #5c6978; font-size: 9.5pt; }
  .intro h2 { font-size: 13pt; margin: 7mm 0 2mm; }
  .legend { display: flex; gap: 10px; align-items: center; background: #f7f9fb; border: 1px solid #e3e8ee; border-radius: 8px; padding: 3mm 4mm; }
  .dot { width: 22px; height: 22px; border-radius: 50%; background: #fa541c; color: #fff; font-weight: 700; display: grid; place-items: center; flex: none; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th, td { text-align: left; padding: 2.4mm 3mm; border-bottom: 1px solid #e3e8ee; vertical-align: top; }
  th { background: #f7f9fb; color: #5c6978; font-weight: 600; }
  .quick td:last-child, .quick th:last-child { text-align: center; width: 18mm; }
  .chapter { page-break-before: always; }
  .chapter-head { display: flex; gap: 5mm; align-items: flex-start; border-bottom: 2px solid #2f5bea; padding-bottom: 4mm; margin-bottom: 5mm; }
  .chapter-no { width: 13mm; height: 13mm; border-radius: 10px; background: #2f5bea; color: #fff; font-size: 18pt; font-weight: 700; display: grid; place-items: center; flex: none; }
  .chapter h1 { font-size: 20pt; margin: 0 0 1.5mm; } .summary { margin: 0; color: #5c6978; font-size: 11pt; }
  .block { margin-bottom: 7mm; } .block h2 { font-size: 13pt; margin: 0 0 3mm; color: #17202b; }
  figure { margin: 0 0 4mm; break-inside: avoid; }
  figure img { width: 100%; display: block; border: 1px solid #e3e8ee; border-radius: 8px; }
  figcaption { font-size: 9pt; color: #5c6978; margin-top: 1.5mm; }
  ol.steps { margin: 2mm 0; padding: 0; list-style: none; counter-reset: s; }
  ol.steps li { counter-increment: s; position: relative; padding: 0 0 2.2mm 9mm; break-inside: avoid; }
  ol.steps li::before { content: counter(s); position: absolute; left: 0; top: 0.3mm; width: 6mm; height: 6mm; border-radius: 50%; background: #fa541c; color: #fff; font-weight: 700; font-size: 8.5pt; display: grid; place-items: center; }
  .tip { background: #fff8e6; border-left: 3px solid #faad14; border-radius: 0 6px 6px 0; padding: 2.4mm 3.5mm; margin: 2.5mm 0; font-size: 10pt; break-inside: avoid; }
  .tip b { color: #ad6800; margin-right: 6px; }
  .roles td:first-child { width: 60mm; }
</style></head><body>

<div class="cover">
  <div class="cover-top"><span class="logo">F</span> Fitcheck</div>
  <div>
    <h1>Admin Handbook</h1>
    <p class="lead">How to manage the Fitcheck responsive tester: devices, menu groups, people, security settings and the audit log, step by step.</p>
  </div>
  <img class="cover-art" src="${img("dashboard.svg")}" alt="">
  <div class="cover-foot"><span>For accounts with the <b>Admin</b> role</span><span>${today}</span></div>
</div>

<div class="page toc">
  <h1>Contents</h1>
  <ol>
    <li><span class="n">i</span><a href="#about">About this handbook<small>Roles, the ⓘ help button, how to read the pictures</small></a></li>
    ${topics.map((t, i) => `<li><span class="n">${i + 1}</span><a href="#${t.key}">${esc(t.title)}<small>${esc(t.summary)}</small></a></li>`).join("")}
    <li><span class="n">✓</span><a href="#quick">Quick reference<small>Common tasks at a glance</small></a></li>
  </ol>
</div>

<div class="page intro" id="about">
  <h1>About this handbook</h1>
  <p>Fitcheck has two parts. The <b>tester</b> is the public website where anyone pastes a link and sees it on many phones, tablets and screens. The <b>admin panel</b> is where you decide which devices the tester shows, who can sign in, and how the system is protected. This handbook covers everything an Admin can do in the admin panel.</p>
  <h2>Roles</h2>
  <table class="roles">
    <tr><th>Role</th><th style="text-align:left;width:auto">What it can do</th></tr>
    <tr><td><b>Admin</b> (this handbook)</td><td>Dashboard, screen views, menu groups, users, audit log and settings (General, Security, Extra).</td></tr>
    <tr><td><b>Developer</b></td><td>Everything an Admin can, plus the system log and log settings, changing usernames, typing a password for someone else, and managing Developer accounts.</td></tr>
  </table>
  <h2>Help inside the system</h2>
  <p>Every page in the admin panel has an <b>ⓘ</b> button next to its title. It opens the instructions for that page, the same ones as in this handbook. The <b>User guide</b> link at the top of every page opens this PDF.</p>
  <h2>Reading the pictures</h2>
  <div class="legend"><span class="dot">1</span><span>Orange numbers in a picture point to the part of the screen used in the matching numbered step below it.</span></div>
  <p>Pictures of the admin panel are simplified drawings, so names and numbers in them are examples. The sign-in page and the tester are real screenshots.</p>
  <h2>Good habits</h2>
  <ol class="steps">
    <li>Turn on two-factor sign-in for your own account (My profile), and keep your recovery codes somewhere safe.</li>
    <li>Give temporary passwords to people privately, never by group chat or shared email.</li>
    <li>Hide devices and menu groups instead of deleting them, so you can bring them back.</li>
    <li>Check the dashboard's failed sign-ins now and then, and the audit log when something looks wrong.</li>
  </ol>
</div>

${topics.map(chapter).join("")}

<section class="chapter quick" id="quick">
  <div class="chapter-head"><span class="chapter-no">✓</span><div><h1>Quick reference</h1><p class="summary">Common tasks and where to do them.</p></div></div>
  <table>
    <tr><th>I want to…</th><th>Where</th><th>Chapter</th></tr>
    ${QUICK.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td>${c}</td></tr>`).join("")}
  </table>
</section>
</body></html>`;

const htmlPath = join(HERE, "handbook.html");
const pdfPath = join(HERE, "Fitcheck-Admin-Handbook.pdf");
writeFileSync(htmlPath, html);

const browsers = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
].filter((p) => p && existsSync(p));
if (!browsers.length) throw new Error("Chrome or Edge not found. Set CHROME_PATH.");
execFileSync(browsers[0], ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files", `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { stdio: "ignore", timeout: 120000 });
copyFileSync(pdfPath, join(HELP_DIR, "Fitcheck-Admin-Handbook.pdf"));
console.log(`Handbook: ${topics.length} chapters → ${pdfPath}`);
