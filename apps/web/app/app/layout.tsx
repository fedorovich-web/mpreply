import type { Metadata } from "next";

import { AppShell } from "../../components/app-shell/AppShell";

export const metadata: Metadata = {
  title: "Workspace",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DashboardAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
