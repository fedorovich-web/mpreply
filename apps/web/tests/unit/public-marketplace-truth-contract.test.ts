import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const hub = read("app/marketplaces/page.tsx");
const detail = read("lib/marketplace-detail-content.ts");
const siteConfig = read("lib/site-config.ts");
const wbPage = read("app/marketplaces/wildberries/page.tsx");
const ozonPage = read("app/marketplaces/ozon/page.tsx");
const yandexPage = read("app/marketplaces/yandex-market/page.tsx");
const avitoPage = read("app/marketplaces/avito/page.tsx");

const forbiddenAcrossPublicMarketplaceCopy = [
  "со всех маркетплейсов",
  "четыре готовые интеграции",
  "Интеграция готова",
  "Смотреть видео",
  "точные и персонализированные ответы",
  "настраивайте роли",
  "контролируйте нагрузку",
  "Шаблоны ответов",
  'label: "Шаблоны"',
  'label: "Команда"',
];

for (const phrase of forbiddenAcrossPublicMarketplaceCopy) {
  if (`${hub}\n${detail}\n${siteConfig}`.includes(phrase)) {
    throw new Error(`Marketplace public copy must not contain unsupported claim: ${phrase}`);
  }
}

if (hub.includes("Сообщения и отзывы")) {
  throw new Error("Avito hub card must not claim reviews; the public scenario is buyer messages/dialogs.");
}

if (!detail.includes('heroTitle: "Отзывы и вопросы Wildberries — в одном рабочем процессе"')) {
  throw new Error("Wildberries detail must retain the runtime-verified reviews + questions scope.");
}

if (detail.includes("отзывы, вопросы и сообщения Wildberries")) {
  throw new Error("Wildberries public detail must not add buyer messages beyond the verified adapter scope.");
}

if (!detail.includes('heroTitle: "Обращения Ozon — без постоянных переключений"')) {
  throw new Error("Ozon detail heading must stay channel-neutral until runtime channel certification is available.");
}

if (!detail.includes('heroTitle: "Обращения Яндекс Маркета — в единой очереди"')) {
  throw new Error("Yandex Market detail heading must stay channel-neutral until runtime channel certification is available.");
}

if (!siteConfig.includes('const marketplaceStatusLabel = "Интеграция MPReply"')) {
  throw new Error("Marketplace status label must describe the product surface, not claim runtime certification.");
}

if (!wbPage.includes("Отзывы и вопросы Wildberries")) {
  throw new Error("Wildberries SEO metadata must preserve its verified channel scope.");
}

if (ozonPage.includes("отзывы, вопросы и чаты") || yandexPage.includes("Отзывы, вопросы и чаты")) {
  throw new Error("Uncertified Ozon/Yandex channel lists must not appear as SEO promises.");
}

if (!avitoPage.includes("поддерживаемые диалоги")) {
  throw new Error("Avito metadata must retain its explicit supported-dialog qualification.");
}
