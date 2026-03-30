import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { analyzeGeminiFailure } from "@/app/lib/geminiQuota";
import {
  applyStoryImagePlaceholders,
  ensureDraftIntegrity,
  extractAssistantJsonText,
  generateMockStoryDraft,
  safeParseStoryDraft,
  type StoryDraft,
  type StoryFormat,
} from "@/app/lib/storyDraft";

const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";

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

type GenerateStoryRequest = {
  format: StoryFormat | "Manga" | "Comic";
  idea: string;
};

function normalizeFormat(input: GenerateStoryRequest["format"]): StoryFormat | null {
  if (input === "manga" || input === "comic") return input;
  if (input === "Manga") return "manga";
  if (input === "Comic") return "comic";
  return null;
}

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
        `[generate-story:${requestId}] rate limited, retrying in ${delay}ms (attempt ${attempt}/${RATE_LIMIT_RETRY_DELAYS_MS.length})`,
      );
      await sleep(delay);
    }
  }
}

export async function POST(req: Request) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`;
  console.info(`[generate-story:${requestId}] request received`);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiModel = resolveGeminiModel();
  console.info(
    `[generate-story:${requestId}] config: geminiKeyPresent=${Boolean(apiKey)} GEMINI_MODEL=${JSON.stringify(geminiModel)}`,
  );

  if (!apiKey) {
    console.error(
      `[generate-story:${requestId}] generationMode will not run: missing GEMINI_API_KEY (set in .env.local)`,
    );
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY" },
      { status: 500 },
    );
  }

  let body: GenerateStoryRequest;
  try {
    body = (await req.json()) as GenerateStoryRequest;
  } catch {
    console.error(`[generate-story:${requestId}] invalid JSON body`);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  const format = normalizeFormat(body.format);

  if (!format) {
    console.error(`[generate-story:${requestId}] invalid format`);
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  if (!idea) {
    console.error(`[generate-story:${requestId}] empty idea`);
    return NextResponse.json({ error: "Idea is required" }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: geminiModel,
    systemInstruction:
      "You are StoryForge. Return ONLY valid JSON. Do not include markdown fences or extra commentary.",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "format",
      "idea",
      "title",
      "summary",
      "characters",
      "chapterPreview",
      "comicPanels",
      "storyWorld",
    ],
    properties: {
      format: { type: "string", enum: ["manga", "comic"] },
      idea: { type: "string" },
      title: { type: "string" },
      summary: { type: "string" },
      storyWorld: {
        type: "object",
        additionalProperties: false,
        required: ["background", "theme", "tone", "timePeriod"],
        properties: {
          background: { type: "string" },
          theme: { type: "string" },
          tone: { type: "string" },
          timePeriod: { type: "string" },
        },
      },
      characters: {
        type: "array",
        minItems: 3,
        maxItems: 3,
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
      chapterPreview: { type: "string" },
      comicPanels: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["caption", "dialogue", "tone"],
          properties: {
            caption: { type: "string" },
            dialogue: { type: "string" },
            tone: { type: "string", enum: ["hero", "villain", "mentor", "scene"] },
          },
        },
      },
    },
  } as const;

  const userPrompt = `Format: ${format}
Story idea: ${idea}

Generate a StoryDraft JSON object that exactly matches this schema:
${JSON.stringify(schema)}

Rules:
- Exactly 3 main characters with distinct roles chosen from: Hero, Villain, Friend, Mentor, Rival, Family, or a short custom label (role field is a string).
- storyWorld: vivid background/environment, theme, tone, and time period (e.g. cyberpunk city, fantasy forest, school, future world).
- chapterPreview: a short prose opening (not just a bullet list).
- Exactly 4 comicPanels; each panel MUST include punchy dialogue (speech-bubble style) and a caption (short scene beat).
- Keep tone modern and punchy
- Characters use "personality" (not tagline/details): 2–4 sentences each
- "format" must be "${format}"
- "idea" must be "${idea}"`;

  try {
    console.info(
      `[generate-story:${requestId}] Gemini request started (model=${geminiModel})`,
    );
    const response = await withRateLimitRetry(
      () => withTimeout(model.generateContent(userPrompt), 45_000),
      requestId,
    );

    const rawText = response.response.text();
    const jsonText = extractAssistantJsonText(rawText);
    let draft = safeParseStoryDraft(jsonText) as StoryDraft | null;
    if (!draft && jsonText !== rawText.trim()) {
      draft = safeParseStoryDraft(rawText.trim()) as StoryDraft | null;
    }

    if (!draft) {
      const preview =
        jsonText.length > 280 ? `${jsonText.slice(0, 280)}…` : jsonText;
      console.warn(
        `[generate-story:${requestId}] Gemini fallback reason: parse_failed`,
      );
      console.error(
        `[generate-story:${requestId}] safeParseStoryDraft returned null; contentPreview=${JSON.stringify(preview)}`,
      );
      const fallback = generateMockStoryDraft(format, idea);
      return NextResponse.json({
        ...fallback,
        generationMode: "mock" as const,
        generationMockReason: "parse_failed",
      });
    }
    console.info(
      `[generate-story:${requestId}] Gemini response success (model=${geminiModel}, generationMode=ai)`,
    );

    const normalized: StoryDraft = applyStoryImagePlaceholders(
      ensureDraftIntegrity({
        ...draft,
        format,
        idea,
        generationMode: "ai",
        generationMockReason: undefined,
      }),
    );

    return NextResponse.json(normalized);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown generation error";
    const { mockReason: reason, retryAfterMs } = analyzeGeminiFailure(err);
    console.warn(
      `[generate-story:${requestId}] Gemini fallback reason: ${reason}` +
        (retryAfterMs != null ? ` retryAfterMs=${retryAfterMs}` : ""),
    );
    console.error(
      `[generate-story:${requestId}] Gemini request failed; error=${message}`,
    );
    const fallback = generateMockStoryDraft(format, idea);
    return NextResponse.json({
      ...fallback,
      generationMode: "mock" as const,
      generationMockReason: reason,
      ...(retryAfterMs != null && retryAfterMs > 0
        ? { generationRetryAfterMs: retryAfterMs }
        : {}),
    });
  }
}
