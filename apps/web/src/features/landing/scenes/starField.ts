// Stars with real depth behind the AI section (the Starlight page style, in 3D): they twinkle,
// stream slowly towards you, turn a little, follow the pointer, and drift faster while the section
// passes through the screen.

import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from "three";
import { startStage, travelled } from "./stage";

// Stars live between DEEP and NEAR along z and wrap round, so the stream never runs out.
const DEEP = -70;
const NEAR = 10;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aTint;
  uniform float uTime;
  uniform float uDrift;
  uniform float uScale;
  varying float vAlpha;
  varying float vTint;
  void main() {
    vec3 p = position;
    p.z = mod(p.z - ${DEEP.toFixed(1)} + uDrift, ${(NEAR - DEEP).toFixed(1)}) + ${DEEP.toFixed(1)};
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    float twinkle = 0.5 + 0.5 * sin(uTime * (0.7 + fract(aPhase * 7.13) * 1.8) + aPhase * 6.2831);
    // Fade in from the deep end and out before a star reaches the camera, so none pop.
    vAlpha = (0.35 + 0.65 * twinkle) * smoothstep(${DEEP.toFixed(1)}, ${(DEEP + 25).toFixed(1)}, p.z) * (1.0 - smoothstep(2.0, 9.0, p.z));
    vTint = aTint;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vTint;
  void main() {
    float glow = pow(1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5)), 2.4);
    // White, and the two pale tints of the Starlight style.
    vec3 col = vTint < 0.45 ? vec3(1.0) : vTint < 0.78 ? vec3(0.84, 0.81, 1.0) : vec3(0.70, 0.84, 1.0);
    gl_FragColor = vec4(col, glow * vAlpha);
  }
`;

export function mount(canvas: HTMLCanvasElement, { count = 1500 }: { count?: number } = {}): () => void {
  const n = innerWidth < 768 ? Math.round(count * 0.45) : count;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * 34;
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * 20;
    positions[i * 3 + 2] = DEEP + Math.random() * (NEAR - DEEP);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  // Mostly small stars and a few bright ones.
  geometry.setAttribute("aSize", new BufferAttribute(Float32Array.from({ length: n }, () => 0.8 + Math.random() ** 3 * 3.4), 1));
  geometry.setAttribute("aPhase", new BufferAttribute(Float32Array.from({ length: n }, () => Math.random()), 1));
  geometry.setAttribute("aTint", new BufferAttribute(Float32Array.from({ length: n }, () => Math.random()), 1));
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uTime: { value: 0 }, uDrift: { value: 0 }, uScale: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const stars = new Points(geometry, material);
  stars.frustumCulled = false;

  return startStage(canvas, { fov: 50, z: 12 }, (stage, time, dt) => {
    if (!stars.parent) stage.scene.add(stars);
    const u = material.uniforms;
    u.uTime!.value = time;
    u.uScale!.value = 72 * stage.pixelRatio;
    u.uDrift!.value += dt * (1.1 + travelled(stage.rect) * 2.2);
    stars.rotation.y += dt * 0.01;
    stars.rotation.z = Math.sin(time * 0.05) * 0.05;
    stage.camera.position.x = stage.pointer.x * 1.4;
    stage.camera.position.y = stage.pointer.y * 0.9;
    stage.camera.lookAt(0, 0, -20);
  });
}
