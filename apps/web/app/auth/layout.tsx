import type { Metadata } from "next";

import { AppProviders } from "../../components/providers/AppProviders";

export const metadata: Metadata = {
  title: "Вход и регистрация | MPReply",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppProviders>{children}</AppProviders>;
}