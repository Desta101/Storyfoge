import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { analyzeGeminiFailure } from "@/app/lib/geminiQuota";
import {
  createGeminiImageEngineProvider,
  buildCharacterPortraitPrompt,
} from "@/app/lib/image-engine";
import {
  resolveSupportedGeminiImageModel,
  type GeminiImageRequestError,
} from "@/app/lib/geminiImage";
import {
  characterPortraitPlaceholderUrl,
  ensureDraftIntegrity,
  extractAssistantJsonText,
  regenerateMockCharacters,
  safeParseCharactersPayload,
  safeParseStoryDraft,
  type CharacterDraft,
} from "@/app/lib/storyDraft";

const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
const DEFAULT_GEMINI_IMAGE_MODEL = "imagen-3.0-generate-002";

function resolveGeminiModel(): string {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  return fromEnv || DEFAULT_GEMINI_MODEL;
}

function geminiErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const s = (err as { status?: unknown }).status;
  if (typeof s === "number") return s;
  const c = (err as { statusCode?: unknown }).statusCode;
  if (typeof c === "number") return c;
  return undefined;
}

type GenerateCharactersRequest = {
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
  const status = geminiErrorStatus(err);
  if (status === 429) return true;
  if (!err || typeof err !== "object") return false;
  const message = err instanceof Error ? err.message : String(err);
  return message.toLowerCase().includes("resource exhausted") || message.includes("429");
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
        `[generate-characters:${requestId}] rate limited, retrying in ${delay}ms (attempt ${attempt}/${RATE_LIMIT_RETRY_DELAYS_MS.length})`,
      );
      await sleep(delay);
    }
  }
}

function mergeCharacterIds(
  previous: CharacterDraft[],
  next: CharacterDraft[],
): CharacterDraft[] {
  return next.map((c, i) => ({
    ...c,
    id: previous[i]?.id ?? c.id,
  }));
}

type GeneratedPortrait = {
  imageUrl: string;
  mimeType: string;
  data: string;
};

async function generateCharacterPortrait(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<GeneratedPortrait | null> {
  const provider = createGeminiImageEngineProvider({ apiKey, model });
  const generated = await provider.generatePortrait({ prompt });
  const data = generated.imageBytes;
  const mimeType = generated.mimeType;
  if (!data || !mimeType) return null;
  return {
    imageUrl: generated.dataUrl,
    mimeType,
    data,
  };
}

async function portraitHasVisibleFace(
  apiKey: string,
  modelName: string,
  portrait: GeneratedPortrait,
): Promise<boolean> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const vision = genAI.getGenerativeModel({ model: modelName });
  const response = await withTimeout(
    vision.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Reply with only YES or NO. Is this image a close-up portrait of a fictional human or humanoid character where the face is clearly visible as the main subject, expression is visible, and shoulders or upper torso are visible, with no object/landscape/scenery as the primary subject?",
            },
            {
              inlineData: {
                mimeType: portrait.mimeType,
                data: portrait.data,
              },
            },
          ],
        },
      ],
    }),
    30_000,
  );
  return response.response.text().trim().toUpperCase().startsWith("YES");
}

export async function POST(req: Request) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`;
  console.info(`[generate-characters:${requestId}] request received`);

  let body: GenerateCharactersRequest;
  try {
    body = (await req.json()) as GenerateCharactersRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const draftRaw =
    body.draft !== undefined && body.draft !== null
      ? JSON.stringify(body.draft)
      : null;
  const draft = safeParseStoryDraft(draftRaw);
  if (!draft) {
    return NextResponse.json({ error: "Invalid or incomplete StoryDraft" }, { status: 400 });
  }

  const n = draft.characters.length;
  if (n < 1 || n > 10) {
    return NextResponse.json({ error: "Character count must be between 1 and 10" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiModel = resolveGeminiModel();
  console.info(
    `[generate-characters:${requestId}] config: geminiKeyPresent=${Boolean(apiKey)} GEMINI_MODEL=${JSON.stringify(geminiModel)}`,
  );

  if (!apiKey) {
    console.warn(
      `[generate-characters:${requestId}] Gemini fallback reason: missing_gemini_api_key`,
    );
    const fallback = regenerateMockCharacters(draft);
    return NextResponse.json({
      characters: mergeCharacterIds(draft.characters, fallback.characters),
      charactersGenerationMode: "mock" as const,
    });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: geminiModel,
    systemInstruction:
      "You are StoryForge. Refresh character bios for manga/comic pre-production. Return ONLY valid JSON. No markdown fences or extra commentary.",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const schemaHint = {
    type: "object",
    additionalProperties: false,
    required: ["characters"],
    properties: {
      characters: {
        type: "array",
        minItems: n,
        maxItems: n,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["role", "name", "personality", "visual"],
          properties: {
            role: { type: "string" },
            name: { type: "string" },
            personality: { type: "string" },
            visual: { type: "string" },
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
    currentCharacters: draft.characters,
  });

  const userPrompt = `Given this story context JSON, produce updated character entries that fit the tone and plot.

Preserve the number of characters (${n}). Keep the same role labels (strings) in the same order when possible; you may refine names for consistency.

Context:
${context}

Output JSON matching exactly this shape:
${JSON.stringify(schemaHint)}

Rules:
- personality: 2–4 sentences
- visual: concise art-direction for illustrators (hair, wardrobe, palette, silhouette)
- Stay consistent with format (${draft.format}), storyWorld, and the story idea.`;

  try {
    console.info(
      `[generate-characters:${requestId}] Gemini request started (model=${geminiModel})`,
    );
    const response = await withRateLimitRetry(
      () => withTimeout(model.generateContent(userPrompt), 45_000),
      requestId,
    );

    const rawText = response.response.text();
    const jsonText = extractAssistantJsonText(rawText);
    let parsed = safeParseCharactersPayload(jsonText);
    if (!parsed && jsonText !== rawText.trim()) {
      parsed = safeParseCharactersPayload(rawText.trim());
    }
    if (!parsed || parsed.length !== n) {
      console.warn(
        `[generate-characters:${requestId}] Gemini fallback reason: parse_failed`,
      );
      const fallback = regenerateMockCharacters(draft);
      return NextResponse.json({
        characters: mergeCharacterIds(draft.characters, fallback.characters),
        charactersGenerationMode: "mock" as const,
      });
    }

    const merged = mergeCharacterIds(draft.characters, parsed);
    const preferredImageModel =
      process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
    const resolvedImageModel = await resolveSupportedGeminiImageModel(
      apiKey,
      preferredImageModel,
    );
    if (!resolvedImageModel) {
      console.warn(
        `[generate-characters:${requestId}] Gemini fallback reason: no_supported_image_model (preferred=${preferredImageModel})`,
      );
    }
    const withPortraits: CharacterDraft[] = [];
    for (let i = 0; i < merged.length; i += 1) {
      const character = merged[i]!;
      const prompt = buildCharacterPortraitPrompt(draft.format, character);
      let portraitUrl: string | undefined;
      try {
        if (!resolvedImageModel) throw new Error("No supported Gemini image model");
        console.info(
          `[generate-characters:${requestId}] portrait image request started (model=${resolvedImageModel}, endpoint=/v1beta/models/${encodeURIComponent(resolvedImageModel)}:generateImages, character=${character.id})`,
        );
        let accepted: GeneratedPortrait | null = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const generated = await withRateLimitRetry(
            () =>
              withTimeout(
                generateCharacterPortrait(apiKey, resolvedImageModel, prompt),
                90_000,
              ),
            `${requestId}-portrait-${i}-gen-${attempt + 1}`,
          );
          if (!generated) {
            continue;
          }
          const hasFace = await withRateLimitRetry(
            () => portraitHasVisibleFace(apiKey, geminiModel, generated),
            `${requestId}-portrait-${i}-verify-${attempt + 1}`,
          );
          if (hasFace) {
            accepted = generated;
            console.info(
              `[generate-characters:${requestId}] portrait image request success (character=${character.id}, bytes=${generated.data.length})`,
            );
            break;
          }
          console.warn(
            `[generate-characters:${requestId}] portrait rejected (no visible face), retrying (character=${character.id}, attempt=${attempt + 1}/3)`,
          );
        }
        if (!accepted) {
          console.warn(
            `[generate-characters:${requestId}] portrait fallback reason: no_visible_face_after_retries (character=${character.id})`,
          );
        }
        portraitUrl =
          accepted?.imageUrl || characterPortraitPlaceholderUrl(character.id, i);
      } catch (imageErr) {
        if (typeof imageErr === "object" && imageErr !== null && "status" in imageErr && "endpoint" in imageErr) {
          const e = imageErr as GeminiImageRequestError;
          console.error(
            `[generate-characters:${requestId}] portrait image request failed (character=${character.id}) status=${e.status} model=${e.model} endpoint=${e.endpoint} responseBody=${e.responseBody || "<empty>"}`,
          );
        } else {
          const msg = imageErr instanceof Error ? imageErr.message : String(imageErr);
          console.error(
            `[generate-characters:${requestId}] portrait image request failed (character=${character.id}) error=${msg}`,
          );
        }
        console.warn(
          `[generate-characters:${requestId}] portrait fallback reason: image_generation_failed (character=${character.id})`,
        );
        portraitUrl = characterPortraitPlaceholderUrl(character.id, i);
      }
      withPortraits.push({
        ...character,
        imagePrompt: prompt,
        portraitUrl,
        imageUrl: portraitUrl,
      });
    }
    console.info(
      `[generate-characters:${requestId}] Gemini response success (model=${geminiModel}, charactersGenerationMode=ai)`,
    );
    return NextResponse.json({
      characters: withPortraits,
      charactersGenerationMode: "ai" as const,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const { mockReason: reason, retryAfterMs } = analyzeGeminiFailure(err);
    console.warn(
      `[generate-characters:${requestId}] Gemini fallback reason: ${reason}` +
        (retryAfterMs != null ? ` retryAfterMs=${retryAfterMs}` : ""),
    );
    console.error(
      `[generate-characters:${requestId}] Gemini request failed; error=${message}`,
    );
    const fallback = regenerateMockCharacters(ensureDraftIntegrity(draft));
    return NextResponse.json({
      characters: mergeCharacterIds(draft.characters, fallback.characters),
      charactersGenerationMode: "mock" as const,
      generationMockReason: reason,
      ...(retryAfterMs != null && retryAfterMs > 0
        ? { generationRetryAfterMs: retryAfterMs }
        : {}),
    });
  }
}
