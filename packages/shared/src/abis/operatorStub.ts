/**
 * Placeholder ABI until LiquiChain operator ABI is copied from `forge inspect`.
 * Decoder returns structured fields when calldata matches a known swap entrypoint.
 */
export const operatorStubAbi = [
  {
    type: "function",
    name: "swap",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "poolId",
        type: "bytes32",
      },
      {
        name: "tokenIn",
        type: "address",
      },
      {
        name: "amountIn",
        type: "uint256",
      },
      {
        name: "limitSqrtPrice",
        type: "uint160",
      },
      {
        name: "deadline",
        type: "uint256",
      },
    ],
    outputs: [],
  },
] as const;
