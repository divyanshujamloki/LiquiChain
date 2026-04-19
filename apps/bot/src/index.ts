import { createPublicClient, createWalletClient, defineChain, http, isHex, zeroAddress } from "viem";
import { foundry } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { loadDeployments } from "@nfs/shared/addresses";
import { isOperatorConfigured } from "@nfs/shared";
import * as cfg from "./config.js";
import { startMempoolWatcher } from "./mempool/watcher.js";
import { decodeVictimGeneric } from "./decoder/swapDecoder.js";
import { estimateSandwichProfitWei, isProfitable } from "./strategy/profitability.js";
import { simulateSandwich } from "./executor/submitter.js";
import { log } from "./util/logger.js";

function chainFromId(id: number) {
  if (id === 31337) return foundry;
  return defineChain({
    id,
    name: "LiquiChain stack",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcHttpUrl] } },
  });
}

async function main() {
  const chain = chainFromId(cfg.chainId);
  const publicClient = createPublicClient({
    chain,
    transport: http(cfg.rpcHttpUrl),
  });

  let deployments;
  try {
    deployments = loadDeployments(cfg.chainId);
  } catch (e) {
    log.error({ err: e }, "failed to load deployments JSON");
    process.exit(1);
  }

  if (!isOperatorConfigured(deployments)) {
    log.warn(
      { operator: deployments.operator, watchTarget: deployments.watchTarget },
      "operator is zero — bot watches `watchTarget` until LiquiChain operator is set",
    );
  }

  const operator = (cfg.operatorWatchOverride ??
    (isOperatorConfigured(deployments) ? deployments.operator : deployments.watchTarget)) as `0x${string}`;
  if (operator === zeroAddress) {
    log.error("Bot exiting: no watch address (run deploy mocks or set BOT_WATCH_ADDRESS)");
    process.exit(1);
  }

  if (!cfg.botPrivateKey || !isHex(cfg.botPrivateKey)) {
    log.error("BOT_PRIVATE_KEY missing or invalid in .env");
    process.exit(1);
  }

  const account = privateKeyToAccount(cfg.botPrivateKey);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(cfg.rpcHttpUrl),
  });

  log.info(
    {
      chainId: cfg.chainId,
      rpc: cfg.rpcHttpUrl,
      operator,
      bot: account.address,
    },
    "sandwich bot started",
  );

  const stop = startMempoolWatcher(publicClient, operator, async (hashes) => {
    for (const h of hashes) {
      const tx = await publicClient.getTransaction({ hash: h });
      if (!tx) continue;
      const victim = decodeVictimGeneric(tx, operator);
      if (!victim) continue;

      log.info({ hash: victim.hash, from: victim.from }, "pending tx to operator");

      const profit = estimateSandwichProfitWei(victim);
      if (!isProfitable(profit, cfg.minProfitWei)) {
        log.debug({ hash: victim.hash, profit: profit.toString() }, "skip unprofitable");
        continue;
      }

      await simulateSandwich(publicClient, walletClient, victim);
    }
  });

  const shutdown = () => {
    stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  log.error(e);
  process.exit(1);
});
