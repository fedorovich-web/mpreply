import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const headerSource = readFileSync(resolve(process.cwd(), "components/public-site/PublicHeader.tsx"), "utf8");
const calculatorSource = readFileSync(resolve(process.cwd(), "components/public-site/AnswerPackCalculator.tsx"), "utf8");
const pricingPageSource = readFileSync(resolve(process.cwd(), "app/pricing/page.tsx"), "utf8");
const siteConfigSource = readFileSync(resolve(process.cwd(), "lib/site-config.ts"), "utf8");
const publicStyleSource = readFileSync(resolve(process.cwd(), "styles/public-site.css"), "utf8");
const tokenSource = readFileSync(resolve(process.cwd(), "styles/tokens.css"), "utf8");

describe("Respio pricing and menu visual contract", () => {
  it("keeps the public navigation free of visible rail/link backgrounds", () => {
    expect(headerSource).toContain("public-header-v90");
    expect(headerSource).toContain("public-nav-rail-v90");
    expect(headerSource).toContain("public-nav-link-dot-v90");
    expect(headerSource).toContain("public-mobile-menu-panel-v90");
    expect(headerSource).toContain("public-mobile-menu-close-v90");
    expect(siteConfigSource).toContain('href: "/about"');
    expect(siteConfigSource).toContain('href: "/blog"');
    expect(headerSource).toContain("document.body.style.overflow = \"hidden\"");
    expect(headerSource).not.toContain("href: \"/#product\"");
    expect(publicStyleSource).toContain("Respio 0.1.90 · dependency-warning audit, typography, pricing and menu recovery");
    expect(publicStyleSource).toContain("Respio 0.1.94 · public hero spacing, lists and trial modal form recovery");
    expect(publicStyleSource).toMatch(/\.public-nav-rail-v90,[\s\S]*?background:\s*var\(--public-v86-transparent\) !important;[\s\S]*?box-shadow:\s*var\(--public-v86-none\) !important;/);
    expect(publicStyleSource).toMatch(/\.public-nav-v90 \.public-nav-link-v90::before \{[\s\S]*?content:\s*none !important;[\s\S]*?display:\s*none !important;/);
    expect(publicStyleSource).toMatch(/\.public-nav-link-label-v90::after \{[\s\S]*?width:\s*100%;[\s\S]*?transform:\s*var\(--public-v90-nav-underline-hidden\);/);
    expect(publicStyleSource).toMatch(/\.public-nav-v90 \.public-nav-link-v90\[aria-current='page'\] \.public-nav-link-label-v90::after \{[\s\S]*?transform:\s*var\(--public-v90-nav-underline-visible\);/);
  });

  it("keeps accepted typography scale and 18px public lead copy", () => {
    expect(tokenSource).toContain("--font-size-h1: 3.625rem;");
    expect(tokenSource).toContain("--font-size-h2: 3rem;");
    expect(tokenSource).toContain("--font-size-h3: 1.75rem;");
    expect(tokenSource).toContain("--font-size-lead: 1.125rem;");
    expect(tokenSource).toContain("--public-v91-header-bg: #ffffff;");
    expect(tokenSource).toContain("--public-v91-h2-size: var(--font-size-h2);");
    expect(publicStyleSource).toContain(".answer-pack-calculator-copy-v90 > p:not(.public-eyebrow)");
    expect(publicStyleSource).toMatch(/font-size:\s*var\(--font-size-lead\) !important;/);
  });



  it("uses one public eyebrow contract across public sections", () => {
    expect(publicStyleSource).toContain(".public-eyebrow,");
    expect(publicStyleSource).toContain("align-items: center !important;");
    expect(publicStyleSource).toContain("margin: 0 0 var(--public-eyebrow-to-heading) !important;");
    expect(publicStyleSource).toContain("border-radius: var(--radius-control-soft) !important;");
    expect(publicStyleSource).toContain("background: var(--color-eyebrow-surface) !important;");
    expect(publicStyleSource).toContain("padding: var(--public-chip-padding-block) var(--public-chip-padding-inline) !important;");
  });

  it("keeps the approved pricing hero headline instead of the rejected shortened H1", () => {
    expect(pricingPageSource).toContain("<h1>Пакеты автоответов без подписки</h1>");
    expect(pricingPageSource).not.toContain("<h1>Цены на автоответы для маркетплейсов</h1>");
  });

  it("calms the pricing trial card and removes the rejected decorative stripe", () => {
    expect(pricingPageSource).toContain("pricing-page-hero-v90");
    expect(pricingPageSource).toContain("pricing-page-trial-card-v90");
    expect(pricingPageSource).toContain("<h2>{trialOffer.answerLimit} ответов для проверки сервиса</h2>");
    expect(pricingPageSource).toContain("Модерация — только по настройке");
    expect(publicStyleSource).toMatch(/\.pricing-page-trial-card-v90 > h2,[\s\S]*?font-size:\s*var\(--public-v94-panel-title-size\) !important;/);
    expect(publicStyleSource).toMatch(/\.pricing-page-trial-card-v90 > h2,[\s\S]*?white-space:\s*nowrap !important;/);
    expect(publicStyleSource).toMatch(/\.pricing-page-trial-card-v90 li,[\s\S]*?display:\s*grid !important;[\s\S]*?gap:\s*var\(--public-v94-list-marker-gap\) !important;/);
  });

  it("keeps the calculator neutral and stretches the result card with the controls", () => {
    expect(calculatorSource).toContain("answer-pack-calculator-v90");
    expect(calculatorSource).toContain("Подберите пакет под поток обращений");
    expect(calculatorSource).toContain("answer-pack-result-action-shell-v90");
    expect(publicStyleSource).toMatch(/\.answer-pack-calculator-grid-v90 \{[\s\S]*?align-items:\s*stretch !important;/);
    expect(publicStyleSource).toMatch(/\.answer-pack-field-v90 input\[type="range"\] \{[\s\S]*?background:\s*var\(--pricing-v90-range-track\) !important;/);
    expect(tokenSource).not.toMatch(/--pricing-v90-range-track:[^;]*var\(--range-progress/);
    expect(publicStyleSource).toMatch(/\.answer-pack-calculator-result-v90 \{[\s\S]*?align-self:\s*stretch !important;/);
  });


  it("keeps the trial modal as a contact form without marketplace preselection", () => {
    const modalSource = readFileSync(resolve(process.cwd(), "components/public-site/PublicTrialModal.tsx"), "utf8");
    expect(modalSource).toContain("public-trial-dialog-v94");
    expect(modalSource).toContain('name="name"');
    expect(modalSource).toContain('name="phone"');
    expect(modalSource).toContain('name="email"');
    expect(modalSource).not.toContain("Первый маркетплейс для теста");
    expect(modalSource).not.toContain("<select");
    expect(publicStyleSource).toContain("Respio 0.1.94 · public hero spacing, lists and trial modal form recovery");
  });

  it("keeps final CTA buttons readable on dark cards and result CTA blue", () => {
    expect(publicStyleSource).toMatch(/\.answer-pack-result-action-v90,[\s\S]*?background:\s*var\(--gradient-brand-action\) !important;/);
    expect(publicStyleSource).toMatch(/\.home-final-cta-card \.home-final-cta-primary,[\s\S]*?background:\s*#ffffff !important;[\s\S]*?color:\s*var\(--color-brand-primary\) !important;/);
  });

  it("uses honest auto-first public copy without absolute quality claims", () => {
    const publicCopy = [pricingPageSource].join("\n");
    expect(publicCopy).toContain("ответов для отзывов, вопросов и чатов");
    expect(publicCopy).toContain("согласование включается только для выбранных сценариев");
    expect(publicCopy).toMatch(/автопубликац|автоматическ[а-яё]+ публикац/i);
    expect(publicCopy).not.toMatch(/идеальн|самыми сложными/i);
  });
});
