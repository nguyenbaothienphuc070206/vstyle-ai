import { z } from 'zod';

export const GeminiFunctionalNeedCodeEnum = z.enum([
  'WHEELCHAIR_SEATED',
  'LIMITED_HAND_MOBILITY',
  'MATERIAL_SENSITIVITY',
  'LIMITED_STANDING',
  'LIMITED_MOBILITY',
]);

export const GeminiStyleIdEnum = z.enum([
  'TRUYEN_THONG_HOANG_GIA',
  'TRUYEN_THONG',
  'CONTEMPORARY',
  'TOI_GIAN',
  'NANG_DONG',
  'REMIX_GEN_Z',
  'SANG_TRONG',
  'THANH_LICH',
]);

export const GeminiConfirmationFieldEnum = z.enum([
  'event',
  'weather',
  'style',
  'color',
  'adaptiveNeeds',
]);

const HexColorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

/** Model text is trimmed and clipped instead of rejected, so a slightly long answer is still usable. */
const clippedText = (max: number) => z.string().trim().min(1).transform((value) => value.slice(0, max));

/** Keeps hashtags social-media safe: leading #, letters/numbers/underscore only, max 8. */
export function normalizeHashtags(tags: string[]): string[] {
  const cleaned = tags
    .map((tag) => `#${tag.replace(/^#+/, '').normalize('NFC').replace(/[^\p{L}\p{N}_]/gu, '')}`)
    .filter((tag) => tag.length > 1);
  return [...new Set(cleaned)].slice(0, 8);
}

export const GeminiParseRequestSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  allowedEvents: z.array(z.string().min(1)).max(32),
  allowedWeatherIds: z.array(z.string().min(1)).max(16),
  allowedStyles: z.array(GeminiStyleIdEnum).max(16),
  allowedColors: z.array(z.object({ name: z.string().min(1), hex: HexColorSchema })).max(128),
  allowedNeeds: z.array(GeminiFunctionalNeedCodeEnum).max(8),
  allowedGarments: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })).max(32).optional(),
  allowedAccessories: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })).max(64).optional(),
});
export type GeminiParseRequest = z.infer<typeof GeminiParseRequestSchema>;

/** Body accepted by POST /api/gemini/parse. Allow-lists are always computed on the server. */
export const GeminiParseApiRequestSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});
export type GeminiParseApiRequest = z.infer<typeof GeminiParseApiRequestSchema>;

export const GeminiParseModelOutputSchema = z.object({
  eventId: z.string().nullable().optional(),
  weatherId: z.string().nullable().optional(),
  styleId: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  needCodes: z.array(z.string()).optional(),
  garmentId: z.string().nullable().optional(),
  accessoryIds: z.array(z.string()).optional(),
  summary: z.string().optional(),
});
export type GeminiParseModelOutput = z.infer<typeof GeminiParseModelOutputSchema>;

export const GeminiParseResponseSchema = z.object({
  eventId: z.string().nullable(),
  weatherId: z.string().nullable(),
  styleId: GeminiStyleIdEnum.nullable(),
  color: HexColorSchema.nullable(),
  needCodes: z.array(GeminiFunctionalNeedCodeEnum),
  garmentId: z.string().nullable().default(null),
  accessoryIds: z.array(z.string()).default([]),
  confirmationRequired: z.array(GeminiConfirmationFieldEnum),
  summary: z.string(),
  usedFallback: z.boolean(),
});
export type GeminiParseResponse = z.infer<typeof GeminiParseResponseSchema>;

export const GeminiRecommendationContextSchema = z.object({
  eventId: z.string().min(1),
  location: z.string().max(160).optional(),
  weatherId: z.string().optional(),
  garmentPreferences: z.object({
    preferredGarmentIds: z.array(z.string()).optional(),
    preferredCategories: z.array(z.string()).optional(),
    excludedGarmentIds: z.array(z.string()).optional(),
  }).optional(),
  style: z.string().optional(),
  colorPreferences: z.array(z.string()).max(32).optional(),
  accessoryIds: z.array(z.string()).max(32).optional(),
  characterId: z.string().optional(),
  adaptiveNeedCode: GeminiFunctionalNeedCodeEnum.or(z.literal('NONE')).optional(),
  adaptiveNeedCodes: z.array(GeminiFunctionalNeedCodeEnum).max(8).optional(),
  limit: z.number().int().min(1).max(12).optional(),
});
export type GeminiRecommendationContext = z.infer<typeof GeminiRecommendationContextSchema>;

export const GeminiRecommendRequestSchema = z.object({
  context: GeminiRecommendationContextSchema,
  candidateIds: z.array(z.string().min(1)).min(1).max(12),
});
export type GeminiRecommendRequest = z.infer<typeof GeminiRecommendRequestSchema>;

export const GeminiRecommendModelOutputSchema = z.object({
  candidateIds: z.array(z.string()).max(3),
});
export type GeminiRecommendModelOutput = z.infer<typeof GeminiRecommendModelOutputSchema>;

export const GeminiRecommendResponseSchema = z.object({
  candidateIds: z.array(z.string()).max(3),
  usedFallback: z.boolean(),
});
export type GeminiRecommendResponse = z.infer<typeof GeminiRecommendResponseSchema>;

export const GeminiCultureResultSchema = z.object({
  status: z.enum(['KEEP', 'CONSIDER', 'WARNING']),
  score: z.number().min(0).max(100),
  ruleIds: z.array(z.string()),
  reasons: z.array(z.string()),
  retainedCharacteristics: z.array(z.string()),
  sourceIds: z.array(z.string()),
  nonNegotiablesSatisfied: z.boolean(),
});

export const GeminiSourceReferenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
});

export const GeminiAdaptiveAdjustmentContextSchema = z.object({
  id: z.string(),
  needName: z.string(),
  adjustment: z.string(),
  reason: z.string(),
  sourceId: z.string(),
});

export const GeminiExplainRequestSchema = z.object({
  garmentId: z.string().min(1),
  eventId: z.string().min(1),
  styleId: z.string(),
  primaryColor: HexColorSchema,
  accessoryIds: z.array(z.string()).max(32),
  adaptiveNeedCodes: z.array(GeminiFunctionalNeedCodeEnum).max(8).optional(),
});
export type GeminiExplainRequest = z.infer<typeof GeminiExplainRequestSchema>;

export const GeminiExplainModelOutputSchema = z.object({
  headline: clippedText(140),
  editorialReview: clippedText(700),
  culturalHarmony: clippedText(500),
  styleRemixVerdict: clippedText(400),
  adviceForWearing: z.array(clippedText(180)).transform((items) => items.slice(0, 5)),
});

export const GeminiExplainResponseSchema = GeminiExplainModelOutputSchema.extend({
  usedFallback: z.boolean(),
});
export type GeminiExplainResponse = z.infer<typeof GeminiExplainResponseSchema>;

export const GeminiCaptionRequestSchema = z.object({
  garmentId: z.string().min(1),
  eventId: z.string().min(1),
  styleId: z.string(),
  primaryColor: HexColorSchema,
  accessoryIds: z.array(z.string()).max(32),
  adaptiveNeedCodes: z.array(GeminiFunctionalNeedCodeEnum).max(8).optional(),
});
export type GeminiCaptionRequest = z.infer<typeof GeminiCaptionRequestSchema>;

export const GeminiCaptionModelOutputSchema = z.object({
  instagramCaption: clippedText(500),
  shortPunchyHook: clippedText(120),
  culturalHighlight: clippedText(240),
  hashtags: z.array(z.string()).transform(normalizeHashtags),
});

export const GeminiCaptionResponseSchema = GeminiCaptionModelOutputSchema.extend({
  usedFallback: z.boolean(),
});
export type GeminiCaptionResponse = z.infer<typeof GeminiCaptionResponseSchema>;


// ---------------------------------------------------------------------------
// Vision: user photo → palette + garment suggestions (Gemini image understanding)
// ---------------------------------------------------------------------------

const Base64ImageSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  // ~4.5 MB of base64 max; the browser downsizes photos before upload.
  data: z.string().min(16).max(6_000_000).regex(/^[A-Za-z0-9+/=]+$/),
});
export type Base64Image = z.infer<typeof Base64ImageSchema>;

export const GeminiVisionRequestSchema = z.object({
  image: Base64ImageSchema,
  note: z.string().trim().max(300).optional(),
});
export type GeminiVisionRequest = z.infer<typeof GeminiVisionRequestSchema>;

export const GeminiVisionModelOutputSchema = z.object({
  summary: clippedText(400),
  detectedItems: z.array(clippedText(80)).transform((items) => items.slice(0, 6)),
  dominantColors: z.array(z.object({ name: clippedText(60), hex: z.string() }))
    .transform((colors) => colors.filter((color) => HexColorSchema.safeParse(color.hex).success).slice(0, 5)),
  styleIds: z.array(z.string()).transform((items) => items.slice(0, 3)),
  suggestedGarmentIds: z.array(z.string()).transform((items) => items.slice(0, 3)),
  eventIds: z.array(z.string()).transform((items) => items.slice(0, 3)),
});
export type GeminiVisionModelOutput = z.infer<typeof GeminiVisionModelOutputSchema>;

export const GeminiColorMatchSchema = z.object({
  sourceHex: HexColorSchema,
  garmentId: z.string(),
  colorName: z.string(),
  colorHex: HexColorSchema,
  distance: z.number(),
});
export type GeminiColorMatch = z.infer<typeof GeminiColorMatchSchema>;

export const GeminiVisionResponseSchema = z.object({
  summary: z.string(),
  detectedItems: z.array(z.string()),
  dominantColors: z.array(z.object({ name: z.string(), hex: HexColorSchema })),
  styleId: GeminiStyleIdEnum.nullable(),
  suggestedGarmentIds: z.array(z.string()),
  eventId: z.string().nullable(),
  colorMatches: z.array(GeminiColorMatchSchema),
  usedFallback: z.boolean(),
});
export type GeminiVisionResponse = z.infer<typeof GeminiVisionResponseSchema>;

// ---------------------------------------------------------------------------
// Render: verified outfit data → illustrative image (Gemini native image generation)
// ---------------------------------------------------------------------------

export const GeminiRenderRequestSchema = z.object({
  garmentId: z.string().min(1),
  eventId: z.string().min(1),
  styleId: z.string().max(40),
  primaryColor: HexColorSchema,
  pantColor: HexColorSchema,
  accessoryIds: z.array(z.string()).max(12),
  characterId: z.string().min(1),
  skinTone: HexColorSchema.optional(),
  adaptiveNeedCodes: z.array(GeminiFunctionalNeedCodeEnum).max(5).optional(),
  referenceImage: Base64ImageSchema.optional(),
  consentToUseReference: z.boolean().optional(),
});
export type GeminiRenderRequest = z.infer<typeof GeminiRenderRequestSchema>;

export const GeminiRenderResponseSchema = z.object({
  imageDataUrl: z.string().startsWith('data:image/'),
  model: z.string(),
  usedReference: z.boolean(),
  checklist: z.array(z.string()),
});
export type GeminiRenderResponse = z.infer<typeof GeminiRenderResponseSchema>;
