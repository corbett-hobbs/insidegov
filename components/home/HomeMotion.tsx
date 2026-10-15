"use client";

import { useEffect } from "react";

/**
 * Switches on the homepage's draw-in motion. Each `[data-home-reveal]` card gets
 * `data-seen` the first time it scrolls into view, and the styles in globals.css
 * (`html[data-home-motion] .home-card ...`) draw its chart and rows from then on.
 * Nothing is hidden until this runs, so with no JavaScript, no IntersectionObserver
 * or `prefers-reduced-motion: reduce` the cards simply show.
 */
export function HomeMotion() {
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    root.dataset.homeMotion = "on";
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.seen = "";
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    document.querySelectorAll("[data-home-reveal]").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      delete root.dataset.homeMotion;
    };
  }, []);
  return null;
}
