"use client";

import { useEffect, useRef } from "react";
import styles from "./HeroProductFlowCanvas.module.css";

type Point = { x: number; y: number };
type Curve = { p0: Point; p1: Point; p2: Point; p3: Point };
type Particle = { lane: number; offset: number; speed: number; radius: number };

type SceneRefs = {
  question: HTMLElement | null;
  product: HTMLElement | null;
  engine: HTMLElement | null;
  proofs: Array<HTMLDivElement | null>;
};

const PARTICLES: Particle[] = Array.from({ length: 34 }, (_, index) => ({
  lane: index % 5,
  offset: (index * 0.137) % 1,
  speed: 0.023 + (index % 6) * 0.0048,
  radius: 1.15 + (index % 3) * 0.3,
}));

const COLORS = {
  blue: "47, 109, 246",
  green: "10, 168, 143",
  cyan: "34, 199, 214",
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function anchor(scene: HTMLElement, element: HTMLElement, side: "left" | "right", ratio: number): Point {
  const rect = element.getBoundingClientRect();
  const base = scene.getBoundingClientRect();
  return {
    x: (side === "left" ? rect.left : rect.right) - base.left,
    y: rect.top - base.top + rect.height * ratio,
  };
}

function buildCurve(from: Point, to: Point, bend: number, pointerX: number, pointerY: number, intensity: number): Curve {
  const distance = Math.max(48, to.x - from.x);
  const handle = Math.min(116, Math.max(50, distance * 0.48));
  const pullX = pointerX * 34 * intensity;
  const pullY = pointerY * 22 * intensity;

  return {
    p0: from,
    p1: {
      x: from.x + handle + pullX,
      y: from.y + bend + pullY,
    },
    p2: {
      x: to.x - handle + pullX * 1.12,
      y: to.y - bend + pullY * 1.12,
    },
    p3: to,
  };
}

function getBezierPoint(curve: Curve, t: number): Point {
  const u = 1 - t;
  return {
    x:
      u * u * u * curve.p0.x +
      3 * u * u * t * curve.p1.x +
      3 * u * t * t * curve.p2.x +
      t * t * t * curve.p3.x,
    y:
      u * u * u * curve.p0.y +
      3 * u * u * t * curve.p1.y +
      3 * u * t * t * curve.p2.y +
      t * t * t * curve.p3.y,
  };
}

function traceCurve(context: CanvasRenderingContext2D, curve: Curve): void {
  context.beginPath();
  context.moveTo(curve.p0.x, curve.p0.y);
  context.bezierCurveTo(curve.p1.x, curve.p1.y, curve.p2.x, curve.p2.y, curve.p3.x, curve.p3.y);
}

function drawConnection(
  context: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  lane: number,
  colorA: string,
  colorB: string,
  time: number,
  bend: number,
  pointerX: number,
  pointerY: number,
  intensity: number,
  reducedMotion: boolean,
): void {
  const curve = buildCurve(from, to, bend, pointerX, pointerY, intensity);
  const gradient = context.createLinearGradient(from.x, from.y, to.x, to.y);
  gradient.addColorStop(0, `rgba(${colorA}, 0.95)`);
  gradient.addColorStop(1, `rgba(${colorB}, 0.95)`);

  context.save();
  context.lineCap = "round";

  traceCurve(context, curve);
  context.strokeStyle = gradient;
  context.globalAlpha = 0.2 + intensity * 0.08;
  context.lineWidth = 11.5 + intensity * 1.5;
  context.shadowColor = `rgba(${colorB}, 0.8)`;
  context.shadowBlur = 20 + intensity * 14;
  context.stroke();

  traceCurve(context, curve);
  context.globalAlpha = 0.84 + intensity * 0.1;
  context.lineWidth = 2 + intensity * 0.25;
  context.shadowBlur = 8 + intensity * 5;
  context.stroke();

  if (!reducedMotion) {
    PARTICLES.forEach((particle) => {
      if (particle.lane !== lane) return;
      const progress = (particle.offset + time * particle.speed * (1 + intensity * 0.18)) % 1;
      const point = getBezierPoint(curve, progress);
      context.beginPath();
      context.arc(point.x, point.y, particle.radius + intensity * 0.18, 0, Math.PI * 2);
      context.fillStyle = `rgba(${colorB}, 0.96)`;
      context.globalAlpha = 0.88;
      context.shadowBlur = 9;
      context.fill();
    });
  }

  context.restore();
}

function drawScene(
  canvas: HTMLCanvasElement,
  scene: HTMLElement,
  refs: SceneRefs,
  time: number,
  pointerX: number,
  pointerY: number,
  intensity: number,
  reducedMotion: boolean,
): void {
  const question = refs.question;
  const product = refs.product;
  const engine = refs.engine;
  const [proofA, proofB, proofC] = refs.proofs;
  if (!question || !product || !engine || !proofA || !proofB || !proofC) return;

  const rect = scene.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const context = canvas.getContext("2d");
  if (!context) return;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  drawConnection(
    context,
    anchor(scene, question, "right", 0.52),
    anchor(scene, engine, "left", 0.3),
    0,
    COLORS.blue,
    COLORS.cyan,
    time,
    -10,
    pointerX,
    pointerY,
    intensity,
    reducedMotion,
  );

  drawConnection(
    context,
    anchor(scene, product, "right", 0.48),
    anchor(scene, engine, "left", 0.72),
    1,
    COLORS.green,
    COLORS.cyan,
    time,
    12,
    pointerX,
    pointerY,
    intensity,
    reducedMotion,
  );

  drawConnection(
    context,
    anchor(scene, engine, "right", 0.34),
    anchor(scene, proofA, "left", 0.5),
    2,
    COLORS.green,
    COLORS.cyan,
    time,
    -10,
    pointerX,
    pointerY,
    intensity,
    reducedMotion,
  );

  drawConnection(
    context,
    anchor(scene, engine, "right", 0.54),
    anchor(scene, proofB, "left", 0.5),
    3,
    COLORS.blue,
    COLORS.cyan,
    time,
    0,
    pointerX,
    pointerY,
    intensity,
    reducedMotion,
  );

  drawConnection(
    context,
    anchor(scene, engine, "right", 0.74),
    anchor(scene, proofC, "left", 0.5),
    4,
    COLORS.green,
    COLORS.cyan,
    time,
    10,
    pointerX,
    pointerY,
    intensity,
    reducedMotion,
  );
}

export function HeroProductFlowCanvas() {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const questionRef = useRef<HTMLElement | null>(null);
  const productRef = useRef<HTMLElement | null>(null);
  const engineRef = useRef<HTMLElement | null>(null);
  const proofOneRef = useRef<HTMLDivElement | null>(null);
  const proofTwoRef = useRef<HTMLDivElement | null>(null);
  const proofThreeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const canvas = canvasRef.current;
    if (!scene || !canvas) return undefined;

    const hero = scene.closest<HTMLElement>(".home-hero") ?? scene;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = mediaQuery.matches;
    let frame: number | null = null;
    let cancelled = false;
    let lastMove = performance.now();

    const refs: SceneRefs = {
      question: questionRef.current,
      product: productRef.current,
      engine: engineRef.current,
      proofs: [proofOneRef.current, proofTwoRef.current, proofThreeRef.current],
    };

    const pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      activity: 0,
      targetActivity: 0,
    };

    const resize = () => {
      drawScene(canvas, scene, refs, performance.now() / 1000, pointer.x, pointer.y, pointer.activity, reducedMotion);
    };

    const updatePointer = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.targetX = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      pointer.targetY = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
      pointer.targetActivity = 1;
      lastMove = performance.now();
    };

    const resetPointer = () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
      pointer.targetActivity = 0;
    };

    const renderFrame = (now: number) => {
      if (cancelled) return;

      if (now - lastMove > 800) {
        pointer.targetActivity = 0;
        pointer.targetX *= 0.985;
        pointer.targetY *= 0.985;
      }

      const ease = reducedMotion ? 1 : 0.07;
      pointer.x += (pointer.targetX - pointer.x) * ease;
      pointer.y += (pointer.targetY - pointer.y) * ease;
      pointer.activity += (pointer.targetActivity - pointer.activity) * ease;

      const fx = pointer.x * pointer.activity;
      const fy = pointer.y * pointer.activity;

      scene.style.setProperty("--spot-x", `${50 + pointer.x * 11}%`);
      scene.style.setProperty("--spot-y", `${48 + pointer.y * 8}%`);
      scene.style.setProperty("--scene-x", `${(fx * 2.2).toFixed(2)}px`);
      scene.style.setProperty("--scene-y", `${(fy * 1.8).toFixed(2)}px`);
      scene.style.setProperty("--q-x", `${(fx * 4).toFixed(2)}px`);
      scene.style.setProperty("--q-y", `${(fy * 3.2).toFixed(2)}px`);
      scene.style.setProperty("--p-x", `${(fx * 6.2).toFixed(2)}px`);
      scene.style.setProperty("--p-y", `${(fy * 5).toFixed(2)}px`);
      scene.style.setProperty("--e-x", `${(fx * 8.8).toFixed(2)}px`);
      scene.style.setProperty("--e-y", `${(fy * 6.5).toFixed(2)}px`);
      scene.style.setProperty("--a-x", `${(fx * 5.8).toFixed(2)}px`);
      scene.style.setProperty("--a-y", `${(fy * 4.4).toFixed(2)}px`);

      drawScene(canvas, scene, refs, now / 1000, pointer.x, pointer.y, pointer.activity, reducedMotion);
      frame = window.requestAnimationFrame(renderFrame);
    };

    const onReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (reducedMotion) resetPointer();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(scene);
    hero.addEventListener("pointermove", updatePointer, { passive: true });
    hero.addEventListener("pointerenter", updatePointer, { passive: true });
    hero.addEventListener("pointerleave", resetPointer, { passive: true });
    mediaQuery.addEventListener("change", onReducedMotionChange);

    scene.dataset.ready = "true";
    resize();
    frame = window.requestAnimationFrame(renderFrame);

    return () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      hero.removeEventListener("pointermove", updatePointer);
      hero.removeEventListener("pointerenter", updatePointer);
      hero.removeEventListener("pointerleave", resetPointer);
      mediaQuery.removeEventListener("change", onReducedMotionChange);
    };
  }, []);

  return (
    <div
      ref={sceneRef}
      className={styles.scene}
      data-ready="false"
      data-mpreply-hero="commerce-answer-pipeline"
      data-testid="hero-product-flow"
      role="img"
      aria-label="Сцена MP Reply AI: обращение покупателя, контекст товара, проверка данных и готовый ответ"
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <div className={styles.grid}>
        <div className={styles.leftColumn}>
          <div ref={(node) => { questionRef.current = node; }} className={`${styles.card} ${styles.questionCard}`}>
            <div className={styles.kicker}>
              <span className={styles.number}>01</span>
              <span>Вопрос покупателя</span>
            </div>
            <p className={styles.cardTitle}>На широкую стопу подойдёт?</p>
            <p className={styles.meta}>Вопрос покупателя · 10:24</p>
          </div>

          <div ref={(node) => { productRef.current = node; }} className={`${styles.card} ${styles.productCard}`}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.kicker}>
                  <span className={styles.number}>02</span>
                  <span>Контекст товара</span>
                </div>
                <p className={styles.cardTitle}>Кроссовки для ходьбы</p>
              </div>
            </div>

            <div className={styles.photo}>
              {/* Direct public asset avoids the Next image optimizer path in patch-only deployments. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/mpreply-hero-sneakers.webp"
                alt="Белые женские кроссовки"
                width="780"
                height="370"
                loading="eager"
                decoding="async"
              />
            </div>

            <div className={styles.specs}>
              <div className={styles.spec}>40 · стелька 25,5 см</div>
              <div className={styles.spec}>41 · стелька 26 см</div>
              <div className={`${styles.spec} ${styles.specFull}`}>Полнота колодки не указана</div>
            </div>
          </div>
        </div>

        <div className={styles.engineWrap}>
          <div ref={(node) => { engineRef.current = node; }} className={`${styles.card} ${styles.engineCard}`}>
            <p className={styles.engineTitle}>Сверяет товар, отзывы и правила</p>

            <div className={styles.steps}>
              <div className={styles.step}>
                <span className={styles.number}>1</span>
                <span>Определяет смысл вопроса</span>
              </div>
              <div className={styles.step}>
                <span className={styles.number}>2</span>
                <span>Проверяет карточку и отзывы</span>
              </div>
              <div className={styles.step}>
                <span className={styles.number}>3</span>
                <span>Собирает ответ и доказательства</span>
              </div>
            </div>

            <div className={styles.status}>Ответ проверен по данным</div>
          </div>
        </div>

        <div className={styles.answerWrap}>
          <div className={`${styles.card} ${styles.answerCard}`}>
            <div className={styles.answerHead}>
              <div className={styles.answerLabel}>03 · Готовый ответ</div>
              <div className={styles.confidence}>95%</div>
            </div>

            <p className={styles.cardTitle}>Лучше взять 41 размер.</p>
            <p className={styles.answerCopy}>
              По отзывам модель узкая в носочной части. Для широкой стопы 41-й даст запас и сядет комфортнее.
            </p>

            <div className={styles.proofs}>
              <div ref={(node) => { proofOneRef.current = node; }} className={styles.proof}>
                <div className={styles.tick}>✓</div>
                <div>
                  <strong>40-й подходит по длине</strong>
                  <small>Стелька 25,5 см</small>
                </div>
              </div>

              <div ref={(node) => { proofTwoRef.current = node; }} className={styles.proof}>
                <div className={styles.tick}>✓</div>
                <div>
                  <strong>41-й комфортнее для широкой стопы</strong>
                  <small>Отзывы: посадка узкая</small>
                </div>
              </div>

              <div ref={(node) => { proofThreeRef.current = node; }} className={styles.proof}>
                <div className={styles.tick}>✓</div>
                <div>
                  <strong>Запас по стельке — около 5 мм</strong>
                  <small>Около 5 мм запаса</small>
                </div>
              </div>
            </div>

            <div className={styles.publish}>Ответ готов к публикации</div>
          </div>
        </div>
      </div>
    </div>
  );
}
