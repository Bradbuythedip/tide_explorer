import type { Metadata } from "next";
import { HoldemClient } from "./client";

export const metadata: Metadata = {
  title: "Tide Hold'em",
  description:
    "Play-money Texas Hold'em poker on prevblock.com. Practice against 5 bot opponents.",
};

/**
 * Tide Hold'em — Texas Hold'em with real Tidecoin.
 *
 * The page is a thin server component wrapper. All game logic and
 * interactive UI runs client-side via HoldemClient.
 */
export default function HoldemPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <HoldemClient />
    </main>
  );
}
