import type { Metadata } from "next";

import { AppShell } from "../../../components/app-shell/AppShell";
import { AppProviders } from "../../../components/providers/AppProviders";
import { WorkspaceProvider } from "../../../components/workspace/WorkspaceProvider";

export const metadata: Metadata = {
  title: "Workspace | MPReply",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function EnglishDashboardAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppProviders>
      <WorkspaceProvider locale="en">
        <AppShell>{children}</AppShell>
      </WorkspaceProvider>
    </AppProviders>
  );
}
