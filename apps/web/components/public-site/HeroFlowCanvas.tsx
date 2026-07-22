"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  CAMERA_FOV,
  CAMERA_Z,
  HERO_ORBITS,
  getHeroOrbitPoint3D,
  type HeroOrbitPoint3D,
  type OrbitKey,
} from "./HeroFlowModel";
import type { HeroSceneRuntime } from "./HeroFlowWebGL";
import styles from "./HeroFlowCanvas.module.css";

export { HERO_ORBITS, getHeroOrbitPoint3D };
export type { HeroOrbitPoint3D };

type WebGLState = "idle" | "loading" | "ready" | "fallback";
type HeroWebGLModule = typeof import("./HeroFlowWebGL");
type LabelSize = { width: number; height: number };

const EMPTY_LABEL_SIZES: Record<OrbitKey, LabelSize> = {
  question: { width: 100, height: 40 },
  catalog: { width: 100, height: 40 },
  data: { width: 100, height: 40 },
  context: { width: 100, height: 40 },
  answer: { width: 100, height: 40 },
};

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function getPixelRatioCap(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (window.innerWidth <= 620) return 1.15;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return 1.2;
  return 1.5;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function readPixelToken(element: HTMLElement, token: string, fallback: number): number {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(token));
  return Number.isFinite(value) ? value : fallback;
}

export function HeroFlowCanvas() {
  const shellRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coreLabelRef = useRef<HTMLDivElement | null>(null);
  const monogramRef = useRef<HTMLSpanElement | null>(null);
  const coreArtworkRef = useRef<HTMLImageElement | null>(null);
  const coreShadowRef = useRef<HTMLSpanElement | null>(null);
  const labelRefs = useRef<Record<OrbitKey, HTMLDivElement | null>>({
    question: null,
    catalog: null,
    data: null,
    context: null,
    answer: null,
  });
  const [webglState, setWebglState] = useState<WebGLState>("idle");

  useEffect(() => {
    const shell = shellRef.current;
    const canvas = canvasRef.current;
    if (!shell || !canvas) return undefined;

    let cancelled = false;
    let runtime: HeroSceneRuntime | null = null;
    let webglModule: HeroWebGLModule | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    let requestedLoad = false;
    let labelSizes: Record<OrbitKey, LabelSize> = { ...EMPTY_LABEL_SIZES };

    const measureLabels = () => {
      labelSizes = HERO_ORBITS.reduce<Record<OrbitKey, LabelSize>>(
        (sizes, orbit) => {
          const label = labelRefs.current[orbit.key];
          if (!label) return sizes;
          sizes[orbit.key] = {
            width: Math.max(64, label.offsetWidth),
            height: Math.max(24, label.offsetHeight),
          };
          return sizes;
        },
        { ...EMPTY_LABEL_SIZES },
      );
    };

    const updateDomLabels = () => {
      if (!runtime || !webglModule) return;
      const activeRuntime = runtime;
      activeRuntime.scene.updateMatrixWorld(true);
      activeRuntime.camera.updateMatrixWorld(true);

      const rect = shell.getBoundingClientRect();
      const compact = rect.width <= 620;
      const labelGap = readPixelToken(shell, "--hero-planet-label-gap", compact ? 16 : 24);
      const edgePadding = compact ? 10 : 18;

      const projectToCss = (
        object: Parameters<HeroWebGLModule["projectObjectToNdc"]>[0],
      ) => {
        if (!webglModule) return { x: 0, y: 0 };
        const vector = webglModule.projectObjectToNdc(object, activeRuntime.camera);
        return {
          x: (vector.x * 0.5 + 0.5) * rect.width,
          y: (-vector.y * 0.5 + 0.5) * rect.height,
        };
      };

      const corePoint = projectToCss(activeRuntime.core);
      const coreLabel = coreLabelRef.current;
      const monogram = monogramRef.current;
      const coreArtwork = coreArtworkRef.current;
      const coreShadow = coreShadowRef.current;

      if (coreLabel) {
        coreLabel.style.transform = `translate3d(${Math.round(corePoint.x)}px, ${Math.round(corePoint.y + (compact ? 15 : 24))}px, 0) translate(-50%, -50%)`;
      }
      if (monogram) {
        monogram.style.transform = `translate3d(${Math.round(corePoint.x)}px, ${Math.round(corePoint.y - rect.height * (compact ? 0.116 : 0.142))}px, 0) translate(-50%, -50%)`;
      }
      if (coreArtwork) {
        coreArtwork.style.transform = `translate3d(${Math.round(corePoint.x)}px, ${Math.round(corePoint.y)}px, 0) translate(-50%, -50%)`;
      }
      if (coreShadow) {
        coreShadow.style.transform = `translate3d(${Math.round(corePoint.x)}px, ${Math.round(corePoint.y + (compact ? 85 : 128))}px, 0) translate(-50%, -50%)`;
      }

      HERO_ORBITS.forEach((orbit) => {
        const planet = activeRuntime.planets.get(orbit.key);
        const label = labelRefs.current[orbit.key];
        if (!planet || !label) return;

        const point = projectToCss(planet);
        const size = labelSizes[orbit.key];
        let x = point.x;
        let y = point.y;
        let translateX = "-50%";
        let translateY = "-50%";
        let textAlign: "left" | "right" | "center" = "center";

        if (orbit.labelSide === "left") {
          x -= labelGap;
          translateX = "-100%";
          textAlign = "right";
        } else if (orbit.labelSide === "right") {
          x += labelGap;
          translateX = "0";
          textAlign = "left";
        } else if (orbit.labelSide === "top") {
          y -= labelGap;
          translateY = "-100%";
        } else {
          y += labelGap;
          translateY = "0";
        }

        if (compact) {
          if (orbit.labelSide === "left") {
            x = clamp(x, size.width + edgePadding, rect.width - edgePadding);
          } else if (orbit.labelSide === "right") {
            x = clamp(x, edgePadding, rect.width - size.width - edgePadding);
          } else {
            x = clamp(
              x,
              size.width / 2 + edgePadding,
              rect.width - size.width / 2 - edgePadding,
            );
          }

          if (orbit.labelSide === "top") {
            y = clamp(y, size.height + edgePadding, rect.height - edgePadding);
          } else if (orbit.labelSide === "bottom") {
            y = clamp(y, edgePadding, rect.height - size.height - edgePadding);
          } else {
            y = clamp(
              y,
              size.height / 2 + edgePadding,
              rect.height - size.height / 2 - edgePadding,
            );
          }
        }

        label.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(${translateX}, ${translateY})`;
        label.style.textAlign = textAlign;
        label.style.justifyContent =
          orbit.labelSide === "left"
            ? "flex-end"
            : orbit.labelSide === "right"
              ? "flex-start"
              : "center";
      });
    };

    const renderFrame = () => {
      if (!runtime) return;
      runtime.scene.updateMatrixWorld(true);
      runtime.renderer.render(runtime.scene, runtime.camera);
      updateDomLabels();
    };

    const resize = () => {
      if (!runtime) return;
      const rect = shell.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const compact = rect.width <= 620;
      runtime.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getPixelRatioCap()));
      runtime.renderer.setSize(rect.width, rect.height, false);
      runtime.camera.aspect = rect.width / rect.height;
      runtime.camera.fov = compact ? 37 : CAMERA_FOV;
      runtime.camera.position.set(0, compact ? 0.1 : 0.15, compact ? 16.4 : CAMERA_Z);
      runtime.camera.lookAt(0, 0, 0);
      runtime.root.position.set(compact ? 0 : -0.12, compact ? 0.08 : 0.22, 0);
      runtime.root.scale.setScalar(compact ? 0.8 : 0.86);
      runtime.parallax.position.set(0, 0, 0);
      runtime.parallax.rotation.set(0, 0, 0);
      runtime.camera.updateProjectionMatrix();
      measureLabels();
      renderFrame();
    };

    const loadScene = async () => {
      if (requestedLoad || cancelled) return;
      requestedLoad = true;

      if (!supportsWebGL()) {
        setWebglState("fallback");
        return;
      }

      setWebglState("loading");
      try {
        const sceneModule = await import("./HeroFlowWebGL");
        if (cancelled) return;
        webglModule = sceneModule;
        runtime = sceneModule.createHeroSceneRuntime(
          canvas,
          shell.getBoundingClientRect().width <= 620,
        );

        HERO_ORBITS.forEach((orbit) => {
          const planet = runtime?.planets.get(orbit.key);
          if (!planet) return;
          const point = getHeroOrbitPoint3D(orbit, orbit.phase);
          planet.position.set(point.x, point.y, point.z);
        });

        resize();
        setWebglState("ready");
        requestAnimationFrame(() => {
          measureLabels();
          renderFrame();
        });

        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(shell);

        const onContextLost = (event: Event) => {
          event.preventDefault();
          setWebglState("fallback");
        };
        canvas.addEventListener("webglcontextlost", onContextLost, { once: true });
      } catch (error) {
        console.error("Hero WebGL scene failed to initialize", error);
        setWebglState("fallback");
      }
    };

    visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadScene();
      },
      { rootMargin: "220px 0px" },
    );
    visibilityObserver.observe(shell);

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      if (runtime && webglModule) webglModule.disposeHeroSceneRuntime(runtime);
    };
  }, []);

  return (
    <figure
      ref={shellRef}
      className={styles.scene}
      data-webgl-state={webglState}
      role="img"
      aria-label="Пять смысловых AI-узлов расположены на пяти отдельных трёхмерных орбитах вокруг Respio AI: вопрос покупателя, товары и каталог, данные о товарах, контекст и правила, готовый ответ"
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <div className={styles.fallback} aria-hidden="true">
        <div className={styles.fallbackCore}>
          <span>R</span>
        </div>
        <div className={styles.fallbackOrbit} />
      </div>

      <div className={styles.labelLayer} aria-hidden="true">
        <span ref={coreShadowRef} className={styles.coreGroundShadow} />
        <Image
          ref={coreArtworkRef}
          className={styles.coreArtwork}
          src="/brand/respio-ai-core-reference.png"
          alt=""
          width={300}
          height={300}
          sizes="(max-width: 620px) 195px, 300px"
          draggable={false}
          priority
          unoptimized
        />
        <span ref={monogramRef} className={styles.coreMonogram}>R</span>
        <div ref={coreLabelRef} className={styles.coreLabel}>
          <strong>Respio AI</strong>
          <span>AI-ответы для маркетплейсов</span>
        </div>

        {HERO_ORBITS.map((orbit) => (
          <div
            key={orbit.key}
            ref={(node) => {
              labelRefs.current[orbit.key] = node;
            }}
            className={`${styles.planetLabel} ${styles[`label_${orbit.accent}`]}`}
            data-orbit-label={orbit.key}
          >
            {orbit.label}
          </div>
        ))}
      </div>
    </figure>
  );
}
