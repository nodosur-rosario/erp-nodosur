import Link from "next/link";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      footer={
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          <Link href="/auth/sign-in" className="text-[var(--foreground)] underline-offset-4 hover:underline">
            Volver al inicio de sesión
          </Link>
        </p>
      }
    >
      <div className="space-y-6">
        <ResetPasswordForm />
      </div>
    </AuthShell>
  );
}
