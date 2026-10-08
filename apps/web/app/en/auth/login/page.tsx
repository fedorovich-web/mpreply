import { Suspense } from "react";

import { AuthForm } from "../../../../components/auth/AuthForm";

export default function EnglishLoginPage() {
  return (
    <Suspense fallback={<main className="auth-page"><section className="auth-card"><p>Loading...</p></section></main>}>
      <AuthForm mode="login" locale="en" />
    </Suspense>
  );
}
