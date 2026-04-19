import type { Address, Hex } from "viem";

export type DeploymentAddresses = {
  chainId: number;
  deployer: Address;
  mockTokenA: Address;
  mockTokenB: Address;
  core: Address;
  operator: Address;
  /** Mempool filter until LiquiChain operator is deployed */
  watchTarget: Address;
};

export type VictimIntent = {
  hash: Hex;
  from: Address;
  to: Address;
  /** Raw calldata (for logging / future ABI decode) */
  input: Hex;
  gasPrice: bigint;
  maxPriorityFeePerGas: bigint | undefined;
  maxFeePerGas: bigint | undefined;
};
