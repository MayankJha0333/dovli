"use client";

import { useEffect, useRef, useState } from "react";

/** True when the person asked for less motion (on their device, or in Dovli's settings). */
export function prefersLessMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true";
}

/**
 * Marks an element with data-inview="false" until it scrolls into view, then "true" (once).
 * landing.css uses this to play a section's little sequence when you reach it. Nothing is hidden
 * before the page runs its script, so the content is always there without it.
 */
export function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersLessMotion() || !("IntersectionObserver" in window)) {
      el.dataset.inview = "true";
      setSeen(true);
      return;
    }
    el.dataset.inview = "false";
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        el.dataset.inview = "true";
        setSeen(true);
        io.disconnect();
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  /** Play the sequence again (for a "Play again" button). */
  const replay = () => {
    const el = ref.current;
    if (!el || prefersLessMotion()) return;
    // Jump back to the start without animating, then play forward again.
    el.dataset.reset = "";
    el.dataset.inview = "false";
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        delete el.dataset.reset;
        el.dataset.inview = "true";
      }),
    );
  };
  return { ref, seen, replay };
}

/**
 * Runs the page's scroll and pointer motion (scrollMotion.ts) once the page is up. GSAP loads in its
 * own chunk, so the first paint never waits for it, and not at all with less motion.
 */
export function useScrollMotion<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || prefersLessMotion()) return;
    let stop: (() => void) | undefined;
    let gone = false;
    import("./scrollMotion")
      .then((m) => {
        if (!gone) stop = m.start(root);
      })
      .catch((e) => console.warn("Landing page: the scroll motion didn't start", e));
    return () => {
      gone = true;
      stop?.();
    };
  }, []);
  return ref;
}
