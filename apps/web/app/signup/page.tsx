"use client";

import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";

const steps = [
  {
    title: "Install a wallet",
    body: "MetaMask, Rabby, or any EIP-1193 browser wallet works. On local Anvil, add network RPC from your .env.",
  },
  {
    title: "Connect",
    body: "We never see your seed phrase. Connection is read/write only to the contracts you approve in-wallet.",
  },
  {
    title: "Start trading",
    body: "Deploy mocks, then use Swap and Liquidity from the nav. Balances refresh after each transaction.",
  },
];

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500/90">Onboarding</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">Create your access</h1>
      <p className="mt-3 text-zinc-400">
        In Web3, signing up means installing a wallet and connecting it. LiquiChain uses your wallet as your
        account—no separate username and password.
      </p>

      <ol className="mt-10 space-y-6">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="flex gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-400"
              aria-hidden
            >
              {i + 1}
            </span>
            <div>
              <h2 className="font-semibold text-zinc-100">{s.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8">
        <ConnectButton variant="hero" />
        <p className="text-center text-sm text-zinc-500">
          Already have access?{" "}
          <Link href="/login/" className="font-medium text-emerald-400 hover:text-emerald-300">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
