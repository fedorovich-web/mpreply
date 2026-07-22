import * as THREE from "three";

import {
  CAMERA_FOV,
  CAMERA_Z,
  HERO_ORBITS,
  getHeroOrbitPoint3D,
  type OrbitAccent,
  type OrbitKey,
} from "./HeroFlowModel";

export type HeroSceneRuntime = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  parallax: THREE.Group;
  core: THREE.Group;
  coreBand: THREE.Group;
  planets: Map<OrbitKey, THREE.Group>;
  ownedTextures: Set<THREE.Texture>;
};

type AccentDefinition = { base: number; light: number; glow: number };
type AccentPalette = Record<OrbitAccent, AccentDefinition>;

const FALLBACK_ACCENTS: AccentPalette = {
  violet: { base: 0x7049d8, light: 0xcbbaff, glow: 0x9677f0 },
  blue: { base: 0x2473c9, light: 0xaed7ff, glow: 0x4e9ef2 },
  cyan: { base: 0x20a9c5, light: 0xb9f1f8, glow: 0x43c9df },
  purple: { base: 0x7b4cc7, light: 0xd6bff5, glow: 0x9b71dc },
  mint: { base: 0x21a88d, light: 0xb9f2e3, glow: 0x4bd1b4 },
};

function readCssColor(variableName: string, fallback: number): number {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  if (!value) return fallback;
  try {
    return new THREE.Color(value).getHex();
  } catch {
    return fallback;
  }
}

function getAccentPalette(): AccentPalette {
  return {
    violet: {
      base: readCssColor("--hero-orbit-violet-base", FALLBACK_ACCENTS.violet.base),
      light: readCssColor("--hero-orbit-violet-light", FALLBACK_ACCENTS.violet.light),
      glow: readCssColor("--hero-orbit-violet-glow", FALLBACK_ACCENTS.violet.glow),
    },
    blue: {
      base: readCssColor("--hero-orbit-blue-base", FALLBACK_ACCENTS.blue.base),
      light: readCssColor("--hero-orbit-blue-light", FALLBACK_ACCENTS.blue.light),
      glow: readCssColor("--hero-orbit-blue-glow", FALLBACK_ACCENTS.blue.glow),
    },
    cyan: {
      base: readCssColor("--hero-orbit-cyan-base", FALLBACK_ACCENTS.cyan.base),
      light: readCssColor("--hero-orbit-cyan-light", FALLBACK_ACCENTS.cyan.light),
      glow: readCssColor("--hero-orbit-cyan-glow", FALLBACK_ACCENTS.cyan.glow),
    },
    purple: {
      base: readCssColor("--hero-orbit-purple-base", FALLBACK_ACCENTS.purple.base),
      light: readCssColor("--hero-orbit-purple-light", FALLBACK_ACCENTS.purple.light),
      glow: readCssColor("--hero-orbit-purple-glow", FALLBACK_ACCENTS.purple.glow),
    },
    mint: {
      base: readCssColor("--hero-orbit-mint-base", FALLBACK_ACCENTS.mint.base),
      light: readCssColor("--hero-orbit-mint-light", FALLBACK_ACCENTS.mint.light),
      glow: readCssColor("--hero-orbit-mint-glow", FALLBACK_ACCENTS.mint.glow),
    },
  };
}

function makeRadialTexture(
  inner: string,
  middle: string,
  outer: string,
  size = 256,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");

  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.44, middle);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function drawIcon(
  context: CanvasRenderingContext2D,
  key: OrbitKey,
  size: number,
): void {
  context.clearRect(0, 0, size, size);
  context.save();

  const padding = size * 0.18;
  const scale = (size - padding * 2) / 24;
  context.translate(padding, padding);
  context.scale(scale, scale);
  context.strokeStyle = "rgba(255,255,255,0.98)";
  context.lineWidth = 1.7;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = "rgba(255,255,255,0.22)";
  context.shadowBlur = 0.8;

  const paths: Record<OrbitKey, string[]> = {
    question: [
      "M3 20l1.3-3.9a9 8 0 1 1 3.4 2.9L3 20",
      "M12 12l0 .01",
    ],
    catalog: [
      "M12 3l8 4.5v9l-8 4.5l-8-4.5v-9l8-4.5",
      "M12 12l8-4.5",
      "M12 12v9",
      "M12 12l-8-4.5",
      "M16 5.25l-8 4.5",
    ],
    data: [
      "M4 6c0-1.657 3.582-3 8-3s8 1.343 8 3-3.582 3-8 3-8-1.343-8-3z",
      "M4 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3V6",
      "M4 12v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6",
    ],
    context: [
      "M14 3v4a1 1 0 0 0 1 1h4",
      "M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z",
      "M9 13h6",
      "M9 17h3",
    ],
    answer: [
      "M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z",
      "M9 12l2 2l4-4",
    ],
  };

  paths[key].forEach((pathData) => {
    context.stroke(new Path2D(pathData));
  });

  context.restore();
}

function makeIconTexture(key: OrbitKey): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");
  drawIcon(context, key, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function makePlanetTexture(accent: AccentDefinition, size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size / 2;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");

  const width = canvas.width;
  const height = canvas.height;
  const base = new THREE.Color(accent.base);
  const dark = base.clone().multiplyScalar(0.58);
  const soft = new THREE.Color(accent.light).lerp(new THREE.Color(accent.base), 0.28);

  const body = context.createLinearGradient(0, 0, width, height);
  body.addColorStop(0, colorToCss(accent.light));
  body.addColorStop(0.36, colorToCss(soft.getHex()));
  body.addColorStop(0.72, colorToCss(accent.base));
  body.addColorStop(1, colorToCss(dark.getHex()));
  context.fillStyle = body;
  context.fillRect(0, 0, width, height);

  const highlight = context.createRadialGradient(
    width * 0.34,
    height * 0.22,
    0,
    width * 0.34,
    height * 0.22,
    width * 0.34,
  );
  highlight.addColorStop(0, "rgba(255,255,255,0.82)");
  highlight.addColorStop(0.28, "rgba(255,255,255,0.24)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = highlight;
  context.fillRect(0, 0, width, height);

  const shade = context.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, "rgba(255,255,255,0.08)");
  shade.addColorStop(0.56, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(15,18,60,0.24)");
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function makeGlowSprite(
  texture: THREE.Texture,
  scale: number,
  opacity: number,
  color = 0xffffff,
): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(scale);
  return sprite;
}

class HeroOrbitCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly orbit: (typeof HERO_ORBITS)[number],
  ) {
    super();
  }

  override getPoint(progress: number, target = new THREE.Vector3()): THREE.Vector3 {
    const point = getHeroOrbitPoint3D(this.orbit, progress);
    return target.set(point.x, point.y, point.z);
  }
}

function makeOrbitMeshes(
  orbit: (typeof HERO_ORBITS)[number],
  sharedGlow: THREE.Texture,
  accents: AccentPalette,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `orbit-${orbit.key}`;
  const accent = accents[orbit.accent];
  const curve = new HeroOrbitCurve(orbit);

  const outerGlow = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 192, 0.011, 8, true),
    new THREE.MeshBasicMaterial({
      color: accent.glow,
      transparent: true,
      opacity: 0.082,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  outerGlow.renderOrder = 1;
  group.add(outerGlow);

  const line = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 220, 0.0046, 8, true),
    new THREE.MeshBasicMaterial({
      color: accent.glow,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    }),
  );
  line.renderOrder = 2;
  group.add(line);

  const lightCore = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 220, 0.0015, 5, true),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    }),
  );
  lightCore.renderOrder = 3;
  group.add(lightCore);

  [0.18, 0.68].forEach((progress, index) => {
    const marker = makeGlowSprite(
      sharedGlow,
      index === 0 ? 0.062 : 0.078,
      index === 0 ? 0.26 : 0.34,
      accent.light,
    );
    marker.position.copy(curve.getPointAt(progress));
    marker.renderOrder = 5;
    group.add(marker);
  });

  return group;
}

function makeLatheSurface(
  points: Array<[radius: number, y: number]>,
  material: THREE.Material,
  segments = 112,
): THREE.Mesh {
  const profile = points.map(([radius, y]) => new THREE.Vector2(radius, y));
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, segments), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makePearlTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");

  context.fillStyle = "#f3f1fa";
  context.fillRect(0, 0, size, size);

  const clouds = [
    [0.16, 0.2, 0.29, "rgba(177,164,232,0.2)"],
    [0.71, 0.18, 0.27, "rgba(255,255,255,0.98)"],
    [0.42, 0.49, 0.34, "rgba(190,181,226,0.17)"],
    [0.82, 0.63, 0.31, "rgba(164,205,235,0.13)"],
    [0.23, 0.78, 0.31, "rgba(151,137,207,0.13)"],
    [0.59, 0.9, 0.25, "rgba(255,255,255,0.78)"],
  ] as const;

  clouds.forEach(([x, y, radius, color]) => {
    const gradient = context.createRadialGradient(
      x * size,
      y * size,
      0,
      x * size,
      y * size,
      radius * size,
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });

  const image = context.getImageData(0, 0, size, size);
  for (let index = 0; index < image.data.length; index += 4) {
    const noise = (Math.random() - 0.5) * 5;
    image.data[index] = Math.max(0, Math.min(255, image.data[index] + noise));
    image.data[index + 1] = Math.max(0, Math.min(255, image.data[index + 1] + noise));
    image.data[index + 2] = Math.max(0, Math.min(255, image.data[index + 2] + noise));
  }
  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function makeCloudOverlayTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");

  const clouds = [
    [0.12, 0.2, 0.23, "rgba(122,102,205,0.3)"],
    [0.39, 0.13, 0.18, "rgba(255,255,255,0.55)"],
    [0.72, 0.24, 0.26, "rgba(151,136,225,0.27)"],
    [0.9, 0.48, 0.22, "rgba(122,196,235,0.21)"],
    [0.22, 0.58, 0.28, "rgba(117,100,196,0.25)"],
    [0.55, 0.68, 0.3, "rgba(255,255,255,0.46)"],
    [0.8, 0.84, 0.24, "rgba(116,101,187,0.23)"],
    [0.31, 0.92, 0.2, "rgba(116,190,226,0.18)"],
  ] as const;

  clouds.forEach(([x, y, radius, color]) => {
    const gradient = context.createRadialGradient(
      x * size,
      y * size,
      0,
      x * size,
      y * size,
      radius * size,
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.68, color.replace(/0\.([0-9]+)\)/, "0.04)"));
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function makePearlFaceTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");

  const patches = [
    [0.22, 0.28, 0.28, "rgba(137,118,218,0.34)"],
    [0.48, 0.16, 0.23, "rgba(255,255,255,0.72)"],
    [0.78, 0.29, 0.25, "rgba(171,158,231,0.25)"],
    [0.16, 0.52, 0.25, "rgba(137,118,209,0.26)"],
    [0.62, 0.49, 0.31, "rgba(255,255,255,0.42)"],
    [0.86, 0.62, 0.2, "rgba(114,191,226,0.18)"],
    [0.3, 0.76, 0.29, "rgba(126,108,198,0.24)"],
    [0.62, 0.84, 0.25, "rgba(180,169,227,0.22)"],
  ] as const;

  patches.forEach(([x, y, radius, color]) => {
    const gradient = context.createRadialGradient(
      x * size,
      y * size,
      0,
      x * size,
      y * size,
      radius * size,
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.52, color.replace(/0\.([0-9]+)\)/, "0.09)"));
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });

  context.globalCompositeOperation = "destination-in";
  const mask = context.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.37,
    size / 2,
    size / 2,
    size * 0.5,
  );
  mask.addColorStop(0, "rgba(255,255,255,1)");
  mask.addColorStop(0.82, "rgba(255,255,255,0.94)");
  mask.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = mask;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeSurfaceOverlay(
  source: THREE.Mesh,
  texture: THREE.Texture,
  opacity: number,
): THREE.Mesh {
  const overlay = new THREE.Mesh(
    source.geometry.clone(),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  overlay.scale.setScalar(1.003);
  overlay.renderOrder = 4;
  return overlay;
}

function makeSphereProfile(
  yTop: number,
  yBottom: number,
  sphereRadius: number,
  samples: number,
  bulge = 0,
): Array<[radius: number, y: number]> {
  return Array.from({ length: samples + 1 }, (_, index) => {
    const progress = index / samples;
    const y = THREE.MathUtils.lerp(yTop, yBottom, progress);
    const sphereX = Math.sqrt(Math.max(0, sphereRadius * sphereRadius - y * y));
    const shapedBulge = Math.sin(progress * Math.PI) * bulge;
    return [sphereX + shapedBulge, y];
  });
}

function makeSmoothProfile(
  controls: Array<[radius: number, y: number]>,
  samples = 36,
): Array<[radius: number, y: number]> {
  const curve = new THREE.SplineCurve(
    controls.map(([radius, y]) => new THREE.Vector2(radius, y)),
  );
  return curve.getPoints(samples).map((point) => [point.x, point.y]);
}

function makeCentralPlanet(
  haloTexture: THREE.Texture,
  shadowTexture: THREE.Texture,
  pearlTexture: THREE.Texture,
  cloudTexture: THREE.Texture,
  pearlFaceTexture: THREE.Texture,
): { core: THREE.Group; band: THREE.Group } {
  const core = new THREE.Group();
  core.name = "respio-core";

  const halo = makeGlowSprite(haloTexture, 4.9, 0.24, 0x8268ff);
  halo.position.z = -0.62;
  halo.renderOrder = -2;
  core.add(halo);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.85, 1.02),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  shadow.position.set(-0.22, -1.55, -0.34);
  shadow.rotation.x = -0.18;
  shadow.renderOrder = -1;
  core.add(shadow);

  const topMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf3f0f9,
    map: pearlTexture,
    bumpMap: pearlTexture,
    bumpScale: 0.012,
    roughness: 0.38,
    metalness: 0,
    clearcoat: 0.74,
    clearcoatRoughness: 0.3,
    emissive: 0x7066a7,
    emissiveIntensity: 0.018,
  });
  const titleMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe2deeb,
    map: pearlTexture,
    bumpMap: pearlTexture,
    bumpScale: 0.01,
    roughness: 0.34,
    metalness: 0,
    clearcoat: 0.72,
    clearcoatRoughness: 0.3,
    emissive: 0x6559a2,
    emissiveIntensity: 0.02,
  });
  const subtitleMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb8afcc,
    map: pearlTexture,
    bumpMap: pearlTexture,
    bumpScale: 0.008,
    roughness: 0.4,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.38,
    emissive: 0x62589c,
    emissiveIntensity: 0.025,
  });
  const lowerMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x9990b5,
    map: pearlTexture,
    bumpMap: pearlTexture,
    bumpScale: 0.006,
    roughness: 0.46,
    metalness: 0,
    clearcoat: 0.48,
    clearcoatRoughness: 0.44,
    emissive: 0x51487f,
    emissiveIntensity: 0.018,
  });

  const sphereRadius = 1.43;
  const topCutY = 0.56;
  const separatorY = -0.34;
  const lowerCutY = -0.91;
  const topCutRadius = Math.sqrt(sphereRadius * sphereRadius - topCutY * topCutY);
  const separatorRadius = Math.sqrt(
    sphereRadius * sphereRadius - separatorY * separatorY,
  );
  const lowerCutRadius = Math.sqrt(
    sphereRadius * sphereRadius - lowerCutY * lowerCutY,
  );

  const topCap = makeLatheSurface(
    makeSphereProfile(sphereRadius, topCutY, sphereRadius, 40),
    topMaterial,
  );
  core.add(topCap);
  core.add(makeSurfaceOverlay(topCap, cloudTexture, 0.78));

  const band = new THREE.Group();
  band.name = "respio-core-band";

  const titleBelt = makeLatheSurface(
    makeSphereProfile(topCutY, separatorY, sphereRadius, 52, 0.012),
    titleMaterial,
  );
  band.add(titleBelt);
  band.add(makeSurfaceOverlay(titleBelt, cloudTexture, 0.62));

  const subtitleBelt = makeLatheSurface(
    makeSphereProfile(separatorY, lowerCutY, sphereRadius, 40, 0.006),
    subtitleMaterial,
  );
  band.add(subtitleBelt);
  band.add(makeSurfaceOverlay(subtitleBelt, cloudTexture, 0.5));

  const lowerCap = makeLatheSurface(
    makeSphereProfile(lowerCutY, -sphereRadius, sphereRadius, 30),
    lowerMaterial,
  );
  core.add(lowerCap);
  core.add(makeSurfaceOverlay(lowerCap, cloudTexture, 0.38));

  const pearlFace = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: pearlFaceTexture,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    }),
  );
  pearlFace.scale.set(2.78, 3.02, 1);
  pearlFace.position.set(-0.04, 0.01, 1.455);
  pearlFace.renderOrder = 5;
  core.add(pearlFace);

  const topSeamGlow = new THREE.Mesh(
    new THREE.TorusGeometry(topCutRadius + 0.012, 0.013, 8, 128),
    new THREE.MeshBasicMaterial({
      color: 0x7c68e8,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    }),
  );
  topSeamGlow.rotation.x = Math.PI / 2;
  topSeamGlow.position.y = topCutY;
  band.add(topSeamGlow);

  const topSeam = new THREE.Mesh(
    new THREE.TorusGeometry(topCutRadius + 0.008, 0.0045, 6, 128),
    new THREE.MeshBasicMaterial({
      color: 0x7063ce,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  topSeam.rotation.x = Math.PI / 2;
  topSeam.position.y = topCutY;
  band.add(topSeam);

  const separatorCollar = makeLatheSurface(
    makeSmoothProfile([
      [separatorRadius - 0.012, separatorY + 0.07],
      [separatorRadius + 0.035, separatorY + 0.025],
      [separatorRadius + 0.035, separatorY - 0.035],
      [separatorRadius - 0.012, separatorY - 0.075],
    ], 18),
    new THREE.MeshBasicMaterial({
      color: 0x8068f4,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      toneMapped: false,
    }),
  );
  separatorCollar.renderOrder = 6;
  band.add(separatorCollar);

  const separatorGlow = new THREE.Mesh(
    new THREE.TorusGeometry(separatorRadius + 0.022, 0.085, 12, 144),
    new THREE.MeshBasicMaterial({
      color: 0x8a74ff,
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    }),
  );
  separatorGlow.rotation.x = Math.PI / 2;
  separatorGlow.position.y = separatorY;
  separatorGlow.renderOrder = 7;
  band.add(separatorGlow);

  const separator = new THREE.Mesh(
    new THREE.TorusGeometry(separatorRadius + 0.018, 0.018, 10, 144),
    new THREE.MeshBasicMaterial({
      color: 0x7658f2,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    }),
  );
  separator.rotation.x = Math.PI / 2;
  separator.position.y = separatorY;
  separator.renderOrder = 8;
  band.add(separator);

  const separatorCore = new THREE.Mesh(
    new THREE.TorusGeometry(separatorRadius + 0.012, 0.0045, 6, 144),
    new THREE.MeshBasicMaterial({
      color: 0xf4f3ff,
      transparent: true,
      opacity: 0.082,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    }),
  );
  separatorCore.rotation.x = Math.PI / 2;
  separatorCore.position.y = separatorY;
  separatorCore.renderOrder = 9;
  band.add(separatorCore);

  const separatorGlintHalo = makeGlowSprite(haloTexture, 0.34, 0.18, 0x8eeaff);
  separatorGlintHalo.position.set(-0.34, separatorY, separatorRadius + 0.028);
  separatorGlintHalo.renderOrder = 12;
  band.add(separatorGlintHalo);

  const separatorGlint = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xd8fbff, toneMapped: false }),
  );
  separatorGlint.position.set(-0.34, separatorY, separatorRadius + 0.052);
  separatorGlint.renderOrder = 13;
  band.add(separatorGlint);

  const ringGlints: Array<[number, number, number, number]> = [
    [-0.72, 0xbcefff, 0.17, 0.44],
    [-0.12, 0xe9feff, 0.23, 0.62],
    [0.68, 0xb9b0ff, 0.13, 0.34],
  ];
  ringGlints.forEach(([x, color, scale, opacity]) => {
    const z = Math.sqrt(Math.max(0, separatorRadius * separatorRadius - x * x));
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTexture,
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
      }),
    );
    sprite.scale.setScalar(scale);
    sprite.position.set(x, separatorY, z + 0.04);
    sprite.renderOrder = 14;
    band.add(sprite);
  });

  const lowerSeam = new THREE.Mesh(
    new THREE.TorusGeometry(lowerCutRadius + 0.006, 0.0055, 6, 112),
    new THREE.MeshBasicMaterial({
      color: 0x6957ad,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  lowerSeam.rotation.x = Math.PI / 2;
  lowerSeam.position.y = lowerCutY;
  band.add(lowerSeam);

  const highlight = makeGlowSprite(haloTexture, 1.16, 0.16, 0xffffff);
  highlight.position.set(-0.46, 0.72, 1.05);
  highlight.renderOrder = 11;
  core.add(highlight);

  core.add(band);
  core.scale.set(0.94, 1.015, 0.94);
  return { core, band };
}

function makePlanet(
  key: OrbitKey,
  radius: number,
  accentKey: OrbitAccent,
  haloTexture: THREE.Texture,
  iconTexture: THREE.Texture,
  surfaceTexture: THREE.Texture,
  accents: AccentPalette,
): THREE.Group {
  const accent = accents[accentKey];
  const group = new THREE.Group();
  group.name = `planet-${key}`;

  const halo = makeGlowSprite(haloTexture, radius * 2.65, 0.12, accent.glow);
  halo.position.z = -0.08;
  group.add(halo);

  const innerCore = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.78, 44, 34),
    new THREE.MeshPhysicalMaterial({
      color: accent.base,
      roughness: 0.32,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.22,
      emissive: accent.glow,
      emissiveIntensity: 0.08,
    }),
  );
  innerCore.position.z = -radius * 0.03;
  group.add(innerCore);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: surfaceTexture,
      roughness: 0.17,
      metalness: 0.015,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      sheen: 0.18,
      sheenColor: new THREE.Color(accent.light),
      emissive: accent.glow,
      emissiveIntensity: 0.035,
    }),
  );
  sphere.castShadow = true;
  group.add(sphere);

  const glassShell = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.025, 56, 42),
    new THREE.MeshPhysicalMaterial({
      color: accent.light,
      transparent: true,
      opacity: 0.12,
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  glassShell.renderOrder = 7;
  group.add(glassShell);

  const equator = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.78, radius * 0.018, 8, 96),
    new THREE.MeshBasicMaterial({
      color: accent.light,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  equator.rotation.x = Math.PI / 2;
  equator.position.z = radius * 0.04;
  equator.renderOrder = 8;
  group.add(equator);

  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.035, 48, 36),
    new THREE.MeshBasicMaterial({
      color: accent.light,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  rim.renderOrder = 8;
  group.add(rim);

  const glint = makeGlowSprite(haloTexture, radius * 0.4, 0.28, 0xffffff);
  glint.position.set(-radius * 0.25, radius * 0.28, radius * 0.82);
  glint.renderOrder = 9;
  group.add(glint);

  const icon = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: iconTexture,
      transparent: true,
      opacity: 0.98,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  icon.scale.setScalar(radius * 1.16);
  icon.position.z = radius + 0.036;
  icon.renderOrder = 10;
  group.add(icon);

  return group;
}

export function createHeroSceneRuntime(
  canvas: HTMLCanvasElement,
  compact: boolean,
): HeroSceneRuntime {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
    premultipliedAlpha: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const accents = getAccentPalette();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 60);
  camera.position.set(0, 0.18, CAMERA_Z);
  camera.lookAt(0, 0, 0);

  const root = new THREE.Group();
  root.name = "hero-orbital-system-root";
  root.position.set(compact ? 0 : -0.12, compact ? 0.08 : 0.22, 0);
  root.scale.setScalar(compact ? 0.8 : 0.86);
  scene.add(root);

  const parallax = new THREE.Group();
  parallax.name = "hero-orbital-system-parallax";
  root.add(parallax);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9c4e4, 2.65));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.45);
  keyLight.position.set(-5.8, 7.8, 9.6);
  scene.add(keyLight);

  const violetLight = new THREE.PointLight(0x785fff, 2.65, 18, 2);
  violetLight.position.set(3.2, 1.8, 4.6);
  scene.add(violetLight);

  const cyanLight = new THREE.PointLight(0x73eaff, 1.85, 17, 2);
  cyanLight.position.set(-4.4, -0.7, 3.8);
  scene.add(cyanLight);

  const fillLight = new THREE.PointLight(0xaaa0ff, 1.55, 14, 2);
  fillLight.position.set(0, -3.5, 6.2);
  scene.add(fillLight);

  const ownedTextures = new Set<THREE.Texture>();
  const haloTexture = makeRadialTexture(
    "rgba(255,255,255,0.98)",
    "rgba(132,105,255,0.2)",
    "rgba(132,105,255,0)",
  );
  const orbitMarkerTexture = makeRadialTexture(
    "rgba(255,255,255,1)",
    "rgba(255,255,255,0.78)",
    "rgba(255,255,255,0)",
    96,
  );
  const shadowTexture = makeRadialTexture(
    "rgba(72,52,187,0.82)",
    "rgba(91,70,211,0.18)",
    "rgba(91,70,211,0)",
  );
  ownedTextures.add(haloTexture);
  ownedTextures.add(orbitMarkerTexture);
  const pearlTexture = makePearlTexture();
  const cloudTexture = makeCloudOverlayTexture();
  const pearlFaceTexture = makePearlFaceTexture();
  ownedTextures.add(shadowTexture);
  ownedTextures.add(pearlTexture);
  ownedTextures.add(cloudTexture);
  ownedTextures.add(pearlFaceTexture);

  HERO_ORBITS.forEach((orbit) => {
    parallax.add(makeOrbitMeshes(orbit, orbitMarkerTexture, accents));
  });

  const { core, band } = makeCentralPlanet(
    haloTexture,
    shadowTexture,
    pearlTexture,
    cloudTexture,
    pearlFaceTexture,
  );
  core.position.set(0.2, 0.2, 0.42);
  core.visible = false;
  parallax.add(core);

  const planets = new Map<OrbitKey, THREE.Group>();
  HERO_ORBITS.forEach((orbit) => {
    const iconTexture = makeIconTexture(orbit.key);
    const surfaceTexture = makePlanetTexture(accents[orbit.accent]);
    ownedTextures.add(iconTexture);
    ownedTextures.add(surfaceTexture);
    const planet = makePlanet(
      orbit.key,
      orbit.planetRadius,
      orbit.accent,
      haloTexture,
      iconTexture,
      surfaceTexture,
      accents,
    );
    parallax.add(planet);
    planets.set(orbit.key, planet);
  });

  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  return {
    renderer,
    scene,
    camera,
    root,
    parallax,
    core,
    coreBand: band,
    planets,
    ownedTextures,
  };
}

export function projectObjectToNdc(
  object: THREE.Object3D,
  camera: THREE.Camera,
): THREE.Vector3 {
  object.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(object.matrixWorld).project(camera);
}

function disposeMaterial(material: THREE.Material): void {
  Object.values(material).forEach((value) => {
    if (value instanceof THREE.Texture) value.dispose();
  });
  material.dispose();
}

export function disposeHeroSceneRuntime(runtime: HeroSceneRuntime): void {
  runtime.scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
      object.geometry?.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach(disposeMaterial);
      else if (material) disposeMaterial(material);
    }
  });
  runtime.ownedTextures.forEach((texture) => texture.dispose());
  runtime.renderer.renderLists.dispose();
  runtime.renderer.dispose();
  runtime.renderer.forceContextLoss();
}
