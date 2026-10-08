import type { Metadata } from "next";

import { HelpCenter } from "../../components/public-site/HelpCenter";
import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Помощь и ответы на вопросы — MPReply",
  description: "Ответы на вопросы о подключении маркетплейсов, работе с обращениями, ИИ-ответах, тарифах и доступах в MPReply.",
  path: "/help",
  localized: true,
});

export default function HelpPage() {
  return <PublicShell><HelpCenter locale="ru" /></PublicShell>;
}
