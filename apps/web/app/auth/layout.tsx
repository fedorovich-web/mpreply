import type { Metadata } from "next";

import { AppProviders } from "../../components/providers/AppProviders";
import "../../styles/auth.css";

export const metadata: Metadata = {
  title: "Вход и регистрация | MPReply",
  description: null,
  alternates: null,
  openGraph: null,
  twitter: null,
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppProviders>{children}</AppProviders>;
}
