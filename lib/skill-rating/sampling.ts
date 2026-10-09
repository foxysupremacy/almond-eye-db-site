import type { TriggerPath } from './types';
export interface MeterSample { meter: number; weight: number }
const span = (r:{start:number;end:number}) => Math.max(0,r.end-r.start-10);
const xorshift = (seed:number) => { let x=seed|0; return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}; };
function gammaCdf(x:number,k:number,rate:number):number {
  const z=rate*Math.max(0,x); let term=1,sum=1;
  for(let i=1;i<k;i++){term*=z/i;sum+=term;}
  return 1-Math.exp(-z)*sum;
}
function gammaQuantile(q:number,k:number,rate:number):number {
  let lo=0,hi=(k+12)/rate;
  for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(gammaCdf(mid,k,rate)<q)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
function pickPoint(regions:RegionShape, random:()=>number):number {
  const eligible=regions.filter(r=>span(r)>0);
  if(!eligible.length)return regions[0]?.start??0;
  const selected=eligible[Math.min(eligible.length-1,Math.floor(random()*eligible.length))];
  return selected.start+random()*span(selected);
}
type RegionShape=Array<{start:number;end:number}>;
/** Fixed weighted quadrature of each reference sampling policy. Uniform random
 * weights by physical eligible length; straight-random chooses a region equally;
 * all-corner places up to four independent corner rolls and fires the first;
 * Erlang policy uses quantiles of the source family's conditional distribution. */
export function samplePath(path:TriggerPath,samples=12):MeterSample[] {
  const regions=path.regions.filter(r=>r.end>r.start).sort((a,b)=>a.start-b.start);
  if(!regions.length)return [];
  if(path.sampling==='immediate')return [{meter:regions[0].start,weight:1}];
  if(path.sampling==='all-corner'){
    return Array.from({length:samples},(_,i)=>{
      const random=xorshift(0x6d2b79f5+i*0x9e3779b9), corners=regions.filter(r=>span(r)>0), chosen:number[]=[];
      while(corners.length&&chosen.length<4){const index=Math.floor(random()*corners.length);chosen.push(pickPoint([corners[index]],random));corners.splice(index,1);}
      return {meter:chosen.length?Math.min(...chosen):regions[0].start,weight:1/samples};
    });
  }
  if(path.sampling==='straight'){
    return Array.from({length:samples},(_,i)=>{const random=xorshift(0x1f123bb5+i*0x9e3779b9);return {meter:pickPoint(regions,random),weight:1/samples};});
  }
  if(path.sampling==='distribution'){
    const shape=Math.max(1,path.distribution?.shape??1),rate=Math.max(.001,path.distribution?.rate??1);
    const random=xorshift(0x243f6a88),values=Array.from({length:samples},()=>gammaQuantile(Math.max(1e-8,random()),shape,rate));
    const min=Math.min(...values),range=Math.max(1e-9,Math.max(...values)-min);
    const total=regions.reduce((sum,r)=>sum+Math.max(0,r.end-r.start),0);
    return values.map(value=>{
      let remaining=total*(value-min)/range,meter=regions.at(-1)!.end;
      for(const region of regions){const width=Math.max(0,region.end-region.start);if(remaining<width){meter=region.start+Math.min(remaining,span(region));break;}remaining-=width;}
      return {meter,weight:1/samples};
    });
  }
  // Conditions marked random can trigger once anywhere in the union of all
  // eligible intervals. Stratified positions preserve their lengths exactly.
  const total=regions.reduce((sum,r)=>sum+Math.max(0,r.end-r.start),0);
  return Array.from({length:samples},(_,i)=>{
    let remaining=total*(i+.5)/samples,meter=regions.at(-1)!.end;
    for(const region of regions){const width=Math.max(0,region.end-region.start);if(remaining<width){meter=region.start+Math.min(remaining,span(region));break;}remaining-=width;}
    return {meter,weight:1/samples};
  });
}
