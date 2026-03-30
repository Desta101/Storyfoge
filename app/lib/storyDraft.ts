export type StoryFormat = "manga" | "comic";
export type GenerationMode = "ai" | "mock";

/** Legacy panel / character tone buckets (comic panels). */
export type ComicPanelTone = "hero" | "villain" | "mentor" | "scene";

export type ComicColorModePreference = "bw" | "color";

export type StoryWorldSettings = {
  background: string;
  theme: string;
  tone: string;
  timePeriod: string;
  /** Comic preview display mode; persisted with the project in `story_world`. */
  comicColorMode?: ComicColorModePreference;
};

export type CharacterDraft = {
  id: string;
  /** Display role: Hero, Villain, Friend, Mentor, Rival, Family, or custom text */
  role: string;
  name: string;
  personality: string;
  visual: string;
  /** Portrait prompt used for image generation / regeneration. */
  imagePrompt?: string;
  /** URL/data-url for generated portrait artwork. */
  portraitUrl?: string;
  /** URL for generated character portrait (https) or placeholder until image gen is wired. */
  imageUrl?: string;
};

export type ComicPanelDraft = {
  /** Short scene beat used in the UI caption. */
  caption: string;
  /** Speech bubble line used in the UI dialogue. */
  dialogue: string;
  /** Longer scene description used for prompt-building. */
  sceneDescription: string;
  /** Image-generation prompt (used for DALL·E). */
  imagePrompt: string;
  tone: ComicPanelTone;
  /** URL for generated panel artwork (https) or placeholder until image gen is wired. */
  imageUrl?: string;
};

export type StoryDraft = {
  format: StoryFormat;
  idea: string;
  title: string;
  summary: string;
  characters: CharacterDraft[];
  chapterPreview: string;
  comicPanels: ComicPanelDraft[];
  storyWorld: StoryWorldSettings;
  generationMode?: GenerationMode;
  /** When `generationMode` is `mock`, server may set why (debugging / support). */
  generationMockReason?: string;
  /**
   * When the server returns mock due to quota/rate limits, optional cooldown (ms)
   * from Gemini RetryInfo so the UI can disable retries until it elapses.
   */
  generationRetryAfterMs?: number;
};

export const ROLE_PRESETS = [
  "Hero",
  "Villain",
  "Friend",
  "Mentor",
  "Rival",
  "Family",
] as const;

export function defaultStoryWorld(): StoryWorldSettings {
  return {
    background: "",
    theme: "",
    tone: "",
    timePeriod: "",
    comicColorMode: "bw",
  };
}

export function newCharacterId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function legacyRoleToLabel(
  role: unknown,
): string | null {
  if (role === "hero") return "Hero";
  if (role === "villain") return "Villain";
  if (role === "mentor") return "Mentor";
  return null;
}

function normalizeRoleField(role: unknown): string {
  const leg = legacyRoleToLabel(role);
  if (leg) return leg;
  if (typeof role === "string" && role.trim()) {
    const t = role.trim();
    const low = t.toLowerCase();
    if (low === "hero") return "Hero";
    if (low === "villain") return "Villain";
    if (low === "mentor") return "Mentor";
    return t;
  }
  return "";
}

function parsePersonalityFromLegacy(c: Record<string, unknown>): string | null {
  if (typeof c.personality === "string" && c.personality.trim()) {
    return c.personality;
  }
  const tagline = typeof c.tagline === "string" ? c.tagline.trim() : "";
  const details = typeof c.details === "string" ? c.details.trim() : "";
  if (!tagline && !details) return null;
  if (tagline && details) return `${tagline}\n\n${details}`;
  return tagline || details;
}

function parseCharacterRecord(c: Record<string, unknown>): CharacterDraft | null {
  const name = typeof c.name === "string" ? c.name : "";
  const visual = typeof c.visual === "string" ? c.visual : "";
  const role = normalizeRoleField(c.role);
  if (!role) return null;

  const personality = parsePersonalityFromLegacy(c);
  if (!personality) return null;

  const id =
    typeof c.id === "string" && c.id.trim() ? c.id.trim() : newCharacterId();

  const imageUrl =
    typeof c.imageUrl === "string" && c.imageUrl.trim()
      ? c.imageUrl.trim()
      : undefined;
  const portraitUrl =
    typeof c.portraitUrl === "string" && c.portraitUrl.trim()
      ? c.portraitUrl.trim()
      : imageUrl;
  const imagePrompt =
    typeof c.imagePrompt === "string" && c.imagePrompt.trim()
      ? c.imagePrompt.trim()
      : undefined;

  return {
    id,
    role,
    name,
    personality,
    visual,
    ...(imagePrompt ? { imagePrompt } : {}),
    ...(portraitUrl ? { portraitUrl } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export function parseStoryWorldPayload(raw: unknown): StoryWorldSettings {
  if (!raw || typeof raw !== "object") return defaultStoryWorld();
  const o = raw as Record<string, unknown>;
  const comicColorMode: ComicColorModePreference =
    o.comicColorMode === "color" ? "color" : "bw";
  return {
    background: typeof o.background === "string" ? o.background : "",
    theme: typeof o.theme === "string" ? o.theme : "",
    tone: typeof o.tone === "string" ? o.tone : "",
    timePeriod: typeof o.timePeriod === "string" ? o.timePeriod : "",
    comicColorMode,
  };
}

const STORY_DRAFT_SESSION_KEY = "storyforge.storyDraft";
const STORY_DRAFT_LOCAL_KEY = "storyforge.storyDraftLocal";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

export function ensureDraftIntegrity(draft: StoryDraft): StoryDraft {
  const storyWorld = { ...defaultStoryWorld(), ...draft.storyWorld };
  const characters = draft.characters.map((c) => ({
    ...c,
    id: c.id?.trim() ? c.id : newCharacterId(),
    role: c.role?.trim() ? c.role : "Hero",
    name: c.name ?? "",
    personality: c.personality ?? "",
    visual: c.visual ?? "",
    imagePrompt:
      typeof c.imagePrompt === "string" && c.imagePrompt.trim()
        ? c.imagePrompt.trim()
        : undefined,
    portraitUrl:
      typeof c.portraitUrl === "string" && c.portraitUrl.trim()
        ? c.portraitUrl.trim()
        : typeof c.imageUrl === "string" && c.imageUrl.trim()
          ? c.imageUrl.trim()
          : undefined,
    imageUrl:
      typeof c.imageUrl === "string" && c.imageUrl.trim()
        ? c.imageUrl.trim()
        : typeof c.portraitUrl === "string" && c.portraitUrl.trim()
          ? c.portraitUrl.trim()
        : undefined,
  }));
  const comicPanels = draft.comicPanels.map((p) => ({
    ...p,
    imageUrl:
      typeof p.imageUrl === "string" && p.imageUrl.trim()
        ? p.imageUrl.trim()
        : undefined,
  }));
  return { ...draft, storyWorld, characters, comicPanels };
}

/** Deterministic placeholder portrait until real image generation is connected. */
export function characterPortraitPlaceholderUrl(
  characterId: string,
  variantIndex = 0,
): string {
  const seed = `sfchar-${characterId}-v${variantIndex}`
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 48);
  return `https://picsum.photos/seed/${seed || "sf"}/400/520`;
}

/** Deterministic placeholder panel art until real image generation is connected. */
export function comicPanelPlaceholderUrl(panelIndex: number): string {
  return `https://picsum.photos/seed/sfpanel-${panelIndex}/960/720`;
}

/** True when the URL is missing or our deterministic picsum fallback (not a generated asset). */
export function isComicPanelPlaceholderImageUrl(url: string | undefined): boolean {
  if (!url?.trim()) return true;
  return url.trim().toLowerCase().includes("picsum.photos");
}

/**
 * Fills missing `imageUrl` on characters and panels with stable placeholder URLs
 * (e.g. after AI JSON that omits images).
 */
export function applyStoryImagePlaceholders(draft: StoryDraft): StoryDraft {
  const base = ensureDraftIntegrity(draft);
  const characters = base.characters.map((c) => ({
    ...c,
    portraitUrl:
      c.portraitUrl ?? c.imageUrl ?? characterPortraitPlaceholderUrl(c.id, 0),
    imageUrl:
      c.imageUrl ?? c.portraitUrl ?? characterPortraitPlaceholderUrl(c.id, 0),
  }));
  const comicPanels = base.comicPanels.map((p, i) => ({
    ...p,
    imageUrl: p.imageUrl ?? comicPanelPlaceholderUrl(i),
  }));
  return { ...base, characters, comicPanels };
}

/**
 * Strips optional ```json ... ``` fences so `JSON.parse` succeeds when the model
 * wraps the payload (should be rare with `response_format: json_object`).
 */
export function extractAssistantJsonText(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  const withoutOpen = t.replace(/^```(?:json)?\s*\r?\n?/i, "");
  const end = withoutOpen.lastIndexOf("```");
  if (end === -1) return t;
  return withoutOpen.slice(0, end).trim();
}

export function safeParseStoryDraft(raw: string | null): StoryDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;

    const format = parsed.format;
    if (format !== "manga" && format !== "comic") return null;

    const idea = parsed.idea;
    const title = parsed.title;
    const summary = parsed.summary;
    const chapterPreview = parsed.chapterPreview;
    const characters = parsed.characters;
    const comicPanels = parsed.comicPanels;
    const generationMode =
      parsed.generationMode === "ai" || parsed.generationMode === "mock"
        ? parsed.generationMode
        : undefined;
    const generationMockReason =
      typeof parsed.generationMockReason === "string" &&
      parsed.generationMockReason.trim()
        ? parsed.generationMockReason.trim()
        : undefined;

    let generationRetryAfterMs: number | undefined;
    if (typeof parsed.generationRetryAfterMs === "number") {
      const n = parsed.generationRetryAfterMs;
      if (Number.isFinite(n) && n > 0 && n < 86_400_000) {
        generationRetryAfterMs = Math.floor(n);
      }
    }

    if (
      typeof idea !== "string" ||
      typeof title !== "string" ||
      typeof summary !== "string" ||
      typeof chapterPreview !== "string" ||
      !Array.isArray(characters) ||
      !Array.isArray(comicPanels)
    ) {
      return null;
    }

    const parsedCharacters: CharacterDraft[] = [];
    for (const c of characters) {
      if (!isRecord(c)) return null;
      const ch = parseCharacterRecord(c);
      if (!ch) return null;
      parsedCharacters.push(ch);
    }

    if (parsedCharacters.length < 1 || parsedCharacters.length > 10) {
      return null;
    }

    const parsedPanels: ComicPanelDraft[] = [];
    for (const p of comicPanels) {
      if (!isRecord(p)) return null;
      const tone = p.tone;
      if (
        tone !== "hero" &&
        tone !== "villain" &&
        tone !== "mentor" &&
        tone !== "scene"
      ) {
        return null;
      }
      if (typeof p.caption !== "string" || typeof p.dialogue !== "string") {
        return null;
      }
      const caption = p.caption.trim();
      const dialogue = p.dialogue.trim();
      const sceneDescription =
        typeof p.sceneDescription === "string" && p.sceneDescription.trim()
          ? p.sceneDescription.trim()
          : `${caption} ${dialogue}`.trim();
      const imagePrompt =
        typeof p.imagePrompt === "string" && p.imagePrompt.trim()
          ? p.imagePrompt.trim()
          : `Illustration only. ${sceneDescription}. Bold ink and cinematic lighting. Do not render any text, letters, logos, speech bubbles, or watermarks in the image.`;
      const panelImageUrl =
        typeof p.imageUrl === "string" && p.imageUrl.trim()
          ? p.imageUrl.trim()
          : undefined;
      parsedPanels.push({
        caption,
        dialogue,
        tone,
        sceneDescription,
        imagePrompt,
        ...(panelImageUrl ? { imageUrl: panelImageUrl } : {}),
      });
    }

    if (parsedPanels.length !== 4) return null;

    const storyWorld = parseStoryWorldPayload(parsed.storyWorld);

    return ensureDraftIntegrity({
      format,
      idea,
      title,
      summary,
      characters: parsedCharacters,
      chapterPreview,
      comicPanels: parsedPanels,
      storyWorld,
      generationMode,
      ...(generationMockReason ? { generationMockReason } : {}),
      ...(generationRetryAfterMs != null
        ? { generationRetryAfterMs }
        : {}),
    });
  } catch {
    return null;
  }
}

/** Parse AI character refresh payload: 1–10 characters, order preserved. */
export function safeParseCharactersPayload(
  raw: string | null,
): CharacterDraft[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const characters = parsed.characters;
    if (!Array.isArray(characters)) return null;
    if (characters.length < 1 || characters.length > 10) return null;
    const parsedCharacters: CharacterDraft[] = [];
    for (const c of characters) {
      if (!isRecord(c)) return null;
      const ch = parseCharacterRecord(c);
      if (!ch) return null;
      parsedCharacters.push(ch);
    }
    return parsedCharacters;
  } catch {
    return null;
  }
}

/** Parse AI comic panel refresh payload. */
export function safeParseComicPanelsPayload(
  raw: string | null,
): ComicPanelDraft[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const comicPanels = parsed.comicPanels;
    if (!Array.isArray(comicPanels) || comicPanels.length !== 4) return null;
    const parsedPanels: ComicPanelDraft[] = [];
    for (const p of comicPanels) {
      if (!isRecord(p)) return null;
      const tone = p.tone;
      if (
        tone !== "hero" &&
        tone !== "villain" &&
        tone !== "mentor" &&
        tone !== "scene"
      ) {
        return null;
      }
      if (typeof p.caption !== "string" || typeof p.dialogue !== "string") {
        return null;
      }
      if (
        typeof p.sceneDescription !== "string" ||
        typeof p.imagePrompt !== "string"
      ) {
        return null;
      }
      const img =
        typeof p.imageUrl === "string" && p.imageUrl.trim()
          ? p.imageUrl.trim()
          : undefined;
      const caption = p.caption.trim();
      const dialogue = p.dialogue.trim();
      parsedPanels.push({
        caption,
        dialogue,
        tone,
        sceneDescription: p.sceneDescription.trim(),
        imagePrompt: p.imagePrompt.trim(),
        ...(img ? { imageUrl: img } : {}),
      });
    }
    return parsedPanels;
  } catch {
    return null;
  }
}

/** Parse smart refresh API response. */
export function safeParseStoryRefreshPayload(raw: string | null): {
  summary: string;
  chapterPreview: string;
  comicPanels: ComicPanelDraft[];
} | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const summary = parsed.summary;
    const chapterPreview = parsed.chapterPreview;
    const comicPanels = parsed.comicPanels;
    if (typeof summary !== "string" || typeof chapterPreview !== "string") {
      return null;
    }
    if (!Array.isArray(comicPanels)) return null;
    const panels: ComicPanelDraft[] = [];
    for (const p of comicPanels) {
      if (!isRecord(p)) return null;
      const tone = p.tone;
      if (
        tone !== "hero" &&
        tone !== "villain" &&
        tone !== "mentor" &&
        tone !== "scene"
      ) {
        return null;
      }
      if (typeof p.caption !== "string" || typeof p.dialogue !== "string") {
        return null;
      }
      if (
        typeof p.sceneDescription !== "string" ||
        typeof p.imagePrompt !== "string"
      ) {
        return null;
      }
      const img =
        typeof p.imageUrl === "string" && p.imageUrl.trim()
          ? p.imageUrl.trim()
          : undefined;
      const caption = p.caption.trim();
      const dialogue = p.dialogue.trim();
      panels.push({
        caption,
        dialogue,
        tone,
        sceneDescription: p.sceneDescription.trim(),
        imagePrompt: p.imagePrompt.trim(),
        ...(img ? { imageUrl: img } : {}),
      });
    }
    if (panels.length !== 4) return null;
    return { summary, chapterPreview, comicPanels: panels };
  } catch {
    return null;
  }
}

export function loadStoryDraftFromStorage(): StoryDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const fromSession = safeParseStoryDraft(
      sessionStorage.getItem(STORY_DRAFT_SESSION_KEY),
    );
    if (fromSession) return fromSession;
  } catch {
    // ignore
  }

  try {
    const fromLocal = safeParseStoryDraft(
      localStorage.getItem(STORY_DRAFT_LOCAL_KEY),
    );
    if (fromLocal) return fromLocal;
  } catch {
    // ignore
  }

  return null;
}

export function saveStoryDraftToStorage(draft: StoryDraft) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(ensureDraftIntegrity(draft));
  try {
    sessionStorage.setItem(STORY_DRAFT_SESSION_KEY, serialized);
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(STORY_DRAFT_LOCAL_KEY, serialized);
  } catch {
    // ignore
  }
}

function titleForIdea(idea: string) {
  const normalized = idea.trim().toLowerCase();
  if (normalized.includes("fire") || normalized.includes("ember")) {
    return "The Last Fire Mage";
  }
  return "The Last Fire Mage";
}

function extractKeyword(idea: string) {
  const words = idea
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);
  return words[0]?.slice(0, 24) ?? "ember";
}

function worldSnippet(w: StoryWorldSettings) {
  const parts = [w.background, w.theme, w.tone, w.timePeriod].filter(
    (s) => typeof s === "string" && s.trim(),
  );
  return parts.length ? parts.join(" · ") : "a vivid, lived-in world";
}

export function generateMockStoryDraft(format: StoryFormat, idea: string): StoryDraft {
  const keyword = extractKeyword(idea);
  const title = titleForIdea(idea);
  const storyWorld: StoryWorldSettings = {
    background: "A city where ember-light leaks through cracked neon.",
    theme: "Hope vs. controlled flame",
    tone: "Bittersweet adventure",
    timePeriod: "Near-future fantasy",
  };

  const summary = `When ${keyword} refuses to fade, a reluctant mage must forge a new kind of hope—one panel at a time—against ${worldSnippet(storyWorld).toLowerCase()}.`;

  const chapterPreview = `Chapter 1: The first frame flickers. ${keyword} leaks into the margins, and Kael Emberhart realizes the city has been hiding its warmth beneath ${storyWorld.background || "the skyline"}.`;

  const characters: CharacterDraft[] = [
    {
      id: newCharacterId(),
      role: "Hero",
      name: "Kael Emberhart",
      personality:
        "A mage who reignites lost flames, but every spark demands a memory in return. Heat in his palms, silence in his past—triggered by the story's central conflict.",
      visual:
        "Cinder-red hair, ember-glow eyes, and a coat stitched with living embers.",
    },
    {
      id: newCharacterId(),
      role: "Villain",
      name: "Vyr Noxell",
      personality:
        "The architect of perpetual dusk, draining fire from the world to stitch a new night. A shadow that learns your name and steals it for fuel.",
      visual:
        "Night-black silhouette, floating ash fragments, and a collar of fractured dusk.",
    },
    {
      id: newCharacterId(),
      role: "Mentor",
      name: "Aria Glasscrown",
      personality:
        "A former flame-seer who guides with riddles, not answers—and never twice the same lesson. Wisdom forged in nearly breaking worlds.",
      visual:
        "Silver threaded hair, calm gaze, and a lantern-like aura under a violet cloak.",
    },
  ];

  const comicPanels: ComicPanelDraft[] = [
    {
      tone: "hero",
      caption: "Panel 1: The frame ignites.",
      dialogue: `“Kael… where did that light come from?”`,
      sceneDescription:
        "A cold street suddenly blooms with ember-light, igniting dust motes in the air.",
      imagePrompt:
        "Illustration only. A premium comic book panel where ember-light ignites a dark street at dramatic angles. Cinematic lighting, bold ink linework, high detail. No text, letters, logos, speech bubbles, or watermarks.",
    },
    {
      tone: "scene",
      caption: "Panel 2: The city holds its breath.",
      dialogue: "“Every flame leaves a debt.”",
      sceneDescription:
        "The skyline pauses mid-breath, neon reflections trembling on rain-slick concrete.",
      imagePrompt:
        "Illustration only. A premium comic book panel showing a tense city-wide quiet with neon reflections on wet streets. Cinematic lighting, bold ink linework, high detail. No text, letters, logos, speech bubbles, or watermarks.",
    },
    {
      tone: "villain",
      caption: "Panel 3: A shadow learns his name.",
      dialogue: `“Vyr Noxell. I’ve been waiting.”`,
      sceneDescription:
        "A villain’s silhouette emerges from darkness, fragments of ash swirling around a listening figure.",
      imagePrompt:
        "Illustration only. A premium comic book panel featuring a shadowy villain revealing themselves, ash fragments swirling, dramatic contrast lighting. Bold ink linework, high detail. No text, letters, logos, speech bubbles, or watermarks.",
    },
    {
      tone: "mentor",
      caption: "Panel 4: Guidance returns.",
      dialogue: `“Look between frames. That’s where truth hides.”`,
      sceneDescription:
        "A mentor figure frames the truth between layers, lantern-soft aura creating a calm focus center.",
      imagePrompt:
        "Illustration only. A premium comic book panel where a mentor’s lantern-like aura frames the scene like a window between panels. Cinematic lighting, bold ink linework, high detail. No text, letters, logos, speech bubbles, or watermarks.",
    },
  ];

  return applyStoryImagePlaceholders(
    ensureDraftIntegrity({
      format,
      idea,
      title,
      summary,
      characters,
      chapterPreview,
      comicPanels,
      storyWorld,
    }),
  );
}

export function regenerateMockCharacters(draft: StoryDraft): StoryDraft {
  const keyword = extractKeyword(draft.idea);
  const w = draft.storyWorld ?? defaultStoryWorld();

  const nextCharacters: CharacterDraft[] = draft.characters.map((c) => {
    const rl = c.role.toLowerCase();
    if (rl.includes("hero") || rl === "hero") {
      return {
        ...c,
        personality: `Heat in his palms, silence in his past—now awakened by ${keyword}. ${c.personality}`,
        visual: `${c.visual} — ${w.background || "urban twilight"} palette.`,
        portraitUrl:
          c.portraitUrl ??
          c.imageUrl ??
          characterPortraitPlaceholderUrl(c.id, 0),
        imageUrl: c.imageUrl ?? characterPortraitPlaceholderUrl(c.id, 0),
      };
    }
    if (rl.includes("villain") || rl === "villain") {
      return {
        ...c,
        personality: `Charcoal resolve and a vow carved into shadow. ${c.personality}`,
        visual: `${c.visual} — ash-fractured silhouette, ${w.theme || "ominous"} mood.`,
        portraitUrl:
          c.portraitUrl ??
          c.imageUrl ??
          characterPortraitPlaceholderUrl(c.id, 0),
        imageUrl: c.imageUrl ?? characterPortraitPlaceholderUrl(c.id, 0),
      };
    }
    if (rl.includes("mentor") || rl === "mentor") {
      return {
        ...c,
        personality: `Guidance sharpened around ${keyword}. ${c.personality}`,
        visual: `${c.visual} — lantern-soft focus, ${w.tone || "steady"} atmosphere.`,
        portraitUrl:
          c.portraitUrl ??
          c.imageUrl ??
          characterPortraitPlaceholderUrl(c.id, 0),
        imageUrl: c.imageUrl ?? characterPortraitPlaceholderUrl(c.id, 0),
      };
    }
    return {
      ...c,
      personality: `${c.personality} (refined for ${keyword} in ${worldSnippet(w)}).`,
      visual: `${c.visual} — scene notes: ${w.background || "setting TBD"}.`,
      portraitUrl:
        c.portraitUrl ??
        c.imageUrl ??
        characterPortraitPlaceholderUrl(c.id, 0),
      imageUrl: c.imageUrl ?? characterPortraitPlaceholderUrl(c.id, 0),
    };
  });

  return ensureDraftIntegrity({ ...draft, characters: nextCharacters });
}

export function regenerateMockComicPanels(draft: StoryDraft): StoryDraft {
  const keyword = extractKeyword(draft.idea);
  const w = draft.storyWorld ?? defaultStoryWorld();
  const setting = w.background || "the skyline";

  const nextPanels: ComicPanelDraft[] = [
    {
      tone: "hero",
      caption: "Panel 1: The ember answers back.",
      dialogue: `“Kael—hold steady. ${keyword} is speaking.”`,
      sceneDescription: `Kael’s ember-light surges across the scene in ${w.background || "an urban alley"}.`,
      imagePrompt:
        `Illustration only. A premium comic book panel with ${keyword} reflected in cinematic ember-light, dynamic composition, bold ink linework, high detail, dramatic contrast. Do not render any text, letters, logos, speech bubbles, or watermarks.`,
      imageUrl: comicPanelPlaceholderUrl(0),
    },
    {
      tone: "scene",
      caption: `Panel 2: ${setting} tightens its grip.`,
      dialogue: `“${w.theme || "The stakes"} echo in every alley.”`,
      sceneDescription: `The setting tightens: neon reflections and tense atmosphere in ${setting}.`,
      imagePrompt:
        `Illustration only. A premium comic book panel showing a tense city moment in ${setting}, neon reflections on wet surfaces, cinematic lighting, bold ink linework, high detail. No text, letters, logos, speech bubbles, or watermarks.`,
      imageUrl: comicPanelPlaceholderUrl(1),
    },
    {
      tone: "villain",
      caption: "Panel 3: Dusk tightens its grip.",
      dialogue: "“You can’t save what was already priced.”",
      sceneDescription:
        "A villain silhouette advances as dusk thickens, ash fragments drifting through harsh light.",
      imagePrompt:
        "Illustration only. A premium comic book panel with a villain silhouette emerging from dusk, ash fragments in the air, dramatic shadows, bold ink linework, high detail. No text, letters, logos, speech bubbles, or watermarks.",
      imageUrl: comicPanelPlaceholderUrl(2),
    },
    {
      tone: "mentor",
      caption: "Panel 4: The lesson lands.",
      dialogue: `“Between panels, the truth breathes—${w.timePeriod || "now"}.”`,
      sceneDescription:
        "A mentor’s lantern-like aura highlights the truth between frames, calm center focus.",
      imagePrompt:
        `Illustration only. A premium comic book panel where a mentor’s lantern-like aura frames the scene like a window between panels, ${w.timePeriod || "near-future fantasy"} mood, cinematic lighting, bold ink linework, high detail. No text, letters, logos, speech bubbles, or watermarks.`,
      imageUrl: comicPanelPlaceholderUrl(3),
    },
  ];

  return ensureDraftIntegrity({ ...draft, comicPanels: nextPanels });
}

/** Deterministic refresh for mock / free-tier sync. */
export function regenerateMockStoryRefresh(draft: StoryDraft): StoryDraft {
  const keyword = extractKeyword(draft.idea);
  const w = draft.storyWorld ?? defaultStoryWorld();
  const worldLine = worldSnippet(w);
  const names = draft.characters.map((c) => c.name).filter(Boolean);
  const lead = names[0] ?? "the lead";

  const summary = `${draft.title}: ${worldLine}. When ${keyword} surfaces, ${lead} navigates ${names.slice(1).join(", ") || "allies and rivals"}—${draft.idea.slice(0, 120)}${draft.idea.length > 120 ? "…" : ""}`;

  const chapterPreview = `Chapter preview: ${w.background || "The setting"} — ${w.tone || "tension"} in ${w.timePeriod || "this era"}. ${lead} steps into the first scene as ${draft.characters[0]?.role ?? "the protagonist"} while the cast (${names.join(", ")}) reframes the stakes.`;

  const withPanels = regenerateMockComicPanels({
    ...draft,
    summary,
    chapterPreview,
  });

  return ensureDraftIntegrity(withPanels);
}

export function emptyCharacterTemplate(role = "Hero"): CharacterDraft {
  return {
    id: newCharacterId(),
    role,
    name: "",
    personality: "",
    visual: "",
  };
}
