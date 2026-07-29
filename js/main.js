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
