// Browser-only Japanese OCR via tesseract.js.
//
// The library, its WASM core and the `jpn` model (~2 MB, cached in IndexedDB
// after the first scan) are fetched on demand, so nothing OCR-related ships in
// the main bundle or loads until someone actually scans an image.

import type { Worker } from "tesseract.js";

export interface OcrProgress {
  status: string;
  /** 0..1 within the current status. */
  progress: number;
}

type ProgressListener = (progress: OcrProgress) => void;

let workerPromise: Promise<Worker> | null = null;
let progressListener: ProgressListener | null = null;

function getWorker(): Promise<Worker> {
  workerPromise ??= import("tesseract.js")
    .then(({ createWorker, OEM }) => createWorker("jpn", OEM.LSTM_ONLY, {
      logger: (message) => progressListener?.({ status: message.status, progress: message.progress }),
    }))
    .catch((error: unknown) => {
      workerPromise = null;
      throw error;
    });
  return workerPromise;
}

/** Small screenshots OCR poorly; upscale so glyphs are ~30px+ tall. */
const MIN_OCR_WIDTH = 1600;
const MAX_UPSCALE = 3;

async function prepareImage(image: Blob): Promise<HTMLCanvasElement | Blob> {
  if (typeof createImageBitmap !== "function") return image;
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(MAX_UPSCALE, Math.max(1, MIN_OCR_WIDTH / bitmap.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return image;
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export async function recognizeJapaneseText(image: Blob, onProgress?: ProgressListener): Promise<string> {
  progressListener = onProgress ?? null;
  try {
    const [worker, input] = await Promise.all([getWorker(), prepareImage(image)]);
    const { data } = await worker.recognize(input);
    return data.text;
  } finally {
    progressListener = null;
  }
}
