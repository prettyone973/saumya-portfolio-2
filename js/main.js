// Portfolio 2 — shared site script.

// Page transitions: native cross-document View Transitions (Chromium via
// the @view-transition CSS rule) need no JS at all — this block only runs
// the manual fade+slide fallback, and only when the inline <head> script
// decided this browser lacks native support and motion isn't reduced (that
// script also does the reduced-motion check, so it doubles as this whole
// feature's off-switch here).
if (document.documentElement.classList.contains("page-transitions-js")) {
  requestAnimationFrame(() => {
    document.documentElement.classList.add("page-entered");
  });

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const link = e.target.closest("a[href]");
    if (!link) return;
    if (link.target && link.target !== "_self") return;

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return; // external link: normal navigation
    if (url.pathname === window.location.pathname && url.hash) return; // same-page anchor, no page change

    e.preventDefault();
    document.documentElement.classList.remove("page-entered");
    document.documentElement.classList.add("page-leaving");
    setTimeout(() => {
      window.location.href = link.href;
    }, 400); // matches the outgoing fade's duration in style.css
  });
}

// Hero parallax: background drifts at ~0.5x scroll speed while the page's
// actual content scrolls at the normal 1x. The native CSS scroll-timeline
// in style.css handles this with zero JS on supporting browsers; this rAF
// fallback only runs when that's unavailable, and never under reduced
// motion (matching the CSS gate exactly, so precisely one mechanism ever
// drives --hero-parallax-y).
const heroForParallax = document.querySelector(".hero");

if (
  heroForParallax &&
  !CSS.supports("animation-timeline", "scroll()") &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  let ticking = false;

  const updateHeroParallax = () => {
    const heroHeight = heroForParallax.offsetHeight || window.innerHeight;
    const scrollY = Math.min(window.scrollY, heroHeight); // hero's fully scrolled past beyond this
    heroForParallax.style.setProperty("--hero-parallax-y", `${scrollY * 0.5}px`);
    ticking = false;
  };

  updateHeroParallax();
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateHeroParallax);
      }
    },
    { passive: true }
  );
}

// Sparkle trail: inside .sparkle-zone elements only (the project cards).
// Desktop pointer + no reduced-motion preference only — `sparkleTrailEnabled()`
// is re-checked on every pointer move rather than once at load, so it also
// responds live if the OS setting changes or a touch input takes over
// mid-session, without needing separate matchMedia change listeners.
const sparkleZones = document.querySelectorAll(".sparkle-zone");

if (sparkleZones.length > 0) {
  const finePointer = window.matchMedia("(pointer: fine)");
  const noReducedMotion = window.matchMedia("(prefers-reduced-motion: no-preference)");
  const sparkleTrailEnabled = () => finePointer.matches && noReducedMotion.matches;

  const SPARKLE_DURATION = 700; // ms
  const SPARKLE_MAX = 15;
  const SPARKLE_MIN_INTERVAL = 45; // ms between spawns, on top of the velocity gate
  const SPARKLE_VELOCITY_THRESHOLD = 0.25; // px/ms — below this, stationary-ish movement spawns nothing
  const SPARKLE_DRIFT = 10; // px, downward drift over the sparkle's lifetime
  // Opacity peaks shortly after spawn (a quick flash-in) before fading out
  // over the rest of the lifetime, rather than a flat fade from frame one.
  const SPARKLE_PEAK_T = 0.15;

  const activeSparkles = [];
  let rafHandle = null;
  let lastPointer = null; // { x, y, time }
  let lastSpawnTime = 0;

  function spawnSparkle(x, y) {
    if (activeSparkles.length >= SPARKLE_MAX) return;

    const size = 14 + Math.random() * 12; // 14-26px
    const rotation = Math.random() * 360;
    const hueRotate = Math.random() * 50 - 25; // -25deg to +25deg

    const img = document.createElement("img");
    img.src = "assets/img/sparkle.png";
    img.alt = "";
    img.draggable = false;
    img.classList.add("sparkle");
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    img.style.filter = `hue-rotate(${hueRotate}deg) drop-shadow(0 0 6px rgba(255, 255, 255, 0.7))`;

    document.body.appendChild(img);
    activeSparkles.push({
      el: img,
      baseX: x - size / 2,
      baseY: y - size / 2,
      rotation,
      startTime: performance.now(),
    });

    if (rafHandle === null) {
      rafHandle = requestAnimationFrame(tickSparkles);
    }
  }

  function tickSparkles(now) {
    for (let i = activeSparkles.length - 1; i >= 0; i--) {
      const s = activeSparkles[i];
      // Clamped both ends: rAF's frame timestamp can be a hair behind a
      // performance.now() taken during the pointermove that just spawned
      // this sparkle, which would otherwise make t briefly negative.
      const t = Math.min(Math.max((now - s.startTime) / SPARKLE_DURATION, 0), 1);
      const scale = 1 - t;
      const drift = t * SPARKLE_DRIFT;
      // Ramp up to full opacity by SPARKLE_PEAK_T, then fade out over the
      // remaining lifetime.
      const opacity = t < SPARKLE_PEAK_T ? t / SPARKLE_PEAK_T : 1 - (t - SPARKLE_PEAK_T) / (1 - SPARKLE_PEAK_T);

      s.el.style.opacity = String(opacity);
      s.el.style.transform = `translate(${s.baseX}px, ${s.baseY + drift}px) rotate(${s.rotation}deg) scale(${scale})`;

      if (t >= 1) {
        s.el.remove();
        activeSparkles.splice(i, 1);
      }
    }

    rafHandle = activeSparkles.length > 0 ? requestAnimationFrame(tickSparkles) : null;
  }

  document.addEventListener(
    "pointermove",
    (e) => {
      if (!sparkleTrailEnabled()) return;

      const zone = e.target.closest(".sparkle-zone");
      if (!zone) {
        lastPointer = null;
        return;
      }

      const now = performance.now();
      if (lastPointer) {
        const dt = now - lastPointer.time;
        const velocity = dt > 0 ? Math.hypot(e.clientX - lastPointer.x, e.clientY - lastPointer.y) / dt : 0;
        if (velocity > SPARKLE_VELOCITY_THRESHOLD && now - lastSpawnTime > SPARKLE_MIN_INTERVAL) {
          spawnSparkle(e.clientX, e.clientY);
          lastSpawnTime = now;
        }
      }
      lastPointer = { x: e.clientX, y: e.clientY, time: now };
    },
    { passive: true }
  );
}

// Butterfly easter egg: a couple per page, placed at random within a set
// of computed "safe zones" (viewport edge margins + the whitespace gaps
// between sections) rather than fixed anchor points, so they never fall
// into the same rhythm relative to the content. Fully skipped — not just
// visually hidden — under reduced motion or below the 768px breakpoint,
// and per-butterfly once it's flown away this session.
if (
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
  window.innerWidth >= 768
) {
  const BUTTERFLY_COUNT = 2;
  const SIZE_MIN = 44; // px
  const SIZE_MAX = 52; // px
  const CLEARANCE = 20; // px min gap from any obstacle or other butterfly
  const MARGIN_ZONE_WIDTH = 140; // px strip in from each viewport edge
  const MAX_SAMPLES_PER_ZONE = 25;
  const FLAP_MIN_DELAY = 3000; // ms
  const FLAP_MAX_DELAY = 9000; // ms
  const FLIGHT_DURATION = 1200; // ms
  const FLIGHT_OVERSHOOT = 120; // px past the nearest edge
  const FLIGHT_ARC = 60; // px, perpendicular bow of the curved path
  const FLIGHT_END_SCALE = 0.6;

  const imgSrc = window.location.pathname.includes("/case-studies/")
    ? "../assets/img/butterfly.png"
    : "assets/img/butterfly.png";

  function pageRect(el) {
    const r = el.getBoundingClientRect();
    return {
      left: r.left + window.scrollX,
      right: r.right + window.scrollX,
      top: r.top + window.scrollY,
      bottom: r.bottom + window.scrollY,
    };
  }

  function rectsClear(a, b, clearance) {
    return (
      a.right + clearance < b.left ||
      a.left - clearance > b.right ||
      a.bottom + clearance < b.top ||
      a.top - clearance > b.bottom
    );
  }

  // Obstacles: anything a butterfly shouldn't land on top of — controls,
  // links and body text/images. Checked with real page rects, so a zone
  // only has to be roughly right; this is what keeps placement safe even
  // if the zone geometry loosely overlaps content.
  const obstacles = Array.from(
    document.querySelectorAll(
      "a, button, [role='button'], input, textarea, select, .glass-btn, .glass-card, h1, h2, h3, h4, h5, p, li, img, label"
    )
  ).map(pageRect);

  const nav = document.querySelector(".site-nav");
  const footer = document.querySelector(".site-footer");
  const docHeight = document.documentElement.scrollHeight;
  const viewportWidth = window.innerWidth;

  const safeTop = (nav ? pageRect(nav).bottom : 0) + 24;
  const safeBottom = (footer ? pageRect(footer).top : docHeight) - 24;

  function buildZones() {
    const zones = [];

    if (safeBottom - safeTop > SIZE_MIN + CLEARANCE * 2) {
      if (MARGIN_ZONE_WIDTH > SIZE_MIN + CLEARANCE * 2) {
        zones.push({ left: 8, right: MARGIN_ZONE_WIDTH, top: safeTop, bottom: safeBottom });
        zones.push({
          left: viewportWidth - MARGIN_ZONE_WIDTH,
          right: viewportWidth - 8,
          top: safeTop,
          bottom: safeBottom,
        });
      }
    }

    // Gaps between adjacent top-level content blocks (the whitespace
    // between sections/containers) — a horizontal band spanning the
    // content column at each gap wide enough to hold a butterfly.
    const contentRoot = document.querySelector(".page-content, main");
    const blocks = contentRoot
      ? Array.from(contentRoot.children).filter((el) => el.getBoundingClientRect().height > 0)
      : [];
    for (let i = 0; i < blocks.length - 1; i += 1) {
      const gapTop = pageRect(blocks[i]).bottom;
      const gapBottom = pageRect(blocks[i + 1]).top;
      if (gapBottom - gapTop >= SIZE_MIN + CLEARANCE * 2) {
        const contentLeft = Math.min(pageRect(blocks[i]).left, pageRect(blocks[i + 1]).left);
        const contentRight = Math.max(pageRect(blocks[i]).right, pageRect(blocks[i + 1]).right);
        zones.push({ left: contentLeft, right: contentRight, top: gapTop + 8, bottom: gapBottom - 8 });
      }
    }

    return zones.filter((z) => z.right - z.left >= SIZE_MIN && z.bottom - z.top >= SIZE_MIN);
  }

  function shuffled(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function tryPlaceInZone(zone, size, placedRects) {
    for (let attempt = 0; attempt < MAX_SAMPLES_PER_ZONE; attempt += 1) {
      const left = zone.left + Math.random() * Math.max(0, zone.right - zone.left - size);
      const top = zone.top + Math.random() * Math.max(0, zone.bottom - zone.top - size);
      const candidate = { left, right: left + size, top, bottom: top + size };

      const clearsObstacles = obstacles.every((o) => rectsClear(candidate, o, CLEARANCE));
      const clearsPlaced = placedRects.every((p) => rectsClear(candidate, p, CLEARANCE));
      if (clearsObstacles && clearsPlaced) return candidate;
    }
    return null;
  }

  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  function flyAway(butterfly, img, storageKey) {
    const rect = butterfly.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const distanceToEdge = {
      left: rect.left,
      right: vw - rect.right,
      top: rect.top,
      bottom: vh - rect.bottom,
    };
    const nearestEdge = Object.keys(distanceToEdge).reduce((a, b) =>
      distanceToEdge[a] < distanceToEdge[b] ? a : b
    );

    let targetX = 0;
    let targetY = 0;
    if (nearestEdge === "left") targetX = -(rect.left + FLIGHT_OVERSHOOT);
    if (nearestEdge === "right") targetX = vw - rect.right + FLIGHT_OVERSHOOT;
    if (nearestEdge === "top") targetY = -(rect.top + FLIGHT_OVERSHOOT);
    if (nearestEdge === "bottom") targetY = vh - rect.bottom + FLIGHT_OVERSHOOT;

    // Curved (quadratic bezier) path: bow the control point perpendicular
    // to the straight start->target line so it arcs instead of flying straight.
    const bow = FLIGHT_ARC * (Math.random() < 0.5 ? -1 : 1);
    let controlX = targetX / 2;
    let controlY = targetY / 2;
    if (targetX !== 0) controlY += bow;
    else controlX += bow;

    const rotationTarget = (Math.random() * 30 - 15) + (targetX > 0 ? 20 : targetX < 0 ? -20 : 0);
    const start = performance.now();

    img.classList.remove("is-flapping");
    img.classList.add("is-launching");

    function tick(now) {
      const linear = Math.min((now - start) / FLIGHT_DURATION, 1);
      const t = easeOutCubic(linear);
      const inv = 1 - t;

      const x = 2 * inv * t * controlX + t * t * targetX;
      const y = 2 * inv * t * controlY + t * t * targetY;
      const scale = 1 - (1 - FLIGHT_END_SCALE) * t;
      const rotate = rotationTarget * t;

      butterfly.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`;
      butterfly.style.opacity = String(1 - t);

      if (linear < 1) {
        requestAnimationFrame(tick);
      } else {
        butterfly.remove();
        sessionStorage.setItem(storageKey, "1");
      }
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener("load", () => {
    const zones = buildZones();
    if (zones.length === 0) return;

    const placedRects = [];

    for (let i = 0; i < BUTTERFLY_COUNT; i += 1) {
      const storageKey = `butterfly-flown:${window.location.pathname}:${i}`;
      if (sessionStorage.getItem(storageKey)) continue; // already flown this session

      const size = SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN);
      let placement = null;
      for (const zone of shuffled(zones)) {
        placement = tryPlaceInZone(zone, size, placedRects);
        if (placement) break;
      }
      if (!placement) continue; // no safe spot found — skip rather than overlap content

      placedRects.push(placement);

      const butterfly = document.createElement("div");
      butterfly.className = "butterfly";
      butterfly.setAttribute("aria-hidden", "true");
      butterfly.style.width = `${size}px`;
      butterfly.style.height = `${size}px`;
      butterfly.style.left = `${placement.left}px`;
      butterfly.style.top = `${placement.top}px`;

      const img = document.createElement("img");
      img.className = "butterfly__img";
      img.src = imgSrc;
      img.alt = "";
      img.draggable = false;
      butterfly.appendChild(img);
      document.body.appendChild(butterfly);

      img.addEventListener("animationend", (e) => {
        if (e.animationName === "butterfly-flap") {
          img.classList.remove("is-flapping", "is-launching");
        }
      });

      (function scheduleFlap() {
        const delay = FLAP_MIN_DELAY + Math.random() * (FLAP_MAX_DELAY - FLAP_MIN_DELAY);
        setTimeout(() => {
          if (!butterfly.isConnected) return; // flown away — stop rescheduling
          img.classList.add("is-flapping");
          scheduleFlap();
        }, delay);
      })();

      butterfly.addEventListener("click", () => flyAway(butterfly, img, storageKey));
    }
  });
}

// About page: copy email to clipboard (button/note only present on about.html).
const copyEmailBtn = document.getElementById("copy-email-btn");
const copiedNote = document.getElementById("copied-note");

if (copyEmailBtn && copiedNote) {
  copyEmailBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("saumyamehta252004@gmail.com");
      copiedNote.hidden = false;
      setTimeout(() => {
        copiedNote.hidden = true;
      }, 2000);
    } catch {
      // clipboard access unavailable; no-op
    }
  });
}
