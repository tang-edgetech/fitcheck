/*!
 * Fitcheck mirroring. Add to the site you test:
 *   <script src="https://fitcheck.smartsitecp.com/sync.js" defer></script>
 * When the page is shown inside Fitcheck, what you do in one device happens in all the others:
 * scrolling, taps and clicks (popups, menus, links), swipes on sliders, typing in fields, and page changes.
 * It does nothing when the page is opened normally (not inside a frame).
 * The same code runs in Fitcheck's device view (backend/app/Http/Controllers/Api/DeviceViewController.php): change both.
 */
(function () {
  "use strict";
  function here() { return location.href; }
  function goTo(u) { location.href = u; }
  var emulateTouch = false; // a real touchscreen already sends touches
  if (window.parent === window || window.__fitcheckSync) return;
  window.__fitcheckSync = true;
  // Messages go to whichever Fitcheck shows the page; they carry scroll positions, the element acted on,
  // and field values (never password fields)
  function post(m) { m.url = here(); try { window.parent.postMessage(m, "*"); } catch (e) {} }

  /* ---- Page scroll ---- */
  var quietUntil = 0, queued = false;
  function root() { return document.scrollingElement || document.documentElement; }
  function maxY() { return Math.max(0, root().scrollHeight - window.innerHeight); }
  function send(type) { post({ fitcheck: type, y: window.scrollY, ratio: maxY() ? window.scrollY / maxY() : 0 }); }
  window.addEventListener("scroll", function () {
    if (queued || Date.now() < quietUntil) return; // ignore scrolling we were told to do
    queued = true;
    requestAnimationFrame(function () { queued = false; send("scroll"); });
  }, { passive: true });

  /* ---- Finding "the same element" in another device ---- */
  var touchDevice = "ontouchstart" in window && typeof TouchEvent === "function";
  var userAt = 0, replaying = false;
  function pathOf(el) {
    var p = [];
    for (; el && el.nodeType === 1 && el !== document.documentElement; el = el.parentElement) {
      // Ids made up when the page loads (e.g. swiper-wrapper-1a2b3c4d) differ between devices: skip those
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id) && !/\d{3,}|[0-9a-f]{6,}/i.test(el.id) && document.querySelectorAll("#" + el.id).length === 1) { p.unshift("#" + el.id); break; }
      var i = 1, s = el;
      while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
      p.unshift(el.tagName.toLowerCase() + ":nth-of-type(" + i + ")");
    }
    return p.join(">");
  }
  function isField(el) { return el.matches && el.matches("input,textarea,select"); }
  function label(el) { return isField(el) ? "" : (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80); }
  function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function describe(el) {
    var cls = typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
    return { path: pathOf(el), tag: el.tagName.toLowerCase(), cls: cls.trim(), text: label(el), name: el.getAttribute("name") || "" };
  }
  function findTarget(m) {
    if (typeof m.path !== "string" || typeof m.tag !== "string") return null;
    var text = String(m.text || ""), cls = String(m.cls || ""), name = String(m.name || "");
    function same(el) { return el.tagName.toLowerCase() === m.tag && (el.getAttribute("name") || "") === name && label(el) === text && visible(el); }
    var el = null;
    try { el = document.querySelector(m.path); } catch (e) {}
    if (el && same(el)) return el;
    // Different layout (mobile vs desktop): a visible element of the same kind, classes, name and text
    var list = [];
    try { list = document.querySelectorAll(m.tag + cls.split(/\s+/).filter(Boolean).map(function (c) { return "." + CSS.escape(c); }).join("") + (name ? '[name="' + CSS.escape(name) + '"]' : "")); } catch (e) {}
    for (var i = 0; i < list.length; i++) if (same(list[i])) return list[i];
    return el && visible(el) ? el : null;
  }
  function act(kind, el, extra) {
    if (replaying || !el || el.nodeType !== 1) return;
    var m = describe(el);
    m.fitcheck = "act"; m.kind = kind;
    for (var k in extra || {}) m[k] = extra[k];
    post(m);
  }

  /* ---- Watching what the visitor does (real input only, never our own replays) ---- */
  var press = null, lastDrag = 0;
  function mark(e) { if (e.isTrusted) userAt = Date.now(); }
  ["pointerdown", "wheel", "touchstart", "keydown"].forEach(function (t) { window.addEventListener(t, mark, { capture: true, passive: true }); });
  window.addEventListener("pointerdown", function (e) {
    if (!e.isTrusted || !e.isPrimary || !e.target || e.target.nodeType !== 1) return;
    var r = e.target.getBoundingClientRect();
    press = { el: e.target, x: e.clientX, y: e.clientY, t: Date.now(), moved: false,
      fx: r.width ? (e.clientX - r.left) / r.width : 0.5, fy: r.height ? (e.clientY - r.top) / r.height : 0.5 };
  }, true);
  window.addEventListener("pointermove", function (e) {
    if (!press || !e.isTrusted) return;
    press.lx = e.clientX; press.ly = e.clientY;
    if (Math.abs(e.clientX - press.x) > 10 || Math.abs(e.clientY - press.y) > 10) press.moved = true;
  }, true);
  function endPress(e) {
    var p = press;
    press = null;
    if (!p || !e.isTrusted || !p.moved) return;
    lastDrag = Date.now();
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    // Sideways drags are swipes (sliders); up/down is page scrolling, which is synced already
    if (Math.abs(dx) > Math.abs(dy)) act("swipe", p.el, { dx: dx / window.innerWidth, dy: dy / window.innerHeight, fx: p.fx, fy: p.fy, ms: Math.min(1200, Date.now() - p.t) });
  }
  window.addEventListener("pointerup", endPress, true);
  // The browser took over the press (dragging an image, panning): it still counts as a swipe
  window.addEventListener("pointercancel", function (e) { if (press) endPress({ isTrusted: e.isTrusted, clientX: press.lx, clientY: press.ly }); }, true);
  window.addEventListener("click", function (e) {
    if (!e.isTrusted || Date.now() - lastDrag < 400) return; // the click that ends a swipe isn't a tap
    act("click", e.target);
  }, true);
  function onField(e) {
    var el = e.target;
    if (!e.isTrusted || !el || el.nodeType !== 1) return;
    if (!isField(el) && !el.isContentEditable) return;
    if (/^(password|file|hidden)$/i.test(el.type || "")) return;
    act("input", el, { value: el.isContentEditable ? el.innerText : String(el.value), checked: !!el.checked });
  }
  window.addEventListener("input", onField, true);
  window.addEventListener("change", onField, true);
  window.addEventListener("keydown", function (e) {
    if (!e.isTrusted || (e.key !== "Enter" && e.key !== "Escape")) return;
    var el = e.target && e.target.nodeType === 1 ? e.target : document.body;
    act("key", el, { key: e.key });
  }, true);
  // Scrolling boxes inside the page (side menus, sideways lists), only while the visitor is using this device
  var quietBox = 0, boxQueued = null;
  document.addEventListener("scroll", function (e) {
    var el = e.target;
    if (!el || el.nodeType !== 1 || el === document.documentElement || el === document.body) return;
    if (Date.now() < quietBox || Date.now() - userAt > 1500 || boxQueued === el) return;
    boxQueued = el;
    requestAnimationFrame(function () {
      boxQueued = null;
      act("boxscroll", el, { rx: el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth), ry: el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight) });
    });
  }, true);

  /* ---- Doing the same here ---- */
  function fire(el, type, x, y) {
    var o = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, screenX: x, screenY: y,
      button: 0, buttons: /down|move|start/.test(type) ? 1 : 0 };
    try {
      if (type.indexOf("pointer") === 0) {
        o.pointerId = 1; o.isPrimary = true; o.pointerType = touchDevice ? "touch" : "mouse";
        return el.dispatchEvent(new PointerEvent(type, o));
      }
      if (type.indexOf("touch") === 0) {
        var t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x + window.scrollX, pageY: y + window.scrollY });
        o.touches = o.targetTouches = type === "touchend" ? [] : [t];
        o.changedTouches = [t];
        return el.dispatchEvent(new TouchEvent(type, o));
      }
      return el.dispatchEvent(new MouseEvent(type, o));
    } catch (e) { return true; }
  }
  // A tap, in the order a real phone (touch) or computer (mouse) sends it
  function tap(el) {
    var r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    fire(el, "pointerdown", x, y);
    if (touchDevice) {
      fire(el, "touchstart", x, y);
      fire(el, "pointerup", x, y);
      if (!fire(el, "touchend", x, y)) return; // the page took the touch itself (no click follows)
      fire(el, "mousedown", x, y);
    } else {
      fire(el, "mousedown", x, y);
      fire(el, "pointerup", x, y);
    }
    fire(el, "mouseup", x, y);
    if (typeof el.click === "function") el.click(); else fire(el, "click", x, y);
  }
  function swipe(el, m) {
    var r = el.getBoundingClientRect();
    var clamp = function (v) { return Math.min(1, Math.max(0, Number(v) || 0)); };
    var x0 = r.left + r.width * clamp(m.fx), y0 = r.top + r.height * clamp(m.fy);
    var dx = Number(m.dx) * window.innerWidth || 0, dy = Number(m.dy) * window.innerHeight || 0;
    // All at once: browsers slow down timers in frames that are off screen, which would stall a step-by-step swipe
    var steps = 10, x = x0, y = y0;
    fire(el, "pointerdown", x0, y0);
    fire(el, touchDevice ? "touchstart" : "mousedown", x0, y0);
    for (var i = 1; i <= steps; i++) {
      x = x0 + dx * i / steps; y = y0 + dy * i / steps;
      fire(el, "pointermove", x, y);
      fire(el, touchDevice ? "touchmove" : "mousemove", x, y);
    }
    fire(el, "pointerup", x, y);
    fire(el, touchDevice ? "touchend" : "mouseup", x, y);
  }
  function setField(el, m) {
    var value = String(m.value == null ? "" : m.value);
    if (el.isContentEditable) { if (el.innerText === value) return; el.innerText = value; }
    else if (el.type === "checkbox" || el.type === "radio") { if (el.checked === !!m.checked) return; el.checked = !!m.checked; }
    else {
      if (el.value === value) return;
      // The prototype's setter, so React/Vue-controlled fields notice the change
      var proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      var d = Object.getOwnPropertyDescriptor(proto, "value");
      if (d && d.set) d.set.call(el, value); else el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function key(el, m) {
    var code = m.key === "Enter" ? 13 : 27;
    var o = { key: m.key, code: m.key, keyCode: code, which: code, bubbles: true, cancelable: true };
    var ok = el.dispatchEvent(new KeyboardEvent("keydown", o));
    el.dispatchEvent(new KeyboardEvent("keyup", o));
    // Enter in a text field sends its form, as it would for real
    if (ok && m.key === "Enter" && el.form && el.matches("input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio])")) {
      try { el.form.requestSubmit(); } catch (e) {}
    }
  }
  function replay(m) {
    var el = m.kind === "key" && m.tag === "body" ? document.body : findTarget(m);
    if (!el) return;
    replaying = true;
    try {
      if (m.kind === "click") tap(el);
      else if (m.kind === "swipe") swipe(el, m);
      else if (m.kind === "input") setField(el, m);
      else if (m.kind === "key") key(el, m);
      else if (m.kind === "boxscroll") {
        quietBox = Date.now() + 200;
        el.scrollLeft = (Number(m.rx) || 0) * (el.scrollWidth - el.clientWidth);
        el.scrollTop = (Number(m.ry) || 0) * (el.scrollHeight - el.clientHeight);
      }
    } finally { replaying = false; }
  }

  /* ---- Device view of a phone/tablet: the computer's mouse also sends touches (like the browser's device mode),
     so sliders and menus that only listen for touch work with the mouse ---- */
  if (emulateTouch && touchDevice) {
    var held = null, hx = 0, hy = 0;
    var lift = function (e) { if (!held || !e.isTrusted) return; var t = held; held = null; fire(t, "touchend", hx, hy); };
    window.addEventListener("mousedown", function (e) { if (!e.isTrusted || e.button !== 0) return; held = e.target; hx = e.clientX; hy = e.clientY; fire(held, "touchstart", hx, hy); }, true);
    window.addEventListener("mousemove", function (e) { if (!held || !e.isTrusted) return; hx = e.clientX; hy = e.clientY; fire(held, "touchmove", hx, hy); }, true);
    ["mouseup", "pointerup", "pointercancel"].forEach(function (t) { window.addEventListener(t, lift, true); });
    // Phones don't drag images and links around: without this the browser would take over the swipe
    window.addEventListener("dragstart", function (e) { if (e.isTrusted) e.preventDefault(); }, true);
  }

  /* ---- Page changes made by the site's own scripts (single-page apps) ---- */
  var lastUrl = here();
  function urlChanged() { var u = here(); if (u !== lastUrl) { lastUrl = u; send("url"); } }
  ["pushState", "replaceState"].forEach(function (k) {
    var orig = history[k];
    history[k] = function () { var r = orig.apply(this, arguments); setTimeout(urlChanged, 0); return r; };
  });
  window.addEventListener("popstate", urlChanged);
  window.addEventListener("hashchange", urlChanged);

  window.addEventListener("message", function (e) {
    if (e.source !== window.parent) return;
    var d = e.data;
    if (!d || typeof d !== "object") return;
    if (d.fitcheck === "actAt") return replay(d);
    if (d.fitcheck === "go" && typeof d.url === "string" && /^https?:\/\//.test(d.url)) return goTo(d.url);
    if (d.fitcheck !== "scrollTo" || typeof d.ratio !== "number") return;
    quietUntil = Date.now() + 120;
    window.scrollTo({ top: Math.round(Math.min(1, Math.max(0, d.ratio)) * maxY()), left: 0, behavior: "instant" });
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { send("hello"); });
  else send("hello");
})();
