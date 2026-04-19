import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Address } from "viem";
import { isAddress, zeroAddress } from "viem";
import type { DeploymentAddresses } from "./types.js";

function parseAddress(value: unknown): Address {
  if (typeof value !== "string" || !isAddress(value)) return zeroAddress;
  return value;
}

function defaultDeploymentsPath(chainId: number): string {
  const fromEnv = process.env.DEPLOYMENTS_FILE;
  if (fromEnv) {
    const p = fromEnv.split("{chainId}").join(String(chainId));
    return isAbsolute(p) ? p : join(process.cwd(), p);
  }
  return join(process.cwd(), "packages", "contracts", "deployments", `${chainId}.json`);
}

/** Load deployments JSON (path from `DEPLOYMENTS_FILE` or `packages/contracts/deployments/<chainId>.json` from cwd). */
export function loadDeployments(
  chainId: number,
  explicitPath?: string,
): DeploymentAddresses {
  const root = explicitPath ?? defaultDeploymentsPath(chainId);

  const raw = JSON.parse(readFileSync(root, "utf-8")) as Record<string, unknown>;
  return {
    chainId: Number(raw.chainId ?? chainId),
    deployer: parseAddress(raw.deployer),
    mockTokenA: parseAddress(raw.mockTokenA),
    mockTokenB: parseAddress(raw.mockTokenB),
    core: parseAddress(raw.core),
    operator: parseAddress(raw.operator),
    watchTarget: parseAddress(raw.watchTarget),
  };
}
