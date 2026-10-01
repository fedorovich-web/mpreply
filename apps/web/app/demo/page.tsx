import type { Metadata } from "next";

import { DemoEntry } from "../../components/public-site/DemoEntry";

export const metadata: Metadata = {
  title: "Демо-кабинет MPReply",
  description: "Откройте интерфейс MPReply с демонстрационными обращениями без регистрации.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoEntry locale="ru" />;
}
