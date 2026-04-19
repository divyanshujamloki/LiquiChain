import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337";
const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
const ws = process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:8545";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "..", "..");

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@nfs/shared"],
  env: {
    NEXT_PUBLIC_CHAIN_ID: chainId,
    NEXT_PUBLIC_RPC_URL: rpc,
    NEXT_PUBLIC_WS_URL: ws,
  },
  /** Avoid PackFileCacheStrategy ENOENT / missing chunk modules on Windows (e.g. OneDrive locking `.next`). */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
