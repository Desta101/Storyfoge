import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  ensureDraftIntegrity,
  regenerateMockStoryRefresh,
  safeParseStoryDraft,
  safeParseStoryRefreshPayload,
} from "@/app/lib/storyDraft";
import { getUserPlanTierFromServer } from "@/app/lib/billingPlan";

type Body = {
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

const refreshSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "chapterPreview", "comicPanels"],
  properties: {
    summary: { type: "string" },
    chapterPreview: { type: "string" },
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
          tone: {
            type: "string",
            enum: ["hero", "villain", "mentor", "scene"],
          },
            sceneDescription: { type: "string" },
            imagePrompt: { type: "string" },
        },
      },
    },
  },
} as const;

export async function POST(req: Request) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`;
  let body: Body;
  try {
    body = (await req.json()) as Body;
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

  const tier = await getUserPlanTierFromServer();
  const apiKey = process.env.OPENAI_API_KEY;
  const useAi = tier === "premium" && Boolean(apiKey);

  if (!useAi) {
    const out = regenerateMockStoryRefresh(ensureDraftIntegrity(draft));
    return NextResponse.json({
      summary: out.summary,
      chapterPreview: out.chapterPreview,
      comicPanels: out.comicPanels,
      refreshMode: "mock" as const,
      tier,
    });
  }

  const client = new OpenAI({ apiKey: apiKey! });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const context = JSON.stringify(ensureDraftIntegrity(draft));

  try {
    const response = await withTimeout(
      client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are StoryForge. Refresh story summary, chapter preview, and comic panel captions/dialogue so they stay consistent with the current cast and world settings. Return ONLY valid JSON. No markdown fences.",
          },
          {
            role: "user",
            content: `Story context (authoritative):
${context}

Produce updated JSON matching exactly this schema:
${JSON.stringify(refreshSchema)}

Rules:
- summary: 2–4 sentences
- chapterPreview: chapter-opening prose, 2–5 sentences
- comicPanels: exactly 4 panels; tones in order hero, scene, villain, mentor
- Dialogue must reflect character personalities and roles; captions reference setting (background, theme, tone, time period) when relevant.
- sceneDescription: short but vivid description of what is happening visually (no panel numbering)
- imagePrompt: detailed image-generation prompt for the panel scene; must explicitly instruct the image generator to render no text/speech bubbles/logos/watermarks.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
      45000,
    );

    const text = response.choices[0]?.message?.content ?? "";
    const parsed = safeParseStoryRefreshPayload(text);
    if (!parsed) {
      console.error(`[refresh-story-draft:${requestId}] parse failed, using mock`);
      const out = regenerateMockStoryRefresh(ensureDraftIntegrity(draft));
      return NextResponse.json({
        summary: out.summary,
        chapterPreview: out.chapterPreview,
        comicPanels: out.comicPanels,
        refreshMode: "mock" as const,
      });
    }

    return NextResponse.json({
      ...parsed,
      refreshMode: "ai" as const,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[refresh-story-draft:${requestId}] failed: ${message}`);
    const out = regenerateMockStoryRefresh(ensureDraftIntegrity(draft));
    return NextResponse.json({
      summary: out.summary,
      chapterPreview: out.chapterPreview,
      comicPanels: out.comicPanels,
      refreshMode: "mock" as const,
    });
  }
}
