import type { Course } from "@/lib/skill-engine/types";
import type { RunningStyle } from "@/lib/deck/types";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import type { SlotRecommendationOptions } from "@/lib/parenting/compatibility";
import type { getSlotRecommendations } from "@/lib/parenting";

export interface SlotRecommendationsParams {
  targetCharaId: number;
  minmax?: SlotRecommendationOptions["minmax"];
  branchParent: KyumaruVeteranItem | null;
  excludedCharIds: number[];
  course: Course | null;
  runningStyle: RunningStyle | number | null;
  veterans: KyumaruVeteranItem[];
  supportCardIds: (number | null)[];
}

export type SlotRecommendationsResult = ReturnType<typeof getSlotRecommendations>;

export interface SlotRecommendationsQueryOptions {
  onResult: (res: SlotRecommendationsResult) => void;
  onError: (error: string) => void;
}

let workerInstance: Worker | null = null;
let currentRequestId = 0;
let pendingCallback: {
  requestId: number;
  onResult: (res: SlotRecommendationsResult) => void;
  onError: (error: string) => void;
} | null = null;

function getOrCreateWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL("./slot-recommendations.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerInstance.onmessage = (event: MessageEvent<{
      requestId?: number;
      recommendations: SlotRecommendationsResult;
      error?: string;
    }>) => {
      const { requestId, recommendations, error } = event.data;
      if (pendingCallback && (requestId === undefined || requestId === pendingCallback.requestId)) {
        const cb = pendingCallback;
        pendingCallback = null;
        if (error) {
          cb.onError(error);
        } else {
          cb.onResult(recommendations);
        }
      }
    };
    workerInstance.onerror = (event) => {
      if (pendingCallback) {
        pendingCallback.onError(event.message || "Worker error occurred");
        pendingCallback = null;
      }
      workerInstance?.terminate();
      workerInstance = null;
    };
  }
  return workerInstance;
}

export function querySlotRecommendations(
  params: SlotRecommendationsParams,
  options: SlotRecommendationsQueryOptions,
): () => void {
  const worker = getOrCreateWorker();
  if (!worker) {
    options.onError("Web Workers are not supported in this environment");
    return () => {};
  }
  const requestId = ++currentRequestId;
  pendingCallback = {
    requestId,
    onResult: options.onResult,
    onError: options.onError,
  };
  worker.postMessage({ requestId, ...params });
  return () => {
    if (pendingCallback?.requestId === requestId) {
      pendingCallback = null;
    }
  };
}
