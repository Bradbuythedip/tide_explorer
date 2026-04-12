/** Minimal type declarations for pokersolver (no @types available). */

declare module "pokersolver" {
  export class Hand {
    /** Solve a hand from card strings like ["As","Kh","Qd","Jc","Ts"]. */
    static solve(cards: string[], game?: string, canDisqualify?: boolean): Hand;
    /** Compare two solved hands. Returns <0 if a wins, >0 if b wins, 0 if tie. */
    static winners(hands: Hand[]): Hand[];

    name: string;
    descr: string;
    rank: number;
    cards: Array<{ value: string; suit: string; rank: number }>;
  }
}
