# LiquiChain — Full-Stack dApp + MEV Sandwich Bot
## Engineering Blueprint (v1.0)

> **Author role:** Senior Staff Engineer, Full-Stack Web3 + MEV Infra
> **Target audience:** Engineering reviewers @ LiquiChain
> **Assignment scope:** Local deployment of LiquiChain `core` + `operator`, a Next.js dApp (pool init, liquidity mgmt, swap w/ slippage, kernel visualizer), and a TypeScript sandwich bot against a local Anvil node.
> **This document is the single source of truth for architecture, decisions, trade-offs, and reproducibility.**

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Monorepo Folder Structure](#2-monorepo-folder-structure)
3. [Tech Stack Justification](#3-tech-stack-justification)
4. [Smart Contract Layer](#4-smart-contract-layer)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend / MEV Sandwich Bot](#6-backend--mev-sandwich-bot)
7. [AI / LLM Agent Extension](#7-ai--llm-agent-extension)
8. [APIs & Communication](#8-apis--communication)
9. [DevOps & Environment Setup](#9-devops--environment-setup)
10. [Advanced Concepts](#10-advanced-concepts-senior-level)
11. [Edge Cases & Failure Handling](#11-edge-cases--failure-handling)
12. [README Template](#12-readme-template)
13. [Testing Strategy](#13-testing-strategy)
14. [Production Deployment on Render](#14-production-deployment-on-render)

---

## 1. System Architecture

### 1.1 High-Level Architecture (text diagram)

```
                        ┌──────────────────────────────────────────┐
                        │                USER (Browser)            │
                        │  MetaMask injected (window.ethereum)     │
                        └───────────────────┬──────────────────────┘
                                            │ EIP-1193
                                            ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │                            FRONTEND  (Next.js 14 App Router)                 │
 │  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
 │  │  Swap UI   │  │ Pool Init UI │  │ LP Mgmt UI   │  │ Kernel Visualizer  │ │
 │  │ (slippage) │  │ (kernel pick)│  │ (mint/burn)  │  │  (D3 / Recharts)   │ │
 │  └────────────┘  └──────────────┘  └──────────────┘  └────────────────────┘ │
 │                     wagmi + viem  •  Zustand store  •  TanStack Query       │
 └───────────┬──────────────────────────────────────────────┬───────────────────┘
             │ (1) eth_sendTransaction (via MetaMask)        │ (4) event logs / state reads
             │                                               │
             ▼                                               ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │                      LOCAL BLOCKCHAIN — Anvil (foundry)                      │
 │   • Auto-mining DISABLED (--no-mining)                                       │
 │   • Interval mining fallback (--block-time 12) OR manual `anvil_mine`        │
 │   • JSON-RPC :8545   •   WebSocket :8545/ws (eth_subscribe)                  │
 │                                                                              │
 │  ┌────────────────┐   ┌─────────────────┐   ┌────────────────────────────┐  │
 │  │ LiquiChain Core │◄──│ LiquiChain       │◄──│ Mock ERC-20s  (TKA, TKB)   │  │
 │  │  (singleton)   │   │ Operator        │   │  minted to test wallet     │  │
 │  └────────────────┘   │ (Delegatee)     │   └────────────────────────────┘  │
 │                       └─────────────────┘                                   │
 └───────────────────▲───────────────────────────────────────▲──────────────────┘
                     │ (2) txpool_content / newPendingTransactions │
                     │                                         │
                     │                                         │ (3b) front-run TX
                     │                                         │ (3c) back-run  TX
                     │                                         │     (gas-priced)
                     ▼                                         │
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │                     BACKEND / SANDWICH BOT  (Node.js + TS)                   │
 │                                                                              │
 │  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
 │  │  Mempool    │──▶│   Calldata   │──▶│ Profitability│──▶│ Tx Builder + │  │
 │  │  Watcher    │   │    Decoder   │   │   Engine     │   │ Nonce/Gas    │  │
 │  │ (WS sub)    │   │ (viem ABI)   │   │  (sim)       │   │ Orchestrator │  │
 │  └─────────────┘   └──────────────┘   └──────────────┘   └──────┬───────┘  │
 │                                                                  │          │
 │                              ┌───────────────────────────────────┘          │
 │                              ▼                                               │
 │                    LLM Strategy Agent (optional) — OpenAI/Anthropic          │
 │                    explains: "why skip?" / suggests param tweaks             │
 └──────────────────────────────────────────────────────────────────────────────┘
```

### 1.1.a Production Topology (public demo on Render)

When deployed for public access, the same components are rearranged across two Render services + two supporting free services:

```
                         ┌─────────────────────────────────────┐
                         │  Visitor's browser + MetaMask       │
                         └─────────────────┬───────────────────┘
                                           │ HTTPS
                                           ▼
         ┌───────────────────────────────────────────────────────┐
         │  Render Static Site  (always-on, free, no sleep)      │
         │  ── apps/web (Next.js, static export)                 │
         │  URL: https://liquichain-web.onrender.com              │
         └───────────────────┬───────────────────────────────────┘
                             │ wss:// RPC
                             ▼
         ┌───────────────────────────────────────────────────────┐
         │  Render Web Service  (Docker, free 750 hrs/mo)        │
         │  URL: https://liquichain-chain.onrender.com            │
         │  ── apps/render-bundle                                │
         │                                                       │
         │   ┌────────────┐  ┌──────────────┐  ┌─────────────┐  │
         │   │   Caddy    │  │   Anvil      │  │   Bot       │  │
         │   │ :$PORT     │◄─│ 127.0.0.1    │◄─│ (Node/TS)   │  │
         │   │ public TLS │  │ :8545        │  │ localhost   │  │
         │   │ RPC allow- │  │ --chain-id   │  │ decoder +   │  │
         │   │ list +     │  │  1337421     │  │ executor    │  │
         │   │ rate limit │  │ --prune-hist │  │             │  │
         │   └────────────┘  └──────┬───────┘  └─────────────┘  │
         │                           │                          │
         │         every 5 min: anvil_dumpState                 │
         │                           │                          │
         │                           ▼                          │
         │                  ┌────────────────┐                  │
         │                  │ state-sync     │── uploads ──┐    │
         │                  │ sidecar (node) │             │    │
         │                  └────────────────┘             │    │
         └──────────────────────────────────────────┬──────┘    │
                    ▲                                │           │
                    │ GET /health every 10 min       │           │
                    │ (keep-alive; prevents sleep)   │           │
                    │                                │           │
         ┌──────────┴────────┐              ┌────────▼──────────┐
         │  cron-job.org     │              │ Cloudflare R2     │
         │  (free, 1-min)    │              │ state.json        │
         └───────────────────┘              │ (free 10 GB)      │
                                            └───────────────────┘
```

**Why two services and not one?** Render free tier doesn't allow Docker Static Sites and static deploys are faster/cheaper. The frontend (a static Next.js bundle) gets Render's always-on Static Site plan; the chain+bot bundle gets the Web Service plan where we actually need a running container. Clean separation, lowest cost.

### 1.2 Component Breakdown

| Component                 | Tech                                        | Responsibility                                                                                     |
| ------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Frontend**              | Next.js 14 (App Router), TS, Tailwind       | Wallet UX, pool/LP/swap UIs, kernel visualizer, tx lifecycle UI                                    |
| **Wallet Layer**          | wagmi v2 + viem + MetaMask connector        | EIP-1193 handling, chain switch (`31337`), signing                                                 |
| **State**                 | Zustand (UI) + TanStack Query (chain reads) | Optimistic updates, cache invalidation on `newBlock`                                               |
| **Blockchain**            | Anvil (preferred) / Hardhat Network         | Local EVM, mempool accessible via `txpool_*` and `eth_subscribe`                                   |
| **Core Contracts**        | LiquiChain `core` (singleton pool manager)   | Pool registry, swap accounting, kernel-based concentrated liquidity                                |
| **Operator Contracts**    | LiquiChain `operator` (delegatee pattern)    | User-facing entrypoint; batches `initialize/mint/burn/swap` via callbacks into core                |
| **Mock Tokens**           | `MockERC20` (OpenZeppelin)                  | TKA, TKB — minted to the deployer wallet; seeded in UI via `ERC20.approve` + `transfer`            |
| **Bot**                   | Node.js 20, TypeScript, viem, pino          | Mempool subscription, calldata decode, sandwich construction                                       |
| **LLM Agent (optional)**  | OpenAI/Claude SDK, LangChain-lite           | Log analysis, trade-skip reasoning, prompt-based strategy tuning                                   |
| **Shared package**        | ABIs, addresses, types, constants           | Single source of truth consumed by frontend + bot                                                  |

### 1.3 End-to-End Data Flow (happy path — user swap being sandwiched)

```
  t=0ms   User clicks "Swap" in UI
          └─> viem writeContract → MetaMask popup → user signs
  t~50ms  eth_sendRawTransaction hits Anvil RPC
          └─> tx enters mempool (auto-mine off; stays pending)
  t~55ms  Bot's WS subscription (newPendingTransactions) fires
          └─> Bot fetches tx via eth_getTransactionByHash
          └─> Decodes calldata with operator ABI (`modifyBalance`/`swap`)
          └─> Extracts: pool-id, tokenIn, amountIn, minAmountOut, deadline
          └─> Computes profitability (see §6.4)
  t~80ms  Bot signs 2 EOA txs:
          • Front-run (maxPriorityFee=high)
          • Back-run  (maxPriorityFee=low, nonce=front+1)
          Both submitted via eth_sendRawTransaction
  t~85ms  Bot calls anvil_mine(1) OR waits for the --block-time interval
          └─> Geth-style ordering: highest tip first → front-run, victim, back-run
  t~90ms  Block mined; frontend `useWatchBlocks` invalidates TanStack Query caches
          └─> Swap UI updates "confirmed"; LP balances refresh
  t~95ms  Bot logs realized PnL from Transfer events; (optional) sends to LLM
```

### 1.4 Key Interactions

- **UI ↔ Wallet:** All writes go through `wagmi.writeContract` → viem encodes → MetaMask signs. No private keys in the frontend.
- **UI ↔ Core:** UI never calls `core` directly. All state-changing calls go through the **operator** (delegatee pattern per LiquiChain design). Reads (e.g. `getPoolState`, kernel storage) go to core directly via viem.
- **Bot ↔ Node:** Persistent **WebSocket** to Anvil (not polling). Falls back to `txpool_content` polling if subscriptions drop.
- **Bot ↔ Core/Operator:** Reads for price/reserves; writes for front/back-run swaps using the same operator path the user uses (so decode logic is symmetric).

---

## 2. Monorepo Folder Structure

We use a **pnpm workspace** monorepo. Rationale: shared ABIs and TypeScript types must stay in lockstep between frontend and bot — a monorepo makes this atomic; package-level hoisting gives fast CI.

```
liquichain-stack/
├── apps/
│   ├── web/                          # Next.js 14 dApp
│   │   ├── app/
│   │   │   ├── (dex)/
│   │   │   │   ├── pool/new/page.tsx       # pool initialization
│   │   │   │   ├── pool/[id]/page.tsx      # LP mgmt (mint/burn)
│   │   │   │   └── swap/page.tsx           # swap w/ slippage
│   │   │   ├── layout.tsx
│   │   │   └── providers.tsx               # wagmi + QueryClient + Zustand
│   │   ├── components/
│   │   │   ├── wallet/ConnectButton.tsx
│   │   │   ├── swap/SwapCard.tsx
│   │   │   ├── swap/SlippageControl.tsx
│   │   │   ├── pool/KernelEditor.tsx       # D3 graphical kernel picker
│   │   │   ├── pool/InitPoolForm.tsx
│   │   │   ├── pool/LiquidityPanel.tsx
│   │   │   └── tx/TxStatusToast.tsx        # pending/success/reverted
│   │   ├── hooks/
│   │   │   ├── useSwapQuote.ts
│   │   │   ├── usePoolState.ts
│   │   │   ├── useTxLifecycle.ts
│   │   │   └── useKernel.ts
│   │   ├── lib/
│   │   │   ├── wagmi.ts                    # chain config (anvil 31337)
│   │   │   ├── math/slippage.ts
│   │   │   └── math/kernel.ts              # kernel encoding helpers
│   │   └── next.config.mjs
│   │
│   ├── bot/                          # Sandwich bot (Node + TS)
│   │   ├── src/
│   │   │   ├── index.ts                    # entry: wires all services
│   │   │   ├── config.ts                   # env-driven config
│   │   │   ├── mempool/
│   │   │   │   ├── watcher.ts              # WS newPendingTransactions
│   │   │   │   └── txpoolPoll.ts           # fallback
│   │   │   ├── decoder/
│   │   │   │   ├── operatorAbi.ts
│   │   │   │   └── swapDecoder.ts          # extracts victim params
│   │   │   ├── strategy/
│   │   │   │   ├── profitability.ts        # sandwich math (§6.4)
│   │   │   │   ├── gasOracle.ts
│   │   │   │   └── victimFilter.ts         # size/slippage thresholds
│   │   │   ├── executor/
│   │   │   │   ├── nonceManager.ts
│   │   │   │   ├── txBuilder.ts            # builds front/back txs
│   │   │   │   └── submitter.ts            # sendRawTransaction
│   │   │   ├── ai/
│   │   │   │   ├── llmClient.ts
│   │   │   │   └── strategyAgent.ts        # §7
│   │   │   ├── util/
│   │   │   │   ├── logger.ts               # pino
│   │   │   │   └── metrics.ts              # prom-client (optional)
│   │   │   └── types.ts
│   │   ├── tests/
│   │   │   ├── decoder.spec.ts
│   │   │   └── profitability.spec.ts
│   │   └── tsconfig.json
│   │
│   └── render-bundle/                # Deployable Docker image for Render (§14)
│       ├── Dockerfile                      # multi-stage: foundry + node + caddy
│       ├── Caddyfile                       # reverse proxy + RPC allow-list
│       ├── supervisord.conf                # runs anvil + bot + state-sync + caddy
│       ├── scripts/
│       │   ├── boot.sh                     # load state from R2, then exec supervisord
│       │   ├── state-sync.ts               # cron dumper → Cloudflare R2
│       │   └── health.ts                   # tiny HTTP /health for keep-alive cron
│       └── render.yaml                     # Render IaC (both services)
│
├── packages/
│   ├── contracts/                    # foundry project
│   │   ├── foundry.toml
│   │   ├── lib/                            # git submodules: forge-std, OZ
│   │   ├── src/
│   │   │   ├── mocks/MockERC20.sol
│   │   │   └── vendor/                     # symlinks to LiquiChain core & operator
│   │   ├── script/
│   │   │   ├── 00_DeployCore.s.sol
│   │   │   ├── 01_DeployOperator.s.sol
│   │   │   ├── 02_DeployMockTokens.s.sol
│   │   │   └── 03_InitializePool.s.sol
│   │   ├── test/
│   │   │   ├── Swap.t.sol
│   │   │   └── Kernel.t.sol
│   │   └── deployments/
│   │       └── 31337.json                  # emitted by scripts, consumed by apps
│   │
│   ├── shared/                       # TS types, ABIs, constants
│   │   ├── src/
│   │   │   ├── abis/                       # generated via `forge inspect`
│   │   │   ├── addresses.ts                # loads 31337.json
│   │   │   ├── types/pool.ts
│   │   │   ├── types/kernel.ts
│   │   │   └── constants.ts
│   │   └── package.json
│   │
│   └── eslint-config/                # shared lint + prettier
│
├── scripts/                          # orchestration (root)
│   ├── start-anvil.sh                      # anvil --no-mining --block-time 12
│   ├── deploy-all.sh                       # forge scripts in order
│   ├── seed-tokens.sh                      # mints + approvals
│   ├── dev.sh                              # concurrently: anvil + web + bot
│   └── reset.sh                            # kills anvil, clears caches
│
├── .env.example
├── docker-compose.yml                # optional: anvil + bot + web in one up
├── pnpm-workspace.yaml
├── turbo.json                        # task graph (build, lint, test)
├── package.json
└── README.md
```

### 2.1 Why this structure scales

- **`packages/shared` is the contract-client boundary.** When contracts change, `forge build` regenerates ABIs → `pnpm --filter shared build` → frontend and bot both pick up the types at compile time. A breaking ABI change fails CI **before** runtime.
- **`apps/*` vs `packages/*`** follows the Vercel/Turborepo convention: `apps` are leaf deployables; `packages` are libs consumed by apps. Makes `turbo prune` trivial for Docker builds.
- **`packages/contracts` is isolated Foundry.** Foundry builds don't pollute Node's `node_modules`. `forge` compiles into `out/` which a `pnpm build` script copies into `packages/shared/src/abis`.
- **`scripts/` at root** owns environment orchestration. One script = one verb. No hidden coupling in `package.json` run-scripts.
- **`deployments/<chainId>.json`** — addresses are **emitted, not hand-edited**. Frontend imports them through `shared`. Redeploys never require manual address pasting. For the public demo, a second file `deployments/1337421.json` is committed (the hosted-Anvil chainId) so the static frontend build already knows the addresses.
- **`apps/render-bundle/` is a leaf deployable.** Everything Render needs to build the backend container lives there: `Dockerfile`, `render.yaml`, the supervisord config, and the state-sync sidecar. The local dev flow never touches it — it only runs in production. See §14.

---

## 3. Tech Stack Justification

| Decision                          | Choice                           | Why (and what I'd avoid)                                                                                                                                                                                                                                                           |
| --------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend framework**            | **Next.js 14 App Router**        | RSC + streaming gives us a fast wallet-connect shell while keeping client-only Web3 code (`"use client"`) for wallet hooks. SSR isn't strictly needed for a local dApp, but Next gives us route conventions, built-in TS, and prod-grade bundling. Plain CRA is EOL'd.             |
| **Wallet / RPC client**           | **viem + wagmi v2**              | viem's tree-shakable, has first-class TS inference from ABIs (no `any`), and is 10× smaller than ethers v5. wagmi wraps viem with React hooks (`useWriteContract`, `useWatchContractEvent`). ethers.js is fine but types are weaker and bundle size bigger.                        |
| **Local chain**                   | **Anvil** (Foundry)              | Startup <200ms vs Hardhat's ~3s. Native `--no-mining`, `--order fees`, `anvil_setNextBlockBaseFeePerGas`, `anvil_impersonateAccount`. Mempool behavior matches Geth closely — critical for a sandwich bot. Hardhat Network's mempool is JS-simulated and less realistic.           |
| **Contract framework**            | **Foundry (forge)**              | LiquiChain core/operator likely ship Foundry-native. `forge script` is deterministic, uses the same EVM as anvil, and writes broadcast artifacts we parse to populate `deployments/31337.json`. Hardhat scripts are fine but slower; we'd still need Foundry for fuzz tests.       |
| **State management**              | **Zustand + TanStack Query**     | Zustand for pure UI state (modals, slippage setting, pending-tx list) — zero boilerplate. TanStack Query for on-chain reads with automatic cache invalidation on `newBlock`. Redux is overkill here; Context causes re-render storms for fast-changing balances.                   |
| **Bot runtime**                   | **Node.js 20 + TypeScript**      | Shares ABIs and decode logic with the frontend — zero code duplication. Node's event loop is a natural fit for WS subscriptions. Go/Rust would be faster but add a language boundary. For a **local** sandwich bot, Node p95 latency (<5ms decode) is well below block times.     |
| **WS vs polling**                 | **WebSocket (`eth_subscribe`)**  | Polling `txpool_content` adds avoidable latency (min 50–100ms round trips) and load. WS subscriptions deliver `newPendingTransactions` as Anvil emits them (<1ms). Fallback polling only kicks in on WS disconnect.                                                                |
| **Logging**                       | **pino**                         | Structured JSON logs, extremely fast. Piped through `pino-pretty` in dev. Lets us grep decoded-calldata events and later feed them to the LLM.                                                                                                                                     |
| **Charting (kernel visualizer)**  | **D3 + React** (or Recharts)     | The kernel is a custom piecewise-curve shape — Recharts is too rigid. D3 with React refs gives us drag-to-edit knots and per-interval liquidity bars. Canvas fallback if the kernel has >200 points.                                                                               |
| **Monorepo tooling**              | **pnpm + turborepo**             | pnpm's content-addressable store keeps cold installs under ~15s. Turbo's task graph (`build` depends on `shared#build`) prevents stale ABIs. npm workspaces would work but pnpm is strictly faster and more deterministic.                                                         |
| **CI**                            | **GitHub Actions + act (local)** | Matrix: `forge test`, `pnpm lint`, `pnpm test --filter bot`, `pnpm build --filter web`. `act` lets reviewers run the pipeline locally.                                                                                                                                             |
| **Frontend hosting (prod)**       | **Render Static Site**           | Always-on free plan (no idle sleep), global CDN, free HTTPS. Next.js `output: 'export'` produces a pure static bundle — no SSR needed because all dynamic data comes from the chain. Vercel was the obvious alternative but the brief is to use Render end-to-end.                |
| **Backend bundle hosting (prod)** | **Render Web Service (Docker)**  | Free tier 750 hrs/mo covers always-on (30 days × 24 hrs = 720 hrs). Docker runtime lets us bundle Anvil + Bot + Caddy + supervisord into a single image. Sleeps after 15 min idle — mitigated by a free keep-alive cron (see §14.3).                                              |
| **State persistence (prod)**      | **Cloudflare R2** (S3-compatible)| Render free tier has no persistent disk, so Anvil state would reset on every restart. R2 free tier (10 GB, 1M writes/mo) stores `state.json` dumps via `anvil_dumpState`; a sidecar syncs every 5 min and on SIGTERM. See §14.4.                                                   |
| **Keep-alive (prod)**             | **cron-job.org**                 | Free, 1-min granularity. Pings `/health` every 10 min to keep the Render backend service warm. UptimeRobot is a fine alternative; we pick cron-job.org for its shorter interval floor.                                                                                             |

### 3.1 Non-choices (things I deliberately avoided)

- **ethers v6:** viem is superior for new code; no reason to mix libraries.
- **Hardhat:** would work, but the deterministic Anvil mempool is non-negotiable for realistic sandwich behavior.
- **Redux Toolkit Query:** TanStack Query is the de-facto standard for async state outside Redux and composes better with wagmi hooks.
- **Truffle/Ganache:** unmaintained.
- **Custom Solidity MEV contract:** explicitly out of scope per assignment — sequential EOA txs are sufficient to demonstrate ordering.

---

## 4. Smart Contract Layer

### 4.1 LiquiChain mental model (essential context)

LiquiChain uses a **singleton core** (similar in spirit to Uniswap v4's `PoolManager`) with an **operator (delegatee)** pattern. Users never call the core directly — they call the operator, which performs a **locked callback** into core, executes a sequence of actions (initialize/mint/burn/swap), and settles balances at the end. Concentrated liquidity is described via a **kernel**: a shape function over price intervals (see the protocol spec). A kernel is a sequence of `(height, sqrtPrice)` knots defining how LP liquidity is distributed across the price curve.

This design has three consequences for us:

1. **All writes from the dApp go through the operator** — the ABI we decode in the bot is the *operator's* ABI, not core's.
2. **Initializing a pool requires encoding a kernel** — the UI must serialize the graphical kernel into the calldata format the operator expects (per `ILiquiChainDelegatee.sol#L11`).
3. **The mock kernel from `SwapData_test.py#L841-L846`** is an acceptable fallback; our UI ships both a graphical editor and a "Use mock kernel" button that emits that exact shape.

### 4.2 Deployment Flow

```
 ┌─────────────────────┐
 │ 00_DeployCore.s.sol │  forge script → anvil
 └─────────┬───────────┘
           │ emits: core address
           ▼
 ┌─────────────────────────────┐
 │ 01_DeployOperator.s.sol     │  constructor(core)
 └─────────┬───────────────────┘
           │ emits: operator address
           ▼
 ┌─────────────────────────────┐
 │ 02_DeployMockTokens.s.sol   │  deploys TKA, TKB; mints 1e24 to deployer;
 │                             │  approves operator for max uint
 └─────────┬───────────────────┘
           │ emits: tokens addresses
           ▼
 ┌─────────────────────────────┐
 │ 03_InitializePool.s.sol     │  calls operator.initialize(poolParams, kernel)
 │   (optional seed pool)      │  kernel = mock from SwapData_test.py
 └─────────┬───────────────────┘
           │
           ▼
  writes `packages/contracts/deployments/31337.json`:
     { core, operator, tokenA, tokenB, poolId, deployerEOA }
```

Each script is idempotent and uses `vm.writeJson` to append to the deployments file. A single `scripts/deploy-all.sh` runs them in order with `--broadcast --rpc-url http://127.0.0.1:8545`.

### 4.3 ABI Interaction Rules

- **ABIs live in `packages/shared/src/abis`** and are regenerated by a `postbuild` hook in the contracts package: `forge inspect <Contract> abi > ../shared/src/abis/<Contract>.json`.
- **Typed ABIs via viem:** `const operatorAbi = abi as const` → viem infers function signatures and argument tuples. No `any` in the entire write path.
- **Reads** (price, position, kernel state) bypass the operator and go directly to core — cheaper and simpler.
- **Writes** always go through the operator to match the user path the bot needs to decode.

### 4.4 Token Setup (ERC-20)

```
MockERC20(name, symbol, decimals=18)
  ├─ mint(deployer, 1_000_000e18)
  ├─ mint(secondaryEOA, 1_000_000e18)   // the bot's wallet
  └─ approve(operator, type(uint256).max) // pre-approval saves UX friction
```

We mint to **two** EOAs: the user-facing MetaMask account and the bot's hot wallet. Both approve the operator up-front so neither the dApp nor the bot show "approve token" popups in the demo.

### 4.5 Liquidity Pool Logic (high-level)

```
initializePool(tokenA, tokenB, sqrtPriceX96, kernel):
  1. operator.initialize(params) is called by the user via UI
  2. operator enters the "locked" state in core (exclusive callback)
  3. core creates pool storage, stores the kernel (knots + heights)
  4. core mints the initial shares (if any) & emits PoolInitialized
  5. operator settles: transfers tokens from user, updates balances, exits lock
```

Core's invariant: **every operator callback must net-zero balances by the end** (pay tokens in → receive output or position shares out). If not, the transaction reverts. This is what makes flash-accounting safe — we use it in the sandwich bot's profit check (§6.4).

### 4.6 Swap Execution Flow

```
User or Bot → operator.swap({poolId, tokenIn, amountIn, limitSqrtPrice, deadline, recipient})
  │
  ▼
operator: acquires lock on core
  │
  ▼
operator: calls core.swap() inside callback
  │       core: walks the kernel, consumes liquidity tick-by-tick
  │       core: accumulates delta in internal ledger (no transfers yet)
  │
  ▼
operator: reads delta → enforces `amountOut >= amountOutMin` (slippage)
operator: core.settle() → ERC20.transferFrom / transfer to close the ledger
  │
  ▼
Tx confirmed. Events: Swap(poolId, sender, deltas, sqrtPriceX96After)
```

**Slippage enforcement** lives in the operator, not core. The operator encodes the user's `amountOutMin` (or `limitSqrtPrice`) into calldata. This is the exact field our bot extracts in §6.3 to decide profitability.

### 4.7 What we deliberately are **not** building

- **Custom MEV/flashbot contract.** Per assignment scope, sequential EOA txs are enough.
- **Fee tier switching UI.** The UI exposes a single default fee tier to keep the kernel editor focused.
- **Governance/access control.** Out of scope for a local test.

---

## 5. Frontend Architecture

### 5.1 Component Tree

```
<RootLayout>
 └── <Providers>                                     // wagmi, QueryClient, ZustandProvider
      ├── <Navbar>
      │    └── <ConnectButton/>                      // chain switch to 31337 if wrong
      │
      ├── /swap  → <SwapPage>
      │    └── <SwapCard>
      │         ├── <TokenPicker in/out>
      │         ├── <AmountInput>
      │         ├── <SlippageControl>                // numeric + slider, default 0.5%
      │         ├── <SwapQuote>                      // est. out, price impact
      │         └── <SubmitSwapButton>               // drives useTxLifecycle
      │
      ├── /pool/new → <InitPoolPage>
      │    ├── <PoolParamsForm>                      // token pair, fee, initial sqrtPrice
      │    └── <KernelEditor>                        // D3 graphical kernel
      │         ├── toggle "use mock kernel"
      │         └── drag knots, set heights
      │
      ├── /pool/[id] → <PoolPage>
      │    ├── <PoolHeader>                          // price, tvl, kernel preview
      │    └── <LiquidityPanel>
      │         ├── <MintForm>                       // choose interval + amount
      │         ├── <BurnForm>                       // selects position, partial/full
      │         └── <PositionsTable>
      │
      └── <TxStatusToastStack>                       // global; listens to Zustand tx store
```

### 5.2 State Strategy

| Kind of state                        | Where                                     | Rationale                                                 |
| ------------------------------------ | ----------------------------------------- | --------------------------------------------------------- |
| Wallet account, chainId              | wagmi (uses its own store)                | Single source of truth for wallet                         |
| UI state (modals, slippage, form)    | **Zustand**                               | No selectors needed; tiny footprint                       |
| On-chain reads (pool state, balances)| **TanStack Query** via wagmi's `useReadContract` | Automatic cache + `useBlockNumber` invalidation     |
| Pending transactions list            | Zustand (persist to `sessionStorage`)     | Survives refresh; drives toast UI                         |
| Kernel editor state                  | Local component state + `useReducer`     | High-frequency drag updates — avoid global re-renders     |

```ts
// store/txStore.ts (Zustand)
type TxState = 'signing' | 'pending' | 'confirmed' | 'reverted';
interface TxEntry { hash?: `0x${string}`; kind: 'swap'|'mint'|'burn'|'init'; state: TxState; error?: string }
export const useTxStore = create<{...}>((set) => ({ /* add, update, remove */ }))
```

### 5.3 Wallet Integration (MetaMask)

- `wagmi` config pins **chainId = 31337** with Anvil's default RPC. If user is on another chain, `ConnectButton` prompts `switchChain`.
- For a brand-new MetaMask install on a reviewer's machine, we provide a `AddLocalChainButton` that calls `wallet_addEthereumChain` with `{ chainId: 0x7A69, rpcUrls: ['http://127.0.0.1:8545'], ... }`.
- We **do not import the deployer private key** into MetaMask. The UI uses a user-supplied account; the deploy script imports funds into that account via `anvil_setBalance` called from a dev-only `scripts/fund-user.sh`.

### 5.4 Transaction Lifecycle Handling

Every write follows a single hook:

```ts
// hooks/useTxLifecycle.ts  (pseudocode)
export function useTxLifecycle() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const addTx = useTxStore((s) => s.add);
  const updateTx = useTxStore((s) => s.update);

  return async function send({ kind, request }) {
    const localId = crypto.randomUUID();
    addTx({ localId, kind, state: 'signing' });

    try {
      const hash = await writeContractAsync(request);           // MetaMask popup
      updateTx(localId, { state: 'pending', hash });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') {
        updateTx(localId, { state: 'reverted', error: 'Reverted on-chain' });
      } else {
        updateTx(localId, { state: 'confirmed' });
      }
    } catch (err) {
      // user rejected / nonce error / insufficient funds
      updateTx(localId, { state: 'reverted', error: parseViemError(err) });
    }
  };
}
```

UI behavior per state:

- **signing** → toast "Confirm in MetaMask…" (spinner, no hash yet)
- **pending** → toast with hash + "View on explorer" (local block explorer link), UI inputs disabled
- **confirmed** → success toast, TanStack Query cache invalidated (`queryClient.invalidateQueries(['pool', poolId])`)
- **reverted** → red toast with decoded revert reason (`viem`'s `BaseError.shortMessage`), retry button

### 5.5 Key UX Details

- **Price impact** computed **client-side** by simulating the swap against a local mirror of the kernel (JS port of the core math) — this avoids an extra RPC round-trip on every keystroke. Falls back to `eth_call` on the operator's `quote*` function if available.
- **Slippage** defaults to 0.5% with quick-select chips (0.1 / 0.5 / 1.0 / custom). Below 0.05% we show a red warning ("likely to revert").
- **Kernel editor:** SVG canvas with draggable knot handles. Each drag updates a `{x: sqrtPrice, y: height}[]` array. Hotkey `M` toggles the mock kernel. A live "Preview liquidity density" chart renders to the right.

---

## 6. Backend / MEV Sandwich Bot

### 6.1 Responsibilities (reframed)

The bot is a **single-process event loop** with five stages:

```
 Mempool Watcher ──► Filter ──► Decoder ──► Profit Engine ──► Executor
       ▲                                                          │
       └────────────────── (loop) ─────────────────────────────────┘
```

Each stage is a pure async function with clean boundaries — easy to unit test and swap out.

### 6.2 Mempool Monitoring Strategy

**Primary:** WebSocket subscription.

```ts
// mempool/watcher.ts
const client = createPublicClient({ chain: anvil, transport: webSocket(WS_URL) });

const unwatch = client.watchPendingTransactions({
  poll: false,                                   // use subscription, not polling
  onTransactions: async (hashes) => {
    for (const hash of hashes) {
      const tx = await client.getTransaction({ hash });
      if (!tx || tx.to?.toLowerCase() !== OPERATOR.toLowerCase()) continue;
      queue.push(tx);
    }
  },
});
```

**Why only operator-targeted txs?** Anything not going to the operator can't be a user swap we care about. Cheap filter, massive signal-to-noise win.

**Fallback:** If the WS drops (`ws.onclose`), switch to polling `txpool_content` every 500ms with exponential backoff. Anvil supports `txpool_content` natively.

**Anvil config to enable this:**
```bash
anvil --no-mining \
      --block-time 12 \                 # periodic blocks, keeps pending tx window open
      --order fees \                    # txs ordered by priority fee (MEV-realistic)
      --host 0.0.0.0 --port 8545
```

With `--no-mining`, we then **manually mine** (via `anvil_mine`) after the bot submits its sandwich so the ordering is tight and deterministic. Alternative: rely on `--block-time 12` and race.

### 6.3 Calldata Decoding Logic

The operator exposes a swap-dispatch function (e.g. `modifyBalance` / `swap` depending on LiquiChain's latest ABI). Calldata shape typically:

```
selector (4 bytes) || abi.encode(SwapParams { poolId, tokenIn, amountSpecified, limitSqrtPrice, deadline, recipient })
```

Bot decode path:

```ts
// decoder/swapDecoder.ts
import { decodeFunctionData } from 'viem';
import { operatorAbi } from '@nfs/shared/abis';

export function decodeVictim(tx: Transaction): VictimIntent | null {
  if (!tx.input || tx.input === '0x') return null;

  const { functionName, args } = decodeFunctionData({
    abi: operatorAbi,
    data: tx.input,
  });

  if (functionName !== 'swap' && functionName !== 'modifyBalance') return null;

  const params = args[0] as SwapParams;
  return {
    hash: tx.hash,
    from: tx.from,
    poolId: params.poolId,
    tokenIn: params.tokenIn,
    amountIn: params.amountSpecified,       // exact-in sign convention per LiquiChain
    limitSqrtPrice: params.limitSqrtPrice,  // our proxy for slippage tolerance
    deadline: params.deadline,
    gasPrice: tx.maxFeePerGas ?? tx.gasPrice ?? 0n,
    priorityFee: tx.maxPriorityFeePerGas ?? 0n,
  };
}
```

**Slippage extraction:** LiquiChain expresses slippage as a `limitSqrtPrice` bound rather than `amountOutMin`. We convert it to an implied `%` by comparing to the pool's current `sqrtPriceX96`:

```
slippagePct = |limitSqrtPrice - currentSqrtPrice| / currentSqrtPrice
```

### 6.4 Profitability Engine (the core math)

A classic sandwich:

- Let `x` be our front-run size (in `tokenIn`).
- Let `V` be victim's `amountIn`.
- Pool reserves/kernel define a price function. After our front-run, price moves; the victim now executes at a worse price (closer to or at `limitSqrtPrice`). We then back-run, selling what we bought.

```
Profit(x) = AmountOut_backrun(x) − x          // in units of tokenIn
subject to:
  victim's execution price after front-run ≤ victim.limitSqrtPrice   (else victim reverts → no gain)
```

We solve for the optimal `x` numerically (golden-section search over a capped range: `0 < x < min(botBalance, 0.5 * pool_reserve_tokenIn)`), using an **in-memory simulator** that mirrors LiquiChain's kernel math. This avoids hammering `eth_call`.

```
# profitability.ts pseudocode
function simulateSandwich(pool, kernel, victim, x):
    pool1 = applySwap(pool, kernel, tokenIn=victim.tokenIn, amountIn=x)    # front
    pool2 = applySwap(pool1, kernel, tokenIn=victim.tokenIn, amountIn=victim.amountIn)
    if priceMovedBeyond(pool2, victim.limitSqrtPrice):
        return VICTIM_WOULD_REVERT   # skip
    backOut = applySwap(pool2, kernel, tokenIn=victim.tokenOut, amountIn=ourTokenOutFromFront).amountOut
    gasCost = (GAS_FRONT + GAS_BACK) * maxFeePerGas
    return backOut - x - gasCost

function optimalSize(pool, kernel, victim):
    return goldenSection(x => simulateSandwich(pool, kernel, victim, x), lo, hi)

if (profit > MIN_PROFIT_WEI) → execute
```

**Thresholds (env-tunable):**
- `MIN_PROFIT_WEI` — skip dust (default `1e15` = 0.001 token).
- `MAX_FRONT_SIZE` — cap per-attack exposure.
- `MIN_VICTIM_SIZE` — ignore tiny victims where gas dominates.

### 6.5 Gas Strategy

- Read Anvil's `eth_gasPrice` + recent blocks' `baseFeePerGas`.
- **Front-run:** `maxPriorityFeePerGas = victim.priorityFee + Δ` (default `Δ = 2 gwei`).
- **Back-run:** `maxPriorityFeePerGas = max(1 gwei, victim.priorityFee - 1 gwei)` — must sort strictly **after** victim.
- `maxFeePerGas = baseFee * 2 + priorityFee` (standard EIP-1559 buffer).
- With `anvil --order fees`, the resulting miner ordering is exactly: **front > victim > back**, which is what we need.

### 6.6 Nonce Management

Single-writer nonce manager prevents races:

```ts
// executor/nonceManager.ts
class NonceManager {
  private next: Promise<number>;
  constructor(client, address) {
    this.next = client.getTransactionCount({ address, blockTag: 'pending' });
  }
  async reserve(count = 1): Promise<number[]> {
    const start = await this.next;
    this.next = Promise.resolve(start + count);
    return Array.from({ length: count }, (_, i) => start + i);
  }
  async reset(client, address) { this.next = client.getTransactionCount({ address, blockTag: 'pending' }); }
}
```

On startup and after every reverted tx, `reset()` is called. `reserve(2)` returns the two contiguous nonces for front+back.

### 6.7 Transaction Ordering & Submission

```ts
// executor/submitter.ts
async function fireSandwich(victim: VictimIntent, plan: Plan) {
  const [nFront, nBack] = await nonceManager.reserve(2);

  const frontRaw = await account.signTransaction({
    to: OPERATOR, data: plan.frontCalldata, nonce: nFront,
    maxPriorityFeePerGas: plan.frontTip, maxFeePerGas: plan.frontMax,
    gas: plan.frontGasLimit, chainId: 31337,
  });

  const backRaw = await account.signTransaction({
    to: OPERATOR, data: plan.backCalldata, nonce: nBack,
    maxPriorityFeePerGas: plan.backTip, maxFeePerGas: plan.backMax,
    gas: plan.backGasLimit, chainId: 31337,
  });

  // submit front first, then back — Anvil orders by tip, not receipt time,
  // but submitting in this order protects against the edge case of --order 'fifo'
  await client.sendRawTransaction({ serializedTransaction: frontRaw });
  await client.sendRawTransaction({ serializedTransaction: backRaw });

  // force block when running in "manual mine" mode
  if (process.env.MANUAL_MINE === '1') {
    await client.request({ method: 'anvil_mine', params: ['0x1'] });
  }
}
```

### 6.8 Bot Architecture Diagram (text)

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                              bot/src/index.ts                          │
 │                                                                        │
 │   ┌──────────────────┐    ┌────────────────┐    ┌──────────────────┐  │
 │   │ MempoolWatcher   │───▶│ VictimFilter   │───▶│ SwapDecoder      │  │
 │   │  (viem WS sub)   │    │ (tokens, size) │    │ (decodeFunction) │  │
 │   └──────────────────┘    └────────────────┘    └────────┬─────────┘  │
 │                                                           │            │
 │                                                           ▼            │
 │                                              ┌──────────────────────┐  │
 │                                              │ Profitability        │  │
 │                                              │ Engine               │  │
 │                                              │  • pool snapshot     │  │
 │                                              │  • golden-section    │  │
 │                                              │  • gas model         │  │
 │                                              └─────────┬────────────┘  │
 │                                                        │ Plan          │
 │                                                        ▼                │
 │   ┌──────────────────┐      ┌───────────────┐   ┌─────────────────┐   │
 │   │ NonceManager     │◀────▶│ TxBuilder     │──▶│ Submitter       │   │
 │   │                  │      │ (EIP-1559)    │   │ (sendRawTx + mine) │
 │   └──────────────────┘      └───────────────┘   └─────────────────┘   │
 │                                                                        │
 │                          ┌──────────────┐                              │
 │                          │ LLM Agent    │ (optional) §7                │
 │                          │ postmortem   │                              │
 │                          └──────────────┘                              │
 └────────────────────────────────────────────────────────────────────────┘
```

### 6.9 Observability

- **pino JSON logs** with keys `{ module, victimHash, decision, expectedProfitWei, realizedProfitWei, latencyMs }`.
- `prom-client` counters: `victims_seen`, `victims_skipped_unprofitable`, `sandwiches_fired`, `sandwiches_realized_profit_wei`.
- Optional `/metrics` HTTP endpoint on `:9090` — handy when the demo video shows real-time throughput.

---

## 7. AI / LLM Agent Extension

The LLM adds value in three bounded places — **not** as a tx signer, always as an advisor.

### 7.1 Use Cases

| Use case                         | Where it runs                     | Prompt input                                                  | Why LLM vs code                                                      |
| -------------------------------- | --------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Trade-skip explainer**         | After `profitabilityEngine` rejects | `{ victim, poolState, computedProfit, gasCost, reason }`      | Human-readable postmortem; surfaces parameter patterns (fee too low, victim under min-size) |
| **Strategy tuner**               | Nightly batch over logged rejects | Aggregated CSV of last N decisions                            | Suggests config changes (e.g. "lower MIN_VICTIM_SIZE to capture +30% of observed swaps") |
| **Revert & log debugger**        | On any bot or contract revert     | `{ txHash, revertBytes, decodedSelector, contextualCode }`    | Decodes cryptic `custom_error(uint, bytes32)` into likely root cause |
| **Market-context narrator** (UI) | Swap UI sidebar (optional)        | Recent swaps, pool stats                                      | Nice-to-have explainer: "Price impact high because of thin liquidity above tick X" |

### 7.2 Agent Architecture

```
 ┌────────────────────────────────────────────────────────────────┐
 │                     ai/strategyAgent.ts                        │
 │                                                                │
 │   Event ──► Prompt Builder ──► LLM (OpenAI/Claude) ──► Parser  │
 │     │            │                      │               │       │
 │     │            │                      │               ▼       │
 │     │            │                      │         Structured    │
 │     │            │                      │         Suggestion    │
 │     │            │                      │         (JSON schema) │
 │     │            │                      ▼                        │
 │     │            │              Cached per                        │
 │     │            │              (victim-class,                    │
 │     │            │               reason) key                      │
 │     ▼            ▼                                                │
 │   pino log    Strict system prompt: "respond ONLY as JSON         │
 │   archive     matching schema {reason, suggestion, confidence}"   │
 └────────────────────────────────────────────────────────────────┘
```

**Strict JSON mode** (OpenAI `response_format: json_schema` / Anthropic tool-use) is mandatory — the bot must never parse free-form prose. Schema:

```ts
const skipExplainerSchema = z.object({
  summary: z.string().max(200),
  likelyCause: z.enum(['gas_too_high','victim_too_small','slippage_too_tight','pool_too_shallow','other']),
  suggestedConfigChange: z.object({
    key: z.string(),
    oldValue: z.union([z.string(), z.number()]),
    newValue: z.union([z.string(), z.number()]),
    expectedImpact: z.string(),
  }).nullable(),
  confidence: z.number().min(0).max(1),
});
```

### 7.3 Guardrails

1. **Rate limit** — one LLM call per N decisions (env: `LLM_SAMPLE_EVERY=20`).
2. **Local cache** — LRU keyed by `(reason, victim-bucket)` — avoids re-asking the same question.
3. **No-agency rule** — the LLM **never** changes runtime config. Its suggestions are logged to `bot-suggestions.jsonl` for human review.
4. **Cost cap** — `MAX_LLM_USD_PER_HOUR`; exceeding it disables the agent until next hour.

### 7.4 Future extension (out of scope)

A *proper* trading agent (LangGraph-style) with tools: `getPoolSnapshot`, `simulateSwap`, `proposeStrategy`, `runShadowTest`. Out of scope for this assignment, but the codebase is structured so this slots in cleanly at `apps/bot/src/ai/*`.

---

## 8. APIs & Communication

### 8.1 Frontend ↔ Blockchain

| Call                              | Method                              | Transport |
| --------------------------------- | ----------------------------------- | --------- |
| Connect wallet                    | `eth_requestAccounts` (MetaMask)    | EIP-1193  |
| Read pool/position state          | `eth_call` via `useReadContract`    | JSON-RPC  |
| Subscribe to new blocks           | `useBlockNumber({ watch: true })` → `eth_subscribe('newHeads')` | WS  |
| Subscribe to events               | `useWatchContractEvent`             | WS        |
| Submit tx                         | `eth_sendTransaction` (MetaMask)    | EIP-1193  |
| Wait for receipt                  | `waitForTransactionReceipt`         | JSON-RPC  |

Wagmi's transport is configured WS-first with HTTP fallback:

```ts
transport: fallback([webSocket(WS_URL), http(HTTP_URL)])
```

### 8.2 Bot ↔ Node

| Call                              | Method                          | Purpose                         |
| --------------------------------- | ------------------------------- | ------------------------------- |
| Pending tx stream (primary)       | `eth_subscribe('newPendingTransactions')` via WS | Zero-latency intake |
| Pending tx poll (fallback)        | `txpool_content`                | Used if WS disconnects          |
| Read pool state                   | `eth_call`                      | Snapshot before simulate        |
| Submit sandwich                   | `eth_sendRawTransaction`        | Pre-signed with nonce           |
| Force block (demo mode)           | `anvil_mine`                    | Make ordering deterministic     |
| Impersonate (tests only)          | `anvil_impersonateAccount`      | Test victim scenarios           |

### 8.3 Internal APIs (bot-local HTTP)

For the demo video we expose a tiny HTTP server for the UI to peek at bot state:

- `GET /health` → `{ up: true, lastBlock: 123 }`
- `GET /stats` → Prometheus text + JSON summary
- `GET /decisions?limit=50` → last decisions with decoded victim params

No auth (local-only; binds to `127.0.0.1`).

### 8.4 WebSockets vs Polling — decision rules

- **Always prefer WS** for: new blocks, new pending txs, contract events.
- **Use polling** for: txpool contents (fallback), health checks, cross-origin frontends with unreliable WS.
- **Never use WS** from the browser for pending txs — that's the bot's job; browsers shouldn't see the mempool of other users.

---

## 9. DevOps & Environment Setup

### 9.1 Prerequisites

| Tool         | Version         | Install                                           |
| ------------ | --------------- | ------------------------------------------------- |
| Node.js      | **20.x** (LTS)  | `nvm install 20 && nvm use 20`                    |
| pnpm         | **9.x**         | `corepack enable && corepack prepare pnpm@latest` |
| Foundry      | **latest nightly** | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| git          | any             | —                                                 |
| MetaMask     | latest          | Browser extension                                 |
| (optional) Docker | 24+        | For `docker-compose up` path                       |

### 9.2 Environment Variables (`.env.example`)

```
# Node / chain
RPC_HTTP_URL=http://127.0.0.1:8545
RPC_WS_URL=ws://127.0.0.1:8545
CHAIN_ID=31337

# Bot wallet (pre-funded dev account — NEVER a real key)
BOT_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d  # anvil #1

# Bot tuning
MIN_PROFIT_WEI=1000000000000000          # 0.001 token
MIN_VICTIM_SIZE_WEI=100000000000000000   # 0.1 token
MAX_FRONT_SIZE_WEI=10000000000000000000  # 10 tokens
FRONT_TIP_BUMP_GWEI=2
MANUAL_MINE=1                            # 1 = call anvil_mine after submit

# LLM (optional)
LLM_PROVIDER=openai                      # 'openai' | 'anthropic' | 'none'
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
LLM_SAMPLE_EVERY=20
MAX_LLM_USD_PER_HOUR=2

# Deployments (written by forge scripts; don't edit by hand)
DEPLOYMENTS_FILE=packages/contracts/deployments/31337.json

# ─────────────────────────────────────────────────────────────────
#  Production (Render) — only used by apps/render-bundle and the
#  Render dashboard "Environment" settings. Not required for local dev.
# ─────────────────────────────────────────────────────────────────
# Hosted Anvil identity (chosen to avoid MetaMask collisions with 31337)
HOSTED_CHAIN_ID=1337421
HOSTED_PUBLIC_RPC_URL=https://liquichain-chain.onrender.com/rpc
HOSTED_PUBLIC_WS_URL=wss://liquichain-chain.onrender.com/ws

# Cloudflare R2 — persistent state store (NEVER commit real values)
R2_ACCOUNT_ID=<set-in-render-dashboard>
R2_ACCESS_KEY_ID=<set-in-render-dashboard>
R2_SECRET_ACCESS_KEY=<set-in-render-dashboard>
R2_BUCKET=liquichain-state
R2_STATE_OBJECT_KEY=state.json
STATE_DUMP_INTERVAL_SEC=300

# Render health / admin
HEALTH_PORT=10000               # Render injects $PORT; Caddy binds to it
ADMIN_RESET_SECRET=<random-long-string>   # optional /admin/reset trigger
```

> **Secrets hygiene:** `.env` is gitignored. Only `.env.example` (with placeholders, never real values) is tracked. All production secrets live in the Render dashboard's "Environment" tab, injected at runtime. `packages/shared/src/addresses.ts` reads `deployments/<chainId>.json` at build time — addresses are public, keys are not.

### 9.3 Scripts (root `package.json`)

```jsonc
{
  "scripts": {
    "chain":         "bash scripts/start-anvil.sh",
    "deploy":        "bash scripts/deploy-all.sh",
    "seed":          "bash scripts/seed-tokens.sh",
    "web":           "pnpm --filter web dev",
    "bot":           "pnpm --filter bot dev",
    "dev":           "bash scripts/dev.sh",               // all-in-one
    "reset":         "bash scripts/reset.sh",
    "test":          "turbo run test",
    "lint":          "turbo run lint",
    "build":         "turbo run build",

    "bundle:docker": "docker build -t liquichain-chain:local -f apps/render-bundle/Dockerfile .",
    "bundle:run":    "docker run --rm -p 10000:10000 --env-file .env liquichain-chain:local",
    "web:export":    "pnpm --filter web build && pnpm --filter web export",
    "deploy:render": "echo 'Push to main → Render auto-deploys both services per render.yaml'"
  }
}
```

**`scripts/start-anvil.sh`:**
```bash
#!/usr/bin/env bash
set -euo pipefail
anvil \
  --no-mining \
  --block-time 12 \
  --order fees \
  --host 0.0.0.0 --port 8545 \
  --mnemonic "test test test test test test test test test test test junk"
```

**`scripts/deploy-all.sh`:**
```bash
#!/usr/bin/env bash
set -euo pipefail
cd packages/contracts
forge script script/00_DeployCore.s.sol       --rpc-url $RPC_HTTP_URL --broadcast
forge script script/01_DeployOperator.s.sol   --rpc-url $RPC_HTTP_URL --broadcast
forge script script/02_DeployMockTokens.s.sol --rpc-url $RPC_HTTP_URL --broadcast
forge script script/03_InitializePool.s.sol   --rpc-url $RPC_HTTP_URL --broadcast
pnpm --filter shared build   # regen ABIs + addresses
```

**`scripts/dev.sh`:**
```bash
#!/usr/bin/env bash
npx concurrently -n chain,deploy,web,bot -c blue,magenta,green,yellow \
  "pnpm chain" \
  "sleep 3 && pnpm deploy && pnpm seed" \
  "pnpm web" \
  "sleep 8 && pnpm bot"
```

### 9.4 Local Setup Steps (from a clean checkout)

```bash
git clone <repo>
cd liquichain-stack
cp .env.example .env
pnpm install
forge install --root packages/contracts

# terminal A
pnpm chain

# terminal B
pnpm deploy && pnpm seed

# terminal C
pnpm web            # open http://localhost:3000

# terminal D
pnpm bot            # logs streaming pending txs and sandwich decisions
```

Or, single command: `pnpm dev`.

### 9.5 Docker (optional path)

`docker-compose.yml` services: `anvil`, `deploy` (one-shot), `web`, `bot`. Useful if reviewers want zero host installs. Anvil runs in a Foundry container; frontend/bot share a Node image.

---

## 10. Advanced Concepts (Senior Level)

### 10.1 Gas Optimization

- **EIP-1559 tips:** use `maxPriorityFeePerGas` to control ordering, not `gasPrice`. Legacy gas on EIP-1559 chains just gets upgraded internally with `priority = gasPrice - baseFee`, but keeping 1559 fields explicit is cleaner.
- **Gas limit:** estimate once via `eth_estimateGas` at bot startup for each swap shape and cache it — avoid repeating estimation per victim (saves 30–50ms).
- **Calldata packing:** the operator ABI uses a single struct — we reuse the viem-encoded bytes for front/back (different amounts), saving encode cost per decision.
- **Static calls first:** before broadcasting, we `eth_call` the front-run from the bot's EOA; if it reverts (e.g. approval issue), we abort without paying gas.

### 10.2 Mempool Behavior (what matters for the bot)

- **Anvil's mempool is FIFO by default** — that's why we pass `--order fees` to emulate Geth's priority-fee-based ordering. Without it, gas tip doesn't guarantee ordering.
- **Pending tx visibility window:** with auto-mine ON, a tx is mined in the next block (~instant) — **no window to sandwich**. `--no-mining` + manual mine gives us an arbitrary window.
- **Replace-by-fee (RBF):** Anvil supports it. If the victim bumps their gas, our front-run might no longer outbid. We re-evaluate on `newPendingTransactions` for the same hash prefix (same from+nonce).

### 10.3 Slippage Mechanics

- LiquiChain uses `limitSqrtPrice` rather than `amountOutMin`. Both are equivalent expressions of "revert if price moves past X".
- **Implied slippage** from `limitSqrtPrice`:
  `slippagePct ≈ 2 · |limitSqrtPrice - currentSqrt| / currentSqrt` (first-order — `Δprice ≈ 2·Δsqrt/sqrt`).
- **Our attack's upper bound:** we can push the price right up to (but not past) the victim's limit — any further and the victim reverts and we eat the front-run cost.

### 10.4 MEV Risks (what a senior engineer must call out)

- **Adversarial victims** can set `limitSqrtPrice = currentSqrt` (0% slippage) → sandwich impossible; our engine correctly rejects.
- **Private mempools** (in production): on real networks, users increasingly submit via Flashbots Protect / MEV-Share; our local demo doesn't face this.
- **Bundle reverts on mainnet:** Flashbots bundles are atomic; in our local sequential-EOA demo, any of the 3 txs could fail independently. Mitigation: simulate the whole sequence locally via `debug_traceCall` chained through state overrides before sending.
- **Toxic flow:** sandwiching other bots or smart-contract users that check-and-revert-on-bad-price costs us gas with no profit. Production bots maintain an EOA allowlist/denylist.

### 10.5 Security Concerns

- **Private keys in bot:** loaded from `.env`, never committed. Dev-only keys (Anvil's well-known accounts) in the demo; `.env.example` documents this and `.env` is gitignored.
- **CORS:** the Next.js dev server talks only to `localhost:8545`. No external RPCs.
- **MetaMask chain spoof:** we validate `chainId === 31337` before every write; mismatches prompt a `switchChain` instead of allowing a sign.
- **Slippage UI footgun:** we cap manual slippage at 50% with a dismissible warning; default 0.5%.
- **Reorg safety:** on a local chain reorgs don't happen organically, but `anvil_reset` will wipe state. The frontend treats a missing block number as reset and clears the tx store.
- **Dependency supply-chain:** `pnpm audit --prod` in CI; `package.json` pins exact versions; foundry libs are git submodules pinned by commit SHA.

---

## 11. Edge Cases & Failure Handling

| # | Scenario                                                                 | Detection                                              | Mitigation                                                                 |
| - | ------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1 | **User rejects MetaMask popup**                                          | viem throws `UserRejectedRequestError`                 | `useTxLifecycle` catches → tx state = `reverted`, toast "Signing cancelled" |
| 2 | **Frontend sends tx but node is down**                                   | Provider throws / `eth_blockNumber` times out          | Health ping every 5s; red "Chain disconnected" banner; disables submit     |
| 3 | **Bot WS connection drops**                                              | `ws.onclose`                                           | Exponential backoff reconnect (1s → 30s); fall back to txpool polling      |
| 4 | **Bot's nonce desyncs (manual tx in wallet, restart)**                   | `nonce too low` / `replacement underpriced` on submit  | `nonceManager.reset()` on error; retry once                                |
| 5 | **Two victims in the same pending window**                               | Decoder sees both                                      | Priority queue by `expectedProfit`; sandwich only the top victim this block |
| 6 | **Our front-run would make victim revert**                               | Profitability engine projects post-front price > limit | Skip (log `victim_would_revert`)                                           |
| 7 | **Victim's tx gets dropped (RBF or reverted)**                           | Our front-run mines but victim doesn't                 | Our back-run still runs → sells what we bought, realizing market impact loss. We detect by watching for the victim hash in the same block; if absent, we log `orphaned_frontrun` and continue. |
| 8 | **Network congestion → our back-run misses the block**                   | Receipt shows front-run only                           | Retry back-run with updated tip; if still failing, emergency close: market-sell at any price to restore inventory |
| 9 | **Bot crashes mid-attack (front-run submitted, back-run not)**           | Startup sees imbalanced inventory                      | Startup reconciliation: check EOA balances; if > expected, emit `emergency_close` market order |
|10 | **Contract reverts with a custom error**                                 | `BaseError.cause.data` matches `0x{selector}{args}`    | `decodeErrorResult` from viem → human message; surfaced to UI and pino     |
|11 | **Anvil restarts (state wipe)**                                          | `eth_chainId` same, but `eth_getCode(operator) === '0x'` | Frontend detects, prompts "Redeploy needed". Bot pauses and re-reads addresses from `deployments/31337.json` |
|12 | **Kernel editor produces an invalid kernel (non-monotonic sqrtPrices)**  | Client-side validator before submit                    | Disable submit, inline error "knots must be strictly increasing"           |
|13 | **User attempts swap on a pool that doesn't exist yet**                  | `getPoolState` returns zero sqrt                       | Swap page shows "Pool not initialized" with CTA to create                  |
|14 | **Race between UI read and bot sandwich**                                | Not actually harmful — reads are eventually consistent | Invalidate TanStack Query on new block; accept 1-block staleness           |
|15 | **Multiple bot instances running against same wallet**                   | Duplicate-nonce rejections                             | File-lock `bot.lock` at startup; exit if held                              |
|16 | **Render cold-start (sleep) hits a user mid-session**                    | `/health` latency > 200ms on first request             | Frontend "waking up" banner; block wallet ops until warm; pre-warm on Connect Wallet click (§14.12) |
|17 | **Render deploys mid-sandwich (kills container between front/back-run)** | SIGTERM received with front submitted, back not sent   | `state-sync` dumps on SIGTERM; on reboot, bot reconciles inventory and emits `emergency_close` market order (§11.9) |
|18 | **Cloudflare R2 returns stale state (5-min snapshot lag)**               | Boot state.ts older than last tx by >5 min             | Accepted trade-off; UI shows a "demo state may be up to 5 min old" tooltip |
|19 | **Abusive visitor floods public RPC**                                    | Caddy 429s in logs                                     | Rate limit absorbs it (120 req/min/IP); no-op                              |
|20 | **Public visitor bricks the chain via a malicious contract**             | Bot gas usage spikes; normal swaps revert              | `/admin/reset` endpoint (auth via `ADMIN_RESET_SECRET` header) re-runs `anvil_loadState` from last known-good R2 snapshot |

### 11.1 Revert-Reason Decoding (for the UI)

```ts
// lib/errors.ts
export function humanizeError(err: unknown): string {
  if (err instanceof BaseError) {
    const reverted = err.walk(e => e instanceof ContractFunctionRevertedError);
    if (reverted) {
      const reason = (reverted as ContractFunctionRevertedError).data?.errorName
        ?? (reverted as ContractFunctionRevertedError).reason
        ?? 'Reverted';
      return reason;
    }
    if (err.walk(e => e instanceof UserRejectedRequestError)) return 'Cancelled';
    return err.shortMessage;
  }
  return String(err);
}
```

---

## 12. README Template

A copy-pasteable `README.md` skeleton that lives at repo root. Everything below the line goes into the file.

---

````markdown
# LiquiChain — dApp + MEV Sandwich Bot (Local + Render)

> Full-stack reference implementation of the LiquiChain protocol for the Senior Full-Stack Web3 Engineer screening assignment.
>
> Deploys LiquiChain `core` + `operator` to a local Anvil node, ships a Next.js dApp (pool init, liquidity mgmt, swap w/ slippage + kernel visualizer), and runs a TypeScript sandwich bot that monitors the mempool and executes front-run / back-run ordering against user swaps.
>
> Two ways to experience it:
> - **Try it live** → `https://liquichain-web.onrender.com` (hosted end-to-end on Render free tier; no installs)
> - **Run locally** → full determinism, full bot logs, recommended for evaluating the sandwich demo

## Try It Live (no install)

1. Open [https://liquichain-web.onrender.com](https://liquichain-web.onrender.com).
2. Click **"Add LiquiChain Hosted"** — MetaMask prompts to add chain `1337421` pointing at our hosted Anvil.
3. Click **"Fund my wallet"** — calls the public `mint()` on the mock ERC-20s (TKA + TKB, 10,000 each) + `anvil_setBalance` via a whitelisted helper to give you gas.
4. Swap, add liquidity, create a pool — whatever you want. State persists via Cloudflare R2 snapshots every 5 min.
5. Peek at the bot's activity: [https://liquichain-chain.onrender.com/stats](https://liquichain-chain.onrender.com/stats).

**Note on the live demo:** the hosted chain is a shared sandbox — other visitors are transacting simultaneously, and the bot is actively sandwiching. Your swap might get sandwiched by the bot in real time; that's the point. For a deterministic, step-through sandwich demo (and the video walkthrough), run locally below.

**First request after idle?** The backend sleeps after 15 min of no traffic; first visitor waits ~30 s for cold start. The UI shows a "Waking up…" banner.

## Transparency Statement

| Feature                                         | Status           | Notes                                                                                  |
| ----------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| Local Anvil deployment (core + operator)        | ✅ Complete       | Foundry scripts in `packages/contracts/script/`                                        |
| Mock ERC-20 tokens (TKA, TKB)                   | ✅ Complete       | Pre-minted + pre-approved for operator                                                 |
| Wallet integration (MetaMask)                   | ✅ Complete       | wagmi v2, chain `31337`, graceful pending/confirmed/reverted UI                        |
| Pool initialization UI                          | ✅ Complete       | Includes mock-kernel toggle                                                            |
| Graphical kernel editor                         | ⚠️ Partial       | Draggable knots + live preview; binding to on-chain encoder uses mock kernel by default |
| Liquidity management (mint/burn)                | ✅ Complete       | Full / partial withdraw                                                                |
| Swap UI with slippage + price impact            | ✅ Complete       | Slider + custom input; client-side simulator                                           |
| Sandwich bot (mempool → decode → execute)       | ✅ Complete       | WS subscription + EIP-1559 ordering + anvil_mine demo mode                             |
| LLM strategy agent                              | ⚠️ Optional      | Feature-flag; disabled by default                                                      |
| Production-grade MEV bundle (Flashbots)         | ❌ Out of scope   | Local / hosted Anvil only per assignment                                                |
| Hosted public demo (Render free tier)           | ✅ Complete       | Static frontend + Dockerized Anvil+bot bundle; R2-backed state persistence; keep-alive cron (§14) |

## Prerequisites

- Node.js 20.x (`nvm use 20`)
- pnpm 9.x (`corepack enable`)
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- MetaMask browser extension

## Quick Start

```bash
git clone <repo> && cd liquichain-stack
cp .env.example .env
pnpm install
forge install --root packages/contracts
pnpm dev      # starts anvil + deploys contracts + web + bot (concurrently)
```

Then:

1. Open `http://localhost:3000`.
2. In MetaMask, click "Add local chain" from the UI (one-click `wallet_addEthereumChain`) — or manually add `chainId 31337`, RPC `http://127.0.0.1:8545`.
3. Import one of the Anvil test accounts (the UI shows the mnemonic used in dev mode).
4. Create a pool (or use the pre-seeded one), add liquidity, and submit a swap.
5. Watch the bot terminal — you'll see:
   ```
   [mempool] pending tx 0xabc... → operator.swap
   [decode]  victim=0xUser poolId=0x... amountIn=1e18 limitSqrtPrice=...
   [profit]  expected=+0.0042 TKA (gas-adjusted)
   [execute] nonces=[4,5] front tip=3 gwei, back tip=1 gwei
   [result]  confirmed block=42 realized=+0.0039 TKA
   ```

## Commands

| Command        | What it does                                               |
| -------------- | ---------------------------------------------------------- |
| `pnpm chain`   | Starts Anvil with `--no-mining --block-time 12 --order fees` |
| `pnpm deploy`  | Runs all `forge script` deployments in order               |
| `pnpm seed`    | Mints tokens to dev accounts, approves operator            |
| `pnpm web`     | Starts Next.js dApp on `:3000`                             |
| `pnpm bot`     | Starts the sandwich bot                                    |
| `pnpm dev`     | All of the above concurrently                              |
| `pnpm test`    | Turbo pipeline: `forge test` + vitest + playwright         |
| `pnpm lint`    | ESLint + forge fmt check                                   |
| `pnpm reset`   | Kills processes, clears caches, resets Anvil state         |

## Architecture Overview

See `BLUEPRINT.md` for the full engineering blueprint. TL;DR:

- **Frontend** (`apps/web`) — Next.js 14 + wagmi/viem + Zustand; talks to Anvil via MetaMask.
- **Bot** (`apps/bot`) — Node/TS; subscribes to `newPendingTransactions` on Anvil WS, decodes operator calldata, simulates sandwich profitability, fires front/back EOA txs with correct EIP-1559 tips and nonces.
- **Contracts** (`packages/contracts`) — Foundry project vendoring LiquiChain core + operator with mock ERC-20s and deployment scripts that emit `deployments/31337.json`.
- **Shared** (`packages/shared`) — ABIs + addresses + types consumed by both apps. Guarantees they can't drift.

## Deploy your own (Render)

**One-time setup (free, ~15 min):**

1. Fork this repo.
2. Create a free [Cloudflare R2](https://dash.cloudflare.com/) bucket named `liquichain-state` and generate an API token (Object Read+Write, scoped to this bucket).
3. Create a free [Render](https://render.com) account and connect your GitHub.
4. In Render's dashboard → "New +" → **"Blueprint"** → point at your fork. Render reads `apps/render-bundle/render.yaml` and provisions **both** services (`liquichain-web` static site + `liquichain-chain` docker service).
5. Set the 4 secret env vars on the `liquichain-chain` service (values from step 2 + a fresh EOA private key for the bot):
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
   - `BOT_PRIVATE_KEY` (**generate a brand-new key** — never reuse a key from any other context)
6. First deploy: both services build & come up. The chain is empty.
7. Trigger the **"Deploy contracts to hosted Anvil"** GitHub Action manually. It deploys LiquiChain core + operator + mocks + a seed pool, commits `packages/contracts/deployments/1337421.json`, which auto-triggers the frontend redeploy with addresses baked in.
8. Create a [cron-job.org](https://cron-job.org) account and add a job: `GET https://liquichain-chain.onrender.com/health`, every 10 min. Prevents idle sleep.

**Ongoing cost: $0.** Render free tier (static site always-on, web service 750 hrs/mo = always-on with 30 hrs headroom) + R2 free tier (10 GB + 1M writes/mo) + cron-job.org (free forever) covers everything.

Full architecture, failure modes, and R2 state-persistence design: [BLUEPRINT.md §14](./BLUEPRINT.md#14-production-deployment-on-render).

### Bot Sandwich Math (one-liner)

Given victim with `amountIn V` and `limitSqrtPrice L`, the bot searches (golden-section) for optimal front-run size `x` maximizing:

```
profit(x) = backrunOut(state_after_victim_after_front(x), ourBalanceIn_tokenOut) - x - gasCost
subject to: postFrontSqrt(x, kernel) does not push victim execution past L
```

Full derivation in `BLUEPRINT.md §6.4`.

## Known Limitations

- **Kernel binding:** the graphical editor emits a valid shape, but the default flow uses the reference mock kernel for deterministic demo. Switch with the "Use custom kernel" toggle.
- **No MEV contract:** sandwich uses sequential EOA txs per assignment scope.
- **No Flashbots:** local / hosted Anvil only.
- **LLM agent:** off by default. Enable via `LLM_PROVIDER=openai` and an API key.
- **Bot counters not persisted:** bot's in-memory metrics reset on restart. Chain state *is* persisted to Cloudflare R2 (see §14.4) so pools and balances survive.
- **Hosted chain cold start:** 30–60 s wake-up after 15+ min idle (mitigated by keep-alive cron, but still happens on deploys).
- **Hosted chain is a shared sandbox:** multiple visitors share state. Two users swapping at the same moment will see each other's txs. This is by design for a public demo — the bot sandwiches whoever's online.
- **State snapshot lag:** R2 dumps every 5 min + on SIGTERM. An unclean crash can lose up to ~5 min of state.
- **Reorgs:** not handled (Anvil doesn't reorg unless someone calls `anvil_reset`, which is firewalled off on the hosted chain).

## References

- [LiquiChain Core](https://github.com/NoFeeSwap/core)
- [LiquiChain Operator](https://github.com/NoFeeSwap/operator)
- [Protocol specification (PDF)](https://github.com/NoFeeSwap/docs/blob/main/yellowpaper.pdf)
- [Initialize_test.py#L67-L78](https://github.com/NoFeeSwap/core) — deployment reference
- [SwapData_test.py#L841-L846](https://github.com/NoFeeSwap/operator) — mock kernel
````

---

## 13. Testing Strategy

### 13.1 Smart Contract Tests (Foundry)

Location: `packages/contracts/test/`.

- **`Swap.t.sol`** — end-to-end: deploy core + operator + mocks, initialize pool with mock kernel, execute a swap, assert balances & price movement match expected math.
- **`Kernel.t.sol`** — fuzz the kernel encoder with random monotonic knot sequences; assert round-trip encode/decode equality.
- **`Sandwich.t.sol`** — **critical**: simulate the sandwich atomically in Solidity (three calls in one test function) and assert:
  - victim's `amountOut` is strictly worse than the standalone swap,
  - sandwich EOA ends up with strictly more `tokenIn` than it started (minus gas — gas is ignored in pure logic test, enforced in bot-level test),
  - invariant: total `tokenOut` across the three swaps equals what the pool paid out.
- **Coverage gate:** `forge coverage` ≥ 85% on our mocks + scripts (we don't test vendored LiquiChain code — trust its own test suite).
- **Gas snapshots:** `forge snapshot` checked into git; CI diffs them.

### 13.2 Shared package tests (vitest)

- **ABI codec round-trips:** encode a `SwapParams` struct, hand to `decodeFunctionData`, assert deep-equal.
- **Slippage math helpers:** table-driven tests (input sqrtPrice, limit, expected %).

### 13.3 Bot Tests (vitest)

Location: `apps/bot/tests/`.

- **`decoder.spec.ts`** — feeds known-good calldata (captured from a real Anvil swap) to `decodeVictim`; asserts parsed fields exactly. Also feeds garbage (random bytes, wrong selector, empty input) — must return `null`, not throw.
- **`profitability.spec.ts`** — property-based (fast-check): for random pool states and victims, if `profit > 0` the reported plan's inclusion cannot push victim past its limit.
- **`nonceManager.spec.ts`** — concurrency test: 100 parallel `reserve(2)` calls yield contiguous, non-overlapping nonces.
- **`integration.spec.ts`** — **the big one**: spawns a throwaway Anvil in a child process, runs a full deploy, submits a fake user swap from EOA_A, runs the bot for one block, asserts EOA_bot balances changed as expected.

### 13.4 Frontend Tests

- **Unit (vitest + React Testing Library):** `useTxLifecycle`, `SlippageControl` (boundary inputs), kernel encoder utilities.
- **Component/snapshot:** `<SwapCard>` in all 4 states (disconnected, connected, pending, reverted).
- **E2E (Playwright):**
  - Boot anvil + deploy via `globalSetup`.
  - Uses `@synthetixio/synpress` (or `playwright-metamask`) to drive MetaMask.
  - Scenarios: connect → add chain → swap with default slippage → assert toast transitions pending → confirmed.
  - One "bot-is-running" scenario: start bot as a child process, submit swap, assert UI still shows confirmed *and* bot stdout contains `sandwich realized +`.

### 13.5 CI Matrix (GitHub Actions)

```yaml
jobs:
  contracts:  forge build && forge test && forge snapshot --check
  lint:       pnpm lint
  unit:       pnpm test --filter '!apps/web'      # fast, no browser
  e2e:        pnpm test --filter apps/web          # playwright + synpress
  build:      pnpm build                           # ensures apps compile
```

### 13.6 What we explicitly don't test

- Vendored LiquiChain contracts' internals (trust upstream).
- MetaMask extension behavior (trust it).
- Performance under real-network latency (local only).

---

## 14. Production Deployment on Render

This section is the full playbook for shipping a public, free, shareable demo. Local dev flow (§9) is unaffected — this adds a parallel production path.

### 14.1 Goal & Constraints

| Goal                                                              | Constraint                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Anyone with the URL can connect MetaMask and try the dApp         | Must work in <30s with no install                                                 |
| Sandwich bot runs against the same hosted chain                   | Bot sees user txs via the same Anvil the frontend talks to                        |
| $0 recurring cost                                                 | Render free Static Site + Web Service + Cloudflare R2 free tier + free cron       |
| State survives routine restarts                                   | `anvil_dumpState` every 5 min → R2; `anvil_loadState` on boot                     |
| Hostile visitors can't nuke the chain                             | Caddy blocks `anvil_*` / `debug_*` / `personal_*` RPCs from the public            |
| Demo video still works for the assignment deliverable             | Video still uses local `pnpm dev` path — Render is additive, never required       |

### 14.2 Two Render Services

Defined declaratively in `apps/render-bundle/render.yaml`:

```yaml
# apps/render-bundle/render.yaml
services:
  # Service 1: Static frontend (always-on, free, no sleep)
  - type: web
    name: liquichain-web
    runtime: static
    buildCommand: |
      corepack enable &&
      pnpm install --frozen-lockfile &&
      pnpm --filter contracts build &&
      pnpm --filter shared build &&
      pnpm --filter web build
    staticPublishPath: apps/web/out
    pullRequestPreviewsEnabled: false
    routes:
      - type: rewrite
        source: /*
        destination: /index.html        # Next.js static export SPA fallback
    headers:
      - path: /*
        name: X-Frame-Options
        value: DENY
    envVars:
      - key: NEXT_PUBLIC_CHAIN_ID
        value: "1337421"
      - key: NEXT_PUBLIC_RPC_URL
        value: https://liquichain-chain.onrender.com/rpc
      - key: NEXT_PUBLIC_WS_URL
        value: wss://liquichain-chain.onrender.com/ws

  # Service 2: Chain + Bot bundle (Docker, 750 hrs/mo, sleeps after 15min idle)
  - type: web
    name: liquichain-chain
    runtime: docker
    dockerfilePath: ./apps/render-bundle/Dockerfile
    dockerContext: .
    healthCheckPath: /health
    plan: free
    autoDeploy: true
    envVars:
      - key: HOSTED_CHAIN_ID
        value: "1337421"
      - key: R2_ACCOUNT_ID
        sync: false                     # set manually in Render dashboard
      - key: R2_ACCESS_KEY_ID
        sync: false
      - key: R2_SECRET_ACCESS_KEY
        sync: false
      - key: R2_BUCKET
        value: liquichain-state
      - key: R2_STATE_OBJECT_KEY
        value: state.json
      - key: STATE_DUMP_INTERVAL_SEC
        value: "300"
      - key: BOT_PRIVATE_KEY
        sync: false
      - key: ADMIN_RESET_SECRET
        generateValue: true             # Render generates a strong random value
```

`sync: false` means Render doesn't copy the value across PR previews; operators set it once in the dashboard. `generateValue: true` creates a cryptographically random string on first deploy.

### 14.3 Keep-Alive Strategy (the 15-min sleep fix)

Render free web services sleep after 15 min of no inbound HTTP. An external cron ping resets that timer.

**Setup:**

1. Go to [cron-job.org](https://cron-job.org), create an account (free).
2. Create a job:
   - URL: `https://liquichain-chain.onrender.com/health`
   - Schedule: every **10 minutes** (5-min safety margin under the 15-min sleep threshold)
   - Request method: `GET`
   - Notification: email on 3 consecutive failures
3. Done.

**Why 10 min and not 14 min?** Render's sleep timer is observed to be jittery; anything above ~12 min has been seen to occasionally miss. 10 min burns a few extra pings per hour (free anyway) for reliability.

**The `/health` endpoint** is served by Caddy inside the container without even hitting Anvil — so keep-alive doesn't wake the EVM for every ping:

```caddy
:{$PORT} {
    handle /health {
        respond "ok" 200
    }
    # ... rest of config below
}
```

**Sleep budget arithmetic:** 30 days × 24 hrs = 720 hrs/mo ≤ 750 hrs free quota. Always-on fits with 30 hrs to spare.

### 14.4 State Persistence via Cloudflare R2

**The problem:** Render's filesystem is ephemeral. Every deploy, restart, or crash wipes the container — meaning every pool, every liquidity position, every mock-token balance vanishes.

**The fix:** Anvil supports state dump/load natively via two RPC methods:

- `anvil_dumpState` → returns the entire EVM state as a hex-encoded string
- `anvil_loadState(hex)` → restores it

We snapshot every 5 minutes + on graceful shutdown (SIGTERM), push to Cloudflare R2, and restore on boot.

**`apps/render-bundle/scripts/state-sync.ts`** (pseudocode):

```ts
import { createPublicClient, http } from 'viem';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const anvil = createPublicClient({ transport: http('http://127.0.0.1:8545') });

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function dumpAndUpload() {
  const hex = await anvil.request({ method: 'anvil_dumpState' });   // hex string
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: process.env.R2_STATE_OBJECT_KEY,
    Body: JSON.stringify({ ts: Date.now(), chainId: 1337421, state: hex }),
    ContentType: 'application/json',
  }));
  log.info({ bytes: hex.length }, 'state dumped to R2');
}

async function downloadAndLoad() {
  try {
    const obj = await r2.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET, Key: process.env.R2_STATE_OBJECT_KEY,
    }));
    const body = JSON.parse(await obj.Body!.transformToString());
    await anvil.request({ method: 'anvil_loadState', params: [body.state] });
    log.info({ ageMs: Date.now() - body.ts }, 'state restored from R2');
  } catch (e) {
    if (e.name === 'NoSuchKey') {
      log.warn('no prior state in R2 — starting fresh');
    } else throw e;
  }
}

// main: load on boot, dump every N seconds, dump on SIGTERM
await downloadAndLoad();
setInterval(dumpAndUpload, Number(process.env.STATE_DUMP_INTERVAL_SEC) * 1000);
process.on('SIGTERM', async () => { await dumpAndUpload(); process.exit(0); });
```

**Cloudflare R2 setup:**

1. Sign up at Cloudflare (free).
2. Create an R2 bucket named `liquichain-state` (region: auto).
3. R2 → Manage R2 API Tokens → Create API Token (permissions: Object Read & Write, bucket: `liquichain-state`).
4. Copy the Account ID, Access Key ID, Secret Access Key into Render's environment variables for the `liquichain-chain` service.

**Cost:** 10 GB storage + 1M Class A operations/mo free. A dump every 5 min = 8,640 writes/mo — 0.86% of the free quota. State file for a small demo is ~1–10 MB. Easy fit.

### 14.5 The Dockerfile (`apps/render-bundle/Dockerfile`)

Multi-stage build — keep the final image small and reuse Foundry's official binary:

```dockerfile
# --- stage 1: fetch anvil binary ---
FROM ghcr.io/foundry-rs/foundry:latest AS foundry

# --- stage 2: build TS artifacts ---
FROM node:20-alpine AS builder
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/bot/package.json             apps/bot/
COPY apps/render-bundle/package.json   apps/render-bundle/
COPY packages/shared/package.json      packages/shared/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm --filter shared build \
 && pnpm --filter bot build \
 && pnpm --filter render-bundle build

# --- stage 3: runtime ---
FROM node:20-alpine
RUN apk add --no-cache caddy supervisor curl tini
COPY --from=foundry   /usr/local/bin/anvil   /usr/local/bin/anvil
COPY --from=builder   /repo/apps/bot/dist           /app/bot
COPY --from=builder   /repo/apps/render-bundle/dist /app/render-bundle
COPY --from=builder   /repo/node_modules            /app/node_modules
COPY --from=builder   /repo/packages/shared/dist    /app/packages/shared/dist
COPY --from=builder   /repo/packages/contracts/deployments /app/deployments
COPY apps/render-bundle/Caddyfile          /etc/caddy/Caddyfile
COPY apps/render-bundle/supervisord.conf   /etc/supervisor/conf.d/app.conf
COPY apps/render-bundle/scripts/boot.sh    /boot.sh
RUN chmod +x /boot.sh
ENV NODE_ENV=production
EXPOSE 10000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/boot.sh"]
```

### 14.6 Caddy Config (`apps/render-bundle/Caddyfile`) — the RPC firewall

Caddy is the only process bound to the public `$PORT`. Anvil and the bot live on `127.0.0.1` and are not reachable from the internet. Caddy does four things:

1. **Allow-list RPC methods.** Only `eth_*`, `net_*`, `web3_*`, `txpool_content` pass through. Everything else (`anvil_*`, `debug_*`, `personal_*`, `miner_*`, `admin_*`) returns 403.
2. **Rate-limit per IP.** 120 requests / minute — plenty for a user, painful for abusers.
3. **Serve `/health`** without touching Anvil.
4. **Expose `/rpc` (HTTP) and `/ws` (WebSocket)** as the two public endpoints.

```caddy
{
    # global
    admin off
    auto_https off          # Render handles TLS at its edge
}

:{$PORT} {
    log { output stdout format json }

    handle /health {
        respond "ok" 200
    }

    # JSON-RPC over HTTPS
    @rpc path /rpc /rpc/*
    handle @rpc {
        rate_limit {
            zone rpc_per_ip {
                key    {client_ip}
                events 120
                window 1m
            }
        }
        # Method allow-list enforced by a tiny Node proxy on :8546
        reverse_proxy 127.0.0.1:8546
    }

    # WebSocket over WSS
    @ws path /ws /ws/*
    handle @ws {
        reverse_proxy 127.0.0.1:8546 {
            header_up Connection {>Connection}
            header_up Upgrade    {>Upgrade}
        }
    }

    handle {
        respond "liquichain-chain: see /health, /rpc, /ws" 200
    }
}
```

The **method allow-list** lives in a small Node proxy (`apps/render-bundle/scripts/rpc-proxy.ts`) that sits between Caddy and Anvil — it inspects the JSON-RPC body, rejects disallowed methods with `{ error: { code: -32601, message: "method disallowed" } }`, and forwards the rest.

```ts
// allowed prefix set
const ALLOWED = new Set([
  'eth_', 'net_', 'web3_', 'txpool_content', 'txpool_status',
]);
// denied explicitly even if they look ok
const DENIED = new Set([
  'anvil_', 'debug_', 'personal_', 'miner_', 'admin_', 'evm_',
  'hardhat_', 'txpool_inspect',
]);
```

### 14.7 supervisord Config

`supervisord` keeps four processes alive inside the container. If any dies, it's restarted. If any dies repeatedly (>3 in 60s), supervisord exits → Render restarts the container → state is loaded from R2 fresh.

```ini
[supervisord]
nodaemon=true
logfile=/dev/stdout
logfile_maxbytes=0
loglevel=info

[program:anvil]
command=/usr/local/bin/anvil
    --host 127.0.0.1 --port 8545
    --chain-id %(ENV_HOSTED_CHAIN_ID)s
    --block-time 3
    --prune-history
    --gas-limit 30000000
    --accounts 10 --balance 10000
autorestart=true
priority=10
stdout_logfile=/dev/stdout
stderr_logfile=/dev/stderr

[program:rpc-proxy]
command=node /app/render-bundle/rpc-proxy.js
autorestart=true
priority=20
stdout_logfile=/dev/stdout

[program:state-sync]
command=node /app/render-bundle/state-sync.js
autorestart=true
priority=30
startsecs=10            # give anvil time to be ready first
stdout_logfile=/dev/stdout

[program:bot]
command=node /app/bot/index.js
environment=RPC_HTTP_URL="http://127.0.0.1:8545",RPC_WS_URL="ws://127.0.0.1:8545"
autorestart=true
priority=40
startsecs=15
stdout_logfile=/dev/stdout

[program:caddy]
command=caddy run --config /etc/caddy/Caddyfile
autorestart=true
priority=50
stdout_logfile=/dev/stdout
```

### 14.8 Boot Script (`apps/render-bundle/scripts/boot.sh`)

```bash
#!/usr/bin/env sh
set -e

echo "[boot] pre-flight: Anvil state restore from R2"
node /app/render-bundle/state-sync.js --mode=restore-only || \
  echo "[boot] no prior state (fresh start)"

echo "[boot] handing off to supervisord"
exec supervisord -c /etc/supervisor/conf.d/app.conf
```

The `--mode=restore-only` first pass is a degenerate run of the sync script that pulls `state.json` from R2 into a temp file, then starts Anvil with `--load-state <file>` via the env var read by `supervisord`. If no R2 object exists, it's a fresh chain and the deploy step re-runs on first boot (see §14.9).

### 14.9 One-Time Deploy of Contracts to the Hosted Chain

The very first boot has an empty chain — we need LiquiChain core + operator + mocks deployed, and the pool initialized. Two approaches:

**Option A (chosen):** A GitHub Actions workflow runs on manual dispatch:

```yaml
# .github/workflows/deploy-contracts-hosted.yml
name: Deploy contracts to hosted Anvil
on: workflow_dispatch
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge install
        working-directory: packages/contracts
      - name: Deploy
        env:
          RPC_URL: https://liquichain-chain.onrender.com/rpc
          DEPLOYER_PK: ${{ secrets.HOSTED_DEPLOYER_PRIVATE_KEY }}
        run: |
          cd packages/contracts
          forge script script/00_DeployCore.s.sol       --rpc-url $RPC_URL --private-key $DEPLOYER_PK --broadcast
          forge script script/01_DeployOperator.s.sol   --rpc-url $RPC_URL --private-key $DEPLOYER_PK --broadcast
          forge script script/02_DeployMockTokens.s.sol --rpc-url $RPC_URL --private-key $DEPLOYER_PK --broadcast
          forge script script/03_InitializePool.s.sol   --rpc-url $RPC_URL --private-key $DEPLOYER_PK --broadcast
      - name: Commit deployments/1337421.json
        run: |
          git config user.email "bot@LiquiChain"
          git config user.name  "deploy-bot"
          git add packages/contracts/deployments/1337421.json
          git commit -m "chore: hosted chain deployments" || echo "no changes"
          git push
```

After the first successful deploy:

1. Addresses are pushed to `deployments/1337421.json`.
2. Render auto-deploys the Static Site (addresses baked into the static bundle).
3. Every subsequent boot of the `liquichain-chain` service restores state from R2 — contracts and pool persist. Redeploy only needed if state is wiped (see §14.12).

**Option B (fallback):** A `first-boot.ts` script inside the container that detects "no code at expected addresses" and runs `forge script` from within. Clean but fragile — picked Option A.

### 14.10 Frontend Static Export Config

For Render Static Site hosting, `apps/web/next.config.mjs` switches to static export:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',                    // writes to apps/web/out
  images: { unoptimized: true },       // no server-side image optimizer
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID ?? '31337',
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL ?? 'http://127.0.0.1:8545',
    NEXT_PUBLIC_WS_URL:  process.env.NEXT_PUBLIC_WS_URL  ?? 'ws://127.0.0.1:8545',
  },
};
export default nextConfig;
```

The same build works locally (defaults to `31337` + `127.0.0.1`) and in production (reads injected env vars at build time).

The wagmi config switches transports based on `NEXT_PUBLIC_CHAIN_ID`:

```ts
// apps/web/lib/wagmi.ts
const hostedChain = defineChain({
  id: 1337421,
  name: 'LiquiChain Hosted',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL!],
      webSocket: [process.env.NEXT_PUBLIC_WS_URL!],
    },
  },
});
const localChain = { ...anvil, id: 31337 };
const activeChain = Number(process.env.NEXT_PUBLIC_CHAIN_ID) === 1337421
  ? hostedChain : localChain;
```

A one-click **"Add chain to MetaMask"** button calls `wallet_addEthereumChain` with this config so visitors don't have to type anything.

### 14.11 Deploy Workflow (end to end)

```
1. Push to `main`
   ├─ Render auto-deploys liquichain-web         (static build, ~2 min)
   └─ Render auto-deploys liquichain-chain       (Docker build, ~5-8 min)
                                                 └─ boot.sh: restore state from R2

2. First time only (or after chain reset):
   └─ Manually trigger GitHub Actions workflow "Deploy contracts to hosted Anvil"
      └─ Commits deployments/1337421.json
         └─ Triggers another auto-deploy of the web service (new addresses baked in)

3. Always-on:
   └─ cron-job.org pings /health every 10 min      → prevents sleep
   └─ state-sync dumps to R2 every 5 min + SIGTERM → prevents state loss

4. Visitor flow:
   a. Visit https://liquichain-web.onrender.com
   b. Click "Add chain" → MetaMask adds 1337421 + hosted RPC
   c. Click "Fund me" → UI calls a minter on the mock ERC-20 (public mint for demo)
   d. Swap, add liquidity, observe — and optionally watch the bot's public
      /stats JSON endpoint update in real time as it sandwiches your swaps.
```

### 14.12 Cold-Start UX Mitigation

If the service has been asleep, the first visitor takes a ~30-60s hit while the container wakes. We soften this with:

- **Warm-up page** — if `/health` returns >200ms, the frontend shows a "Waking up the hosted chain — 30 seconds" banner with a progress bar, and refuses wallet actions until `/health` is fast again.
- **Pre-warm on click** — "Connect Wallet" triggers a `fetch('/health')` immediately; by the time MetaMask popup appears, the backend is usually warm.
- **Keep-alive cron minimizes this** — cold starts should be rare (only after deploys or crashes).

### 14.13 Failure Modes Specific to Hosted Mode

| Failure                                               | Detection                               | Response                                                           |
| ----------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| R2 unreachable on boot                                | `state-sync restore-only` exits non-zero | Start fresh chain + redeploy contracts via GH Actions               |
| R2 quota exceeded (somehow)                           | 429 on PutObject                        | Pause dumping; alert via cron-job.org failure email                |
| Caddy allow-list blocks a valid new RPC method        | 403s in logs after Anvil upgrade        | Update `rpc-proxy.ts` allow-list, redeploy                         |
| Bot nonce desync after restart                        | `nonce too low` on first send           | `nonceManager.reset()` auto-retries; R2 state restore covers most   |
| 750 hr/mo exceeded                                    | Service 503 + Render email              | Render auto-pauses; reduce keep-alive to every 14 min              |
| Abusive visitor spams `eth_sendRawTransaction`        | Caddy rate-limit returns 429            | No action needed; rate limit absorbs it                            |
| OOM (container exceeds 512 MB)                        | Render restart + "OOM killed" in logs   | State restored from R2 on restart; tune `--prune-history` if chronic |
| Cloudflare R2 API key rotated by us                   | state-sync logs 403s                    | Update Render dashboard env vars; service continues serving reads  |

### 14.14 What to Tell Reviewers

In the submission, the README should point to both tracks (this is baked into §12):

- **Try it live** → Render URL. Works instantly but the sandwich bot is happening silently in the background — for the deterministic sandwich demo, watch the video.
- **Run locally** → `pnpm dev`. Full local chain, full bot visibility, step-through of the demo.

Both tracks exist because each has a purpose: the live demo shows UX + deployability, the local demo shows the engineering rigor of the bot. Reviewers who want to poke at the contracts can hit the live site; reviewers who want to read the sandwich logs run locally.

---

## Appendix A — Decision Log (for the follow-up interview)

| Decision                                | Alternative considered            | Why we chose this                                                                                      |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Anvil over Hardhat                      | Hardhat Network                   | Realistic mempool + `--order fees` required for sandwich ordering; faster cold start                   |
| viem over ethers.js                     | ethers v6                         | Tree-shakable, stronger type inference from ABIs, smaller bundle                                       |
| Zustand over Redux Toolkit              | RTK                               | UI state is simple; TanStack Query already handles async; avoids boilerplate                           |
| Operator-first decoding                 | Decoding core directly            | Users call operator; core is called inside a callback — calldata in the mempool belongs to operator    |
| Manual `anvil_mine` after sandwich      | Relying on `--block-time`         | Determinism for the demo video; removes flaky timing in integration tests                              |
| Strict JSON mode for LLM                | Free-form prose parsing           | Prevents parse errors; LLM is optional, must never block the bot hot-path                              |
| Monorepo (pnpm + turbo)                 | Multi-repo                        | ABI and type sync is the #1 pain point in hybrid web3 projects; monorepo makes it a compile-time error |
| Render (end-to-end) for hosting         | Fly.io, Vercel+Fly hybrid, Railway | Single provider = single dashboard, one blueprint file, one log UI. Render's free Static Site is always-on (no sleep) and the Web Service 750 hr/mo quota fits always-on with 30 hr headroom. Trade-off: 15-min idle sleep on the backend, mitigated by keep-alive cron. |
| Cloudflare R2 for Anvil state dumps      | Supabase Storage, GitHub as store | R2's S3 API is drop-in with `@aws-sdk/client-s3`; 10 GB + 1M writes/mo free handles the workload with >99% headroom. No egress fees ever. |
| Static Next.js export on Render          | SSR on Render Web Service         | All dynamic data comes from the chain via client-side wagmi — SSR buys us nothing, costs a second paid service and cold starts. Static export → always-on free. |
| Caddy as public RPC firewall             | Raw reverse proxy / Node only      | Caddy gives free HTTPS (even though Render handles edge TLS, internal WS upgrades need it), built-in rate limiting, and trivial config for method-filtering proxies. |

## Appendix B — "What I'd do with more time"

1. **Port the bot's in-memory simulator to Rust** (or WASM) for ~10× speedup on profitability search — irrelevant locally but relevant on mainnet.
2. **Proper trading agent** with LangGraph + tool-use, shadow-testing config changes against a rolling window of real txs.
3. **Flashbots Protect / MEV-Share integration** with a matching UI toggle — useful for production.
4. **Fork-mode tests** against a real mainnet fork to validate ABI decoding against production calldata.
5. **Kernel editor → full graphical binding** including arbitrary piecewise curves (currently preset shapes + drag).
6. **Prometheus + Grafana dashboard** for bot observability.
7. **Slither / Mythril** CI step on our mock contracts (vendored LiquiChain already has its own audit trail).
8. **Multi-region hosted demo** — use Render's $7/mo Starter plan to move the backend off free tier (no sleep, 1 GB RAM, persistent disk) and skip R2 + keep-alive entirely. Would cut the ops surface area significantly.
9. **WebSocket heartbeat from client** — explicit ping frame every 20 s from the frontend's viem transport to prevent Render's load-balancer WS idle-kill (currently relying on viem's built-in pings, which work but aren't tuned for Render's 110-s idle cut).
10. **Snapshot rotation in R2** — keep the last 12 hourly snapshots instead of one rolling file, so a bad state (e.g., a griefer deploying a self-destructing contract) can be rolled back without manual chain rebuild.

---

*End of blueprint. Questions, challenges, and feedback welcome in the follow-up interview.*
