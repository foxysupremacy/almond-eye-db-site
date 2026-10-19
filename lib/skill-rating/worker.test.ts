import { expect, test } from 'bun:test';
import { loadRacetracks } from '../data/registry';
import { flattenCourse } from '../api/course-format';
import { getSlotRecommendations } from '../parenting/compatibility';

test('real recommendation worker preserves serialized context and feature evaluations',async()=>{
  const course=flattenCourse((await loadRacetracks()).find(t=>t.id===10008)!.courses.find(c=>c.id===10810)!);
  const request={targetCharaId:1024,branchParent:null,excludedCharIds:[],course,runningStyle:3,veterans:[],supportCardIds:[]};
  const expected=getSlotRecommendations(request);
  const worker=new Worker(new URL('../../features/parenting/workers/slot-recommendations.worker.ts',import.meta.url).href);
  try {
    const response=await new Promise<{recommendations:typeof expected;error?:string}>((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Worker response timed out')),15000);
      worker.onmessage=event=>{clearTimeout(timeout);resolve(event.data);};
      worker.onerror=event=>{clearTimeout(timeout);reject(new Error(event.message));};
      worker.postMessage(structuredClone(request));
    });
    expect(response.error).toBeUndefined();
    expect(response.recommendations).toEqual(expected);
    const ratings=[...response.recommendations.owned,...response.recommendations.borrow].flatMap(candidate=>candidate.uniqueEval?[candidate.uniqueEval]:[]);
    expect(ratings.length).toBeGreaterThan(0);
    for(const rating of ratings){expect(["S+", "S", "A", "B", "C", "D", "F"]).toContain(rating.tier);if(rating.score !== undefined) expect(Number.isFinite(rating.score)).toBe(true);}
  } finally {worker.terminate();}
});
