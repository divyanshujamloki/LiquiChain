# LiquiChain stack (scaffold)

Monorepo for local DeFi tooling: Anvil, mock ERC‑20s, Next.js dApp, mempool bot skeleton, optional Render bundle. See [`BLUEPRINT.md`](./BLUEPRINT.md) for full technical notes.

## Prerequisites

- **Node.js 20+** and **pnpm 9**
- **Foundry** ([getfoundry.sh](https://getfoundry.sh)) — `forge`, `anvil`, `cast`
- **MetaMask** (browser)

### pnpm (pick one)

- **Via npm (recommended on Windows if `corepack` fails):**  
  `npm install -g pnpm@9`
- **Via Corepack (macOS/Linux; may need Admin on Windows):**  
  `corepack enable` then `corepack prepare pnpm@9.15.0 --activate`
- **Without global pnpm:** from the repo root run  
  `npx pnpm@9 install`  
  (then prefix commands with `npx pnpm@9` instead of `pnpm`, or install globally once.)

### Windows PowerShell notes

- **PowerShell 5.x** (default on Windows) does **not** support `&&`. Use **semicolons** or separate lines, e.g.  
  `cd packages/contracts; forge install foundry-rs/forge-std@v1.9.4 --no-commit; cd ../..`
- **PowerShell 7+** (`pwsh`) supports `&&` like bash.
- If **`corepack enable`** errors with **EPERM** under **nvm-windows**, skip Corepack and use **`npm install -g pnpm@9`** instead, or run the terminal **as Administrator** once (not usually required if you use npm’s pnpm).

## First-time setup

```bash
pnpm install
```

Then install forge-std (bash/Git Bash/WSL):

```bash
cd packages/contracts && forge install foundry-rs/forge-std@v1.9.4 --no-commit && cd ../..
```

PowerShell:

```powershell
cd packages/contracts; forge install foundry-rs/forge-std@v1.9.4 --no-commit; cd ../..
```

If `pnpm install` did not install `forge-std`, run the `forge install` line above manually.

## Local dev (quick path)

**Terminal A — Anvil (assignment-style mempool):**

```bash
bash scripts/start-anvil.sh
```

Or a simple always-on local node:

```bash
pnpm chain
```

**Terminal B — deploy mocks + write `deployments/31337.json`:**

```bash
pnpm deploy:mocks
```

**Terminal C — copy env and run web + bot:**

```bash
cp .env.example .env
pnpm --filter @nfs/shared build
pnpm --filter @nfs/web dev
```

**Terminal D:**

```bash
pnpm --filter @nfs/bot dev
```

Open [http://localhost:3000](http://localhost:3000). Add network **31337**, RPC `http://127.0.0.1:8545`, import Anvil key #0 (see `.env.example` / Foundry docs).

### Bot watch address

After `deploy:mocks`, `watchTarget` in the JSON is used until you set a real **LiquiChain** protocol operator address. Optional override: `BOT_WATCH_ADDRESS` in `.env`.

### Protocol core + operator

1. Add git submodules (or `forge install`) under `packages/contracts/lib/` as described in `BLUEPRINT.md`.
2. Add forge deploy scripts and extend `deployments/*.json` with `core` and `operator`.
3. Regenerate operator ABI into `packages/shared/src/abis/` and wire `apps/web` + `apps/bot` decoders.

## Render (hosted demo)

See `BLUEPRINT.md` and `apps/render-bundle/render.yaml`. The included Docker image runs **Anvil + a small HTTP gateway** (`/health`, JSON-RPC `POST /`). Extend with bot + R2 as needed.

## Packages

| Path | Role |
|------|------|
| `packages/contracts` | Foundry: `MockERC20`, `WatchTarget`, `DeployMocks.s.sol` |
| `packages/shared` | Addresses loader, ERC‑20 ABI, operator stub ABI |
| `apps/web` | Next.js (static export), wagmi, pages: `/`, `/swap`, `/pool/new`, `/pool/[id]` |
| `apps/bot` | Mempool polling watcher, decoder scaffold, sandwich **simulation** log |
| `apps/render-bundle` | Dockerfile + supervisord + gateway for Render |

## Scripts (root)

| Command | Description |
|---------|-------------|
| `pnpm chain` | Anvil on `:8545` chain 31337 |
| `pnpm deploy:mocks` | Broadcast `DeployMocks` and write `deployments/<chainId>.json` |
| `pnpm --filter @nfs/shared build` | Build shared TS |
| `pnpm --filter @nfs/web build` | Static export → `apps/web/out` |
| `pnpm --filter @nfs/bot build` | Compile bot |
| `pnpm --filter @nfs/web test:e2e` | Playwright smoke (navigation only; no chain) |
| `pnpm --filter @nfs/web test:e2e:integration` | Playwright + **Anvil** + deploy mocks + **injected wallet** + read TKA balance. Requires `forge` / `anvil` on `PATH` ([Foundry](https://getfoundry.sh)). On Windows, use a shell where `forge --version` works (restart the terminal after install). If tests show **skipped**, Foundry was not detected. |

## Transparency

- **Protocol contracts** are **not** fully vendored in this repo yet; deploy mocks only until you add `lib/core` and `lib/operator`.
- **Sandwich execution** is a **stub** (`simulateSandwich` logs + optional `anvil_mine`); wire `eth_sendRawTransaction` when operator ABI + pool math exist.
- **Kernel UI / full swap** are placeholders until operator integration.

## License

MIT (project scaffold). Third-party protocol licenses apply to their upstream repos.
