"use client";

import { useDeploymentsJson } from "@/hooks/useDeploymentsJson";
import { erc20Abi, isOperatorConfigured } from "@nfs/shared";
import Link from "next/link";
import { formatEther } from "viem";
import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";

export default function SwapPage() {
  const deployments = useDeploymentsJson();
  const { address, isConnected } = useAccount();

  const tka = deployments && deployments !== "loading" ? deployments.mockTokenA : undefined;
  const { data: balA } = useReadContract({
    address: tka,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(tka && address && isConnected) },
  });

  const operatorReady =
    deployments && deployments !== "loading" && isOperatorConfigured(deployments);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500/90">Trade</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Swap</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Exchange tokens through LiquiChain once routing is enabled on your network.
        </p>
      </div>

      {deployments === "loading" && (
        <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
          <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800" />
        </div>
      )}

      {deployments === null && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-5 text-sm leading-relaxed text-amber-100">
          <p className="font-medium text-amber-50">Network data not loaded</p>
          <p className="mt-2">
            This app needs a deployment file for your chain. Ask your administrator to run a local deploy, then
            refresh this page.
          </p>
        </div>
      )}

      {deployments && deployments !== "loading" && (
        <>
          {!operatorReady && (
            <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-950/25 p-5 text-sm leading-relaxed text-amber-100">
              <p className="font-semibold text-amber-50">Swap routing unavailable</p>
              <p className="mt-2 text-amber-100/95">
                Test tokens are available, but the LiquiChain router isn’t active on this deployment yet. You can
                still connect your wallet to preview your balance.
              </p>
              <div className="mt-4 flex flex-col gap-1 border-t border-amber-500/20 pt-4 sm:flex-row sm:items-baseline sm:justify-between">
                <span className="text-amber-200/80">Test TKA balance</span>
                <span className="font-mono text-base text-white">
                  {!isConnected
                    ? "Connect wallet"
                    : balA !== undefined
                      ? `${formatEther(balA)} TKA`
                      : "—"}
                </span>
              </div>
            </div>
          )}

          {operatorReady && (
            <div className="mb-6 rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4 text-sm leading-relaxed text-emerald-100">
              <p className="font-medium text-emerald-50">Router active</p>
              <p className="mt-1 text-emerald-100/90">
                <span className="font-mono text-white">{deployments.operator}</span>
                <span className="text-emerald-200/80">
                  {" "}
                  — swap actions will appear here once the interface is fully connected.
                </span>
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/60 to-zinc-950/60 p-6 shadow-xl">
            <h2 className="text-sm font-semibold text-zinc-300">Deployed contracts</h2>
            <p className="mt-1 text-xs text-zinc-500">Token contracts for this environment.</p>
            <dl className="mt-4 space-y-4 font-mono text-sm">
              <div className="flex flex-col gap-1 border-b border-zinc-800/60 pb-4 sm:flex-row sm:justify-between">
                <dt className="text-zinc-500">Token A (TKA)</dt>
                <dd className="break-all text-right text-emerald-300/90">{deployments.mockTokenA}</dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <dt className="text-zinc-500">Token B (TKB)</dt>
                <dd className="break-all text-right text-emerald-300/90">{deployments.mockTokenB}</dd>
              </div>
            </dl>
          </div>
        </>
      )}

      <p className="mt-10 text-sm text-zinc-500">
        <Link href="/" className="text-emerald-400 transition hover:text-emerald-300">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
