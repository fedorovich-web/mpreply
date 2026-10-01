import type { Metadata } from "next";

import { HelpCenter } from "../../../components/public-site/HelpCenter";
import { PublicShell } from "../../../components/public-site/PublicShell";
import { createPageMetadata } from "../../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "MPReply help and FAQ",
  description: "Answers about marketplace connections, customer messages, AI replies, plans, and permissions in MPReply.",
  path: "/help",
  locale: "en",
  localized: true,
});

export default function EnglishHelpPage() {
  return <PublicShell locale="en"><HelpCenter locale="en" /></PublicShell>;
}
