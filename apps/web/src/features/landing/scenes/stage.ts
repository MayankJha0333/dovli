// What every WebGL scene on the landing page shares: one renderer on a canvas, a camera, the
// pointer (eased, -1..1 across the window) and where the canvas sits on screen. It only draws while
// the canvas is on screen and the tab is visible, and it hands everything back to the GPU on stop.

import { PerspectiveCamera, Scene, WebGLRenderer, type Material, type Mesh } from "three";

export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  pointer: { x: number; y: number };
  /** The canvas's box on screen this frame. */
  rect: DOMRect;
  pixelRatio: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** How far a box has scrolled past the top of the screen: 0 while its top is in view, 1 once it's gone. */
export const scrolledPast = (rect: DOMRect) => clamp01(-rect.top / Math.max(1, rect.height));

/** How far a box has travelled through the screen: 0 as its top comes in at the bottom, 1 as its bottom leaves at the top. */
export const travelled = (rect: DOMRect) => clamp01((innerHeight - rect.top) / (innerHeight + rect.height));

export function startStage(
  canvas: HTMLCanvasElement,
  { fov, z }: { fov: number; z: number },
  frame: (stage: Stage, time: number, dt: number) => void,
): () => void {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  // Phones get fewer pixels: the scenes are soft, and the battery matters more than the last bit of crispness.
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia("(max-width: 767px)").matches ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);

  const stage: Stage = {
    scene: new Scene(),
    camera: new PerspectiveCamera(fov, 1, 0.1, 140),
    pointer: { x: 0, y: 0 },
    rect: canvas.getBoundingClientRect(),
    pixelRatio: renderer.getPixelRatio(),
  };
  stage.camera.position.z = z;

  const aim = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    aim.x = (e.clientX / innerWidth) * 2 - 1;
    aim.y = 1 - (e.clientY / innerHeight) * 2;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    stage.camera.aspect = w / h;
    stage.camera.updateProjectionMatrix();
  };
  const sizes = new ResizeObserver(resize);
  sizes.observe(canvas);
  resize();

  let raf = 0;
  let onScreen = false;
  let last = 0;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    // A long gap (a frame dropped, the tab coming back) shouldn't make everything jump.
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    const ease = Math.min(1, dt * 2.5);
    stage.pointer.x += (aim.x - stage.pointer.x) * ease;
    stage.pointer.y += (aim.y - stage.pointer.y) * ease;
    stage.rect = canvas.getBoundingClientRect();
    frame(stage, now / 1000, dt);
    renderer.render(stage.scene, stage.camera);
  };
  const play = () => {
    if (raf || !onScreen || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
  const pause = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const watch = new IntersectionObserver(([e]) => {
    onScreen = !!e?.isIntersecting;
    if (onScreen) play();
    else pause();
  });
  watch.observe(canvas);
  const onVisibility = () => (document.hidden ? pause() : play());
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    pause();
    watch.disconnect();
    sizes.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pointermove", onPointer);
    stage.scene.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      (m.material as Material | undefined)?.dispose?.();
    });
    renderer.dispose();
  };
}
