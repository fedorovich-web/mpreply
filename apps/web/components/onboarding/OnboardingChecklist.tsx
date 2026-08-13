"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { apiRequest, buildApiQuery } from "../../lib/api/client";
import { aiInstructionSetListSchema, marketplaceAccountListSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../workspace/WorkspaceProvider";

export function OnboardingChecklist() {
  const { activeOrganization } = useWorkspace();
  const accountsQuery = useQuery({
    queryKey: ["marketplace-accounts", activeOrganization.id],
    queryFn: () => apiRequest(buildApiQuery("/api/marketplace-accounts", { organization_id: activeOrganization.id }), marketplaceAccountListSchema),
  });
  const setsQuery = useQuery({
    queryKey: ["instruction-sets", activeOrganization.id],
    queryFn: () => apiRequest(`/api/organizations/${activeOrganization.id}/instruction-sets`, aiInstructionSetListSchema),
  });
  if (accountsQuery.isPending || setsQuery.isPending || accountsQuery.error || setsQuery.error) return null;
  const accounts = accountsQuery.data;
  const steps = [
    { label: "Подключить кабинет маркетплейса", done: accounts.length > 0, href: "/app/integrations" },
    { label: "Подтвердить доступ к кабинету", done: accounts.some((item) => item.credentials_status === "valid"), href: "/app/integrations" },
    { label: "Выполнить первую синхронизацию", done: accounts.some((item) => item.last_success_sync_at !== null), href: "/app/integrations" },
    { label: "Проверить основной набор инструкций", done: setsQuery.data.some((item) => item.is_default && item.status === "active"), href: "/app/instruction-sets" },
  ];
  if (steps.every((step) => step.done)) return null;
  return <section className="onboarding-checklist" aria-labelledby="onboarding-title"><header><div><p className="eyebrow">Первый запуск</p><h2 id="onboarding-title">Подготовьте рабочее пространство</h2></div><span className="status-badge">{steps.filter((step) => step.done).length} из {steps.length}</span></header><ol>{steps.map((step) => <li data-done={step.done} key={step.label}><span aria-hidden="true">{step.done ? "✓" : ""}</span><Link href={step.href}>{step.label}</Link></li>)}</ol></section>;
}
