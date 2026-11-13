import { scoreSkillValues, type RawSkillValue, type ScoreRequest } from "@/lib/parent-autopick";

export type AutoPickWorkerMessage =
  | { type: "progress"; key: string; done: number; total: number }
  | { type: "result"; key: string; values: Record<number, RawSkillValue> }
  | { type: "error"; key: string; message: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ScoreRequest>) => void) | null;
  postMessage: (message: AutoPickWorkerMessage) => void;
};

scope.onmessage = (event) => {
  const req = event.data;
  try {
    const values = scoreSkillValues(req, (done, total) => scope.postMessage({ type: "progress", key: req.key, done, total }));
    scope.postMessage({ type: "result", key: req.key, values });
  } catch (e) {
    scope.postMessage({ type: "error", key: req.key, message: e instanceof Error ? e.message : String(e) });
  }
};
