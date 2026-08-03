import type { Metadata } from "next";
import "./globals.css";

// SITE_NOINDEX=true impone noindex global hasta superar 150 publicaciones
// reales (SEO_ARCHITECTURE.md §7, DATA_SEEDING.md §3). Variable explícita:
// apagarla es una acción deliberada del propietario, nunca un olvido.
const siteNoindex = process.env.SITE_NOINDEX === "true";

export const metadata: Metadata = {
  title: "moto.com.py",
  description: "Portal de motos en Paraguay: comprá, vendé y financiá tu moto.",
  ...(siteNoindex ? { robots: { index: false } } : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-PY">
      <body className="antialiased">{children}</body>
    </html>
  );
}
