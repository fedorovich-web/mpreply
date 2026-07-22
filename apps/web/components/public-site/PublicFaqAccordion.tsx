"use client";

import type { CSSProperties } from "react";
import { useCallback, useLayoutEffect, useId, useRef, useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

type PublicFaqAccordionProps = {
  items: readonly FaqItem[];
};

export function PublicFaqAccordion({ items }: PublicFaqAccordionProps) {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState(0);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [panelHeights, setPanelHeights] = useState<number[]>([]);

  const measurePanels = useCallback(() => {
    setPanelHeights(items.map((_, index) => panelRefs.current[index]?.scrollHeight ?? 0));
  }, [items]);

  useLayoutEffect(() => {
    measurePanels();
    window.addEventListener("resize", measurePanels);

    return () => window.removeEventListener("resize", measurePanels);
  }, [measurePanels]);

  return (
    <div className="faq-accordion">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const triggerId = `${baseId}-trigger-${index}`;
        const answerStyle = {
          "--faq-answer-height": isOpen ? `${panelHeights[index] ?? 0}px` : "0px",
        } as CSSProperties;

        return (
          <article className={`faq-item${isOpen ? " is-open" : ""}`} key={item.question}>
            <h3>
              <button
                id={triggerId}
                className="faq-item-trigger"
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(index)}
              >
                <span>{item.question}</span>
                <span className="faq-item-icon" aria-hidden="true" />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              className="faq-item-answer"
              style={answerStyle}
              aria-hidden={!isOpen}
            >
              <div
                ref={(node) => {
                  panelRefs.current[index] = node;
                }}
                className="faq-item-answer-inner"
              >
                <p>{item.answer}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
