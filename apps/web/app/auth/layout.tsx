import { AppProviders } from "../../components/providers/AppProviders";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppProviders>{children}</AppProviders>;
}
