import type { Metadata } from "next";
import { ThesisClient } from "./client";

export const metadata: Metadata = {
  title: "Monetary Thesis",
  description:
    "Tidecoin emits Bitcoin's monetary policy on purpose, at two calendar dates that haven't happened yet. The algebra, the charts, the specs.",
};

export default function ThesisPage() {
  return <ThesisClient />;
}
