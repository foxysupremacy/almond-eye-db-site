/**
 * Parse required ranks from a raw condition string.
 */
export function parseRankRequirements(
  conditionStr: string,
  racerCount: number
): { minRank: number; maxRank: number; hasOrderCondition: boolean } {
  let minRank = 1;
  let maxRank = racerCount;
  let hasOrderCondition = false;

  // order == X
  const eqM = /order==(\d+)/.exec(conditionStr);
  if (eqM) {
    const r = parseInt(eqM[1], 10);
    minRank = r;
    maxRank = r;
    hasOrderCondition = true;
  }

  // order <= X
  const lteM = /order<=(\d+)/.exec(conditionStr);
  if (lteM) {
    maxRank = Math.min(maxRank, parseInt(lteM[1], 10));
    hasOrderCondition = true;
  }

  // order >= X
  const gteM = /order>=(\d+)/.exec(conditionStr);
  if (gteM) {
    minRank = Math.max(minRank, parseInt(gteM[1], 10));
    hasOrderCondition = true;
  }

  // order_rate <= X (e.g. order_rate<=50)
  const rateLteM = /order_rate<=(\d+)/.exec(conditionStr);
  if (rateLteM) {
    const pct = parseInt(rateLteM[1], 10);
    maxRank = Math.min(maxRank, Math.max(1, Math.round((pct / 100) * racerCount)));
    hasOrderCondition = true;
  }

  // order_rate >= X (e.g. order_rate>=50)
  const rateGteM = /order_rate>=(\d+)/.exec(conditionStr);
  if (rateGteM) {
    const pct = parseInt(rateGteM[1], 10);
    minRank = Math.max(minRank, Math.min(racerCount, Math.ceil((pct / 100) * racerCount)));
    hasOrderCondition = true;
  }

  return { minRank, maxRank, hasOrderCondition };
}
