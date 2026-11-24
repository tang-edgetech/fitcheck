/*!
 * Fitcheck scroll sync. Add to the site you test:
 *   <script src="https://fitcheck.smartsitecp.com/sync.js" defer></script>
 * When the page is shown inside Fitcheck, scrolling one device scrolls all the others to the same place.
 * It does nothing when the page is opened normally (not inside a frame). It only sends and receives scroll positions.
 */
(function () {
  "use strict";
  if (window.parent === window || window.__fitcheckSync) return;
  window.__fitcheckSync = true;

  // Talk only to the Fitcheck site this script came from; a self-hosted copy talks to any parent
  var src = document.currentScript && document.currentScript.src;
  var target = "*";
  try { var o = new URL(src, location.href).origin; if (o !== location.origin) target = o; } catch (e) { /* keep "*" */ }

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

  window.addEventListener("message", function (e) {
    if (e.source !== window.parent || (target !== "*" && e.origin !== target)) return;
    var d = e.data;
    if (!d || d.fitcheck !== "scrollTo" || typeof d.ratio !== "number") return;
    quietUntil = Date.now() + 120;
    window.scrollTo({ top: Math.round(Math.min(1, Math.max(0, d.ratio)) * maxY()), left: 0, behavior: "instant" });
  });

  send("hello", { version: 1 });
})();
