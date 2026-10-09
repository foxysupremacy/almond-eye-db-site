export const TIER_POLICY_VERSION = 'conditional-tier-v1';
export function tierForScore(score: number): {tier:'S'|'A'|'B'|'C'|'D'|'F';stars:1|2|3|4|5} {
  if(score>=120)return {tier:'S',stars:5};
  if(score>=90)return {tier:'A',stars:4};
  if(score>=65)return {tier:'B',stars:3};
  if(score>=40)return {tier:'C',stars:2};
  if(score>=20)return {tier:'D',stars:1};
  return {tier:'F',stars:1};
}
/** Exact Shapley values by effect family. The caller caches each coalition. */
export function shapley(families: readonly string[], value: (mask: number)=>number): number[] {
  const n=families.length;
  if(!n)return [];
  const factorial=(k:number)=>{let v=1;for(let i=2;i<=k;i++)v*=i;return v;};
  const out=Array<number>(n).fill(0);
  for(let mask=0;mask<(1<<n);mask++){
    const count=mask.toString(2).replace(/0/g,'').length;
    for(let i=0;i<n;i++)if(!(mask&(1<<i)))out[i]+=factorial(count)*factorial(n-count-1)/factorial(n)*(value(mask|(1<<i))-value(mask));
  }
  return out;
}
