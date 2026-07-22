import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "./pwa-register";

const LOGO_URL =
  "https://ghqsqqegblhseocxmwwx.supabase.co/storage/v1/object/public/brand-assets/Screenshot_20260722_100709_ChatGPT.jpg";

export const metadata: Metadata = {
  title: "Avance Vendas",
  description: "Sistema de controle de produtos, estoque, clientes, vendas e financeiro.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: LOGO_URL, type: "image/jpeg" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: LOGO_URL, type: "image/jpeg" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Avance Vendas",
  },
  openGraph: {
    title: "Avance Vendas",
    description: "Sistema de controle de produtos, estoque, clientes, vendas e financeiro.",
    images: [{ url: LOGO_URL, width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "Avance Vendas",
    description: "Sistema de controle de produtos, estoque, clientes, vendas e financeiro.",
    images: [LOGO_URL],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#060a17",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
