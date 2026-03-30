import type { ImageFormatPresetId, ImageStylePreset } from "./types";

export const IMAGE_STYLE_PRESETS: Record<ImageFormatPresetId, ImageStylePreset> = {
  manga: {
    id: "manga",
    label: "Manga",
    artStyle:
      "Black-and-white manga illustration, rich ink shading, clean line weight, dynamic manga composition.",
    colorMode: "grayscale (black and white only)",
    contrast: "high dramatic contrast, deep blacks and bright highlights",
    cameraFraming:
      "cinematic manga framing, dynamic angles, character-forward shots, expressive close-ups",
    portraitStyle:
      "anime/manga close-up portrait, cinematic face framing, dramatic face lighting, strong contrast, expressive eyes, hero/villain/mentor portrait language",
    panelStyle:
      "sequential manga panels, cinematic manga composition, dramatic contrast, dynamic speed lines, character-focused framing",
  },
  comic: {
    id: "comic",
    label: "Comic",
    artStyle:
      "Full-color comic-book illustration, bold ink outlines, polished rendering, premium sequential art.",
    colorMode: "full color, vibrant balanced palette",
    contrast: "dramatic lighting with readable midtones",
    cameraFraming:
      "cinematic comic framing, heroic wides and tight emotional close-ups",
    portraitStyle:
      "full-color comic-book close-up portrait, cinematic face framing, expressive eyes, dramatic facial lighting, bold linework",
    panelStyle:
      "cinematic comic panels, dramatic lighting, bold ink outlines, clear focal action, readable silhouettes",
  },
};

export function getImageStylePreset(format: ImageFormatPresetId): ImageStylePreset {
  return IMAGE_STYLE_PRESETS[format];
}
