import { config as loadEnv } from "dotenv";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
loadEnv({ path: join(root, ".env") });

const env = process.env;

export const rpcHttpUrl = env.RPC_HTTP_URL ?? "http://127.0.0.1:8545";
export const rpcWsUrl = env.RPC_WS_URL ?? "ws://127.0.0.1:8545";
export const chainId = Number(env.CHAIN_ID ?? "31337");
export const botPrivateKey = env.BOT_PRIVATE_KEY as `0x${string}` | undefined;
export const minProfitWei = BigInt(env.MIN_PROFIT_WEI ?? "0");
export const minVictimSizeWei = BigInt(env.MIN_VICTIM_SIZE_WEI ?? "100000000000000000");
export const maxFrontSizeWei = BigInt(env.MAX_FRONT_SIZE_WEI ?? "10000000000000000000");
export const frontTipBumpGwei = BigInt(env.FRONT_TIP_BUMP_GWEI ?? "2");
export const manualMine = env.MANUAL_MINE === "1";

/** Optional override when `operator` in deployments is still zero (local experiments). */
export const operatorWatchOverride = env.BOT_WATCH_ADDRESS as `0x${string}` | undefined;
