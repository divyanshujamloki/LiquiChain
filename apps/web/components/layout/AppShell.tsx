import { SiteHeader } from "./SiteHeader";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <footer className="border-t border-zinc-800/60 py-10 text-center">
        <p className="text-xs text-zinc-500">
          LiquiChain — experimental interface. Not audited. Use at your own risk.
        </p>
      </footer>
    </div>
  );
}
