import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "prevblock — Tidecoin post-quantum block explorer",
    template: "%s · prevblock",
  },
  description:
    "The first block explorer that actually knows what it's looking at on Tidecoin. Every signature on chain is Falcon-512. prevblock classifies outputs the node's own Solver() can't see.",
  metadataBase: new URL("https://prevblock.com"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
