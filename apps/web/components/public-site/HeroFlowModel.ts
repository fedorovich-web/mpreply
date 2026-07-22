export const CAMERA_FOV = 33;
export const CAMERA_Z = 14.6;

export type OrbitKey = "question" | "catalog" | "data" | "context" | "answer";
export type OrbitAccent = "violet" | "blue" | "cyan" | "purple" | "mint";
export type LabelSide = "left" | "right" | "top" | "bottom";

export type HeroOrbitPoint3D = {
  x: number;
  y: number;
  z: number;
};

export type HeroOrbitDefinition = {
  key: OrbitKey;
  label: string;
  accent: OrbitAccent;
  duration: number;
  direction: 1 | -1;
  phase: number;
  radiusX: number;
  radiusY: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  planetRadius: number;
  labelSide: LabelSide;
  labelOffsetX: number;
  labelOffsetY: number;
  motionRange: number;
};

/**
 * Five clean atom-like ellipses sharing one visual centre.
 * Planets use fixed semantic anchors so labels cannot drift or collide.
 */
export const HERO_ORBITS: readonly HeroOrbitDefinition[] = [
  {
    key: "question",
    label: "Вопрос\nпокупателя",
    accent: "violet",
    duration: 148,
    direction: 1,
    phase: 0.166,
    radiusX: 5.1,
    radiusY: 2.55,
    rotationX: -0.12,
    rotationY: -0.04,
    rotationZ: 0.98,
    planetRadius: 0.36,
    labelSide: "top",
    labelOffsetX: 0,
    labelOffsetY: 0,
    motionRange: 0,
  },
  {
    key: "catalog",
    label: "Товары\nи каталог",
    accent: "blue",
    duration: 154,
    direction: -1,
    phase: 0.565,
    radiusX: 5.45,
    radiusY: 2.25,
    rotationX: -0.86,
    rotationY: -0.04,
    rotationZ: -0.1,
    planetRadius: 0.345,
    labelSide: "left",
    labelOffsetX: 0,
    labelOffsetY: 0,
    motionRange: 0,
  },
  {
    key: "data",
    label: "Данные\nо товарах",
    accent: "cyan",
    duration: 156,
    direction: 1,
    phase: 0.938,
    radiusX: 5.45,
    radiusY: 2.25,
    rotationX: 0.86,
    rotationY: 0.04,
    rotationZ: 0.1,
    planetRadius: 0.345,
    labelSide: "right",
    labelOffsetX: 0,
    labelOffsetY: 0,
    motionRange: 0,
  },
  {
    key: "context",
    label: "Контекст\nи правила",
    accent: "purple",
    duration: 160,
    direction: -1,
    phase: 0.101,
    radiusX: 5.15,
    radiusY: 2.45,
    rotationX: 0.45,
    rotationY: -0.04,
    rotationZ: -0.72,
    planetRadius: 0.35,
    labelSide: "bottom",
    labelOffsetX: 0,
    labelOffsetY: 0,
    motionRange: 0,
  },
  {
    key: "answer",
    label: "Готовый\nответ",
    accent: "mint",
    duration: 162,
    direction: 1,
    phase: 0.397,
    radiusX: 5.15,
    radiusY: 2.45,
    rotationX: -0.45,
    rotationY: 0.04,
    rotationZ: 0.72,
    planetRadius: 0.34,
    labelSide: "bottom",
    labelOffsetX: 0,
    labelOffsetY: 0,
    motionRange: 0,
  },
] as const;

function rotateX(point: HeroOrbitPoint3D, angle: number): HeroOrbitPoint3D {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: point.x,
    y: point.y * cosine - point.z * sine,
    z: point.y * sine + point.z * cosine,
  };
}

function rotateY(point: HeroOrbitPoint3D, angle: number): HeroOrbitPoint3D {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: point.x * cosine + point.z * sine,
    y: point.y,
    z: -point.x * sine + point.z * cosine,
  };
}

function rotateZ(point: HeroOrbitPoint3D, angle: number): HeroOrbitPoint3D {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
    z: point.z,
  };
}

export function getHeroOrbitPoint3D(
  orbit: HeroOrbitDefinition,
  progress: number,
): HeroOrbitPoint3D {
  const normalizedProgress = ((progress % 1) + 1) % 1;
  const angle = normalizedProgress * Math.PI * 2;
  const point = {
    x: Math.cos(angle) * orbit.radiusX,
    y: Math.sin(angle) * orbit.radiusY,
    z: 0,
  };

  return rotateZ(
    rotateY(rotateX(point, orbit.rotationX), orbit.rotationY),
    orbit.rotationZ,
  );
}

export function getHeroOrbitPoints(
  orbit: HeroOrbitDefinition,
  segments = 224,
): HeroOrbitPoint3D[] {
  return Array.from({ length: segments }, (_, index) =>
    getHeroOrbitPoint3D(orbit, index / segments),
  );
}
