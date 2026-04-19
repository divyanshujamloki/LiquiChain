import type { DeploymentAddresses } from "./types.js";
import { zeroAddress } from "viem";

export function isOperatorConfigured(d: DeploymentAddresses): boolean {
  return d.operator !== zeroAddress;
}
