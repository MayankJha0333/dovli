// The paper sky: sheets of paper with Dovli's folded corner, drifting up through the sky behind the
// hero and the closing card. Each tumbles slowly, so its back (the mark's blue to pink) turns into
// view now and then, bends a little as it floats, leans with the pointer, and rises faster as its
// section scrolls away.

import { DoubleSide, InstancedBufferAttribute, InstancedMesh, Object3D, PlaneGeometry, ShaderMaterial } from "three";
import { scrolledPast, startStage } from "./stage";

const vertexShader = /* glsl */ `
  attribute float aPhase;
  attribute float aTone;
  uniform float uTime;
  varying vec2 vUv;
  varying float vTone;
  varying float vShade;
  varying float vDepth;
  void main() {
    vUv = uv;
    vTone = aTone;
    vec3 p = position;
    float bend = sin(p.x * 1.7 + uTime * 0.9 + aPhase) * 0.08 + sin(p.y * 1.2 + uTime * 0.55 + aPhase * 1.7) * 0.05;
    p.z += bend;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * vec3(0.0, 0.0, 1.0));
    vShade = 0.9 + 0.1 * abs(dot(n, normalize(vec3(-0.35, 0.55, 0.75)))) + bend * 0.7;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uNear;
  uniform float uFar;
  varying vec2 vUv;
  varying float vTone;
  varying float vShade;
  varying float vDepth;

  // The mark's colours (Logo.tsx), already in sRGB.
  const vec3 BLUE = vec3(0.490, 0.706, 1.0);
  const vec3 VIOLET = vec3(0.647, 0.573, 1.0);
  const vec3 PINK = vec3(0.965, 0.725, 0.933);
  const vec2 SIZE = vec2(1.0, 1.32);
  const float FOLD = 0.2;

  vec3 brand(float t) {
    t = clamp(t, 0.0, 1.0);
    return t < 0.5 ? mix(BLUE, VIOLET, t * 2.0) : mix(VIOLET, PINK, t * 2.0 - 1.0);
  }

  float roundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 p = (vUv - 0.5) * SIZE;
    float edge = roundBox(p, SIZE * 0.5, 0.05);
    // The top-right corner is folded back: the sheet is cut along the diagonal, as in Sheet.tsx.
    float cut = (p.x - SIZE.x * 0.5) + (p.y - SIZE.y * 0.5) + FOLD;
    if (edge > 0.0 || cut > 0.0) discard;
    bool flap = p.x > SIZE.x * 0.5 - FOLD && p.y > SIZE.y * 0.5 - FOLD;

    vec3 col;
    if (!gl_FrontFacing) {
      col = brand(vUv.y * 0.85 + vTone * 0.15);
    } else if (flap) {
      col = brand(0.3 + (p.x - p.y + 0.16) * 1.4);
    } else {
      vec3 tint = brand(vTone);
      col = mix(vec3(0.992, 0.988, 1.0), tint, 0.1);
      // A title line and faint ruled lines, so it reads as a page.
      float inside = step(0.12, vUv.x) * step(vUv.x, 0.88);
      float ruled = (1.0 - smoothstep(0.0, 0.035, abs(fract(vUv.y * 10.0 + 0.5) - 0.5))) * inside * step(0.1, vUv.y) * step(vUv.y, 0.74);
      float title = step(0.12, vUv.x) * step(vUv.x, 0.52) * step(0.8, vUv.y) * step(vUv.y, 0.85);
      col = mix(col, tint * 0.82, ruled * 0.3 + title * 0.5);
    }
    col *= vShade;
    float alpha = mix(1.0, 0.18, smoothstep(uNear, uFar, vDepth)) * smoothstep(0.0, -0.006, edge);
    gl_FragColor = vec4(col, alpha);
  }
`;

interface Sheet {
  /** Across the view, as a share of its half-width, so the layout follows the canvas's shape. */
  x: number;
  y: number;
  z: number;
  rise: number;
  scale: number;
  rx: number;
  ry: number;
  rz: number;
  spin: [number, number, number];
}

const FOV = 35;
const CAMERA_Z = 18;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** Half the view's height at a depth, in world units. */
const halfHeightAt = (z: number) => Math.tan((FOV * Math.PI) / 360) * (CAMERA_Z - z);

function newSheet(spread: boolean): Sheet {
  const z = rand(-13, 3);
  const h = halfHeightAt(z);
  // Sheets keep out of the middle, where the headline is; only the far, faded ones may cross it.
  const side = z > -3 ? rand(0.55, 1.15) : z > -9 ? rand(0.4, 1.15) : rand(0, 1.15);
  return {
    x: side * (Math.random() < 0.5 ? -1 : 1),
    y: spread ? rand(-h, h) : -h - rand(1.5, 4),
    z,
    rise: rand(0.22, 0.55),
    scale: rand(0.75, 1.35),
    rx: rand(0, Math.PI * 2),
    ry: rand(0, Math.PI * 2),
    rz: rand(-0.6, 0.6),
    spin: [rand(-0.35, 0.35), rand(-0.5, 0.5), rand(-0.15, 0.15)],
  };
}

export function mount(canvas: HTMLCanvasElement, { count = 22 }: { count?: number } = {}): () => void {
  const n = innerWidth < 768 ? Math.ceil(count * 0.55) : count;
  const geometry = new PlaneGeometry(1.5, 1.98, 14, 18);
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uTime: { value: 0 }, uNear: { value: CAMERA_Z }, uFar: { value: CAMERA_Z + 15 } },
    side: DoubleSide,
    transparent: true,
  });
  const sheets = Array.from({ length: n }, () => newSheet(true));
  geometry.setAttribute("aPhase", new InstancedBufferAttribute(Float32Array.from(sheets, () => rand(0, Math.PI * 2)), 1));
  geometry.setAttribute("aTone", new InstancedBufferAttribute(Float32Array.from(sheets, () => Math.random()), 1));
  const mesh = new InstancedMesh(geometry, material, n);
  // Instances drift far from the geometry's own bounds, so the mesh is never culled as a whole.
  mesh.frustumCulled = false;
  const place = new Object3D();

  return startStage(canvas, { fov: FOV, z: CAMERA_Z }, (stage, time, dt) => {
    if (!mesh.parent) stage.scene.add(mesh);
    material.uniforms.uTime!.value = time;
    const away = scrolledPast(stage.rect);
    const aspect = stage.camera.aspect;
    sheets.forEach((s, i) => {
      s.y += (s.rise + away * 2.6) * dt;
      s.rx += s.spin[0] * dt;
      s.ry += s.spin[1] * dt;
      s.rz += s.spin[2] * dt;
      const h = halfHeightAt(s.z);
      if (s.y > h + 2.5) Object.assign(s, newSheet(false));
      // A tall canvas (a phone) has no room beside the words, so its sheets keep to the edges.
      const x = aspect < 1 ? Math.sign(s.x) * (0.8 + Math.abs(s.x) * 0.45) : s.x;
      place.position.set(x * h * aspect, s.y, s.z);
      place.rotation.set(s.rx, s.ry, s.rz);
      place.scale.setScalar(s.scale);
      place.updateMatrix();
      mesh.setMatrixAt(i, place.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // The sky leans towards the pointer, and tips up a little as the section leaves.
    stage.camera.position.x = stage.pointer.x * 1.1;
    stage.camera.position.y = stage.pointer.y * 0.7;
    stage.camera.lookAt(0, away * 1.5, -4);
  });
}
