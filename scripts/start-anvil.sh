#!/usr/bin/env bash
set -euo pipefail
exec anvil \
  --host 127.0.0.1 \
  --port 8545 \
  --chain-id 31337 \
  --no-mining \
  --block-time 12 \
  --order fees \
  --accounts 10 \
  --balance 10000
