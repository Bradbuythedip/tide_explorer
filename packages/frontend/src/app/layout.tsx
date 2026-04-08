import type { Metadata } from "next";
import { Onboarding } from "@/components/Onboarding";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "prevblock — Tidecoin block explorer",
    template: "%s · prevblock",
  },
  description:
    "Tidecoin block explorer. Search blocks, transactions, and addresses on the Tidecoin chain.",
  metadataBase: new URL("https://prevblock.com"),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Onboarding />
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
