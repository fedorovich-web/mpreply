import { AppShell } from "../../components/app-shell/AppShell";

export default function DashboardAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
