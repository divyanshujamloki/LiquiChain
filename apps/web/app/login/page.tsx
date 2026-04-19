"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";

export default function LoginPage() {
  const { isConnected } = useAccount();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 p-8 shadow-2xl shadow-black/40">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          LiquiChain uses wallet-based sign-in. Connect MetaMask or another compatible wallet—no separate password
          required.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <ConnectButton variant="hero" />
          {isConnected && (
            <p className="text-center text-sm text-emerald-400" role="status">
              Wallet connected. Use the app from the header links.
            </p>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-zinc-500">
          New here?{" "}
          <Link href="/signup/" className="font-medium text-emerald-400 hover:text-emerald-300">
            Create an account
          </Link>
        </p>
      </div>

      <p className="mt-8 text-center text-xs text-zinc-600">
        By connecting, you agree to use this interface for development only. Funds are not insured.
      </p>
    </main>
  );
}
