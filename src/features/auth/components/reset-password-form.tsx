"use client";

import { useState } from "react";

import { exchangeResetCode, resetPassword, sendResetEmail } from "@/core/auth/auth-actions";

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSendEmail(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    const result = await sendResetEmail(email.trim());

    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setMessage("Revisá tu correo para ver el código de restablecimiento.");
    setStep("code");
    setIsLoading(false);
  }

  async function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const result = await exchangeResetCode(email.trim(), code.trim());

    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setToken(result.token);
    setStep("password");
    setIsLoading(false);
  }

  async function handleResetPassword(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const result = await resetPassword(newPassword, token);

    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    window.location.href = "/auth/sign-in";
  }

  return (
    <div className="space-y-6">
      {step === "email" ? (
        <>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Restablecer contraseña</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Ingresá tu correo electrónico para enviarte un código de recuperación
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSendEmail}>
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

            {error ? <p className="text-sm text-red-500 font-medium">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-555 font-medium">{message}</p> : null}

            <button
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-amber-600 px-4 text-sm font-semibold text-white shadow-lg shadow-amber-950/20 transition-all hover:bg-amber-500 active:scale-[0.98] disabled:opacity-50"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Enviando..." : "Enviar código"}
            </button>
          </form>
        </>
      ) : null}

      {step === "code" ? (
        <>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Ingresá el código de verificación</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Enviamos un código a <span className="font-medium text-[var(--foreground)]">{email}</span>
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleVerifyCode}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="code">
                Código de verificación
              </label>
              <input
                id="code"
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                className="flex h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center text-lg tracking-[0.35em] text-[var(--foreground)] outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>

            {error ? <p className="text-sm text-red-500 font-medium">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-500 font-medium">{message}</p> : null}

            <button
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-amber-600 px-4 text-sm font-semibold text-white shadow-lg shadow-amber-950/20 transition-all hover:bg-amber-500 active:scale-[0.98] disabled:opacity-50"
              type="submit"
              disabled={isLoading || code.length < 6}
            >
              {isLoading ? "Verificando..." : "Verificar Código"}
            </button>
          </form>
        </>
      ) : null}

      {step === "password" ? (
        <>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Nueva contraseña</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Elegí una nueva contraseña para tu cuenta</p>
          </div>

          <form className="space-y-4" onSubmit={handleResetPassword}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="new-password">
                Nueva contraseña
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                className="flex h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                placeholder="Ingresá tu nueva contraseña"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>

            {error ? <p className="text-sm text-red-500 font-medium">{error}</p> : null}

            <button
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-amber-600 px-4 text-sm font-semibold text-white shadow-lg shadow-amber-950/20 transition-all hover:bg-amber-500 active:scale-[0.98] disabled:opacity-50"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Guardando..." : "Establecer contraseña"}
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
