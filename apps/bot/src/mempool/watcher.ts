import type { Hex, PublicClient } from "viem";
import { log } from "../util/logger.js";

export type PendingHandler = (hashes: Hex[]) => void | Promise<void>;

/** Subscribe to pending txs; falls back to polling txpool_content if WS unavailable. */
export function startMempoolWatcher(
  client: PublicClient,
  operatorAddress: `0x${string}` | undefined,
  onPending: PendingHandler,
): () => void {
  const op = operatorAddress?.toLowerCase();
  if (!op) {
    log.warn("OPERATOR address missing — set deployments JSON after LiquiChain deploy");
    return () => {};
  }

  const unwatch = client.watchPendingTransactions({
    onTransactions: async (hashes) => {
      try {
        const filtered: Hex[] = [];
        for (const h of hashes) {
          const tx = await client.getTransaction({ hash: h });
          if (!tx?.to) continue;
          if (tx.to.toLowerCase() === op) filtered.push(h);
        }
        if (filtered.length) await onPending(filtered);
      } catch (e) {
        log.warn({ err: e }, "pending tx handler error");
      }
    },
    poll: true,
    pollingInterval: 2_000,
  });

  log.info("Mempool watcher started (polling mode for broad client compatibility)");
  return unwatch;
}
