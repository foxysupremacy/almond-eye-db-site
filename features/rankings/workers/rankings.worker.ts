import { rankCharacters } from "@/lib/rankings/rank";
import type { RankingRequest, RankingsWorkerMessage } from "@/lib/rankings/types";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RankingRequest>) => void) | null;
  postMessage: (message: RankingsWorkerMessage) => void;
};

scope.onmessage = (event) => {
  const req = event.data;
  try {
    const result = rankCharacters(req, (done, total) => scope.postMessage({ type: "progress", key: req.key, done, total }));
    scope.postMessage({ type: "result", result });
  } catch (e) {
    scope.postMessage({ type: "error", key: req.key, message: e instanceof Error ? e.message : String(e) });
  }
};
