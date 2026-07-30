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

// Scroll reveal: fade + slide elements in as they enter the viewport, once
// only (never re-hidden on scroll up). The hidden state only exists under
// html.js (added synchronously in <head>, same pattern as
// page-transitions-js), so content is always visible if this never runs.
// Siblings sharing a parent (e.g. each card in a project grid) are
// staggered 90ms apart, in DOM order, via an inline transition-delay —
// skipped under reduced motion, where style.css also drops the
// transform/transition entirely so reveals are instant instead of eased.
{
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealTargets = document.querySelectorAll(".reveal");

  if (revealTargets.length > 0) {
    // Staggered by position among reveal-siblings under the same parent,
    // not global DOM order, so each new group (a row of cards, a list of
    // skills) restarts its own 0/90/180ms sequence.
    const staggerIndex = new Map();
    revealTargets.forEach((el) => {
      const parent = el.parentElement;
      const i = staggerIndex.get(parent) || 0;
      staggerIndex.set(parent, i + 1);
      if (!reduceMotion) {
        el.style.transitionDelay = `${i * 90}ms`;
      }
    });

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
    );

    revealTargets.forEach((el) => revealObserver.observe(el));
  }
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

// Project card flip: each card has two .flip-btn buttons (one per face,
// sharing the same aria-controls target) that toggle .is-flipped on the
// card. Besides the class itself, this also keeps the currently-hidden
// face's interactive elements (the title link, the other flip button) out
// of the tab order via tabindex="-1" — backface-visibility: hidden makes a
// face invisible, but doesn't remove it from the tab order on its own.
function setCardFlipped(card, flipped) {
  card.classList.toggle("is-flipped", flipped);

  const front = card.querySelector(".card-front");
  const back = card.querySelector(".card-back");
  if (!front || !back) return;

  front.querySelectorAll("a, button").forEach((el) => {
    if (flipped) el.setAttribute("tabindex", "-1");
    else el.removeAttribute("tabindex");
  });
  back.querySelectorAll("a, button").forEach((el) => {
    if (flipped) el.removeAttribute("tabindex");
    else el.setAttribute("tabindex", "-1");
  });

  card.querySelectorAll(".flip-btn").forEach((btn) => {
    btn.setAttribute("aria-expanded", String(flipped));
  });
}

document.querySelectorAll(".card").forEach((card) => setCardFlipped(card, false));

document.querySelectorAll(".flip-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const card = btn.closest(".card");
    if (!card) return;
    setCardFlipped(card, !card.classList.contains("is-flipped"));
  });
});

// Card height equalizer: .card-inner's grid-stacked faces already make a
// card's own front/back match each other (sized to the taller one), and
// CSS Grid's default row-stretch already matches cards that share a grid
// row. Neither covers an odd-numbered row-mate-less card (3 cards in a
// 2-column grid always leaves one alone on its own row) — this sets an
// explicit min-height, per .project-grid, to the tallest card's natural
// height so every card matches regardless of row pairing.
function equalizeCardHeights() {
  document.querySelectorAll(".project-grid").forEach((grid) => {
    const cards = Array.from(grid.querySelectorAll(".card"));
    if (cards.length === 0) return;
    cards.forEach((c) => {
      c.style.minHeight = "";
    });
    const tallest = Math.max(...cards.map((c) => c.getBoundingClientRect().height));
    cards.forEach((c) => {
      c.style.minHeight = `${tallest}px`;
    });
  });
}

window.addEventListener("load", equalizeCardHeights);
window.addEventListener("resize", equalizeCardHeights);

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
  const SPARKLE_END_SCALE = 0.4; // scale at end of life (starts at 1)
  // Solid, flat tints only — no gradient, no glow.
  const SPARKLE_COLORS = ["#F2C4CE", "#F6D2BE", "#F1DFC2", "#CFE4DE", "#CBD3EC", "#DCCDE6"];
  const SVG_NS = "http://www.w3.org/2000/svg";
  // Opacity peaks shortly after spawn (a quick flash-in) before fading out
  // over the rest of the lifetime, rather than a flat fade from frame one.
  const SPARKLE_PEAK_T = 0.15;

  const activeSparkles = [];
  let rafHandle = null;
  let lastPointer = null; // { x, y, time }
  let lastSpawnTime = 0;

  // Inlined (not an <img>) so the path's `fill="currentColor"` picks up the
  // `color` set per-instance below — a flat single-colour star, no defs/
  // gradients needed since there's nothing to namespace per instance.
  function buildSparkleSvg() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.classList.add("sparkle");
    svg.innerHTML = `
      <path d="M32 1 C 33.5 20 36.8 26.6 44.4 28.5 C 51.6 30.2 56.8 31.1 63 32 C 56.8 32.9 51.6 33.8 44.4 35.5 C 36.8 37.4 33.5 44 32 63 C 30.5 44 27.2 37.4 19.6 35.5 C 12.4 33.8 7.2 32.9 1 32 C 7.2 31.1 12.4 30.2 19.6 28.5 C 27.2 26.6 30.5 20 32 1 Z" fill="currentColor"/>
    `;
    return svg;
  }

  function spawnSparkle(x, y) {
    if (activeSparkles.length >= SPARKLE_MAX) return;

    const size = 14 + Math.random() * 12; // 14-26px
    const rotation = Math.random() * 360;
    const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];

    const svg = buildSparkleSvg();
    svg.style.width = `${size}px`;
    svg.style.height = `${size}px`;
    svg.style.color = color;

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
      const scale = 1 - (1 - SPARKLE_END_SCALE) * t;
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
// visually hidden — under reduced motion or below the 768px breakpoint.
// A repeatable delight, not a one-time easter egg: no sessionStorage, so
// they're back on every load/navigation.
if (
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
  window.innerWidth >= 768
) {
  const BUTTERFLY_COUNT = 2;
  const SIZE_MIN = 58; // px
  const SIZE_MAX = 70; // px
  const CLEARANCE = 20; // px min gap from any obstacle or other butterfly
  const MARGIN_ZONE_WIDTH = 140; // px strip in from each viewport edge
  const MAX_SAMPLES_PER_ZONE = 25;
  const FLAP_MIN_DELAY = 60000; // ms — fully autonomous, never hover-triggered
  const FLAP_MAX_DELAY = 120000; // ms
  const WANDER_DURATION = 1500; // ms — the fluttering, still-near-home part of a flee
  const EXIT_DURATION = 1000; // ms — the final carry-out-of-view part (~2.5s total)
  const WANDER_CURVES = 2; // gentle curve segments during the wander phase
  const WANDER_DRIFT = 45; // px, how far each wander waypoint drifts from the last
  const WANDER_BOB_AMPLITUDE = 8; // px, small sinusoidal vertical bobbing during wander
  const WANDER_ARC = 28; // px, perpendicular bow of each wander curve
  const EXIT_OVERSHOOT = 120; // px past the nearest edge
  const EXIT_ARC = 60; // px, perpendicular bow of the final curve
  const FLIGHT_END_SCALE = 0.6;

  const imgSrc = window.location.pathname.includes("/case-studies/")
    ? "../assets/img/butterfly-pale.png"
    : "assets/img/butterfly-pale.png";

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

  // A click doesn't just slide the butterfly off-screen: it flees along a
  // short wandering path near where it started (2 gentle curves, a little
  // rotation, small vertical bobbing — ~1.5s), then carries on out past
  // the nearest edge and fades (~1s), for ~2.5s total. Built as a chain of
  // quadratic bezier segments (a spline) through a few waypoints, so the
  // whole thing reads as one continuous flight rather than two stitched
  // animations; only the final exit segment eases out.
  function flyAway(butterfly, img) {
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

    let exitX = 0;
    let exitY = 0;
    if (nearestEdge === "left") exitX = -(rect.left + EXIT_OVERSHOOT);
    if (nearestEdge === "right") exitX = vw - rect.right + EXIT_OVERSHOOT;
    if (nearestEdge === "top") exitY = -(rect.top + EXIT_OVERSHOOT);
    if (nearestEdge === "bottom") exitY = vh - rect.bottom + EXIT_OVERSHOOT;

    const points = [{ x: 0, y: 0 }];
    for (let i = 0; i < WANDER_CURVES; i += 1) {
      const prev = points[points.length - 1];
      points.push({
        x: prev.x + (Math.random() * 2 - 1) * WANDER_DRIFT,
        y: prev.y + (Math.random() * 2 - 1) * WANDER_DRIFT * 0.4,
      });
    }
    points.push({ x: exitX, y: exitY });

    const segmentDurations = points.slice(1, -1).map(() => WANDER_DURATION / WANDER_CURVES);
    segmentDurations.push(EXIT_DURATION);
    const totalDuration = WANDER_DURATION + EXIT_DURATION;

    // Bow each segment's control point perpendicular to its own straight
    // start->end line, so every leg curves rather than flying straight.
    const segmentControls = points.slice(0, -1).map((p, i) => {
      const next = points[i + 1];
      const isExitSegment = i === points.length - 2;
      const bow = (isExitSegment ? EXIT_ARC : WANDER_ARC) * (Math.random() < 0.5 ? -1 : 1);
      let cx = (p.x + next.x) / 2;
      let cy = (p.y + next.y) / 2;
      if (Math.abs(next.x - p.x) > Math.abs(next.y - p.y)) cy += bow;
      else cx += bow;
      return { x: cx, y: cy };
    });

    const rotationTarget = (Math.random() * 30 - 15) + (exitX > 0 ? 20 : exitX < 0 ? -20 : 0);
    const start = performance.now();

    img.classList.remove("is-flapping");
    img.classList.add("is-launching");

    function tick(now) {
      const elapsed = now - start;
      const totalT = Math.min(elapsed / totalDuration, 1);

      let segIndex = 0;
      let segStart = 0;
      while (segIndex < segmentDurations.length - 1 && elapsed >= segStart + segmentDurations[segIndex]) {
        segStart += segmentDurations[segIndex];
        segIndex += 1;
      }
      const isExitSegment = segIndex === segmentDurations.length - 1;
      const segLinear = Math.min(Math.max((elapsed - segStart) / segmentDurations[segIndex], 0), 1);
      const segT = isExitSegment ? easeOutCubic(segLinear) : segLinear;

      const p0 = points[segIndex];
      const p1 = points[segIndex + 1];
      const c = segmentControls[segIndex];
      const inv = 1 - segT;
      const x = inv * inv * p0.x + 2 * inv * segT * c.x + segT * segT * p1.x;
      const bob = isExitSegment ? 0 : Math.sin(totalT * Math.PI * 4) * WANDER_BOB_AMPLITUDE;
      const y = inv * inv * p0.y + 2 * inv * segT * c.y + segT * segT * p1.y + bob;

      const scale = 1 - (1 - FLIGHT_END_SCALE) * totalT;
      const wobble = isExitSegment ? 0 : Math.sin(totalT * Math.PI * 3) * 6;
      const rotate = rotationTarget * totalT + wobble;
      const opacity = isExitSegment ? 1 - segT : 1;

      butterfly.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`;
      butterfly.style.opacity = String(opacity);

      if (totalT < 1) {
        requestAnimationFrame(tick);
      } else {
        img.classList.remove("is-launching");
        butterfly.remove();
      }
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener("load", () => {
    const zones = buildZones();
    if (zones.length === 0) return;

    const placedRects = [];

    for (let i = 0; i < BUTTERFLY_COUNT; i += 1) {
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

      butterfly.addEventListener("click", () => flyAway(butterfly, img));
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
