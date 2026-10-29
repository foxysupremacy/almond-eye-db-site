import { runStaminaSim } from "@/lib/stamina-sim/simulate";
import type { StaminaInput, StaminaResult } from "@/lib/stamina-sim/types";
import type { Course } from "@/lib/skill-engine/types";

export interface StaminaWorkerRequest { id: number; input: StaminaInput; course: Course }
export type StaminaWorkerResponse = { id: number; result: StaminaResult } | { id: number; error: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<StaminaWorkerRequest>) => void) | null;
  postMessage: (message: StaminaWorkerResponse) => void;
};

scope.onmessage = (event) => {
  const { id, input, course } = event.data;
  try {
    scope.postMessage({ id, result: runStaminaSim(input, course) });
  } catch (e) {
    scope.postMessage({ id, error: e instanceof Error ? e.message : String(e) });
  }
};
