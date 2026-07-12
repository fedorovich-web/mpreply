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

type CanvasSettings = {
  transparent: string;
  glowMultiplier: number;
  glowOpacity: number;
  edgeFadeStart: number;
  edgeFadeEnd: number;
  dprMax: number;
  fps: number;
  reducedMotionTime: number;
  samplePoints: number;
  centerOffsetStep: number;
  harmonicFrequencyRatio: number;
  harmonicSpeedRatio: number;
  harmonicAmplitudeRatio: number;
  envelopeBase: number;
  envelopeGain: number;
};

function readCssValue(styles: CSSStyleDeclaration, variable: string): string {
  return styles.getPropertyValue(variable).trim();
}

function readCssNumber(styles: CSSStyleDeclaration, variable: string): number {
  const value = Number.parseFloat(readCssValue(styles, variable));
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric canvas token: ${variable}`);
  }
  return value;
}

function createWavePath(
  width: number,
  height: number,
  time: number,
  layer: FlowLayer,
  index: number,
  settings: CanvasSettings,
): Path2D {
  const points = Math.max(24, Math.round(settings.samplePoints));
  const step = width / (points - 1);
  const center = height * (0.5 + index * settings.centerOffsetStep);
  const path = new Path2D();

  for (let point = 0; point < points; point += 1) {
    const x = point * step;
    const progress = point / (points - 1);
    const envelope = settings.envelopeBase + Math.sin(progress * Math.PI) * settings.envelopeGain;
    const primary =
      Math.sin(progress * Math.PI * layer.frequency + time * layer.speed + layer.phase) *
      layer.amplitude *
      envelope;
    const harmonic =
      Math.sin(
        progress * Math.PI * (layer.frequency * settings.harmonicFrequencyRatio) -
          time * layer.speed * settings.harmonicSpeedRatio +
          layer.phase * 1.7,
      ) *
      layer.amplitude *
      settings.harmonicAmplitudeRatio;
    const y = center + primary + harmonic;

    if (point === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }

  return path;
}

function drawRibbon(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  layer: FlowLayer,
  index: number,
  settings: CanvasSettings,
) {
  const path = createWavePath(width, height, time, layer, index, settings);
  const gradient = context.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, settings.transparent);
  gradient.addColorStop(settings.edgeFadeStart, layer.color);
  gradient.addColorStop(0.5, layer.color);
  gradient.addColorStop(settings.edgeFadeEnd, layer.color);
  gradient.addColorStop(1, settings.transparent);

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  context.globalAlpha = layer.alpha * settings.glowOpacity;
  context.filter = `blur(${layer.blur * settings.glowMultiplier}px)`;
  context.lineWidth = layer.thickness * settings.glowMultiplier;
  context.strokeStyle = gradient;
  context.stroke(path);

  context.globalAlpha = layer.alpha;
  context.filter = `blur(${layer.blur}px)`;
  context.lineWidth = layer.thickness;
  context.stroke(path);
  context.restore();
}

function readCanvasConfiguration(height: number): { layers: FlowLayer[]; settings: CanvasSettings } {
  const styles = getComputedStyle(document.documentElement);
  const settings: CanvasSettings = {
    transparent: readCssValue(styles, "--color-transparent"),
    glowMultiplier: readCssNumber(styles, "--canvas-glow-multiplier"),
    glowOpacity: readCssNumber(styles, "--canvas-glow-opacity"),
    edgeFadeStart: readCssNumber(styles, "--canvas-edge-fade-start"),
    edgeFadeEnd: readCssNumber(styles, "--canvas-edge-fade-end"),
    dprMax: readCssNumber(styles, "--canvas-dpr-max"),
    fps: readCssNumber(styles, "--canvas-fps"),
    reducedMotionTime: readCssNumber(styles, "--canvas-reduced-motion-time"),
    samplePoints: readCssNumber(styles, "--canvas-sample-points"),
    centerOffsetStep: readCssNumber(styles, "--canvas-center-offset-step"),
    harmonicFrequencyRatio: readCssNumber(styles, "--canvas-harmonic-frequency-ratio"),
    harmonicSpeedRatio: readCssNumber(styles, "--canvas-harmonic-speed-ratio"),
    harmonicAmplitudeRatio: readCssNumber(styles, "--canvas-harmonic-amplitude-ratio"),
    envelopeBase: readCssNumber(styles, "--canvas-envelope-base"),
    envelopeGain: readCssNumber(styles, "--canvas-envelope-gain"),
  };

  const layer = (
    suffix: "violet" | "mint" | "soft-violet" | "soft-mint",
  ): FlowLayer => ({
    color: readCssValue(styles, `--canvas-color-${suffix}`),
    alpha: readCssNumber(styles, `--canvas-opacity-${suffix}`),
    amplitude: height * readCssNumber(styles, `--canvas-amplitude-${suffix}`),
    thickness: height * readCssNumber(styles, `--canvas-width-${suffix}`),
    phase: readCssNumber(styles, `--canvas-phase-${suffix}`),
    speed: readCssNumber(styles, `--canvas-speed-${suffix}`),
    frequency: readCssNumber(styles, `--canvas-frequency-${suffix}`),
    blur: readCssNumber(styles, `--canvas-blur-${suffix}`),
  });

  return {
    layers: [layer("violet"), layer("mint"), layer("soft-violet"), layer("soft-mint")],
    settings,
  };
}

export function HeroFlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = reducedMotionQuery.matches;
    let animationFrame = 0;
    let startTime = performance.now();
    let lastFrameTime = 0;
    let isVisible = true;
    let width = 0;
    let height = 0;
    let layers: FlowLayer[] = [];
    let settings: CanvasSettings | null = null;

    const refreshConfiguration = () => {
      const configuration = readCanvasConfiguration(height);
      layers = configuration.layers;
      settings = configuration.settings;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const currentSettings = settings ?? readCanvasConfiguration(Math.max(1, rect.height)).settings;
      const dpr = Math.min(window.devicePixelRatio || 1, currentSettings.dprMax);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      refreshConfiguration();
    };

    const render = (timestamp: number) => {
      if (!settings) refreshConfiguration();
      if (!settings) return;

      const frameInterval = 1000 / settings.fps;
      if (!reducedMotion && timestamp - lastFrameTime < frameInterval) {
        animationFrame = window.requestAnimationFrame(render);
        return;
      }

      lastFrameTime = timestamp;
      context.clearRect(0, 0, width, height);
      const elapsed = reducedMotion ? settings.reducedMotionTime : timestamp - startTime;

      layers.forEach((currentLayer, index) => {
        drawRibbon(context, width, height, elapsed, currentLayer, index - 1.5, settings!);
      });

      if (!reducedMotion && isVisible && !document.hidden) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };

    const restart = () => {
      window.cancelAnimationFrame(animationFrame);
      startTime = performance.now();
      lastFrameTime = 0;
      refreshConfiguration();
      render(startTime);
    };

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      restart();
    };

    const resizeObserver = new ResizeObserver(() => {
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

    resizeObserver.observe(canvas);
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
      resizeObserver.disconnect();
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
