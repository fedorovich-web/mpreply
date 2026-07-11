import type { Metadata } from "next";

import { AppShell } from "../../components/app-shell/AppShell";
import { AppProviders } from "../../components/providers/AppProviders";
import { WorkspaceProvider } from "../../components/workspace/WorkspaceProvider";

export const metadata: Metadata = {
  title: "Workspace",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DashboardAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppProviders>
      <WorkspaceProvider>
        <AppShell>{children}</AppShell>
      </WorkspaceProvider>
    </AppProviders>
  );
}
