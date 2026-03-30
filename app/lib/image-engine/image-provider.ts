import {
  generateImageWithGemini,
  resolveSupportedGeminiImageModel,
} from "@/app/lib/geminiImage";
import type {
  ImageEngineProvider,
  ImageGenerationResult,
  PanelImageRequest,
  PortraitImageRequest,
} from "./types";

export type GeminiImageEngineConfig = {
  apiKey: string;
  /** Resolved model id (e.g. from ListModels / env). */
  model: string;
};

function toResult(r: {
  imageBytes: string;
  mimeType: string;
}): ImageGenerationResult {
  return {
    mimeType: r.mimeType,
    imageBytes: r.imageBytes,
    dataUrl: `data:${r.mimeType};base64,${r.imageBytes}`,
  };
}

/**
 * Gemini `generateImages` implementation of the image engine provider.
 * Same path used today for portraits and panel art.
 */
export function createGeminiImageEngineProvider(
  config: GeminiImageEngineConfig,
): ImageEngineProvider {
  const { apiKey, model } = config;

  return {
    async generatePortrait(request: PortraitImageRequest): Promise<ImageGenerationResult> {
      const r = await generateImageWithGemini({
        apiKey,
        model,
        prompt: request.prompt,
      });
      return toResult(r);
    },

    async generatePanelImage(request: PanelImageRequest): Promise<ImageGenerationResult> {
      const r = await generateImageWithGemini({
        apiKey,
        model,
        prompt: request.prompt,
      });
      return toResult(r);
    },
  };
}

/**
 * Resolves a supported image model for this API key, then returns a Gemini-backed provider.
 */
export async function createGeminiImageEngineProviderFromEnv(
  apiKey: string,
  preferredModel?: string,
): Promise<ImageEngineProvider | null> {
  const envModel =
    preferredModel ?? process.env.GEMINI_IMAGE_MODEL?.trim() ?? undefined;
  const resolved = await resolveSupportedGeminiImageModel(apiKey, envModel);
  if (!resolved) return null;
  return createGeminiImageEngineProvider({ apiKey, model: resolved });
}
