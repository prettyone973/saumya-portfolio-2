// Portfolio 2 — shared site script.

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
