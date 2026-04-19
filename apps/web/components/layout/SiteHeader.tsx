"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";
import { cn } from "@/lib/cn";

const nav: { href: string; label: string; isActive: (p: string) => boolean }[] = [
  { href: "/swap/", label: "Swap", isActive: (p) => p.startsWith("/swap") },
  {
    href: "/pool/new/",
    label: "New pool",
    isActive: (p) => p.startsWith("/pool/new"),
  },
  {
    href: "/pool/demo/",
    label: "Liquidity",
    isActive: (p) => p.startsWith("/pool/") && !p.startsWith("/pool/new"),
  },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "";
  const { isConnected } = useAccount();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-[var(--bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20">
            L
          </span>
          <span className="text-sm font-semibold tracking-tight text-zinc-50 group-hover:text-white">
            LiquiChain
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {nav.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-zinc-800 text-emerald-400" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex max-w-[55%] items-center justify-end gap-1.5 sm:max-w-none sm:gap-3">
          {isConnected ? (
            <Link
              href="/logout/"
              className="shrink-0 text-xs text-zinc-400 transition hover:text-zinc-200 sm:text-sm"
            >
              Sign out
            </Link>
          ) : (
            <>
              <Link
                href="/signup/"
                className="shrink-0 text-xs text-zinc-400 transition hover:text-zinc-200 sm:text-sm"
              >
                Sign up
              </Link>
              <Link
                href="/login/"
                className="shrink-0 text-xs text-zinc-400 transition hover:text-zinc-200 sm:text-sm"
              >
                Sign in
              </Link>
            </>
          )}
          <ConnectButton variant="nav" />
        </div>
      </div>

      <nav className="flex border-t border-zinc-800/50 px-2 py-2 md:hidden" aria-label="Mobile">
        <div className="flex w-full justify-center gap-1 overflow-x-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
