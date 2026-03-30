import {
  defaultStoryWorld,
  type ComicPanelDraft,
  type CharacterDraft,
  type StoryDraft,
} from "@/app/lib/storyDraft";
import {
  characterConsistencyFromDraft,
  mergeCharacterConsistency,
} from "./character-consistency";
import type { CharacterConsistencyRules } from "./types";
import { getImageStylePreset } from "./style-presets";
import type { ImageFormatPresetId } from "./types";

function roleStyle(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("hero")) {
    return "Role styling: strong cinematic protagonist presence, confident posture, determined expression.";
  }
  if (r.includes("mentor")) {
    return "Role styling: older wise character, calm guiding expression, seasoned facial features.";
  }
  if (r.includes("villain")) {
    return "Role styling: dark threatening character, intense expression, ominous visual energy.";
  }
  return "Role styling: distinct character identity that clearly matches the provided role.";
}

function worldLine(draft: StoryDraft): string {
  const w = draft.storyWorld ?? defaultStoryWorld();
  const parts = [w.background, w.theme, w.tone, w.timePeriod].filter(
    (s) => typeof s === "string" && s.trim(),
  );
  return parts.length ? parts.join(" · ") : "a vivid story world";
}

/**
 * Builds a portrait prompt from character data, style preset, and consistency rules.
 */
export function buildCharacterPortraitPrompt(
  format: ImageFormatPresetId,
  character: CharacterDraft,
  consistencyOverride?: Partial<CharacterConsistencyRules>,
): string {
  const preset = getImageStylePreset(format);
  const consistency = mergeCharacterConsistency(
    characterConsistencyFromDraft(character),
    consistencyOverride,
  );

  const role = consistency.role;
  const name = consistency.name;
  const visual =
    character.visual?.trim() ||
    character.personality?.trim() ||
    consistency.clothing ||
    "distinct appearance";

  const traitLine = [
    consistency.age ? `Age: ${consistency.age}.` : "",
    consistency.facialTraits ? `Facial traits: ${consistency.facialTraits}.` : "",
    consistency.hairstyle ? `Hair: ${consistency.hairstyle}.` : "",
    consistency.clothing ? `Clothing: ${consistency.clothing}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const styleBlock = [
    `Preset art style: ${preset.artStyle}`,
    `Color mode: ${preset.colorMode}. Contrast: ${preset.contrast}.`,
    `Camera / framing: ${preset.cameraFraming}.`,
    `Portrait style: ${preset.portraitStyle}.`,
  ].join(" ");

  const base = [
    "close-up portrait of a fictional character",
    `Character portrait for ${name}.`,
    `Role: ${role}.`,
    traitLine,
    "Strict: face visible and centered as the main subject.",
    "Strict: upper body visible (shoulders/upper torso in frame).",
    "Strict: expression clearly visible.",
    "Strict: clothing must follow the character description.",
    roleStyle(role),
    "Background must be minimal, blurred, and secondary only.",
    "Forbidden as main subject: laptops, skies, landscapes, scenery, abstract backgrounds.",
    "No object-focused composition, no environment-focused composition, no distant framing, no full-body shot.",
    "Cinematic face framing with readable emotion and clear eye contact.",
    `Description: ${visual}.`,
    styleBlock,
    "Do not render any text, letters, logos, speech bubbles, or watermarks.",
  ]
    .filter(Boolean)
    .join(" ");

  return base.length > 3500 ? `${base.slice(0, 3497)}...` : base;
}

/**
 * Builds a single comic panel illustration prompt from scene + style preset + cast context.
 */
export function buildComicPanelImagePrompt(
  draft: StoryDraft,
  panel: ComicPanelDraft,
  index: number,
): string {
  const preset = getImageStylePreset(draft.format);
  const w = draft.storyWorld ?? defaultStoryWorld();
  const cast = draft.characters
    .slice(0, 4)
    .map((c) => `${c.name} (${c.role}): ${c.visual}`)
    .join(" | ");
  const safetyNoText =
    "Do not render any text, letters, captions, logos, speech bubbles, or watermarks in the image.";

  const styleGuide = [
    `Art style: ${preset.artStyle}`,
    `Color mode: ${preset.colorMode}. Contrast: ${preset.contrast}.`,
    `Camera: ${preset.cameraFraming}.`,
    `Panel style: ${preset.panelStyle}.`,
  ].join(" ");

  const base =
    panel.imagePrompt?.trim() ||
    [
      `Panel ${index + 1} of 4, ${panel.tone} story beat.`,
      `Series: ${draft.title}. ${worldLine(draft)}.`,
      cast ? `Characters (visual reference): ${cast.slice(0, 1800)}` : "",
      `Scene description: ${panel.sceneDescription || panel.caption}`,
      `Caption context: ${panel.caption}`,
      `Dialogue mood: ${panel.dialogue}`,
      styleGuide,
      "Illustration only: cinematic storytelling composition with clear focal character action.",
    ]
      .filter(Boolean)
      .join(" ");

  const parts = [
    base,
    base.toLowerCase().includes("do not render") ? "" : safetyNoText,
    `Series: ${draft.title}. ${worldLine(draft)}.`,
  ].filter(Boolean);
  const full = parts.join(" ");
  return full.length > 4000 ? full.slice(0, 3997) + "…" : full;
}
