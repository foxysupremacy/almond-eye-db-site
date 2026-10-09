import { expect, test } from 'bun:test';
import { loadRacetracks } from '../data/registry';
import { flattenCourse } from '../api/course-format';
import { defaultRaceImpactProfile } from '../race-impact/profile';
import { getSlotRecommendations } from '../parenting/compatibility';
import { RATING_MODEL_VERSION, RECOVERY_POLICY_VERSION } from './types';

test('real recommendation worker preserves serialized context and canonical ratings',async()=>{
  const course=flattenCourse((await loadRacetracks()).find(t=>t.id===10008)!.courses.find(c=>c.id===10810)!);
  const request={targetCharaId:1024,branchParent:null,excludedCharIds:[],course,runningStyle:3,raceParams:{groundCondition:1,numUmas:9},raceImpactProfile:defaultRaceImpactProfile(),veterans:[],supportCardIds:[]};
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
    const ratings=[...response.recommendations.owned,...response.recommendations.borrow].flatMap(candidate=>candidate.uniqueEval?.canonicalRating?[candidate.uniqueEval.canonicalRating]:[]);
    expect(ratings.length).toBeGreaterThan(0);
    for(const rating of ratings){expect(rating.modelVersion).toBe(RATING_MODEL_VERSION);expect(rating.policyVersion).toBe(RECOVERY_POLICY_VERSION);}
  } finally {worker.terminate();}
});
