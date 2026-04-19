import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-50">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-400">That page does not exist or was moved.</p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-xl bg-emerald-500/15 px-5 py-2.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/25"
      >
        Back to home
      </Link>
    </main>
  );
}
