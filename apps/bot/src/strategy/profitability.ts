import type { VictimIntent } from "@nfs/shared";

/** Placeholder until pool math mirrors LiquiChain routing (stub profitability). */
export function estimateSandwichProfitWei(_victim: VictimIntent): bigint {
  return 0n;
}

export function isProfitable(wei: bigint, min: bigint): boolean {
  return wei >= min;
}
