import { PoolDetailClient } from "./PoolDetailClient";
import { STATIC_POOL_IDS } from "@/lib/static-pool-ids";

export function generateStaticParams() {
  return STATIC_POOL_IDS.map((id) => ({ id }));
}

export const dynamicParams = false;

export default async function PoolLiquidityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PoolDetailClient id={id} />;
}
