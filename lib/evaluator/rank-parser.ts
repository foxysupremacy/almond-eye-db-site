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

  // order == X (all matches — OR conditions like "order==1@order==3" widen the window to the union)
  const eqMatches = [...conditionStr.matchAll(/order==(\d+)/g)].map((m) => parseInt(m[1], 10));
  if (eqMatches.length > 0) {
    minRank = Math.max(minRank, Math.min(...eqMatches));
    maxRank = Math.min(maxRank, Math.max(...eqMatches));
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

  // order_rate_inXX — "within the top XX%" (e.g. order_rate_in20 == order_rate<=20)
  const rateInM = /order_rate_in(\d+)/.exec(conditionStr);
  if (rateInM) {
    const pct = parseInt(rateInM[1], 10);
    maxRank = Math.min(maxRank, Math.max(1, Math.round((pct / 100) * racerCount)));
    hasOrderCondition = true;
  }

  // order_rate_outXX — "outside the top XX%" (e.g. order_rate_out40 == order_rate>=40)
  const rateOutM = /order_rate_out(\d+)/.exec(conditionStr);
  if (rateOutM) {
    const pct = parseInt(rateOutM[1], 10);
    minRank = Math.max(minRank, Math.min(racerCount, Math.ceil((pct / 100) * racerCount)));
    hasOrderCondition = true;
  }

  return { minRank, maxRank, hasOrderCondition };
}
