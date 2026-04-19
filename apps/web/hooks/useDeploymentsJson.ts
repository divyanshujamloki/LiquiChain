"use client";

import { useEffect, useState } from "react";
import type { DeploymentAddresses } from "@nfs/shared";
import { isAddress, zeroAddress } from "viem";

function parse(json: unknown): DeploymentAddresses | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const chainId = Number(o.chainId);
  const asAddr = (k: string) =>
    typeof o[k] === "string" && isAddress(o[k] as string) ? (o[k] as `0x${string}`) : zeroAddress;
  return {
    chainId,
    deployer: asAddr("deployer"),
    mockTokenA: asAddr("mockTokenA"),
    mockTokenB: asAddr("mockTokenB"),
    core: asAddr("core"),
    operator: asAddr("operator"),
    watchTarget: asAddr("watchTarget"),
  };
}

export function useDeploymentsJson(): DeploymentAddresses | null | "loading" {
  const id = process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337";
  const [data, setData] = useState<DeploymentAddresses | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/deployments/${id}.json`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setData(null);
          return;
        }
        const parsed = parse(await res.json());
        if (!cancelled) setData(parsed);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return data;
}
