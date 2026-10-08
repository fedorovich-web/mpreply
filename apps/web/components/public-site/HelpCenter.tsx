"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { getHelpContent, helpIcons, type HelpCategoryId, type HelpIconName } from "../../lib/help-content";
import { localizedPath, type Locale } from "../../lib/i18n";
import { useClientReady } from "../../lib/use-client-ready";
import { PublicIcon } from "./PublicIcon";

const copy = {
  ru: {
    title: <>Помощь и ответы<br />на вопросы</>,
    description: "Инструкции, ответы и полезные материалы по работе с MPReply. Найдите решение или обратитесь в поддержку.",
    categories: "Категории", categoriesAria: "Разделы помощи", supportTitle: "Не нашли ответ?",
    supportText: "Напишите в поддержку — поможем разобраться и подскажем решение.", supportAction: "Написать в поддержку",
    allQuestions: "Все популярные вопросы",
    shortcuts: ["Начало работы", "Интеграции", "ИИ-ответы", "Тарифы", "Проблемы и решения"],
  },
  en: {
    title: <>Help and answers<br />to your questions</>,
    description: "Guidance and answers for working with MPReply. Find a solution or contact support.",
    categories: "Categories", categoriesAria: "Help topics", supportTitle: "Need more help?",
    supportText: "Contact support. We will help you understand the issue and find the next step.", supportAction: "Contact support",
    allQuestions: "All popular questions",
    shortcuts: ["Getting started", "Integrations", "AI replies", "Pricing", "Troubleshooting"],
  },
} as const;

const shortcuts: Array<{ category: HelpCategoryId; icon: HelpIconName }> = [
  { category: "start", icon: "launch" },
  { category: "integrations", icon: "integrations" },
  { category: "ai", icon: "ai" },
  { category: "pricing", icon: "security" },
  { category: "problems", icon: "warning" },
];

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readHash() { return window.location.hash.slice(1); }
function initialHash() { return "popular"; }

function HelpIcon({ name, className = "" }: { name: HelpIconName; className?: string }) {
  return <Image className={`faq-icon ${className}`} src={`/images/help/${helpIcons[name]}`} width={36} height={36} alt="" aria-hidden="true" unoptimized />;
}

export function HelpCenter({ locale }: { locale: Locale }) {
  const labels = copy[locale];
  const { categories, questions } = getHelpContent(locale);
  const hydrated = useClientReady();
  const hash = useSyncExternalStore(subscribeToHash, readHash, initialHash);
  const activeCategory = categories.find((item) => item.id === hash) ?? categories[0];
  const activeQuestions = activeCategory.questions.map((id) => questions.find((item) => item.id === id)!);
  const [expandedByCategory, setExpandedByCategory] = useState<Partial<Record<HelpCategoryId, string | null>>>({});
  const expanded = expandedByCategory[activeCategory.id] === undefined
    ? activeQuestions[0]?.id
    : expandedByCategory[activeCategory.id];

  function selectCategory(id: HelpCategoryId, scroll = false) {
    window.history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    if (scroll) document.getElementById("faq")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }

  return (
    <div className="faq-page">
      <section className="faq-hero help-approved-hero" aria-labelledby="help-title">
        <div className="public-container faq-hero-inner">
          <div className="faq-hero-scene">
          <div className="faq-hero-copy">

            <h1 id="help-title">{labels.title}</h1>
            <p className="public-lead">{labels.description}</p>
          </div>
          <Image className="faq-hero-image" src="/images/help/19-faq-hero-image.avif" width={1448} height={1086} alt="" aria-hidden="true" priority unoptimized sizes="(max-width: 760px) 100vw, 60vw" />
          </div>
          <nav className="faq-hero-shortcuts" aria-label={labels.categoriesAria}>
            {shortcuts.map((item, index) => (
              <a href={`#${item.category}`} key={item.category} onClick={(event) => { event.preventDefault(); selectCategory(item.category, true); }}>
                <HelpIcon name={item.icon} /><span>{labels.shortcuts[index]}</span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="faq-content public-section" id="faq" aria-label={labels.categoriesAria}>
        <div className="public-container faq-layout">
          <aside className="faq-sidebar">
            <p className="faq-sidebar-title"><strong>{labels.categories}</strong></p>
            <div className="faq-category-list" role="tablist" aria-label={labels.categoriesAria} aria-orientation="vertical">
              {categories.map((category, index) => (
                <button type="button" role="tab" key={category.id} id={`faq-tab-${category.id}`}
                  disabled={!hydrated}
                  aria-selected={category.id === activeCategory.id} aria-controls="faq-question-panel"
                  tabIndex={category.id === activeCategory.id ? 0 : -1}
                  onClick={() => selectCategory(category.id)}
                  onKeyDown={(event) => {
                    let next = index;
                    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % categories.length;
                    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index - 1 + categories.length) % categories.length;
                    else if (event.key === "Home") next = 0;
                    else if (event.key === "End") next = categories.length - 1;
                    else return;
                    event.preventDefault();
                    selectCategory(categories[next].id);
                    document.getElementById(`faq-tab-${categories[next].id}`)?.focus();
                  }}>
                  <HelpIcon name={category.icon} /><span>{category.label}</span>
                </button>
              ))}
            </div>
            <div className="faq-support-card">
              <Image className="faq-support-robot" src="/images/help/20-support-robot.avif" width={1254} height={1254} alt="" aria-hidden="true" unoptimized />
              <div className="faq-support-copy"><p className="faq-support-title"><strong>{labels.supportTitle}</strong></p><p>{labels.supportText}</p></div>
              <Link className="button button-primary" href={localizedPath(locale, "/contacts")}><PublicIcon name="send" />{labels.supportAction}</Link>
            </div>
          </aside>

          <div className="faq-main" id="faq-question-panel" role="tabpanel" aria-labelledby={`faq-tab-${activeCategory.id}`}>
            <div className="faq-heading">

              <h2>{activeCategory.title}</h2>
              <p>{activeCategory.description}</p>
              {activeCategory.id !== "popular" ? <button className="faq-back" type="button" onClick={() => selectCategory("popular")}>{labels.allQuestions}</button> : null}
            </div>
            <div className="faq-question-list">
              {activeQuestions.map((item) => {
                const isOpen = item.id === expanded;
                const answerId = `faq-answer-${item.id}`;
                return (
                  <div className="faq-question" data-open={isOpen} key={item.id}>
                    <button className="faq-question-trigger" type="button" aria-expanded={isOpen} aria-controls={answerId} id={`faq-question-${item.id}`}
                      disabled={!hydrated}
                      onClick={() => setExpandedByCategory((current) => ({ ...current, [activeCategory.id]: isOpen ? null : item.id }))}>
                      <HelpIcon name={item.icon} /><span>{item.question}</span>
                      <svg className="faq-chevron" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <div className="faq-answer-transition" id={answerId} inert={!isOpen} aria-hidden={!isOpen}>
                      <div className="faq-answer">
                        <p>{item.answer}</p>
                        {item.link ? <Link href={localizedPath(locale, item.link.href)}>{item.link.label}<span aria-hidden="true"> →</span></Link> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
