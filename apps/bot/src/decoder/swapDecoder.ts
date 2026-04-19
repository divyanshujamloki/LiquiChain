import { decodeFunctionData, zeroAddress } from "viem";
import type { Hex } from "viem";
import { operatorStubAbi } from "@nfs/shared";
import type { VictimIntent } from "@nfs/shared";
import type { Transaction } from "viem";

export function decodeVictimSwap(
  tx: Transaction,
  operator: `0x${string}`,
): VictimIntent | null {
  if (!tx.input || tx.input === "0x") return null;
  if (!tx.to || tx.to.toLowerCase() !== operator.toLowerCase()) return null;

  try {
    const decoded = decodeFunctionData({
      abi: operatorStubAbi,
      data: tx.input,
    });
    if (decoded.functionName !== "swap") return null;
  } catch {
    return null;
  }

  return {
    hash: tx.hash,
    from: tx.from ?? zeroAddress,
    to: tx.to,
    input: tx.input,
    gasPrice: tx.gasPrice ?? 0n,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? undefined,
    maxFeePerGas: tx.maxFeePerGas ?? undefined,
  };
}

/** Any pending tx to the operator (for logging / heuristics when ABI differs). */
export function decodeVictimGeneric(tx: Transaction, operator: `0x${string}`): VictimIntent | null {
  if (!tx.to || tx.to.toLowerCase() !== operator.toLowerCase()) return null;
  if (!tx.input || tx.input === "0x") return null;
  const stub = decodeVictimSwap(tx, operator);
  if (stub) return stub;
  return {
    hash: tx.hash,
    from: tx.from ?? zeroAddress,
    to: tx.to,
    input: tx.input,
    gasPrice: tx.gasPrice ?? 0n,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? undefined,
    maxFeePerGas: tx.maxFeePerGas ?? undefined,
  };
}
