"use client";

// A WebGL scene behind a section (scenes/). Three.js and the scene load only when the canvas comes
// near the screen, and never for people who asked for less motion or less data, or whose browser
// can't do WebGL; they keep the section's own painted background, which is always there underneath.

import { useEffect, useRef } from "react";
import { cn } from "@dovli/ui";
import { prefersLessMotion } from "./motion";

type Kind = "paper" | "stars";

function canRun() {
  if (prefersLessMotion()) return false;
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return false;
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

export function Scene({ kind, count, className }: { kind: Kind; count?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !canRun()) return;
    let stop: (() => void) | undefined;
    let gone = false;
    const near = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        near.disconnect();
        const load: Promise<{ mount: (canvas: HTMLCanvasElement, opts: { count?: number }) => () => void }> =
          kind === "stars" ? import("./scenes/starField") : import("./scenes/paperSky");
        load
          .then((scene) => {
            if (gone) return;
            stop = scene.mount(canvas, { count });
            canvas.dataset.ready = "";
          })
          .catch((e) => console.warn("Landing page: the 3D scene didn't start", e));
      },
      { rootMargin: "300px" },
    );
    near.observe(canvas);
    return () => {
      gone = true;
      near.disconnect();
      stop?.();
    };
  }, [kind, count]);

  return <canvas ref={ref} aria-hidden="true" className={cn("lp-scene pointer-events-none absolute inset-0 size-full", className)} />;
}
