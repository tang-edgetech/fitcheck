<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use GuzzleHttp\Psr7\Uri;
use GuzzleHttp\Psr7\UriResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;

/**
 * "Device view": loads a page the way a real phone, tablet, computer or TV would.
 *
 * Many sites (Laravel, WordPress plugins, …) pick the mobile or desktop layout on their server from the
 * browser's User-Agent, and scripts (React, Vue, …) read navigator.userAgent too. A frame inside Fitcheck always
 * carries the visitor's own computer identity, so every device would get the desktop page. Here the server
 * fetches the page as the device, then sends it to the frame with:
 *   - <base href> so the site's own images, styles and scripts load straight from the site;
 *   - a small script that gives scripts the device's identity, keeps links inside the device view,
 *     and reports/follows scroll for Fitcheck's scroll sync.
 * Safety: public addresses only (checked on every redirect, connection pinned to the checked IP), HTML only,
 * size and time limits, and the page runs sandboxed (no access to this API's cookies or storage). It only
 * answers inside a frame on the Fitcheck site; opened directly it redirects to the real page.
 */
class DeviceViewController extends Controller
{
    /** [User-Agent, navigator.platform, maxTouchPoints, navigator.vendor, userAgentData (null = browser has none)] */
    private const AGENTS = [
        'iphone' => ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', 'iPhone', 5, 'Apple Computer, Inc.', null],
        'android' => ['Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36', 'Linux armv81', 5, 'Google Inc.', ['mobile' => true, 'platform' => 'Android']],
        'ipad' => ['Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', 'iPad', 5, 'Apple Computer, Inc.', null],
        'android-tablet' => ['Mozilla/5.0 (Linux; Android 15; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', 'Linux armv81', 5, 'Google Inc.', ['mobile' => false, 'platform' => 'Android']],
        'desktop' => ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', 'Win32', 0, 'Google Inc.', ['mobile' => false, 'platform' => 'Windows']],
        'mac' => ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15', 'MacIntel', 0, 'Apple Computer, Inc.', null],
        'tv' => ['Mozilla/5.0 (SMART-TV; Linux; Tizen 8.0) AppleWebKit/537.36 (KHTML, like Gecko) 120.0.6099.5/8.0 TV Safari/537.36', 'Linux armv7l', 0, 'Google Inc.', null],
    ];

    private const MAX_BYTES = 6 * 1024 * 1024;

    public function show(Request $request): Response
    {
        $data = $request->validate([
            'url' => ['required', 'string', 'max:2048', 'url:http,https'],
            'ua' => ['required', 'string', 'in:'.implode(',', array_keys(self::AGENTS))],
            'r' => ['nullable', 'integer', 'min:0'],
        ]);
        $url = $data['url'];

        // Only inside a frame: opened as a normal page it just goes to the real site
        $dest = $request->header('Sec-Fetch-Dest');
        if ($dest !== null && $dest !== 'iframe') {
            return redirect()->away($url);
        }

        $key = 'deviceview:'.sha1($url.'|'.$data['ua'].'|'.($data['r'] ?? 0).'|'.$request->header('Accept-Language'));
        $page = Cache::store('file')->get($key);
        if (! $page) {
            $page = $this->fetch($url, self::AGENTS[$data['ua']][0], (string) $request->header('Accept-Language', 'en'));
            if (isset($page['html'])) {
                Cache::store('file')->put($key, $page, 60);
            }
        }
        if (isset($page['redirect'])) {
            return redirect()->away($page['redirect']);
        }
        if (isset($page['error'])) {
            return $this->send($this->errorPage($url, $page['error']), 502, 'utf-8');
        }

        $html = $this->inject($page['html'], $page['url'], $data['ua'], $request->url());

        return $this->send($html, $page['status'], $page['charset']);
    }

    /** @return array{html: string, url: string, status: int, charset: string}|array{redirect: string}|array{error: string} */
    private function fetch(string $url, string $agent, string $lang): array
    {
        try {
            for ($hop = 0; $hop < 6; $hop++) {
                $host = (string) parse_url($url, PHP_URL_HOST);
                $ips = PublicController::publicIps($host);
                if (! $ips) {
                    return ['error' => "This address isn't a public website."];
                }
                $port = parse_url($url, PHP_URL_PORT) ?: (str_starts_with($url, 'https:') ? 443 : 80);
                $options = ['allow_redirects' => false, 'verify' => true,
                    // Stop before downloading something large or that isn't a page
                    'on_headers' => function ($r) {
                        if ((int) $r->getHeaderLine('Content-Length') > self::MAX_BYTES) {
                            throw new \RuntimeException('too large');
                        }
                    }];
                if (extension_loaded('curl')) {
                    // Connect to the address that was just checked (a second DNS answer can't point elsewhere)
                    $options['curl'] = [CURLOPT_RESOLVE => [trim($host, '[]').':'.$port.':'.$ips[0]]];
                }
                $res = Http::withOptions($options)->withHeaders([
                    'User-Agent' => $agent,
                    'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language' => substr($lang, 0, 200),
                ])->timeout(15)->get($url);

                $location = $res->header('Location');
                if ($res->redirect() && $location) {
                    $url = (string) UriResolver::resolve(new Uri($url), new Uri($location));
                    if (! preg_match('#^https?://#i', $url)) {
                        return ['error' => 'The site redirected to an address Fitcheck can\'t open.'];
                    }

                    continue;
                }

                $type = strtolower($res->header('Content-Type'));
                if ($type !== '' && ! str_contains($type, 'html')) {
                    return ['redirect' => $url]; // a PDF, image, …: the browser shows it directly
                }

                $html = $res->body();
                if (strlen($html) > self::MAX_BYTES) {
                    return ['error' => 'The page is too large to show in device view.'];
                }

                return ['html' => $html, 'url' => $url, 'status' => $res->status(), 'charset' => $this->charset($type, $html)];
            }

            return ['error' => 'The site redirected too many times.'];
        } catch (\Throwable $e) {
            logger()->info('Device view: '.$url.': '.$e->getMessage());

            return ['error' => "The site didn't answer."];
        }
    }

    private function charset(string $type, string $html): string
    {
        if (preg_match('/charset=["\']?([\w-]+)/i', $type, $m)) {
            return $m[1];
        }
        if (preg_match('/<meta[^>]+charset=["\']?([\w-]+)/i', substr($html, 0, 4096), $m)) {
            return $m[1];
        }

        return 'utf-8';
    }

    private function inject(string $html, string $pageUrl, string $ua, string $viewUrl): string
    {
        // The page's own <base> (if any) becomes ours, so it must be the first one
        $base = $pageUrl;
        if (preg_match('/<base\s[^>]*href=["\']?([^"\'\s>]+)[^>]*>/i', $html, $m)) {
            $base = (string) UriResolver::resolve(new Uri($pageUrl), new Uri(html_entity_decode($m[1])));
            $html = preg_replace('/<base\s[^>]*>/i', '', $html);
        }
        // A CSP in a <meta> tag would block the helper script
        $html = preg_replace('/<meta[^>]+http-equiv=["\']?content-security-policy[^>]*>/i', '', $html);

        [$agent, $platform, $touch, $vendor, $uaData] = self::AGENTS[$ua];
        $config = json_encode([
            'url' => $pageUrl, 'view' => $viewUrl, 'key' => $ua,
            'ua' => $agent, 'platform' => $platform, 'touch' => $touch, 'vendor' => $vendor, 'uaData' => $uaData,
        ], JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
        $head = '<base href="'.htmlspecialchars($base, ENT_QUOTES).'"><script>'.str_replace('__CONFIG__', $config, self::HELPER).'</script>';

        foreach (['/<head(\s[^>]*)?>/i', '/<html(\s[^>]*)?>/i'] as $re) {
            if (preg_match($re, $html, $m, PREG_OFFSET_CAPTURE)) {
                $at = $m[0][1] + strlen($m[0][0]);

                return substr($html, 0, $at).$head.substr($html, $at);
            }
        }

        return $head.$html;
    }

    private function send(string $html, int $status, string $charset): Response
    {
        $site = rtrim((string) config('fitcheck.frontend_url'), '/');

        return response($html, $status)
            ->header('Content-Type', 'text/html; charset='.$charset)
            // Sandboxed: the page gets no origin of its own, so it can't use this API's cookies or call it as the visitor
            ->header('Content-Security-Policy', "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals; frame-ancestors 'self' ".$site)
            ->header('Cache-Control', 'no-store')
            ->header('X-Robots-Tag', 'noindex, nofollow');
    }

    private function errorPage(string $url, string $reason): string
    {
        $u = htmlspecialchars($url, ENT_QUOTES);

        return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            .'<body style="font:15px/1.5 system-ui,sans-serif;color:#2a1d17;background:#fff8f3;margin:0;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px;box-sizing:border-box">'
            .'<div><b>Device view couldn\'t open this page.</b><br>'.htmlspecialchars($reason).'<br>'
            .'<small style="color:#7a6a60;word-break:break-all">'.$u.'</small></div></body>';
    }

    /** Runs first in the page. __CONFIG__ is replaced with the device and page details. */
    private const HELPER = <<<'JS'
(function () {
  "use strict";
  var C = __CONFIG__;
  function def(o, k, v) { try { Object.defineProperty(o, k, { get: function () { return v; }, configurable: true }); } catch (e) {} }

  // 1. The device's identity, for scripts that check it (React, Vue, jQuery plugins, …)
  var N = Navigator.prototype;
  def(N, "userAgent", C.ua);
  def(N, "appVersion", C.ua.replace(/^Mozilla\//, ""));
  def(N, "platform", C.platform);
  def(N, "vendor", C.vendor);
  def(N, "maxTouchPoints", C.touch);
  def(N, "userAgentData", C.uaData ? {
    mobile: C.uaData.mobile, platform: C.uaData.platform, brands: [],
    getHighEntropyValues: function () { return Promise.resolve({ mobile: C.uaData.mobile, platform: C.uaData.platform }); },
    toJSON: function () { return { mobile: C.uaData.mobile, platform: C.uaData.platform, brands: [] }; }
  } : undefined);
  if (C.touch > 0) {
    if (!("ontouchstart" in window)) window.ontouchstart = null;
    var mm = window.matchMedia;
    if (mm) window.matchMedia = function (q) {
      var s = String(q).replace(/\s+/g, "").toLowerCase(), hit = null;
      if (/^\((any-)?pointer:coarse\)$/.test(s) || /^\((any-)?hover:none\)$/.test(s)) hit = true;
      if (/^\((any-)?pointer:fine\)$/.test(s) || /^\((any-)?hover:hover\)$/.test(s)) hit = false;
      var r = mm.call(window, q);
      if (hit === null) return r;
      return { matches: hit, media: q, onchange: null, addListener: function () {}, removeListener: function () {},
        addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () { return false; } };
    };
  }

  // 2. The sandboxed page has no storage or cookies of its own: give it in-memory ones so scripts don't fail
  function mem() {
    var d = {};
    return { getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
      setItem: function (k, v) { d[String(k)] = String(v); }, removeItem: function (k) { delete d[String(k)]; },
      clear: function () { d = {}; }, key: function (i) { return Object.keys(d)[i] || null; },
      get length() { return Object.keys(d).length; } };
  }
  ["localStorage", "sessionStorage"].forEach(function (k) {
    try { window[k].length; } catch (e) { try { Object.defineProperty(window, k, { value: mem(), configurable: true }); } catch (e2) {} }
  });
  try { document.cookie; } catch (e) {
    var jar = {};
    try { Object.defineProperty(document, "cookie", { configurable: true,
      get: function () { return Object.keys(jar).map(function (k) { return k + "=" + jar[k]; }).join("; "); },
      set: function (v) { var p = String(v).split(";")[0], i = p.indexOf("="); if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1); } }); } catch (e2) {}
  }

  // 3. Show the page's real path, for routers that read it
  var page = new URL(C.url);
  try { history.replaceState(history.state, "", page.pathname + page.search + page.hash); } catch (e) {}

  // 4. Links and search forms stay in device view
  function view(u) { return C.view + "?url=" + encodeURIComponent(u) + "&ua=" + C.key; }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || a.hasAttribute("download")) return;
    var t = (a.getAttribute("target") || "").toLowerCase();
    if (t && t !== "_self" && t !== "_top" && t !== "_parent") return;
    var u; try { u = new URL(a.href); } catch (x) { return; }
    if (!/^https?:$/.test(u.protocol)) return;
    e.preventDefault();
    if (u.href.split("#")[0] === page.href.split("#")[0]) {
      var id = decodeURIComponent(u.hash.slice(1)), el = id && (document.getElementById(id) || document.getElementsByName(id)[0]);
      if (el) el.scrollIntoView(); else if (!id) window.scrollTo(0, 0);
      return;
    }
    location.href = view(u.href);
  });
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (e.defaultPrevented || !f || String(f.method || "get").toLowerCase() !== "get") return;
    try { var u = new URL(f.getAttribute("action") || page.href, document.baseURI); u.search = new URLSearchParams(new FormData(f)).toString(); e.preventDefault(); location.href = view(u.href); } catch (x) {}
  });

  // 5. Fitcheck mirroring: scroll, taps, swipes, typing and page changes (the same code as /sync.js: change both)
  var pathOk = location.pathname === page.pathname;
  function here() { return pathOk ? new URL(location.pathname + location.search + location.hash, page.origin).href : page.href; }
  function goTo(u) { location.href = view(u); }
  var emulateTouch = C.touch > 0;
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
JS;
}
