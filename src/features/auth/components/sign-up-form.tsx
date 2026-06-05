"use client";

import { useState } from "react";

import { OAuthProviderButtons } from "@/features/auth/components/oauth-provider-buttons";
import { resendVerification, signUp, verifyEmail } from "@/core/auth/auth-actions";

export function SignUpForm({ providers }: { providers: string[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"register" | "verify">("register");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    const result = await signUp(email.trim(), password, name.trim());

    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    if (result.requireVerification) {
      setStep("verify");
      setMessage("Check your email for a verification code.");
      setIsLoading(false);
      return;
    }

    window.location.href = "/protected";
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const result = await verifyEmail(email.trim(), otp.trim());

    if (result.success) {
      window.location.href = "/protected";
      return;
    }

    setError(result.error);
    setIsLoading(false);
  }

  async function handleResend() {
    setError("");
    setMessage("");
    const result = await resendVerification(email.trim());

    if (result.success) {
      setMessage("Verification code resent.");
      return;
    }

    setError(result.error);
  }

  if (step === "verify") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Verificá tu correo</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Enviamos un código de 6 dígitos a <span className="font-medium text-[var(--foreground)]">{email}</span>
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleVerify}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="otp">
              Código de verificación
            </label>
            <input
              id="otp"
              type="text"
              required
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              className="flex h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center text-lg tracking-[0.35em] text-[var(--foreground)] outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              placeholder="000000"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>

          {error ? <p className="text-sm text-red-500 font-medium">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-500 font-medium">{message}</p> : null}

          <button
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-amber-600 px-4 text-sm font-semibold text-white shadow-lg shadow-amber-950/20 transition-all hover:bg-amber-500 active:scale-[0.98] disabled:opacity-50"
            type="submit"
            disabled={isLoading || otp.length < 6}
          >
            {isLoading ? "Verificando..." : "Verificar Código"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--muted-foreground)]">
          ¿No recibiste el código?{" "}
          <button type="button" className="text-[var(--foreground)] underline-offset-4 hover:underline transition-colors" onClick={() => void handleResend()}>
            Reenviar
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Crear una Cuenta</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Ingresá tus datos para comenzar</p>
      </div>

      <form className="space-y-4" onSubmit={handleSignUp}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="name">
            Nombre Completo
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            className="flex h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            placeholder="Tu nombre completo"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

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
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            className="flex h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            placeholder="Creá una contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-red-500 font-medium">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-500 font-medium">{message}</p> : null}

        <button
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-amber-600 px-4 text-sm font-semibold text-white shadow-lg shadow-amber-950/20 transition-all hover:bg-amber-500 active:scale-[0.98] disabled:opacity-50"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? "Registrando..." : "Registrarse"}
        </button>
      </form>

      <OAuthProviderButtons providers={providers} />
    </div>
  );
}
