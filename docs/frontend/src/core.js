/* Fitcheck core: device catalog, URL parameters, device frames, share and help.
   Shared by all five frontend designs. Each design styles frames through
   CSS variables: --fc-frame, --fc-edge, --fc-bar-bg, --fc-bar-ink, --fc-load-bg,
   --fc-load-ink, --fc-shadow, --fc-toast-bg, --fc-toast-ink, --fc-dialog-bg, --fc-dialog-ink. */
const FC = (() => {
  // [id, name, width, height, type, shape, brand]  (CSS viewport sizes in px)
  const RAW = [
    ["ip17pm","iPhone 17 Pro Max",440,956,"Mobile","island","Apple"],
    ["ip17p","iPhone 17 Pro",402,874,"Mobile","island","Apple"],
    ["ipair","iPhone Air",420,912,"Mobile","island","Apple"],
    ["ip17","iPhone 17",402,874,"Mobile","island","Apple"],
    ["ip16e","iPhone 16e",390,844,"Mobile","notch","Apple"],
    ["ip15","iPhone 15",393,852,"Mobile","island","Apple"],
    ["ipse","iPhone SE",375,667,"Mobile","home","Apple"],
    ["s25u","Galaxy S25 Ultra",412,891,"Mobile","hole","Samsung"],
    ["s25p","Galaxy S25+",384,832,"Mobile","hole","Samsung"],
    ["s25","Galaxy S25",360,780,"Mobile","hole","Samsung"],
    ["a56","Galaxy A56",384,854,"Mobile","hole","Samsung"],
    ["flip7","Galaxy Z Flip7",412,1004,"Mobile","hole","Samsung"],
    ["px10px","Pixel 10 Pro XL",412,921,"Mobile","hole","Google"],
    ["px10","Pixel 10",412,915,"Mobile","hole","Google"],
    ["px9a","Pixel 9a",412,892,"Mobile","hole","Google"],
    ["mi15","Xiaomi 15",393,851,"Mobile","hole","Xiaomi"],
    ["rn14","Redmi Note 14 Pro",393,873,"Mobile","hole","Xiaomi"],
    ["op13","OnePlus 13",412,915,"Mobile","hole","OnePlus"],
    ["findx8","Oppo Find X8 Pro",412,915,"Mobile","hole","Oppo / Vivo"],
    ["vx200","Vivo X200 Pro",412,915,"Mobile","hole","Oppo / Vivo"],
    ["mag8p","Honor Magic8 Pro",412,916,"Mobile","hole","Honor"],
    ["mag7l","Honor Magic7 Lite",400,888,"Mobile","hole","Honor"],
    ["p70","Huawei Pura 70 Pro",412,915,"Mobile","hole","Huawei"],
    ["ipmini","iPad mini",744,1133,"Tablet","tablet","Apple"],
    ["ipad","iPad 11\"",820,1180,"Tablet","tablet","Apple"],
    ["ipair13","iPad Air 13\"",1024,1366,"Tablet","tablet","Apple"],
    ["tabs10","Galaxy Tab S10",800,1280,"Tablet","tablet","Samsung"],
    ["fold7","Galaxy Z Fold7 (open)",884,1104,"Tablet","tablet","Samsung"],
    ["magv5","Honor Magic V5 (open)",800,868,"Tablet","tablet","Honor"],
    ["lap1024","Small laptop",1024,600,"Desktop","browser","Laptop"],
    ["lap1280","Laptop",1280,800,"Desktop","browser","Laptop"],
    ["lap1366","Laptop HD",1366,768,"Desktop","browser","Laptop"],
    ["lap1440","Laptop 1440",1440,900,"Desktop","browser","Laptop"],
    ["fhd","Desktop Full HD",1920,1080,"Desktop","browser","Desktop"],
    ["qhd","Desktop QHD",2560,1440,"Desktop","browser","Desktop"],
    ["tv720","TV 720p",1280,720,"TV","tv","TV"],
    ["tv1080","TV 1080p",1920,1080,"TV","tv","TV"],
    ["tv4k","TV 4K",3840,2160,"TV","tv","TV"]
  ];
  const DEVICES = RAW.map(([id,name,w,h,type,shape,brand]) => ({id,name,w,h,type,shape,brand}));
  const TYPES = ["Mobile","Tablet","Desktop","TV"];
  const byId = id => DEVICES.find(d => d.id === id);
  const ofType = t => DEVICES.filter(d => d.type === t);
  const brands = list => [...new Set(list.map(d => d.brand))];
  const PRESETS = [
    {id:"quick",   name:"Quick check",        ids:["ip17p","s25","ipad","lap1366"]},
    {id:"iphones", name:"Top iPhones",        ids:["ip17pm","ip17p","ip16e","ipse"]},
    {id:"android", name:"Android mix",        ids:["s25u","s25","px10","a56","rn14"]},
    {id:"tablets", name:"Tablets",            ids:["ipmini","ipad","tabs10","fold7"]},
    {id:"desktop", name:"Laptops & desktops", ids:["lap1024","lap1366","lap1440","fhd"]}
  ];
  const BREAKPOINTS = [{n:"sm",w:640},{n:"md",w:768},{n:"lg",w:1024},{n:"xl",w:1280},{n:"2xl",w:1536}];

  function normalize(u){
    u = (u || "").trim(); if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; }
  }
  function host(u){ try { return new URL(u).host; } catch { return u || ""; } }
  const dims = (d, rot) => rot ? {w:d.h, h:d.w} : {w:d.w, h:d.h};
  const matchType = t => { t = (t||"").toLowerCase(); return [...TYPES,"Custom"].find(x => x.toLowerCase() === t) || ""; };

  /* Query string. Compatible with ?url=&width=&height=&type=&scrolling=yes|no */
  function readParams(){
    const q = new URLSearchParams(location.search);
    const list = (q.get("devices") || "").split(",").filter(byId);
    return {
      url: normalize(q.get("url") || ""),
      width: Math.max(0, parseInt(q.get("width"), 10) || 0),
      height: Math.max(0, parseInt(q.get("height"), 10) || 0),
      type: matchType(q.get("type")),
      scrolling: q.get("scrolling") !== "no",
      device: byId(q.get("device")) ? q.get("device") : "",
      devices: list,
      rotate: q.get("rotate") === "yes",
      preset: q.get("preset") || "",
      get: k => q.get(k) || ""
    };
  }
  function writeParams(p){
    const q = new URLSearchParams();
    Object.keys(p).forEach(k => {
      let v = p[k];
      if (v === true) v = "yes"; else if (v === false) v = "no";
      if (Array.isArray(v)) v = v.join(",");
      if (v !== "" && v != null) q.set(k, v);
    });
    const s = q.toString();
    try { history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash); } catch {}
    return location.href;
  }
  /* Find a catalog device by size within a type (either orientation). */
  function matchSize(w, h, type){
    const pool = type && type !== "Custom" ? ofType(type) : DEVICES;
    for (const d of pool){
      if (d.w === w && d.h === h) return {d, rot:false};
      if (d.w === h && d.h === w) return {d, rot:true};
    }
    return null;
  }

  /* Scale that fits a device (with its frame) inside a box. */
  function fit(availW, availH, w, h, shape, max){
    const bz = shape === "tablet" ? 32 : shape === "tv" ? 24 : (shape === "browser" || shape === "none") ? 0 : 24;
    const extraH = shape === "browser" ? 30 : shape === "home" ? 46 : shape === "tv" ? 30 : 0;
    const s = Math.min((availW - bz) / w, (availH - bz - extraH) / h, max == null ? 1 : max);
    return Math.max(0.05, Math.round(s * 1000) / 1000);
  }

  /* Device frame + iframe. Changing size or scale never reloads the page. */
  function viewport(o){
    const cur = Object.assign({w:400, h:800, s:1, shape:"none", rot:false, url:"", scrolling:true, label:"", emptyText:"Paste a link to preview"}, o);
    const el = document.createElement("div");
    const screen = document.createElement("div"); screen.className = "fc-screen";
    const cut = document.createElement("div"); cut.className = "fc-cut";
    const load = document.createElement("div"); load.className = "fc-load";
    const bar = document.createElement("div"); bar.className = "fc-bar";
    bar.innerHTML = "<i></i><i></i><i></i><span></span>";
    const btn = document.createElement("div"); btn.className = "fc-homebtn";
    const stand = document.createElement("div"); stand.className = "fc-stand";
    screen.append(load, cut);
    el.append(bar, screen, btn, stand);
    let iframe = null, timer = 0;
    function frame(){
      if (iframe) iframe.remove();
      clearTimeout(timer);
      el.classList.remove("fc-loaded");
      if (!cur.url){ load.textContent = cur.emptyText; iframe = null; return; }
      load.textContent = "Loading " + host(cur.url) + "…";
      iframe = document.createElement("iframe");
      iframe.title = (cur.label || "Preview") + ": " + cur.url;
      iframe.setAttribute("scrolling", cur.scrolling ? "yes" : "no");
      if (!cur.scrolling) iframe.style.overflow = "hidden";
      iframe.addEventListener("load", () => el.classList.add("fc-loaded"));
      timer = setTimeout(() => el.classList.add("fc-loaded"), 12000);
      iframe.src = cur.url;
      screen.prepend(iframe);
    }
    function apply(){
      el.className = "fc-vp fc-" + cur.shape + (cur.rot ? " fc-rot" : "") + (el.classList.contains("fc-loaded") ? " fc-loaded" : "");
      el.style.setProperty("--w", cur.w);
      el.style.setProperty("--h", cur.h);
      el.style.setProperty("--s", cur.s);
      bar.querySelector("span").textContent = cur.url ? host(cur.url) : "fitcheck";
    }
    apply(); frame();
    return {
      el,
      set(p){ Object.assign(cur, p); apply(); return this; },
      setUrl(u){ if (u === cur.url) return this; cur.url = u; frame(); apply(); return this; },
      setScrolling(b){ if (b === cur.scrolling) return this; cur.scrolling = b; frame(); return this; },
      reload(){ frame(); return this; },
      get state(){ return Object.assign({}, cur); }
    };
  }

  async function copy(text){
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch {}
      t.remove(); return ok;
    }
  }
  let toastEl = null, toastT = 0;
  function toast(msg){
    if (!toastEl){ toastEl = document.createElement("div"); toastEl.className = "fc-toast"; toastEl.setAttribute("role","status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("on"), 2200);
  }
  async function share(){ const ok = await copy(location.href); toast(ok ? "Link copied. Anyone with it sees this exact view." : "Copy failed. Copy the address bar instead."); }

  const RECENT_KEY = "fitcheck-recent";
  function recent(){ try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 8); } catch { return []; } }
  function addRecent(u){ if (!u) return; try { const r = [u, ...recent().filter(x => x !== u)].slice(0, 8); localStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch {} }

  let dlg = null;
  function help(){
    if (!dlg){
      dlg = document.createElement("dialog"); dlg.className = "fc-dialog";
      dlg.innerHTML = `<h2>Site not loading?</h2>
        <p>Fitcheck shows the site inside a frame, the same way every online responsive tester does. A blank or grey screen usually means one of these:</p>
        <ul>
          <li><b>The site blocks framing.</b> It sends <code>X-Frame-Options: DENY</code> or a <code>Content-Security-Policy</code> with <code>frame-ancestors</code>. Banks, Google and many login pages do this. To test your own site, allow this tester's domain in <code>frame-ancestors</code> on a staging server.</li>
          <li><b>The link is http:// on an https:// page.</b> Browsers block mixed content. Use the https:// address.</li>
          <li><b>The site needs a login or cookie consent.</b> Third-party cookies are often blocked inside frames. Unlock and sign in inside the frame, or test a public page.</li>
          <li><b>Local addresses.</b> <code>localhost</code> links only work on the computer running that site.</li>
        </ul>
        <p>Sizes are CSS pixels, the width a browser reports to the page. They match what the phone's browser uses for media queries.</p>
        <form method="dialog"><button class="fc-dialog-close">Got it</button></form>`;
      document.body.appendChild(dlg);
      dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
    }
    dlg.showModal();
  }

  /* Small switcher between the five designs; keeps the current query string. */
  function designNav(n){
    const names = ["Split Compare","Showcase","QA Checklist","Coral Filmstrip","Breakpoint Strip"];
    const file = i => `design-${i}.html`;
    let hidden = false; try { hidden = sessionStorage.getItem("fc-nav-hidden") === "1"; } catch {}
    if (hidden) return;
    const nav = document.createElement("nav"); nav.className = "fc-nav"; nav.setAttribute("aria-label","Design options");
    const q = () => location.search;
    nav.innerHTML = `<a class="fc-nav-all" href="index.html">All designs</a>` +
      names.map((nm, i) => `<a href="${file(i+1)}" data-i="${i+1}" title="${nm}"${i+1===n?' aria-current="page"':''}>${i+1}</a>`).join("") +
      `<button type="button" aria-label="Hide design switcher">×</button>`;
    nav.addEventListener("click", e => {
      const a = e.target.closest("a[data-i]");
      if (a){ e.preventDefault(); location.href = a.getAttribute("href") + (FC.carry ? FC.carry() : q()); }
      if (e.target.closest("button")){ nav.remove(); try { sessionStorage.setItem("fc-nav-hidden","1"); } catch {} }
    });
    document.body.appendChild(nav);
  }

  const css = `
[hidden]{display:none!important}
.fc-vp{--s:1;--w:400;--h:800;--bz:12;--rad:44;--k:clamp(.45,var(--s),1);position:relative;flex:none;display:inline-flex;flex-direction:column;align-items:center;
  background:var(--fc-frame,#1D2129);border:1px solid var(--fc-edge,#3A404A);padding:calc(var(--bz)*var(--k)*1px);
  border-radius:calc((var(--rad)*var(--s) + var(--bz)*var(--k))*1px);box-shadow:var(--fc-shadow,0 24px 50px -28px rgba(10,20,40,.55))}
.fc-vp.fc-home{--rad:4;padding-block:calc(46px*var(--k)) calc(10px*var(--k))}
.fc-vp.fc-home.fc-rot{padding-block:calc(12px*var(--k));padding-inline:calc(46px*var(--k)) calc(46px*var(--k))}
.fc-vp.fc-tablet{--bz:16;--rad:16}
.fc-vp.fc-tv{--bz:12;--rad:2;border-radius:6px;margin-bottom:calc(30px*var(--k))}
.fc-vp.fc-browser{--bz:0;--rad:0;padding:0;border-radius:10px;overflow:hidden;background:var(--fc-bar-bg,#E9EDF2)}
.fc-vp.fc-none{--bz:0;--rad:0;padding:0;border-radius:0;background:transparent;border:1px solid var(--fc-edge,#3A404A);box-shadow:none}
.fc-screen{position:relative;overflow:hidden;background:#fff;width:calc(var(--w)*var(--s)*1px);height:calc(var(--h)*var(--s)*1px);border-radius:calc(var(--rad)*var(--s)*1px)}
.fc-screen iframe{position:absolute;left:0;top:0;border:0;display:block;background:#fff;width:calc(var(--w)*1px);height:calc(var(--h)*1px);transform:scale(var(--s));transform-origin:0 0}
.fc-load{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:12px;background:var(--fc-load-bg,#F4F6F9);color:var(--fc-load-ink,#5C6978);font:600 13px/1.4 system-ui,sans-serif;z-index:1;transition:opacity .35s}
.fc-loaded .fc-load{opacity:0;pointer-events:none}
.fc-cut{display:none;position:absolute;z-index:2;pointer-events:none;background:#000;left:50%;transform:translateX(-50%)}
.fc-island .fc-cut{display:block;top:calc(11px*var(--s));width:calc(125px*var(--s));height:calc(36px*var(--s));border-radius:999px}
.fc-notch .fc-cut{display:block;top:0;width:calc(160px*var(--s));height:calc(32px*var(--s));border-radius:0 0 calc(18px*var(--s)) calc(18px*var(--s))}
.fc-hole .fc-cut{display:block;top:calc(12px*var(--s));width:calc(12px*var(--s));height:calc(12px*var(--s));border-radius:50%}
.fc-rot.fc-island .fc-cut{top:50%;left:calc(11px*var(--s));transform:translateY(-50%);width:calc(36px*var(--s));height:calc(125px*var(--s))}
.fc-rot.fc-notch .fc-cut{top:50%;left:0;transform:translateY(-50%);width:calc(32px*var(--s));height:calc(160px*var(--s));border-radius:0 calc(18px*var(--s)) calc(18px*var(--s)) 0}
.fc-rot.fc-hole .fc-cut{top:50%;left:calc(12px*var(--s));transform:translateY(-50%)}
.fc-bar{display:none;align-items:center;gap:6px;width:100%;height:30px;padding:0 12px;background:var(--fc-bar-bg,#E9EDF2);color:var(--fc-bar-ink,#5C6978);font:12px/1 system-ui,sans-serif;box-sizing:border-box}
.fc-browser .fc-bar{display:flex}
.fc-bar i{width:9px;height:9px;border-radius:50%;background:currentColor;opacity:.35;flex:none}
.fc-bar span{margin-left:8px;flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;background:var(--fc-bar-field,rgba(255,255,255,.6));border-radius:6px;padding:4px 8px}
.fc-homebtn{display:none;position:absolute;bottom:calc(8px*var(--k));left:50%;transform:translateX(-50%);width:calc(30px*var(--k));height:calc(30px*var(--k));border-radius:50%;border:2px solid var(--fc-edge,#3A404A);box-sizing:border-box}
.fc-home .fc-homebtn{display:block}
.fc-home.fc-rot .fc-homebtn{bottom:auto;top:50%;left:auto;right:calc(8px*var(--k));transform:translateY(-50%)}
.fc-stand{display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);width:28%;height:calc(30px*var(--k));background:linear-gradient(var(--fc-edge,#3A404A),var(--fc-frame,#1D2129));clip-path:polygon(38% 0,62% 0,100% 100%,0 100%)}
.fc-tv .fc-stand{display:block}
.fc-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);opacity:0;pointer-events:none;z-index:100;
  background:var(--fc-toast-bg,#17202B);color:var(--fc-toast-ink,#fff);padding:10px 16px;border-radius:10px;font:600 14px/1.3 system-ui,sans-serif;transition:opacity .2s,transform .2s;max-width:calc(100vw - 32px)}
.fc-toast.on{opacity:1;transform:translate(-50%,0)}
.fc-dialog{max-width:560px;width:calc(100vw - 32px);border:0;border-radius:14px;padding:24px 26px;background:var(--fc-dialog-bg,#fff);color:var(--fc-dialog-ink,#17202B);font:15px/1.55 system-ui,sans-serif;box-shadow:0 30px 80px -20px rgba(0,0,0,.5)}
.fc-dialog::backdrop{background:rgba(10,14,20,.5)}
.fc-dialog h2{margin:0 0 8px;font-size:20px}
.fc-dialog ul{padding-left:18px;display:grid;gap:8px}
.fc-dialog code{font-size:.85em;background:rgba(127,127,127,.18);padding:1px 5px;border-radius:4px}
.fc-dialog-close{margin-top:6px;border:0;border-radius:8px;padding:9px 16px;font:700 14px system-ui,sans-serif;cursor:pointer;background:var(--fc-dialog-btn,#2F5BEA);color:var(--fc-dialog-btn-ink,#fff)}
.fc-nav{position:fixed;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:90;display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;
  background:rgba(23,32,43,.88);backdrop-filter:blur(6px);box-shadow:0 8px 24px -10px rgba(0,0,0,.5);font:600 12px/1 system-ui,sans-serif}
.fc-nav a,.fc-nav button{color:#D6DEE7;text-decoration:none;border:0;background:none;cursor:pointer;padding:6px 9px;border-radius:999px;font:inherit}
.fc-nav a[aria-current]{background:#fff;color:#17202B}
.fc-nav a:hover,.fc-nav button:hover{background:rgba(255,255,255,.14)}
.fc-nav .fc-nav-all{padding-inline:11px}
@media (prefers-reduced-motion:reduce){.fc-load,.fc-toast{transition:none}}
`;
  const st = document.createElement("style"); st.id = "fc-core"; st.textContent = css;
  document.head.prepend(st);

  return {DEVICES, TYPES, PRESETS, BREAKPOINTS, byId, ofType, brands, normalize, host, dims, matchType, matchSize,
          readParams, writeParams, fit, viewport, copy, toast, share, recent, addRecent, help, designNav, carry:null};
})();
