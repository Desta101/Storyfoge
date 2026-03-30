import type { CharacterDraft } from "@/app/lib/storyDraft";
import type { CharacterConsistencyRules } from "./types";

/**
 * Default rules when only a `CharacterDraft` is available (structured fields may be empty).
 */
export function characterConsistencyFromDraft(
  c: CharacterDraft,
): CharacterConsistencyRules {
  const visual = c.visual?.trim() || "";
  return {
    name: c.name?.trim() || "Unnamed character",
    role: c.role?.trim() || "Character",
    age: undefined,
    facialTraits: undefined,
    hairstyle: undefined,
    clothing: visual || undefined,
    seed: c.id,
    referenceImageUrl:
      c.portraitUrl?.trim() || c.imageUrl?.trim() || undefined,
  };
}

export function mergeCharacterConsistency(
  base: CharacterConsistencyRules,
  patch?: Partial<CharacterConsistencyRules>,
): CharacterConsistencyRules {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    name: patch.name ?? base.name,
    role: patch.role ?? base.role,
  };
}

/** Empty template for tests or future UI that collects structured traits. */
export function emptyCharacterConsistencyRules(
  name: string,
  role: string,
): CharacterConsistencyRules {
  return {
    name,
    role,
  };
}
