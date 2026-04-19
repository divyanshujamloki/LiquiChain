import type { PublicClient, WalletClient } from "viem";
import { log } from "../util/logger.js";
import { manualMine } from "../config.js";
import type { VictimIntent } from "@nfs/shared";

/**
 * Sandwich simulation scaffold: logs ordering plan.
 * Wire real `eth_sendRawTransaction` front/back once operator ABI + pool state are available.
 */
export async function simulateSandwich(
  publicClient: PublicClient,
  _wallet: WalletClient,
  victim: VictimIntent,
): Promise<void> {
  log.info(
    {
      victimHash: victim.hash,
      to: victim.to,
      gasPrice: victim.gasPrice?.toString(),
      tip: victim.maxPriorityFeePerGas?.toString(),
    },
    "sandwich simulation (EOA txs not yet wired — extend submitter.ts)",
  );

  if (manualMine) {
    try {
      const c = publicClient as unknown as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
      await c.request({ method: "anvil_mine", params: ["0x1"] });
      log.info("anvil_mine(1) after simulated sandwich");
    } catch {
      log.debug("anvil_mine not available (non-Anvil RPC)");
    }
  }
}
