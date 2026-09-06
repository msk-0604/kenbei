/** Deterministic finance. Never call an LLM from here. */

export function calcGrossProfit(revenue: number, totalCost: number): number {
  return revenue - totalCost;
}

export function calcGrossProfitRate(
  revenue: number,
  totalCost: number,
): number | null {
  if (revenue === 0) {
    return null;
  }
  return (revenue - totalCost) / revenue;
}

export function calcTotalCost(parts: {
  material: number;
  subcontract: number;
  labor: number;
  other: number;
}): number {
  return parts.material + parts.subcontract + parts.labor + parts.other;
}

export function laborVarianceRatio(actual: number, planned: number): number | null {
  if (planned === 0) {
    return actual === 0 ? 0 : null;
  }
  return (actual - planned) / planned;
}
