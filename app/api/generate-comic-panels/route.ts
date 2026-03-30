import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { analyzeGeminiFailure } from "@/app/lib/geminiQuota";
import { generateComicPanelImagesWithGemini } from "@/app/lib/comicPanelImages";
import {
  comicPanelPlaceholderUrl,
  ensureDraftIntegrity,
  extractAssistantJsonText,
  isComicPanelPlaceholderImageUrl,
  regenerateMockComicPanels,
  safeParseComicPanelsPayload,
  safeParseStoryDraft,
  type ComicPanelDraft,
} from "@/app/lib/storyDraft";

const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
/** Panel beat + image generation can exceed default serverless limits. */
export const maxDuration = 300;

function resolveGeminiModel(): string {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  return fromEnv || DEFAULT_GEMINI_MODEL;
}

type GenerateComicPanelsRequest = {
  draft?: unknown;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Generation timed out after ${ms}ms`));
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

const RATE_LIMIT_RETRY_DELAYS_MS = [900, 1800] as const;

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
        `[generate-comic-panels:${requestId}] rate limited, retrying in ${delay}ms (attempt ${attempt}/${RATE_LIMIT_RETRY_DELAYS_MS.length})`,
      );
      await sleep(delay);
    }
  }
}

function sortPanelsByTone(panels: ComicPanelDraft[]) {
  const order = { hero: 0, scene: 1, villain: 2, mentor: 3 } as const;
  return [...panels].sort((a, b) => order[a.tone] - order[b.tone]);
}

function withPlaceholderImageUrls(panels: ComicPanelDraft[]) {
  return panels.map((panel, index) => ({
    ...panel,
    imageUrl: panel.imageUrl?.trim() || comicPanelPlaceholderUrl(index),
  }));
}

export async function POST(req: Request) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`;
  console.info(`[generate-comic-panels:${requestId}] request received`);

  let body: GenerateComicPanelsRequest;
  try {
    body = (await req.json()) as GenerateComicPanelsRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const draftRaw =
    body.draft !== undefined && body.draft !== null ? JSON.stringify(body.draft) : null;
  const draft = safeParseStoryDraft(draftRaw);
  if (!draft) {
    return NextResponse.json({ error: "Invalid or incomplete StoryDraft" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiModel = resolveGeminiModel();
  console.info(
    `[generate-comic-panels:${requestId}] config: geminiKeyPresent=${Boolean(apiKey)} GEMINI_MODEL=${JSON.stringify(geminiModel)}`,
  );

  if (!apiKey) {
    console.warn(
      `[generate-comic-panels:${requestId}] Gemini fallback reason: missing_gemini_api_key`,
    );
    const fallback = regenerateMockComicPanels(draft);
    return NextResponse.json({
      comicPanels: sortPanelsByTone(fallback.comicPanels),
      comicPanelsGenerationMode: "mock" as const,
    });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: geminiModel,
    systemInstruction:
      "You are StoryForge. Refresh comic panel beats for manga/comic pre-production. Return ONLY valid JSON. No markdown fences.",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const schemaHint = {
    type: "object",
    additionalProperties: false,
    required: ["comicPanels"],
    properties: {
      comicPanels: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "caption",
            "dialogue",
            "tone",
            "sceneDescription",
            "imagePrompt",
          ],
          properties: {
            caption: { type: "string" },
            dialogue: { type: "string" },
            tone: { type: "string", enum: ["hero", "scene", "villain", "mentor"] },
            sceneDescription: { type: "string" },
            imagePrompt: { type: "string" },
          },
        },
      },
    },
  } as const;

  const context = JSON.stringify({
    format: draft.format,
    idea: draft.idea,
    title: draft.title,
    summary: draft.summary,
    chapterPreview: draft.chapterPreview,
    storyWorld: draft.storyWorld,
    characters: draft.characters,
    currentComicPanels: draft.comicPanels,
  });

  try {
    console.info(
      `[generate-comic-panels:${requestId}] Gemini request started (model=${geminiModel})`,
    );
    const response = await withRateLimitRetry(
      () => withTimeout(
        model.generateContent(`Given this story context JSON, produce updated comic panel beats. Dialogue and captions must reflect character personalities, roles, and the story world (background, theme, tone, time period).

Context:
${context}

Output JSON matching exactly this shape:
${JSON.stringify(schemaHint)}

Rules:
- Exactly 4 panels
- Use tones in this sequence: hero, scene, villain, mentor
- caption: concise scene beat
- dialogue: punchy speech-bubble style line
- sceneDescription: short but vivid description of what is happening visually (no panel numbering)
- imagePrompt: a detailed image-generation prompt for the panel scene. Must describe composition, lighting, and style. Must explicitly instruct the image generator to render no text/speech bubbles/logos/watermarks.
- Keep continuity with the story and characters`,
        ),
        45000,
      ),
      requestId,
    );

    const rawText = response.response.text();
    const jsonText = extractAssistantJsonText(rawText);
    let parsed = safeParseComicPanelsPayload(jsonText);
    if (!parsed && jsonText !== rawText.trim()) {
      parsed = safeParseComicPanelsPayload(rawText.trim());
    }
    if (!parsed) {
      console.warn(
        `[generate-comic-panels:${requestId}] Gemini fallback reason: parse_failed`,
      );
      const fallback = regenerateMockComicPanels(ensureDraftIntegrity(draft));
      return NextResponse.json({
        comicPanels: sortPanelsByTone(fallback.comicPanels),
        comicPanelsGenerationMode: "mock" as const,
      });
    }

    const sorted = sortPanelsByTone(parsed);
    const imageApiKey = process.env.GEMINI_API_KEY?.trim();
    let panelsWithImages: ComicPanelDraft[] = withPlaceholderImageUrls(sorted);

    if (!imageApiKey) {
      console.warn(
        `[generate-comic-panels:${requestId}] panel image fallback reason: missing_gemini_api_key`,
      );
    } else {
      try {
        panelsWithImages = await generateComicPanelImagesWithGemini(
          ensureDraftIntegrity(draft),
          sorted,
          { requestId, apiKey: imageApiKey },
        );
      } catch (imageErr) {
        const imageMessage =
          imageErr instanceof Error ? imageErr.message : String(imageErr);
        console.warn(
          `[generate-comic-panels:${requestId}] panel image fallback reason: image_generation_failed`,
        );
        console.error(
          `[generate-comic-panels:${requestId}] panel image generation error=${imageMessage}`,
        );
        panelsWithImages = withPlaceholderImageUrls(sorted);
      }
    }

    const generatedCount = panelsWithImages.filter(
      (p) => !isComicPanelPlaceholderImageUrl(p.imageUrl),
    ).length;
    console.info(
      `[generate-comic-panels:${requestId}] Gemini response success (model=${geminiModel}, comicPanelsGenerationMode=ai, generatedImages=${generatedCount}/4)`,
    );

    return NextResponse.json({
      comicPanels: panelsWithImages,
      comicPanelsGenerationMode: "ai" as const,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const { mockReason: reason, retryAfterMs } = analyzeGeminiFailure(err);
    console.warn(
      `[generate-comic-panels:${requestId}] Gemini fallback reason: ${reason}` +
        (retryAfterMs != null ? ` retryAfterMs=${retryAfterMs}` : ""),
    );
    console.error(
      `[generate-comic-panels:${requestId}] Gemini request failed; error=${message}`,
    );
    const fallback = regenerateMockComicPanels(ensureDraftIntegrity(draft));
    return NextResponse.json({
      comicPanels: sortPanelsByTone(fallback.comicPanels),
      comicPanelsGenerationMode: "mock" as const,
      generationMockReason: reason,
      ...(retryAfterMs != null && retryAfterMs > 0
        ? { generationRetryAfterMs: retryAfterMs }
        : {}),
    });
  }
}
