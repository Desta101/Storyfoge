type ListModelsResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
  error?: { message?: string };
};

type GenerateImagesResponse = {
  generatedImages?: Array<{
    image?: {
      imageBytes?: string;
      mimeType?: string;
    };
  }>;
  error?: { message?: string };
};

export type GeminiImageRequestError = {
  status: number;
  endpoint: string;
  model: string;
  responseBody: string;
  message: string;
};

const LIST_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const IMAGE_METHOD = "generateImages";
const FALLBACK_IMAGE_MODELS = [
  "imagen-3.0-generate-002",
  "imagen-4.0-generate-preview-06-06",
  "gemini-2.0-flash-preview-image-generation",
] as const;

let modelCache:
  | { expiresAt: number; models: string[] }
  | null = null;

function normalizeModelName(name: string) {
  return name.startsWith("models/") ? name.slice("models/".length) : name;
}

function pickModel(candidates: string[], preferred?: string) {
  if (preferred && candidates.includes(preferred)) return preferred;
  for (const m of FALLBACK_IMAGE_MODELS) {
    if (candidates.includes(m)) return m;
  }
  return candidates[0] ?? null;
}

export async function resolveSupportedGeminiImageModel(
  apiKey: string,
  preferredModel?: string,
): Promise<string | null> {
  const now = Date.now();
  if (modelCache && modelCache.expiresAt > now) {
    return pickModel(modelCache.models, preferredModel);
  }

  const res = await fetch(`${LIST_MODELS_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const text = await res.text();
  let json: ListModelsResponse | null = null;
  try {
    json = JSON.parse(text) as ListModelsResponse;
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new Error(
      json?.error?.message || `ListModels failed with status ${res.status}`,
    );
  }

  const models =
    (json?.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes(IMAGE_METHOD))
      .map((m) => (m.name ? normalizeModelName(m.name) : ""))
      .filter(Boolean) ?? [];

  modelCache = { expiresAt: now + MODEL_CACHE_TTL_MS, models };
  return pickModel(models, preferredModel);
}

export async function generateImageWithGemini(args: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<{
  imageBytes: string;
  mimeType: string;
  model: string;
  endpoint: string;
}> {
  const model = normalizeModelName(args.model);
  const endpoint = `${LIST_MODELS_URL}/${encodeURIComponent(model)}:generateImages`;
  const resp = await fetch(`${endpoint}?key=${encodeURIComponent(args.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: { text: args.prompt },
      config: {
        numberOfImages: 1,
        outputMimeType: "image/png",
      },
    }),
  });

  const bodyText = await resp.text();
  let json: GenerateImagesResponse | null = null;
  try {
    json = JSON.parse(bodyText) as GenerateImagesResponse;
  } catch {
    json = null;
  }

  if (!resp.ok) {
    const err: GeminiImageRequestError = {
      status: resp.status,
      endpoint,
      model,
      responseBody: bodyText,
      message: json?.error?.message || `Gemini image HTTP ${resp.status}`,
    };
    throw err;
  }

  const imageBytes = json?.generatedImages?.[0]?.image?.imageBytes;
  const mimeType = json?.generatedImages?.[0]?.image?.mimeType || "image/png";
  if (!imageBytes) {
    throw {
      status: resp.status,
      endpoint,
      model,
      responseBody: bodyText,
      message: "Missing generatedImages[0].image.imageBytes",
    } satisfies GeminiImageRequestError;
  }

  return { imageBytes, mimeType, model, endpoint };
}
