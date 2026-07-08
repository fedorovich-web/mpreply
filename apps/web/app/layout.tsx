import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Respio — автоответы на отзывы и вопросы маркетплейсов",
  description:
    "Respio подключается к маркетплейсам через API, автоматически готовит и отправляет AI-ответы, а спорные обращения переводит на ручную проверку.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
