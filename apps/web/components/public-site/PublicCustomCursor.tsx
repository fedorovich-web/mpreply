"use client";

import { useEffect, useRef } from "react";

export function PublicCustomCursor() {
  const cursorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!cursor || !finePointer.matches || reducedMotion.matches) return undefined;

    let frame = 0;
    let x = -100;
    let y = -100;

    const render = () => {
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame = 0;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };
    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      cursor.dataset.visible = "true";
      const target = event.target instanceof Element ? event.target : null;
      cursor.dataset.interactive = String(Boolean(target?.closest("a, button, input, textarea, select, summary")));
      schedule();
    };
    const onLeave = () => { cursor.dataset.visible = "false"; };
    const onDown = () => { cursor.dataset.pressed = "true"; };
    const onUp = () => { cursor.dataset.pressed = "false"; };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div ref={cursorRef} className="public-custom-cursor" data-visible="false" data-interactive="false" data-pressed="false" aria-hidden="true">
      <span className="public-custom-cursor-ring" />
      <span className="public-custom-cursor-core" />
    </div>
  );
}
