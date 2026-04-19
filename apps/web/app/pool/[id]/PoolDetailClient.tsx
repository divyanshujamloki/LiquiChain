"use client";

import Link from "next/link";

export function PoolDetailClient({ id }: { id: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-500/90">Liquidity</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Pool {id}</h1>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-zinc-200">Coming next</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Here you’ll add and remove liquidity, track your share of the pool, and withdraw when you’re ready. The
          pool id in the address bar identifies this pool so you can bookmark or share a direct link.
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
