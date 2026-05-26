import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "sonner";

const themeInitScript = `
(() => {
  try {
    const storageKey = "insforge-theme";
    const savedTheme = localStorage.getItem(storageKey) || "system";
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme = savedTheme === "system"
      ? (prefersDark ? "dark" : "light")
      : savedTheme;

    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  } catch {}
})();
`;

export const metadata: Metadata = {
  title: "ERP Nodo Sur - Sistema de Gestión Comercial",
  description: "Sistema integral de facturación y control de stock multiempresa para el comercio autopartista.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        {children}
        <Toaster
          position="top-right"
          theme="dark"
          closeButton
          toastOptions={{
            className: "!bg-zinc-950/90 !border-zinc-800/80 !text-zinc-300 font-sans text-[11px] rounded-xl backdrop-blur-md shadow-2xl",
            style: {
              background: "rgba(9, 9, 11, 0.9)",
              backdropFilter: "blur(8px)",
              borderColor: "rgba(39, 39, 42, 0.8)",
              color: "#d4d4d8",
            }
          }}
        />
      </body>
    </html>
  );
}
