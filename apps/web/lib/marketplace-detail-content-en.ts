import type { MarketplaceDetailContent } from "./marketplace-detail-content";
import type { MarketplaceKey } from "./site-config";

const commonTrust = ["14-day trial", "Team review controls", "Rule-based automation"] as const;

const marketplaceDetailContentEn: Record<MarketplaceKey, MarketplaceDetailContent> = {
  wildberries: {
    heroTitle: "Wildberries reviews and questions in one reply workflow",
    heroDescription:
      "Bring supported Wildberries reviews and questions into MPReply, draft replies with product context, and route exceptions to your team for review.",
    heroNote: "WB reviews and questions\nin one queue",
    trustItems: ["14-day trial", "Reviews and questions", "Automation or review before sending"],
    sampleType: "Product question",
    sampleMessage: "Which size should I choose for a 25 cm foot?",
    sampleContext: "Women's sneakers\nSize guide available on the product page",
    sampleReply:
      "The size guide on the product page is the best reference for a 25 cm foot. If you are between two sizes, compare the model measurements before ordering.",
    sampleVisual: "product",
    sidebarItems: [
      { icon: "inbox", label: "All messages", count: 17 },
      { icon: "message", label: "Reviews", count: 7 },
      { icon: "message", label: "Questions", count: 10, active: true },
      { icon: "shield-check", label: "Needs review", count: 3 },
      { icon: "gear", label: "Automation" },
    ],
    toolsHeading: "Handle Wildberries feedback without repetitive manual work",
    toolsDescription:
      "MPReply keeps reviews and questions in a clear workflow, helps prepare replies, and preserves team control over exceptions.",
    tools: [
      { icon: "inbox", tone: "blue", title: "Messages waiting for a reply", text: "New reviews and questions that need action stay in one queue instead of requiring repeated checks across seller panels." },
      { icon: "sparkles", tone: "purple", title: "Drafts with product context", text: "AI prepares a reply using the customer message and available product context, giving the manager a useful starting point." },
      { icon: "shield-check", tone: "green", title: "Review for exceptions", text: "Ambiguous or sensitive cases can stay with the team instead of being sent automatically." },
      { icon: "clock", tone: "purple", title: "Visible workflow status", text: "The team can see what is done, what needs action, and which replies require attention." },
    ],
    stepsHeading: "From a new Wildberries review to a ready reply",
    stepsDescription: "The workflow mirrors the day-to-day handling of supported Wildberries reviews and questions.",
    steps: [
      { icon: "link", title: "Connect Wildberries", text: "Add the marketplace connection to the workspace and choose the seller account your team will use." },
      { icon: "inbox", title: "Open messages that need a reply", text: "Supported reviews and questions appear in the shared MPReply queue with their current status and available context." },
      { icon: "document", title: "Review the prepared draft", text: "Use the AI-assisted draft as a starting point and edit it where needed before sending." },
      { icon: "shield-check", title: "Send automatically or after review", text: "Your rules decide which routine cases can move automatically and which remain with a teammate." },
    ],
    benefitsHeading: "What changes in daily Wildberries work",
    benefitsDescription: "The team focuses on the message queue and reply quality instead of switching between separate screens.",
    benefits: [
      { icon: "message", tone: "orange", title: "A dedicated feedback flow", text: "Wildberries reviews and questions stay visible instead of being mixed into unrelated tasks." },
      { icon: "users", tone: "purple", title: "One team process", text: "Status, assignments, and rules help the team work through customer messages consistently." },
      { icon: "document", tone: "blue", title: "Every reply starts with a draft", text: "AI-assisted drafts provide a base that can be reviewed and adjusted before sending." },
      { icon: "clock", tone: "blue", title: "Clear remaining work", text: "Workflow status makes unanswered messages and cases waiting for review easy to spot." },
    ],
    faqIntro: "Key points about handling supported Wildberries reviews and questions in MPReply.",
    faq: [
      { icon: "link", question: "What from Wildberries appears in MPReply?", answer: "Supported reviews and questions received through the integration appear in the shared queue with workflow status and available product context." },
      { icon: "shield-check", question: "Do replies have to be sent automatically?", answer: "No. Routine cases may follow automation rules, while exceptions can remain under manual review." },
      { icon: "users", question: "Can several teammates work from the same queue?", answer: "Yes. Customer messages can be assigned to teammates and filtered by assignee within the workspace." },
    ],
    finalTitle: "Bring Wildberries reviews and questions into one managed workflow",
    finalDescription: "Start with a 14-day trial and test the workflow on your own marketplace queue.",
  },
  ozon: {
    heroTitle: "Ozon customer messages without constant context switching",
    heroDescription:
      "Bring supported Ozon customer messages into MPReply, keep message type and available context visible, draft replies with AI, and control sending.",
    heroNote: "Ozon customer messages\nin one queue",
    trustItems: commonTrust,
    sampleType: "Customer question",
    sampleMessage: "Where can I find the specifications for this product?",
    sampleContext: "Product page\nAvailable message context",
    sampleReply:
      "The main specifications are listed on the product page. If you tell us which parameter you need, we can answer using the information available there.",
    sampleVisual: "product",
    sidebarItems: [
      { icon: "inbox", label: "All messages", count: 24 },
      { icon: "message", label: "Needs reply", count: 9, active: true },
      { icon: "clock", label: "In progress", count: 6 },
      { icon: "shield-check", label: "Needs review", count: 4 },
      { icon: "gear", label: "Automation" },
    ],
    toolsHeading: "One workflow for supported Ozon customer messages",
    toolsDescription: "The team works from one queue with message type, workflow status, and available context visible before replying.",
    tools: [
      { icon: "inbox", tone: "blue", title: "Shared queue", text: "Supported Ozon customer messages enter the common MPReply workflow with a clear current state." },
      { icon: "message", tone: "purple", title: "Message type stays visible", text: "Different marketplace scenarios remain distinguishable instead of being flattened into one generic feed." },
      { icon: "sparkles", tone: "green", title: "Drafts from available context", text: "AI prepares a reply from the customer message and available context, giving the manager a practical starting point." },
      { icon: "shield-check", tone: "purple", title: "Rules before sending", text: "Routine cases can follow automation while non-standard messages remain under team review." },
    ],
    stepsHeading: "How the Ozon workflow looks in MPReply",
    stepsDescription: "The same queue logic applies to customer-message types available through the connected Ozon integration.",
    steps: [
      { icon: "link", title: "Connect Ozon", text: "Add the Ozon connection to the workspace and choose the seller account your team will use." },
      { icon: "inbox", title: "Open incoming messages", text: "The queue shows message type, current status, and what requires action now." },
      { icon: "document", title: "Use the prepared draft", text: "Review the reply next to the available message context and edit it when needed." },
      { icon: "shield-check", title: "Send according to team rules", text: "MPReply separates automated handling from cases that need a person to review them." },
    ],
    benefitsHeading: "What the Ozon team gets",
    benefitsDescription: "Supported customer messages become part of one operating process instead of isolated manual tasks.",
    benefits: [
      { icon: "inbox", tone: "orange", title: "One working queue", text: "Supported Ozon customer messages can be handled from one MPReply workspace." },
      { icon: "users", tone: "purple", title: "Clear ownership", text: "Assignments and workflow status make it clear who is handling the message and what comes next." },
      { icon: "document", tone: "blue", title: "Context stays next to the reply", text: "The draft sits beside the customer message so available information remains visible to the manager." },
      { icon: "clock", tone: "blue", title: "Actionable status", text: "The queue separates new messages from completed work and cases waiting for review." },
    ],
    faqIntro: "Common questions about the MPReply workflow for Ozon.",
    faq: [
      { icon: "message", question: "Which Ozon message types can be handled in MPReply?", answer: "Only customer-message types available through the connected integration. MPReply preserves their type, status, and available context in the shared queue." },
      { icon: "shield-check", question: "How is automatic sending controlled?", answer: "Team rules define automated scenarios, while exceptions and uncertain cases stay under review." },
      { icon: "users", question: "Can several managers work together?", answer: "Yes. Customer messages can be assigned and filtered by assignee inside the organization's workspace." },
    ],
    finalTitle: "Handle supported Ozon customer messages from one queue",
    finalDescription: "Use the 14-day trial to test the workflow after connecting the seller account you need.",
  },
  "yandex-market": {
    heroTitle: "Yandex Market customer messages in one shared queue",
    heroDescription:
      "Bring supported Yandex Market customer messages into MPReply, preserve their type and available context, draft replies with AI, and keep sending under control.",
    heroNote: "Yandex Market messages\nin one queue",
    trustItems: commonTrust,
    sampleType: "Customer question",
    sampleMessage: "Where can I find the terms for this product?",
    sampleContext: "Product page\nAvailable message context",
    sampleReply:
      "We can use the information available on the product page and in this conversation. Tell us which detail you need and we will answer from the available context.",
    sampleVisual: "product",
    sidebarItems: [
      { icon: "inbox", label: "All messages", count: 19 },
      { icon: "message", label: "Needs reply", count: 8, active: true },
      { icon: "clock", label: "In progress", count: 5 },
      { icon: "shield-check", label: "Needs review", count: 3 },
      { icon: "gear", label: "Automation" },
    ],
    toolsHeading: "Supported Yandex Market workflows in one interface",
    toolsDescription: "The team sees message type, workflow status, and available context before replying and handles them with one operating model.",
    tools: [
      { icon: "inbox", tone: "blue", title: "Shared queue", text: "Supported Yandex Market customer messages enter one MPReply workflow with a clear current state." },
      { icon: "message", tone: "purple", title: "Message type stays visible", text: "The type supplied by the integration stays visible so different workflows do not collapse into an anonymous feed." },
      { icon: "sparkles", tone: "green", title: "Drafts from current context", text: "AI prepares a reply for the specific customer message using only the available product and workflow context." },
      { icon: "shield-check", tone: "purple", title: "Review before sending", text: "Automation rules can cover routine cases while exceptions remain in the review queue." },
    ],
    stepsHeading: "From an incoming Yandex Market message to a reply",
    stepsDescription: "The workflow keeps message type, context, draft, and final action in one place.",
    steps: [
      { icon: "link", title: "Connect Yandex Market", text: "Add the marketplace connection to your workspace and select the seller account the team will use." },
      { icon: "inbox", title: "Work from the incoming queue", text: "Supported messages appear with their type, status, and available context." },
      { icon: "document", title: "Review the AI-assisted draft", text: "Check the suggested reply against the current message and product context and edit where needed." },
      { icon: "shield-check", title: "Send under your rules", text: "Use automation for routine cases and team review for anything that needs judgment." },
    ],
    benefitsHeading: "What changes for a Yandex Market team",
    benefitsDescription: "Customer messages follow a repeatable operating process instead of being handled as disconnected tasks.",
    benefits: [
      { icon: "inbox", tone: "orange", title: "Messages stay in one queue", text: "Supported Yandex Market messages remain visible alongside work from other connected marketplaces." },
      { icon: "users", tone: "purple", title: "Ownership is visible", text: "Assignments and status make it clear who is responsible and what needs to happen next." },
      { icon: "document", tone: "blue", title: "The draft uses available context", text: "Managers review an AI-assisted starting point instead of repeatedly writing common replies from scratch." },
      { icon: "clock", tone: "blue", title: "Pending work is easy to find", text: "Workflow status makes unanswered and review-required messages easy to separate from completed work." },
    ],
    faqIntro: "Common questions about the MPReply workflow for Yandex Market.",
    faq: [
      { icon: "message", question: "Which Yandex Market customer messages appear in MPReply?", answer: "Only message types available through the connected integration. Their type, status, and available context are preserved in the shared queue." },
      { icon: "shield-check", question: "Can the team review replies before sending?", answer: "Yes. Automation can be limited to routine scenarios, while exceptions remain under manual review." },
      { icon: "users", question: "Can work be distributed across a team?", answer: "Yes. Assignments and filters help teams split responsibility without losing the shared queue." },
    ],
    finalTitle: "Bring Yandex Market customer messages into one managed workflow",
    finalDescription: "Start with a 14-day trial and evaluate the workflow on the seller account your team uses.",
  },
  avito: {
    heroTitle: "Avito buyer conversations in one managed queue",
    heroDescription:
      "Bring supported Avito buyer messages into MPReply with listing context, AI-assisted drafts, assignments, workflow status, and review before sending.",
    heroNote: "Avito buyer messages\nin one queue",
    trustItems: commonTrust,
    sampleType: "Buyer message",
    sampleMessage: "Is this item still available?",
    sampleContext: "Listing\nAvailable conversation context",
    sampleReply:
      "The item is shown as available in the current listing context. If anything changes, the latest status will be reflected in the listing.",
    sampleVisual: "listing",
    sidebarItems: [
      { icon: "inbox", label: "All conversations", count: 21 },
      { icon: "message", label: "Needs reply", count: 8, active: true },
      { icon: "clock", label: "In progress", count: 7 },
      { icon: "shield-check", label: "Needs review", count: 2 },
      { icon: "gear", label: "Automation" },
    ],
    toolsHeading: "One operating flow for supported Avito buyer messages",
    toolsDescription: "Keep the buyer message, listing context, draft, ownership, and next action together instead of treating every conversation as a separate manual task.",
    tools: [
      { icon: "inbox", tone: "blue", title: "Shared conversation queue", text: "Supported Avito buyer messages stay in one MPReply queue with their current workflow state." },
      { icon: "message", tone: "purple", title: "Listing context stays nearby", text: "The manager sees the available listing and conversation context next to the reply workflow." },
      { icon: "sparkles", tone: "green", title: "AI-assisted reply draft", text: "AI prepares a starting point from the buyer message and available context before the team decides what to send." },
      { icon: "shield-check", tone: "purple", title: "Exceptions stay under review", text: "Messages that need judgment can remain with a teammate instead of being handled automatically." },
    ],
    stepsHeading: "From an Avito buyer message to a controlled reply",
    stepsDescription: "The conversation stays connected to its context, assignment, draft, and final sending decision.",
    steps: [
      { icon: "link", title: "Connect Avito", text: "Add the Avito connection to the workspace and choose the seller account the team will use." },
      { icon: "inbox", title: "Open buyer conversations", text: "Supported messages appear in the shared queue with status and available listing context." },
      { icon: "document", title: "Review the prepared reply", text: "Use the AI-assisted draft as a starting point and adjust it to the specific conversation." },
      { icon: "shield-check", title: "Send under team rules", text: "Routine cases can follow automation while non-standard conversations remain under review." },
    ],
    benefitsHeading: "What changes when Avito messages enter the shared workflow",
    benefitsDescription: "The team gets one visible queue, clearer ownership, and a repeatable way to handle buyer conversations.",
    benefits: [
      { icon: "message", tone: "orange", title: "One queue for buyer conversations", text: "Supported Avito messages stay visible instead of being scattered across separate manual tasks." },
      { icon: "users", tone: "purple", title: "Clear responsibility", text: "Assignments and workflow status help avoid duplicated work and show who owns the next action." },
      { icon: "document", tone: "blue", title: "Draft before manual typing", text: "AI prepares a useful starting point that can be reviewed and tailored to the specific buyer conversation." },
      { icon: "clock", tone: "blue", title: "Conversation state is visible", text: "Managers can quickly distinguish messages that need a reply from work that is already complete." },
    ],
    faqIntro: "Key points about handling supported Avito buyer conversations in MPReply.",
    faq: [
      { icon: "message", question: "What does the Avito integration focus on?", answer: "Supported buyer messages and listing conversations that can be brought into the shared MPReply queue." },
      { icon: "shield-check", question: "What happens with a complex buyer message?", answer: "It can remain under team review so a person confirms or edits the reply before sending." },
      { icon: "users", question: "Can several teammates handle conversations together?", answer: "Yes. Assignments and workflow status help distribute work across the shared queue." },
    ],
    finalTitle: "Bring supported Avito buyer messages into a managed queue",
    finalDescription: "Use the 14-day trial to test the shared workflow after connecting your seller account.",
  },
};

export function getMarketplaceDetailContentEn(key: MarketplaceKey): MarketplaceDetailContent {
  return marketplaceDetailContentEn[key];
}
