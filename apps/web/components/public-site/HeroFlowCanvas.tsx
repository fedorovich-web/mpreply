"use client";

import { useEffect, useRef } from "react";

type FlowLayer = {
  color: string;
  alpha: number;
  amplitude: number;
  thickness: number;
  phase: number;
  speed: number;
  frequency: number;
  blur: number;
};

function readCssColor(variable: string, fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }

  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

function drawRibbon(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  layer: FlowLayer,
  index: number,
) {
  const points = 18;
  const step = width / (points - 1);
  const center = height * (0.5 + index * 0.012);
  const top: Array<[number, number]> = [];
  const bottom: Array<[number, number]> = [];

  for (let point = 0; point < points; point += 1) {
    const x = point * step;
    const progress = point / (points - 1);
    const envelope = 0.46 + Math.sin(progress * Math.PI) * 0.82;
    const wave =
      Math.sin(progress * Math.PI * layer.frequency + time * layer.speed + layer.phase) *
        layer.amplitude *
        envelope +
      Math.sin(progress * Math.PI * (layer.frequency * 0.54) - time * layer.speed * 0.72 + layer.phase * 1.7) *
        layer.amplitude *
        0.36;
    const localThickness =
      layer.thickness *
      (0.56 + Math.sin(progress * Math.PI * 2.8 + layer.phase + time * layer.speed * 0.4) * 0.24);

    top.push([x, center + wave - localThickness]);
    bottom.push([x, center + wave + localThickness]);
  }

  const path = new Path2D();
  path.moveTo(top[0][0], top[0][1]);

  for (let point = 1; point < top.length; point += 1) {
    const previous = top[point - 1];
    const current = top[point];
    const midpointX = (previous[0] + current[0]) / 2;
    path.quadraticCurveTo(previous[0], previous[1], midpointX, (previous[1] + current[1]) / 2);
  }

  const lastTop = top[top.length - 1];
  path.lineTo(lastTop[0], lastTop[1]);

  for (let point = bottom.length - 1; point > 0; point -= 1) {
    const current = bottom[point];
    const previous = bottom[point - 1];
    const midpointX = (current[0] + previous[0]) / 2;
    path.quadraticCurveTo(current[0], current[1], midpointX, (current[1] + previous[1]) / 2);
  }

  path.lineTo(bottom[0][0], bottom[0][1]);
  path.closePath();

  const gradient = context.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(0.09, layer.color);
  gradient.addColorStop(0.48, layer.color);
  gradient.addColorStop(0.91, layer.color);
  gradient.addColorStop(1, "transparent");

  context.save();
  context.globalAlpha = layer.alpha;
  context.filter = `blur(${layer.blur}px)`;
  context.fillStyle = gradient;
  context.fill(path);
  context.restore();
}

export function HeroFlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      return;
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = reducedMotionQuery.matches;
    let animationFrame = 0;
    let startTime = performance.now();
    let lastFrameTime = 0;
    let isVisible = true;
    let width = 0;
    let height = 0;
    let layers: FlowLayer[] = [];

    const buildLayers = () => {
      const violet = readCssColor("--color-brand-primary", "#6f33ab");
      const mint = readCssColor("--color-brand-accent", "#79d6b0");
      const softViolet = readCssColor("--color-brand-violet-light", "#b58bdd");
      const softMint = readCssColor("--color-brand-mint-light", "#bcebd8");

      layers = [
        {
          color: violet,
          alpha: 0.68,
          amplitude: height * 0.18,
          thickness: height * 0.052,
          phase: 0.35,
          speed: 0.00042,
          frequency: 4.15,
          blur: 2.4,
        },
        {
          color: mint,
          alpha: 0.66,
          amplitude: height * 0.2,
          thickness: height * 0.048,
          phase: 2.3,
          speed: 0.00036,
          frequency: 4.65,
          blur: 3.2,
        },
        {
          color: softViolet,
          alpha: 0.38,
          amplitude: height * 0.14,
          thickness: height * 0.032,
          phase: 4.1,
          speed: 0.00028,
          frequency: 5.35,
          blur: 6.5,
        },
        {
          color: softMint,
          alpha: 0.33,
          amplitude: height * 0.16,
          thickness: height * 0.036,
          phase: 5.25,
          speed: 0.0003,
          frequency: 5.7,
          blur: 7.5,
        },
      ];
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildLayers();
    };

    const render = (timestamp: number) => {
      if (!reducedMotion && timestamp - lastFrameTime < 1000 / 30) {
        animationFrame = window.requestAnimationFrame(render);
        return;
      }

      lastFrameTime = timestamp;
      context.clearRect(0, 0, width, height);
      const elapsed = reducedMotion ? 1320 : timestamp - startTime;

      layers.forEach((layer, index) => {
        drawRibbon(context, width, height, elapsed, layer, index - 1.5);
      });

      if (!reducedMotion && isVisible && !document.hidden) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };

    const restart = () => {
      window.cancelAnimationFrame(animationFrame);
      startTime = performance.now();
      lastFrameTime = 0;
      buildLayers();
      render(startTime);
    };

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      restart();
    };

    const observer = new ResizeObserver(() => {
      resize();
      restart();
    });

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry?.isIntersecting ?? true;
        if (isVisible && !reducedMotion && !document.hidden) {
          restart();
        } else {
          window.cancelAnimationFrame(animationFrame);
        }
      },
      { threshold: 0.01 },
    );

    const handleVisibilityChange = () => {
      if (!document.hidden && isVisible && !reducedMotion) {
        restart();
      } else {
        window.cancelAnimationFrame(animationFrame);
      }
    };

    const themeObserver = new MutationObserver(() => restart());

    observer.observe(canvas);
    visibilityObserver.observe(canvas);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    reducedMotionQuery.addEventListener("change", handleMotionChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    resize();
    render(startTime);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      visibilityObserver.disconnect();
      themeObserver.disconnect();
      reducedMotionQuery.removeEventListener("change", handleMotionChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="hero-flow-canvas" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
