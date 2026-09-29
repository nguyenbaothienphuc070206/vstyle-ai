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

export const GeminiParseRequestSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  allowedEvents: z.array(z.string().min(1)).max(32),
  allowedWeatherIds: z.array(z.string().min(1)).max(16),
  allowedStyles: z.array(GeminiStyleIdEnum).max(16),
  allowedColors: z.array(z.object({ name: z.string().min(1), hex: HexColorSchema })).max(128),
  allowedNeeds: z.array(GeminiFunctionalNeedCodeEnum).max(8),
});
export type GeminiParseRequest = z.infer<typeof GeminiParseRequestSchema>;

export const GeminiParseModelOutputSchema = z.object({
  eventId: z.string().nullable().optional(),
  weatherId: z.string().nullable().optional(),
  styleId: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  needCodes: z.array(z.string()).optional(),
  summary: z.string().optional(),
});
export type GeminiParseModelOutput = z.infer<typeof GeminiParseModelOutputSchema>;

export const GeminiParseResponseSchema = z.object({
  eventId: z.string().nullable(),
  weatherId: z.string().nullable(),
  styleId: GeminiStyleIdEnum.nullable(),
  color: HexColorSchema.nullable(),
  needCodes: z.array(GeminiFunctionalNeedCodeEnum),
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
  headline: z.string().min(1).max(140),
  editorialReview: z.string().min(1).max(700),
  culturalHarmony: z.string().min(1).max(500),
  styleRemixVerdict: z.string().min(1).max(400),
  adviceForWearing: z.array(z.string().min(1).max(180)).max(5),
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
  instagramCaption: z.string().min(1).max(500),
  shortPunchyHook: z.string().min(1).max(120),
  culturalHighlight: z.string().min(1).max(240),
  hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u)).max(8),
});

export const GeminiCaptionResponseSchema = GeminiCaptionModelOutputSchema.extend({
  usedFallback: z.boolean(),
});
export type GeminiCaptionResponse = z.infer<typeof GeminiCaptionResponseSchema>;
