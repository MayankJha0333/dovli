// The landing page's scroll and pointer motion, with GSAP. Loaded on its own after the page is up
// (useScrollMotion in motion.ts), and never for people who asked for less motion.
//
// Everything here starts from what's already on the page: without it, every section is simply
// there. While it runs, <html data-gsap> tells landing.css to stand its own scroll-driven
// animations down, since both would move the same things.

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

const EXPO = "expo.out";

const all = <T extends Element = HTMLElement>(root: ParentNode, selector: string) => Array.from(root.querySelectorAll<T & HTMLElement>(selector));

/** Section headings rise into place line by line, the first time they come into view. */
function headings(root: HTMLElement) {
  for (const id of ["eco-title", "features-title", "android-title", "templates-title", "ai-title", "extension-title", "cta-title"]) {
    const el = root.querySelector<HTMLElement>(`#${id}`);
    if (!el) continue;
    let played = false;
    SplitText.create(el, {
      type: "lines",
      mask: "lines",
      aria: "auto",
      // Splits again if the lines change (fonts arriving, a resize) before it has played.
      autoSplit: true,
      onSplit(self) {
        if (played) return;
        // Room for descenders, which the mask would otherwise cut off.
        gsap.set(self.masks, { paddingBottom: "0.12em", marginBottom: "-0.12em" });
        return gsap.from(self.lines, {
          yPercent: 118,
          rotate: 2.5,
          transformOrigin: "0% 0%",
          duration: 1.2,
          ease: EXPO,
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
          // Back to the plain heading, so it wraps like any other text from here on.
          onComplete: () => {
            played = true;
            self.kill();
            self.revert();
          },
        });
      },
    });
  }
}

/** Items that come in one after another as their group reaches the screen. */
function arrive(targets: HTMLElement[], from: gsap.TweenVars, trigger?: Element, start = "top 85%") {
  if (!targets.length) return;
  gsap.from(targets, { duration: 1.1, ease: EXPO, stagger: 0.09, ...from, scrollTrigger: { trigger: trigger ?? targets[0], start, once: true } });
}

/** A scrubbed tween: it follows the scrollbar, forwards and back. */
function scrub(target: Element | null, from: gsap.TweenVars, to: gsap.TweenVars, trigger: gsap.DOMTarget | null, start: string, end: string, smooth: number | true = 0.6) {
  if (!target || !trigger) return;
  gsap.fromTo(target, from, { ease: "none", ...to, scrollTrigger: { trigger, start, end, scrub: smooth } });
}

function hero(root: HTMLElement) {
  const section = root.querySelector('section[aria-labelledby="hero-title"]');
  const copy = root.querySelector("#hero-title")?.parentElement ?? null;
  // The words stay behind a little as you scroll on, so the picture slides up over them.
  scrub(copy, { y: 0 }, { y: 120 }, section, "top top", "+=760", true);
  // The picture lies back like a page on a desk, and stands up as it comes up the screen.
  const picture = root.querySelector(".lp-tilt");
  scrub(
    picture,
    { rotationX: 20, scale: 0.9, y: 30, transformPerspective: 1600, transformOrigin: "50% 0%" },
    { rotationX: 0, scale: 1, y: 0 },
    picture,
    "top 96%",
    "top 28%",
  );
  scrub(root.querySelector(".lp-drift"), { y: 0, rotate: 0 }, { y: -130, rotate: -5 }, section, "top top", "bottom top", 0.8);
}

function features(root: HTMLElement) {
  const section = root.querySelector("#features");
  if (!section) return;
  arrive(all(section, ".lp-acc"), { x: -48, opacity: 0, stagger: 0.07 });
  // The panel opens out from a smaller card as it comes up.
  const panel = section.querySelector(".lp-story-panel");
  scrub(panel, { clipPath: "inset(9% 7% 9% 7% round 48px)", y: 60 }, { clipPath: "inset(0% 0% 0% 0% round 36px)", y: 0 }, panel, "top 98%", "top 40%");
  // Phones: each feature's step arrives on its own.
  for (const step of all(section, ".md\\:hidden > div")) arrive([step], { y: 56, opacity: 0, duration: 1 }, step, "top 90%");
}

function platforms(root: HTMLElement) {
  const list = root.querySelector("#eco-title")?.closest("section")?.querySelector("ul");
  if (!list) return;
  arrive(all(list, ":scope > li"), { y: 90, scale: 0.94, opacity: 0, stagger: 0.12, duration: 1.3 }, list, "top 90%");
}

function android(root: HTMLElement) {
  const section = root.querySelector("#android");
  if (!section) return;
  const pocket = section.querySelector(".lp-pocket");
  scrub(pocket, { scale: 0.93 }, { scale: 1 }, pocket, "top bottom", "top 30%");
  // The phones come up stacked behind the middle one, then fan out (landing.css reads --fan).
  const fan = section.querySelector(".lp-fan");
  scrub(fan, { "--fan": 0 }, { "--fan": 1 }, fan, "top 92%", "center 62%", 0.9);
  all(section, ".lp-float").forEach((note, i) => scrub(note, { y: 70 + i * 40 }, { y: -60 - i * 50 }, fan, "top bottom", "bottom top", 1));
  arrive(all(section, "ul > li"), { y: 26, opacity: 0, stagger: 0.07 });
}

/**
 * The template rows run on GSAP's clock instead of CSS, so they can react to scrolling: they speed
 * up and lean with a fast scroll, then ease back. They still stop for hover, focus and Pause.
 */
function marquees(root: HTMLElement) {
  const section = root.querySelector<HTMLElement>("#templates");
  if (!section) return () => {};
  const rows = all(section, ".lp-marquee").map((box) => {
    const track = box.querySelector<HTMLElement>(".lp-marquee-track")!;
    const dir = track.hasAttribute("data-reverse") ? 1 : -1;
    const seconds = parseFloat(track.style.getPropertyValue("--dur")) || 60;
    return { box, track, dir, seconds, x: 0, loop: 0, setX: gsap.quickSetter(track, "x", "px"), setSkew: gsap.quickSetter(track, "skewX", "deg") };
  });
  const measure = () => {
    for (const r of rows) {
      // The track holds four copies with a 16px gap; moving by two copies and their gaps lines it up again.
      r.loop = (r.track.scrollWidth + 16) / 2;
      if (r.dir > 0 && r.x === 0) r.x = -r.loop;
    }
  };
  measure();
  let boost = 1;
  let skew = 0;
  let onScreen = false;
  const watch = ScrollTrigger.create({ trigger: section, start: "top bottom", end: "bottom top", onToggle: (self) => (onScreen = self.isActive), onRefresh: measure });
  const tick = (_time: number, deltaMs: number) => {
    if (!onScreen) return;
    const v = watch.getVelocity();
    boost += (1 + Math.min(Math.abs(v) / 260, 7) - boost) * 0.08;
    skew += (gsap.utils.clamp(-5, 5, -v / 420) - skew) * 0.12;
    const held = section.hasAttribute("data-paused");
    for (const r of rows) {
      const stopped = held || r.box.matches(":hover, :focus-within");
      if (!stopped && r.loop) {
        r.x += ((r.dir * r.loop) / r.seconds) * boost * (deltaMs / 1000);
        r.x = gsap.utils.wrap(-r.loop, 0, r.x);
      }
      r.setX(r.x);
      r.setSkew(stopped ? 0 : skew);
    }
  };
  gsap.ticker.add(tick);
  return () => gsap.ticker.remove(tick);
}

function ai(root: HTMLElement) {
  const section = root.querySelector("#mcp");
  if (!section) return;
  // The page with the assistant swings up out of the starfield.
  const scene = section.querySelector('[role="img"]');
  scrub(scene, { rotationX: 24, y: 140, scale: 0.88, transformPerspective: 1400, transformOrigin: "50% 0%" }, { rotationX: 0, y: 0, scale: 1 }, scene, "top bottom", "top 34%", 0.8);
  const intro = section.querySelector("#ai-title")?.parentElement;
  if (intro) arrive(all(intro, "li"), { x: -30, opacity: 0 }, intro.querySelector("ul") ?? undefined);
  const strip = scene?.closest(".grid")?.nextElementSibling as HTMLElement | null;
  if (strip) arrive([strip], { y: 70, opacity: 0, duration: 1.3 }, strip, "top 92%");
}

function extension(root: HTMLElement) {
  const section = root.querySelector("#extension");
  if (!section) return;
  const card = section.querySelector(".lp-clouds");
  // The browser rises out of the card's bottom edge as the card comes up.
  scrub(section.querySelector('[role="img"]'), { yPercent: 38 }, { yPercent: 0 }, card, "top bottom", "center 55%", 0.8);
  arrive(all(section, "ul > li"), { y: 16, scale: 0.9, opacity: 0, stagger: 0.06, duration: 0.9 }, section.querySelector("ul") ?? undefined);
}

function closing(root: HTMLElement) {
  const section = root.querySelector('section[aria-labelledby="cta-title"]');
  if (!section) return;
  const sheet = section.querySelector(".dovli-sheet");
  scrub(sheet, { y: 120, rotate: -2.5, scale: 0.92 }, { y: 0, rotate: 0, scale: 1 }, section, "top bottom", "top 25%", 0.8);
  const list = section.querySelector("ul");
  const items = all(section, "ul > li");
  if (!list || !items.length) return;
  const tl = gsap.timeline({ scrollTrigger: { trigger: list, start: "top 85%", once: true } });
  tl.from(items, { y: 24, opacity: 0, duration: 1, ease: EXPO, stagger: 0.12 });
  // Each box ticks as its line lands.
  tl.from(all(list, "li > span:first-child"), { scale: 0.2, rotate: -45, duration: 0.8, ease: EXPO, stagger: 0.12 }, 0.15);
}

function footer(root: HTMLElement) {
  const giant = root.querySelector(".lp-giant");
  // The name rises out of the panel and its letters close up as you reach the end of the page.
  scrub(giant?.firstElementChild ?? null, { yPercent: 60, letterSpacing: "0.04em" }, { yPercent: 0, letterSpacing: "-0.06em" }, giant, "top bottom", "bottom bottom", 0.8);
}

function progress(root: HTMLElement) {
  const bar = root.querySelector(".lp-progress");
  if (bar) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
}

/** Leans an element towards the pointer while it's over it, in 3D. */
function tilt(el: HTMLElement, max: number) {
  gsap.set(el, { transformPerspective: 1100 });
  const rx = gsap.quickTo(el, "rotationX", { duration: 0.7, ease: "power3.out" });
  const ry = gsap.quickTo(el, "rotationY", { duration: 0.7, ease: "power3.out" });
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    ry(((e.clientX - r.left) / r.width - 0.5) * 2 * max);
    rx(-((e.clientY - r.top) / r.height - 0.5) * 2 * max);
  };
  const leave = () => {
    rx(0);
    ry(0);
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", leave);
  return () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerleave", leave);
  };
}

/** Pulls a button a few pixels towards the pointer as it comes near. */
function magnet(el: HTMLElement, pull: number) {
  const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
  const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    x(((e.clientX - r.left) / r.width - 0.5) * pull);
    y(((e.clientY - r.top) / r.height - 0.5) * pull * 0.6);
  };
  const leave = () => {
    x(0);
    y(0);
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", leave);
  return () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerleave", leave);
  };
}

export function start(root: HTMLElement): () => void {
  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    document.documentElement.dataset.gsap = "";
    progress(root);
    headings(root);
    hero(root);
    platforms(root);
    features(root);
    android(root);
    const stopMarquees = marquees(root);
    ai(root);
    extension(root);
    closing(root);
    footer(root);
    return () => {
      stopMarquees();
      delete document.documentElement.dataset.gsap;
    };
  });
  // Pointer effects only where there's a pointer that hovers, and room for them.
  mm.add("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) and (min-width: 1024px)", () => {
    const undo = [
      ...all(root, 'section[aria-labelledby="eco-title"] ul > li').map((li) => tilt(li, 5)),
      ...all(root, ".lp-story-panel").map((panel) => tilt(panel, 3)),
      ...all(root, 'section[aria-labelledby="hero-title"] .lp-fade a, section[aria-labelledby="cta-title"] .flex-wrap > a').map((a) => magnet(a, 14)),
    ];
    return () => undo.forEach((u) => u());
  });
  return () => mm.revert();
}
