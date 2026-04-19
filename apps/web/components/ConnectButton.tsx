"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { activeChain } from "@/lib/wagmi";
import { cn } from "@/lib/cn";

type Variant = "default" | "nav" | "hero";

const variants: Record<Variant, string> = {
  default:
    "rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50",
  nav: "rounded-full border border-zinc-700/80 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-zinc-100 backdrop-blur hover:border-emerald-500/40 hover:bg-zinc-800 disabled:opacity-50",
  hero:
    "rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 shadow-xl shadow-emerald-500/25 hover:bg-emerald-400 disabled:opacity-50",
};

export function ConnectButton({ variant = "default" }: { variant?: Variant }) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  if (!isConnected) {
    return (
      <button
        type="button"
        className={cn(variants[variant], "transition-colors")}
        disabled={isPending}
        onClick={() => connect({ connector: connectors[0] })}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm sm:gap-3">
      <span className="hidden rounded-full border border-zinc-700/80 bg-zinc-900/60 px-3 py-1.5 font-mono text-xs text-zinc-200 sm:inline">
        {short}
      </span>
      {chainId !== activeChain.id && (
        <button
          type="button"
          className="rounded-full bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          disabled={switching}
          onClick={() => switchChain({ chainId: activeChain.id })}
        >
          {switching ? "Switching…" : `Switch to ${activeChain.id}`}
        </button>
      )}
      <button
        type="button"
        className="rounded-full border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
        onClick={() => disconnect()}
      >
        Disconnect
      </button>
    </div>
  );
}
