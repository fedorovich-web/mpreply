import { Suspense } from "react";

import { AuthEmailFlow } from "../../../components/auth/AuthEmailFlow";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="auth-page"><section className="auth-card"><p>Загрузка...</p></section></main>}>
      <AuthEmailFlow mode="reset-password" />
    </Suspense>
  );
}
