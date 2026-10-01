import type { Metadata } from "next";

import { DemoEntry } from "../../../components/public-site/DemoEntry";

export const metadata: Metadata = {
  title: "MPReply demo workspace",
  description: "Open the real MPReply interface with sample messages, without signing up.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoEntry locale="en" />;
}
