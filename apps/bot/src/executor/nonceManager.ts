import type { PublicClient } from "viem";
import type { Address } from "viem";

export class NonceManager {
  private next: Promise<number>;

  constructor(
    private readonly client: PublicClient,
    private readonly address: Address,
  ) {
    this.next = client.getTransactionCount({ address, blockTag: "pending" });
  }

  async reserve(count = 1): Promise<number[]> {
    const start = await this.next;
    this.next = Promise.resolve(start + count);
    return Array.from({ length: count }, (_, i) => start + i);
  }

  async reset(): Promise<void> {
    this.next = this.client.getTransactionCount({
      address: this.address,
      blockTag: "pending",
    });
  }
}
