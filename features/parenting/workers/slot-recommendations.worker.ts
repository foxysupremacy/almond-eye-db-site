import type { Course } from "@/lib/skill-engine/types";
import type { RunningStyle } from "@/lib/deck/types";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import type { SlotRecommendationOptions } from "@/lib/parenting/compatibility";
import { getSlotRecommendations } from "@/lib/parenting";

interface SlotRecommendationsRequest {
  targetCharaId: number;
  minmax?: SlotRecommendationOptions["minmax"];
  branchParent: KyumaruVeteranItem | null;
  excludedCharIds: number[];
  course: Course | null;
  runningStyle: RunningStyle | number | null;
  raceParams?: SlotRecommendationOptions["raceParams"];
  raceImpactProfile?: SlotRecommendationOptions["raceImpactProfile"];
  veterans: KyumaruVeteranItem[];
  supportCardIds: (number | null)[];
}

interface SlotRecommendationsResponse {
  recommendations: ReturnType<typeof getSlotRecommendations>;
  error?: string;
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<SlotRecommendationsRequest>) => void) | null;
  postMessage: (value: SlotRecommendationsResponse) => void;
};

workerScope.onmessage = (event) => {
  try {
    workerScope.postMessage({ recommendations: getSlotRecommendations(event.data) });
  } catch (error) {
    workerScope.postMessage({
      recommendations: { owned: [], borrow: [] },
      error: error instanceof Error ? error.message : "Recommendation calculation failed",
    });
  }
};
