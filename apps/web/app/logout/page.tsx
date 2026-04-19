"use client";

import { useEffect } from "react";
import { useDisconnect } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LogoutPage() {
  const { disconnectAsync } = useDisconnect();
  const router = useRouter();

  useEffect(() => {
    void disconnectAsync().finally(() => {
      router.replace("/");
    });
  }, [disconnectAsync, router]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-500"
        aria-hidden
      />
      <p className="mt-6 text-sm text-zinc-400">Signing you out…</p>
      <p className="mt-4 text-xs text-zinc-600">
        Stuck?{" "}
        <Link href="/" className="text-emerald-500 hover:underline">
          Go home
        </Link>
      </p>
    </main>
  );
}
