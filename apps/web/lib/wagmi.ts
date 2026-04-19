import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import { foundry } from "viem/chains";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337");
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

const local = defineChain({
  ...foundry,
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
});

const hosted = defineChain({
  id: 1337421,
  name: "LiquiChain Hosted",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});

export const activeChain = chainId === 1337421 ? hosted : local;

export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors: [injected()],
  transports: {
    [activeChain.id]: http(rpcUrl),
  } as Record<(typeof activeChain)["id"], ReturnType<typeof http>>,
  ssr: true,
});
