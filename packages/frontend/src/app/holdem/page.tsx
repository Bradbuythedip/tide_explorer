import type { Metadata } from "next";
import { HoldemClient } from "./client";

export const metadata: Metadata = {
  title: "Tide Hold'em",
  description:
    "Texas Hold'em poker on the Tidecoin network. Play against bots with TDC.",
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
