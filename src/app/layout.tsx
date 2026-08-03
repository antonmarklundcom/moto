import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "moto.com.py",
  description: "Portal de motos en Paraguay: comprá, vendé y financiá tu moto.",
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
