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

// Home page: the nav is fixed, but its backdrop isn't — it starts over the
// dark hero photo (white brand text) and ends up over the light mesh
// gradient once scrolled past (needs the normal dark ink-primary text).
// Toggle the modifier class based on whether the hero is still behind the
// nav, rather than hardcoding it per-page.
const heroEl = document.querySelector(".hero");
const navEl = document.querySelector(".site-nav");

if (heroEl && navEl) {
  const HERO_FADE_HEIGHT = 200; // must match .hero's mask-image fade distance in style.css

  const updateNavTone = () => {
    const heroBottom = heroEl.getBoundingClientRect().bottom;
    navEl.classList.toggle("site-nav--on-hero", heroBottom > navEl.offsetHeight + HERO_FADE_HEIGHT);
  };
  updateNavTone();
  window.addEventListener("scroll", updateNavTone, { passive: true });
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

  const SPARKLE_COLORS = ["#F0C8CE", "#F2DFC0", "#D6DEEA"]; // rose, pale gold, ice blue — never a full rainbow
  const SPARKLE_DURATION = 700; // ms
  const SPARKLE_MAX = 15;
  const SPARKLE_MIN_INTERVAL = 45; // ms between spawns, on top of the velocity gate
  const SPARKLE_VELOCITY_THRESHOLD = 0.25; // px/ms — below this, stationary-ish movement spawns nothing
  const SPARKLE_DRIFT = 10; // px, downward drift over the sparkle's lifetime
  // 4-point star / "twinkle" shape: outer tips at N/E/S/W, pinched inner
  // vertices on the diagonals, in a 16x16 viewBox.
  const SPARKLE_STAR_POINTS = "8,0 9.98,6.02 16,8 9.98,9.98 8,16 6.02,9.98 0,8 6.02,6.02";
  const SVG_NS = "http://www.w3.org/2000/svg";

  let colorIndex = 0;
  const activeSparkles = [];
  let rafHandle = null;
  let lastPointer = null; // { x, y, time }
  let lastSpawnTime = 0;

  function spawnSparkle(x, y) {
    if (activeSparkles.length >= SPARKLE_MAX) return;

    const size = 6 + Math.random() * 8; // 6-14px
    const rotation = Math.random() * 360;
    const color = SPARKLE_COLORS[colorIndex % SPARKLE_COLORS.length];
    colorIndex += 1;

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.classList.add("sparkle");

    const poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", SPARKLE_STAR_POINTS);
    poly.setAttribute("fill", color);
    svg.appendChild(poly);

    document.body.appendChild(svg);
    activeSparkles.push({
      el: svg,
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

      s.el.style.opacity = String(1 - t);
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

// Butterfly easter egg: two per page, injected into hand-placed
// .butterfly-slot anchors in the page's HTML (never auto-placed). Fully
// skipped — not just visually hidden — under reduced motion or below the
// 768px breakpoint, and per-butterfly once it's flown away this session.
const butterflySlots = document.querySelectorAll(".butterfly-slot");

if (
  butterflySlots.length > 0 &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
  window.innerWidth >= 768
) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const FLAP_MIN_DELAY = 3000; // ms
  const FLAP_MAX_DELAY = 9000; // ms
  const FLIGHT_DURATION = 1200; // ms
  const FLIGHT_OVERSHOOT = 120; // px past the nearest edge
  const FLIGHT_ARC = 60; // px, perpendicular bow of the curved path
  const FLIGHT_END_SCALE = 0.6;

  let gradientCounter = 0;

  function buildButterflySvg() {
    gradientCounter += 1;
    const gradientId = `butterfly-grad-${gradientCounter}`;

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 32 32");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add("butterfly");
    // Purely decorative and mouse-only: no tabindex, no role, so it's
    // naturally excluded from the tab order without extra work.
    svg.innerHTML = `
      <defs>
        <linearGradient id="${gradientId}" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#F0C8CE"/>
          <stop offset="0.5" stop-color="#F2DFC0"/>
          <stop offset="1" stop-color="#D6DEEA"/>
        </linearGradient>
      </defs>
      <g class="butterfly__wing butterfly__wing-left" style="fill: url(#${gradientId});">
        <ellipse cx="9" cy="12" rx="7" ry="8.5"/>
        <ellipse cx="11" cy="21" rx="4.5" ry="5"/>
      </g>
      <g class="butterfly__wing butterfly__wing-right" style="fill: url(#${gradientId});">
        <ellipse cx="23" cy="12" rx="7" ry="8.5"/>
        <ellipse cx="21" cy="21" rx="4.5" ry="5"/>
      </g>
      <path class="butterfly__body" d="M16 6 C14.5 6 14 7 14 9 L14 24 C14 25.5 15 25.8 16 25.8 C17 25.8 18 25.5 18 24 L18 9 C18 7 17.5 6 16 6 Z"/>
      <path class="butterfly__antenna" d="M15 7 C13.5 4.5 12 4 11 3.5 M17 7 C18.5 4.5 20 4 21 3.5" fill="none"/>
    `;
    return svg;
  }

  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  function flyAway(butterfly, wings, storageKey) {
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

    wings.forEach((wing) => {
      wing.classList.remove("is-flapping");
      wing.classList.add("is-launching");
    });

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

  butterflySlots.forEach((slot) => {
    const id = slot.dataset.butterflyId;
    if (!id) return;

    const storageKey = `butterfly-flown:${id}`;
    if (sessionStorage.getItem(storageKey)) return; // already flown this session

    const butterfly = buildButterflySvg();
    slot.appendChild(butterfly);
    const wings = butterfly.querySelectorAll(".butterfly__wing");

    wings.forEach((wing) => {
      wing.addEventListener("animationend", (e) => {
        if (e.animationName === "butterfly-flap") {
          wing.classList.remove("is-flapping", "is-launching");
        }
      });
    });

    function scheduleFlap() {
      const delay = FLAP_MIN_DELAY + Math.random() * (FLAP_MAX_DELAY - FLAP_MIN_DELAY);
      setTimeout(() => {
        if (!butterfly.isConnected) return; // flown away — stop rescheduling
        wings.forEach((wing) => wing.classList.add("is-flapping"));
        scheduleFlap();
      }, delay);
    }
    scheduleFlap();

    butterfly.addEventListener("click", () => flyAway(butterfly, wings, storageKey));
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
