import {
  buildComicPanelImagePrompt,
  createGeminiImageEngineProvider,
} from "./image-engine";
import {
  comicPanelPlaceholderUrl,
  type ComicPanelDraft,
  type StoryDraft,
} from "./storyDraft";
import {
  resolveSupportedGeminiImageModel,
  type GeminiImageRequestError,
} from "./geminiImage";

export { buildComicPanelImagePrompt } from "./image-engine";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Image generation timed out after ${ms}ms`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

const RATE_LIMIT_RETRY_DELAYS_MS = [1200, 2400] as const;
const DEFAULT_GEMINI_IMAGE_MODEL = "imagen-3.0-generate-002";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRateLimitError(err: unknown) {
  if (err && typeof err === "object") {
    const maybeStatus = (err as { status?: unknown }).status;
    if (maybeStatus === 429) return true;
    const maybeCode = (err as { statusCode?: unknown }).statusCode;
    if (maybeCode === 429) return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  const low = message.toLowerCase();
  return (
    low.includes("rate limit") ||
    low.includes("resource exhausted") ||
    message.includes("429")
  );
}

async function withRateLimitRetry<T>(
  run: () => Promise<T>,
  requestId: string,
  panelIndex: number,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await run();
    } catch (err) {
      if (!isRateLimitError(err) || attempt >= RATE_LIMIT_RETRY_DELAYS_MS.length) {
        throw err;
      }
      const delay = RATE_LIMIT_RETRY_DELAYS_MS[attempt];
      attempt += 1;
      console.warn(
        `[generate-comic-panels:${requestId}] panel ${panelIndex} rate limited, retrying in ${delay}ms (attempt ${attempt}/${RATE_LIMIT_RETRY_DELAYS_MS.length})`,
      );
      await sleep(delay);
    }
  }
}

type ImageGenOptions = {
  requestId: string;
  apiKey: string;
  /** Per-panel timeout (ms). */
  panelTimeoutMs?: number;
  model?: string;
};

/**
 * Generates one image URL per panel via Gemini image generation. Falls back to deterministic
 * placeholder URLs for any panel that fails.
 */
export async function generateComicPanelImagesWithGemini(
  draft: StoryDraft,
  panels: ComicPanelDraft[],
  opts: ImageGenOptions,
): Promise<ComicPanelDraft[]> {
  const {
    requestId,
    apiKey,
    panelTimeoutMs = 90_000,
    model = process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL,
  } = opts;
  const resolvedModel = await resolveSupportedGeminiImageModel(apiKey, model);
  if (!resolvedModel) {
    console.warn(
      `[generate-comic-panels:${requestId}] panel image fallback reason: no_supported_image_model (preferred=${model})`,
    );
  }

  const provider =
    resolvedModel != null
      ? createGeminiImageEngineProvider({ apiKey, model: resolvedModel })
      : null;

  const results: ComicPanelDraft[] = [];
  for (let index = 0; index < panels.length; index += 1) {
    const panel = panels[index]!;
    const prompt = buildComicPanelImagePrompt(draft, panel, index);
    try {
      if (!provider) throw new Error("No supported Gemini image model");
      console.info(
        `[generate-comic-panels:${requestId}] panel ${index} image request started (model=${resolvedModel}, endpoint=/v1beta/models/${encodeURIComponent(resolvedModel!)}:generateImages)`,
      );
      const out = await withRateLimitRetry(
        () =>
          withTimeout(
            provider.generatePanelImage({ prompt, panelIndex: index }),
            panelTimeoutMs,
          ),
        requestId,
        index,
      );
      const data = out.imageBytes;
      const mimeType = out.mimeType || "image/png";
      if (!data || !mimeType) {
        console.error(
          `[generate-comic-panels:${requestId}] panel ${index} image response missing image bytes`,
        );
        results.push({
          ...panel,
          imageUrl: comicPanelPlaceholderUrl(index),
        });
        continue;
      }
      const imageUrl = `data:${mimeType};base64,${data}`;
      console.info(
        `[generate-comic-panels:${requestId}] panel ${index} image request success (bytes=${data.length})`,
      );
      results.push({ ...panel, imageUrl });
    } catch (e) {
      if (typeof e === "object" && e !== null && "status" in e && "endpoint" in e) {
        const err = e as GeminiImageRequestError;
        console.error(
          `[generate-comic-panels:${requestId}] panel ${index} image request failed status=${err.status} model=${err.model} endpoint=${err.endpoint} responseBody=${err.responseBody || "<empty>"}`,
        );
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(
          `[generate-comic-panels:${requestId}] panel ${index} image failed: ${msg}`,
        );
      }
      results.push({
        ...panel,
        imageUrl: comicPanelPlaceholderUrl(index),
      });
    }
    if (index < panels.length - 1) {
      await sleep(250);
    }
  }

  return results;
}
