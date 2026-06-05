"use client";

import Link from "next/link";
import { useState } from "react";

import { OAuthProviderButtons } from "@/features/auth/components/oauth-provider-buttons";
import { signIn } from "@/core/auth/auth-actions";

export function SignInForm({ providers }: { providers: string[] }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const result = await signIn(email.trim(), password);

    if (result.success) {
      window.location.href = "/protected";
      return;
    }

    setError(result.error);
    setIsLoading(false);
  }

  return (
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="email">
            Correo Electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="flex h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="password">
              Contraseña
            </label>
            <Link href="/auth/reset-password" className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="flex h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            placeholder="Ingresá tu contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-red-500 font-medium">{error}</p> : null}

        <button
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-amber-600 px-4 text-sm font-semibold text-white shadow-lg shadow-amber-950/20 transition-all hover:bg-amber-500 active:scale-[0.98] disabled:opacity-50"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? "Ingresando..." : "Ingresar al ERP"}
        </button>
      </form>

      <OAuthProviderButtons providers={providers} />
    </div>
  );
}
