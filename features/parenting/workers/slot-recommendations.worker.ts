import type { Course } from "@/lib/skill-engine/types";
import type { RunningStyle } from "@/lib/deck/types";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import type { SlotRecommendationOptions } from "@/lib/parenting/compatibility";
import { getSlotRecommendations } from "@/lib/parenting";

interface SlotRecommendationsRequest {
  requestId?: number;
  targetCharaId: number;
  minmax?: SlotRecommendationOptions["minmax"];
  branchParent: KyumaruVeteranItem | null;
  excludedCharIds: number[];
  course: Course | null;
  runningStyle: RunningStyle | number | null;
  veterans: KyumaruVeteranItem[];
  supportCardIds: (number | null)[];
}

interface SlotRecommendationsResponse {
  requestId?: number;
  recommendations: ReturnType<typeof getSlotRecommendations>;
  error?: string;
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<SlotRecommendationsRequest>) => void) | null;
  postMessage: (value: SlotRecommendationsResponse) => void;
};

workerScope.onmessage = (event) => {
  const { requestId, ...payload } = event.data;
  try {
    workerScope.postMessage({ requestId, recommendations: getSlotRecommendations(payload) });
  } catch (error) {
    workerScope.postMessage({
      requestId,
      recommendations: { owned: [], borrow: [] },
      error: error instanceof Error ? error.message : "Recommendation calculation failed",
    });
  }
};
