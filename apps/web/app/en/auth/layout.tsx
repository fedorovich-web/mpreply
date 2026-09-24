import type { Metadata } from "next";

import { AppProviders } from "../../../components/providers/AppProviders";
import "../../../styles/auth.css";

export const metadata: Metadata = {
  title: "Login and registration | MPReply",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function EnglishAuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppProviders>{children}</AppProviders>;
}
