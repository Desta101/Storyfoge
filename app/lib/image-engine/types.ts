/** Story format drives which style preset is applied. */
export type ImageFormatPresetId = "manga" | "comic";

/**
 * Reusable visual recipe for a format (manga vs comic).
 * Used by the prompt builder and future private style systems.
 */
export type ImageStylePreset = {
  id: ImageFormatPresetId;
  label: string;
  /** Overall illustration language (e.g. ink, line weight, rendering). */
  artStyle: string;
  /** e.g. grayscale vs full color. */
  colorMode: string;
  /** Contrast / tonal direction. */
  contrast: string;
  /** Typical shot language for scenes and portraits. */
  cameraFraming: string;
  /** How character portraits should read in this format. */
  portraitStyle: string;
  /** How sequential / panel artwork should read. */
  panelStyle: string;
};

/**
 * Structured rules for keeping a character visually consistent across generations.
 * Maps to future seed/reference workflows; some fields may be inferred from `CharacterDraft`.
 */
export type CharacterConsistencyRules = {
  name: string;
  role: string;
  age?: string;
  facialTraits?: string;
  hairstyle?: string;
  clothing?: string;
  /** Stable id for reproducibility / future provider seeds. */
  seed?: string;
  /** Future: reference portrait URL or storage key for img2img / style lock. */
  referenceImageUrl?: string;
};

export type PortraitImageRequest = {
  prompt: string;
  characterId?: string;
  format?: ImageFormatPresetId;
};

export type PanelImageRequest = {
  prompt: string;
  panelIndex?: number;
};

export type ImageGenerationResult = {
  mimeType: string;
  /** Raw base64 image bytes (API response form). */
  imageBytes: string;
  dataUrl: string;
};

/**
 * Pluggable image backend (Gemini today, private engine tomorrow).
 */
export type ImageEngineProvider = {
  generatePortrait(request: PortraitImageRequest): Promise<ImageGenerationResult>;
  generatePanelImage(request: PanelImageRequest): Promise<ImageGenerationResult>;
};
