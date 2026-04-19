import Link from "next/link";

const cards = [
  {
    href: "/swap/",
    title: "Swap",
    desc: "Trade tokens through LiquiChain routing when your network is live.",
    tag: "Trade",
  },
  {
    href: "/pool/new/",
    title: "Create pool",
    desc: "Open a new pool with your chosen pair, fees, and starting liquidity.",
    tag: "Create",
  },
  {
    href: "/pool/demo/",
    title: "Liquidity",
    desc: "Add or remove liquidity and manage positions for a pool.",
    tag: "Earn",
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-zinc-800/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(52,211,153,0.15),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">LiquiChain</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
            Trade and earn on-chain
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">
            A focused interface for swaps and liquidity. Connect your wallet, choose a network, and use the same
            flows you expect from a live product.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/signup/"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
            >
              Get started
            </Link>
            <Link
              href="/login/"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-600 bg-zinc-900/50 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/50"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Products</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 shadow-xl transition hover:border-emerald-500/30 hover:bg-zinc-900/50"
            >
              <span className="text-xs font-medium text-emerald-500/80">{c.tag}</span>
              <h3 className="mt-3 text-lg font-semibold text-zinc-50 group-hover:text-white">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500 group-hover:text-zinc-400">{c.desc}</p>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-emerald-400">
                Open
                <span className="ml-1 transition group-hover:translate-x-0.5" aria-hidden>
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
