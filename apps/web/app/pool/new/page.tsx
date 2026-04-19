"use client";

import Link from "next/link";

export default function NewPoolPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500/90">Pools</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Create pool</h1>
        <p className="mt-2 text-sm text-zinc-500">Launch a new pool and set how liquidity and fees work for this pair.</p>
      </div>

      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-6 shadow-xl">
        <h2 className="text-sm font-semibold text-zinc-200">What you’ll do here</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Pick two tokens, choose a fee tier, and add starting liquidity. When routing is live on your network,
          you’ll review and confirm each step in your wallet—same flow you’d expect from a production app.
        </p>
      </div>

      <p className="mt-10 text-sm text-zinc-500">
        <Link href="/" className="text-emerald-400 transition hover:text-emerald-300">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
