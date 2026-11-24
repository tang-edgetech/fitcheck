/*!
 * Fitcheck scroll and click sync. Add to the site you test:
 *   <script src="https://fitcheck.smartsitecp.com/sync.js" defer></script>
 * When the page is shown inside Fitcheck, scrolling one device scrolls all the others to the same place,
 * and clicking something (closing a popup, opening a menu) clicks the same thing in the others.
 * It does nothing when the page is opened normally (not inside a frame). It only sends and receives scroll positions and which element was clicked.
 */
(function () {
  "use strict";
  if (window.parent === window || window.__fitcheckSync) return;
  window.__fitcheckSync = true;

  // Any Fitcheck (live, local, self-hosted) can show the page; the messages only carry a scroll position or which element was clicked
  var target = "*";

  var root = document.scrollingElement || document.documentElement;
  var quietUntil = 0, queued = false;

  function maxY() { return Math.max(0, root.scrollHeight - window.innerHeight); }
  function send(type, extra) {
    var msg = { fitcheck: type, y: window.scrollY, ratio: maxY() ? window.scrollY / maxY() : 0 };
    if (extra) for (var k in extra) msg[k] = extra[k];
    try { window.parent.postMessage(msg, target); } catch (e) { /* parent gone */ }
  }

  window.addEventListener("scroll", function () {
    if (queued || Date.now() < quietUntil) return; // ignore scrolling we were told to do
    queued = true;
    requestAnimationFrame(function () { queued = false; send("scroll"); });
  }, { passive: true });

  // Clicks: a real click in one device is repeated on the same element in the others (popups, menus, links)
  var replaying = false;
  function pathOf(el) {
    var p = [];
    for (; el && el.nodeType === 1 && el !== document.documentElement; el = el.parentElement) {
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id) && document.querySelectorAll("#" + el.id).length === 1) { p.unshift("#" + el.id); break; }
      var i = 1, s = el;
      while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
      p.unshift(el.tagName.toLowerCase() + ":nth-of-type(" + i + ")");
    }
    return p.join(">");
  }
  function textOf(el) { return (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80); }
  function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function findTarget(m) {
    var el = null;
    try { el = document.querySelector(m.path); } catch (e) {}
    if (el && el.tagName.toLowerCase() === m.tag && textOf(el) === m.text && visible(el)) return el;
    // Different layout (mobile vs desktop): a visible element of the same kind, classes and text
    var list = [];
    try { list = document.querySelectorAll(m.tag + m.cls.split(/\s+/).filter(Boolean).map(function (c) { return "." + CSS.escape(c); }).join("")); } catch (e) {}
    for (var i = 0; i < list.length; i++) if (textOf(list[i]) === m.text && visible(list[i])) return list[i];
    return el && visible(el) ? el : null;
  }
  window.addEventListener("click", function (e) {
    var el = e.target;
    if (replaying || !e.isTrusted || !el || el.nodeType !== 1) return;
    var cls = typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
    try { window.parent.postMessage({ fitcheck: "click", path: pathOf(el), tag: el.tagName.toLowerCase(), cls: cls.trim(), text: textOf(el) }, "*"); } catch (x) {}
  }, true);
  function replayClick(m) {
    if (typeof m.path !== "string" || typeof m.tag !== "string") return;
    m.cls = String(m.cls || ""); m.text = String(m.text || "");
    var el = findTarget(m);
    if (!el) return;
    replaying = true;
    try { if (typeof el.click === "function") el.click(); else el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); }
    finally { replaying = false; }
  }
  window.addEventListener("message", function (e) {
    if (e.source !== window.parent) return;
    var d = e.data;
    if (d && d.fitcheck === "clickAt") return replayClick(d);
    if (!d || d.fitcheck !== "scrollTo" || typeof d.ratio !== "number") return;
    quietUntil = Date.now() + 120;
    window.scrollTo({ top: Math.round(Math.min(1, Math.max(0, d.ratio)) * maxY()), left: 0, behavior: "instant" });
  });

  send("hello", { version: 1 });
})();
