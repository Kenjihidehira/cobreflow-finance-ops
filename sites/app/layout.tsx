import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CobreFlow - Finance Ops",
  description: "Conciliacao, cobranca ativa e priorizacao de recebiveis.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
