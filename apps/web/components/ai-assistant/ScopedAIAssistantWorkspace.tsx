"use client";

import { AIAssistantWorkspace } from "./AIAssistantWorkspace";
import { useWorkspace } from "../workspace/WorkspaceProvider";

export function ScopedAIAssistantWorkspace() {
  const { activeOrganization } = useWorkspace();
  return <AIAssistantWorkspace key={activeOrganization.id} />;
}
