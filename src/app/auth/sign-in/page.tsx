import Link from "next/link";

import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/sign-in-form";
export default async function SignInPage() {
  return (
    <AuthShell
      footer={
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          ¿No tenés una cuenta?{" "}
          <Link href="/auth/sign-up" className="text-[var(--foreground)] underline-offset-4 hover:underline">
            Registrate
          </Link>
        </p>
      }
    >
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">Bienvenido al Sistema</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Ingresá con tus credenciales de operador</p>
        </div>

        <SignInForm providers={[]} />
      </div>
    </AuthShell>
  );
}
