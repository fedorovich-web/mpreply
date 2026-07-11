import { Suspense } from "react";

import { AuthForm } from "../../../components/auth/AuthForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="auth-page"><section className="auth-card"><p>Загрузка...</p></section></main>}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
