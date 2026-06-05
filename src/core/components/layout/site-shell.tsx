import { Suspense } from "react";

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full bg-[var(--background)] flex flex-col">
      <div className="flex-1 w-full flex flex-col">
        {children}
      </div>
    </main>
  );
}
