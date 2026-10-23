import type { Course } from "@/lib/skill-engine/types";
import type { LegacyUniqueEval } from "@/lib/parenting/types";

export interface VeteranEvaluationParams {
  cardIds: number[];
  course: Course | null;
  runningStyle: number | string | null;
}

export interface VeteranEvaluationResult {
  eligibleCardIds: number[];
  uniqueEvals: Array<[number, LegacyUniqueEval]>;
}

export interface VeteranEvaluationQueryOptions {
  onResult: (res: VeteranEvaluationResult) => void;
  onError: (error: string) => void;
}

let workerInstance: Worker | null = null;
let currentRequestId = 0;
let pendingCallback: {
  requestId: number;
  onResult: (res: VeteranEvaluationResult) => void;
  onError: (error: string) => void;
} | null = null;

function getOrCreateWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL("../pickers/veteran-picker-evaluation.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerInstance.onmessage = (event: MessageEvent<{
      requestId?: number;
      eligibleCardIds: number[];
      uniqueEvals: Array<[number, LegacyUniqueEval]>;
      error?: string;
    }>) => {
      const { requestId, eligibleCardIds, uniqueEvals, error } = event.data;
      if (pendingCallback && (requestId === undefined || requestId === pendingCallback.requestId)) {
        const cb = pendingCallback;
        pendingCallback = null;
        if (error) {
          cb.onError(error);
        } else {
          cb.onResult({ eligibleCardIds, uniqueEvals });
        }
      }
    };
    workerInstance.onerror = (event) => {
      if (pendingCallback) {
        pendingCallback.onError(event.message || "Could not evaluate picker candidates");
        pendingCallback = null;
      }
      workerInstance?.terminate();
      workerInstance = null;
    };
  }
  return workerInstance;
}

export function queryVeteranEvaluation(
  params: VeteranEvaluationParams,
  options: VeteranEvaluationQueryOptions,
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
