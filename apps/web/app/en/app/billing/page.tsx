import { BillingWorkspace } from "../../../../components/billing/BillingWorkspace";

export default function EnglishBillingPage() {
  return (
    <section className="app-page app-page-wide billing-page">
      <header className="app-header billing-page-header">
        <h1>Plan and limits</h1>
        <p>
          Review the current plan, billing period, and how your workspace is using the limits available to it.
        </p>
      </header>

      <BillingWorkspace />
    </section>
  );
}
