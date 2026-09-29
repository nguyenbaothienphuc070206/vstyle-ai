import type { CultureCheckResult, Garment } from '../../types/domain.ts';
import {
  GeminiCaptionModelOutputSchema,
  GeminiExplainModelOutputSchema,
  GeminiFunctionalNeedCodeEnum,
  GeminiParseModelOutputSchema,
  GeminiParseResponseSchema,
  GeminiRecommendModelOutputSchema,
  GeminiStyleIdEnum,
  GeminiVisionModelOutputSchema,
  type GeminiCaptionResponse,
  type GeminiColorMatch,
  type GeminiExplainResponse,
  type GeminiParseRequest,
  type GeminiParseResponse,
  type GeminiRecommendRequest,
  type GeminiRecommendResponse,
  type GeminiRenderRequest,
  type GeminiVisionRequest,
  type GeminiVisionResponse,
} from '../../types/gemini.ts';
import {
  getAdaptiveNeeds,
  getApprovedAccessories,
  getApprovedGarments,
  getApprovedSources,
  getCharacterById,
  getEventById,
  getEvents,
  getValidatedAdaptiveAdjustments,
} from '../dal/index.ts';
import { checkCulture } from '../culture/ruleEngine.ts';
import { nearestColor } from '../color/colorMath.ts';
import { mapSafeStylingPrompt } from '../recommendation/promptMapper.ts';
import type { DeterministicRecommendation } from '../recommendation/engine.ts';
import {
  failureKindFrom,
  generateStructuredJson,
  withTimeout,
  type GeminiFailureKind,
  type GeminiImageProvider,
  type GeminiTextProvider,
  type GeminiThinkingLevel,
  type StructuredGenerationResult,
} from './generation.ts';

export interface GeminiServiceConfig {
  provider?: GeminiTextProvider;
  model: string;
  imageProvider?: GeminiImageProvider;
  imageModel?: string;
  thinkingLevel?: GeminiThinkingLevel;
  timeoutMs?: number;
  imageTimeoutMs?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface GeminiExplainPromptContext {
  garmentName: string;
  eventName: string;
  styleId: string;
  primaryColor: string;
  accessoryNames: string[];
  cultureResult: CultureCheckResult;
  retainedCharacteristics: string[];
  sources: Array<{ id: string; title: string; publisher: string }>;
  adaptiveAdjustment?: { id: string; needName: string; adjustment: string; reason: string; sourceId: string };
}

export interface GeminiCaptionPromptContext {
  garmentName: string;
  styleTitle: string;
  eventTitle: string;
  chuanScore: number;
  chatScore: number;
  vibe: string;
  cultureReasons: string[];
  retainedCharacteristics: string[];
  sources: Array<{ id: string; title: string; publisher: string }>;
}

/** Shared voice for every Vietnamese text Gemini writes for Vstyle. */
const VOICE = [
  'Write every string value in natural Vietnamese with full diacritics (tiếng Việt có dấu).',
  'Voice: a warm, witty stylist who talks to Vietnamese Gen Z students — confident, concise, respectful of heritage.',
  'Never mock tradition, never use slurs or crude slang, at most one emoji per field.',
].join(' ');

const NONE = 'NONE';

const MANUAL_PARSE_FALLBACK: GeminiParseResponse = {
  eventId: null,
  weatherId: null,
  styleId: null,
  color: null,
  needCodes: [],
  garmentId: null,
  accessoryIds: [],
  confirmationRequired: ['event', 'weather', 'style', 'color', 'adaptiveNeeds'],
  summary: 'Chưa thể nhận diện chắc chắn. Vui lòng chọn thủ công các thông tin bên dưới.',
  usedFallback: true,
};

function baseOptions(config: GeminiServiceConfig) {
  return {
    provider: config.provider,
    model: config.model,
    thinkingLevel: config.thinkingLevel,
    timeoutMs: config.timeoutMs,
    retryDelayMs: config.retryDelayMs,
    sleep: config.sleep,
  };
}

const stringEnum = (values: string[], description?: string) => ({
  type: 'string',
  enum: values.length ? values : [NONE],
  ...(description ? { description } : {}),
});

// ---------------------------------------------------------------------------
// 1. Natural-language request → structured, allow-listed preferences
// ---------------------------------------------------------------------------

function checkedParseResponse(
  output: ReturnType<typeof GeminiParseModelOutputSchema.parse>,
  request: GeminiParseRequest,
  usedFallback: boolean,
): GeminiParseResponse {
  const confirmationRequired = new Set<GeminiParseResponse['confirmationRequired'][number]>();
  const clean = (value: string | null | undefined) => (value && value !== NONE ? value : null);

  const requestedEvent = clean(output.eventId);
  const eventId = requestedEvent && request.allowedEvents.includes(requestedEvent) ? requestedEvent : null;
  if (requestedEvent && !eventId) confirmationRequired.add('event');

  const requestedWeather = clean(output.weatherId);
  const weatherId = requestedWeather && request.allowedWeatherIds.includes(requestedWeather) ? requestedWeather : null;
  if (requestedWeather && !weatherId) confirmationRequired.add('weather');

  const requestedStyle = clean(output.styleId);
  const styleId = requestedStyle && request.allowedStyles.includes(requestedStyle as GeminiParseRequest['allowedStyles'][number])
    ? requestedStyle as GeminiParseRequest['allowedStyles'][number]
    : null;
  if (requestedStyle && !styleId) confirmationRequired.add('style');

  const requestedColor = clean(output.color)?.trim().toLowerCase();
  const matchedColor = requestedColor
    ? request.allowedColors.find((color) =>
      color.hex.toLowerCase() === requestedColor || color.name.trim().toLowerCase() === requestedColor)
    : undefined;
  if (requestedColor && !matchedColor) confirmationRequired.add('color');

  const requestedNeeds = (output.needCodes ?? []).filter((code) => code !== NONE);
  const allowedNeeds = new Set(request.allowedNeeds);
  const needCodes = [...new Set(requestedNeeds.filter((code) =>
    GeminiFunctionalNeedCodeEnum.safeParse(code).success && allowedNeeds.has(code as GeminiParseRequest['allowedNeeds'][number]),
  ))] as GeminiParseResponse['needCodes'];
  if (requestedNeeds.some((code) => !needCodes.includes(code as GeminiParseResponse['needCodes'][number]))) {
    confirmationRequired.add('adaptiveNeeds');
  }

  const allowedGarmentIds = new Set((request.allowedGarments ?? []).map((garment) => garment.id));
  const requestedGarment = clean(output.garmentId);
  const garmentId = requestedGarment && allowedGarmentIds.has(requestedGarment) ? requestedGarment : null;

  const allowedAccessoryIds = new Set((request.allowedAccessories ?? []).map((accessory) => accessory.id));
  const accessoryIds = [...new Set((output.accessoryIds ?? []).filter((id) => allowedAccessoryIds.has(id)))].slice(0, 4);

  if (usedFallback) {
    ['event', 'weather', 'style', 'color', 'adaptiveNeeds'].forEach((field) =>
      confirmationRequired.add(field as GeminiParseResponse['confirmationRequired'][number]),
    );
  }

  return GeminiParseResponseSchema.parse({
    eventId,
    weatherId,
    styleId,
    color: matchedColor?.hex ?? null,
    needCodes,
    garmentId,
    accessoryIds,
    confirmationRequired: [...confirmationRequired],
    summary: output.summary?.trim().slice(0, 240) || MANUAL_PARSE_FALLBACK.summary,
    usedFallback,
  });
}

export function buildParseJsonSchema(request: GeminiParseRequest): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      eventId: stringEnum([...request.allowedEvents, NONE], 'Occasion ID, NONE if the user did not say.'),
      weatherId: stringEnum([...request.allowedWeatherIds, NONE], 'Weather ID, NONE if not mentioned.'),
      styleId: stringEnum([...request.allowedStyles, NONE], 'Style ID, NONE if not mentioned.'),
      color: stringEnum([...request.allowedColors.map((color) => color.hex), NONE], 'Closest allowed colour hex, NONE if no colour was requested.'),
      needCodes: { type: 'array', items: stringEnum([...request.allowedNeeds, NONE]), maxItems: 5 },
      garmentId: stringEnum([...(request.allowedGarments ?? []).map((garment) => garment.id), NONE], 'Garment ID only if the user named or clearly described it.'),
      accessoryIds: { type: 'array', items: stringEnum([...(request.allowedAccessories ?? []).map((accessory) => accessory.id), NONE]), maxItems: 4 },
      summary: { type: 'string', description: 'One Vietnamese sentence restating what the user asked for.' },
    },
    required: ['eventId', 'weatherId', 'styleId', 'color', 'needCodes', 'garmentId', 'accessoryIds', 'summary'],
  };
}

export async function parseStylingText(
  request: GeminiParseRequest,
  config: GeminiServiceConfig,
): Promise<GeminiParseResponse> {
  const result = await generateStructuredJson({
    ...baseOptions(config),
    systemInstruction: [
      'You are the Vstyle preference parser. You turn a Vietnamese (or English) outfit request into IDs.',
      'You are not a cultural authority: never invent an event, weather, style, colour, garment, accessory, need or fact.',
      'Choose values only from the supplied allow-lists; answer NONE when the user did not clearly say it.',
      'Map colour words to the closest allowed hex (e.g. "xanh thiên thanh" → a sky-blue hex, "đỏ" → a red hex).',
      'Only return an adaptive need when the user explicitly states it about themselves (e.g. "mình ngồi xe lăn"). Never infer needs from age, appearance or context.',
      'The summary must be one short Vietnamese sentence. Return JSON only.',
    ].join(' '),
    prompt: JSON.stringify({
      userRequest: request.text,
      allowedEvents: request.allowedEvents,
      allowedWeatherIds: request.allowedWeatherIds,
      allowedStyles: request.allowedStyles,
      allowedColors: request.allowedColors,
      allowedNeeds: request.allowedNeeds,
      allowedGarments: request.allowedGarments ?? [],
      allowedAccessories: request.allowedAccessories ?? [],
    }),
    schema: GeminiParseModelOutputSchema,
    jsonSchema: buildParseJsonSchema(request),
    fallback: () => ({ eventId: null, weatherId: null, styleId: null, color: null, needCodes: [], garmentId: null, accessoryIds: [], summary: '' }),
    maxOutputTokens: 2048,
  });
  if (result.usedFallback) return keywordParseFallback(request);
  return checkedParseResponse(result.value, request, false);
}

/**
 * Offline fallback: explicit Vietnamese keywords only (e.g. "tốt nghiệp", "trời nóng", "tối giản").
 * Anything not matched stays empty and is flagged for manual confirmation.
 */
export function keywordParseFallback(request: GeminiParseRequest): GeminiParseResponse {
  const mapping = mapSafeStylingPrompt(request.text);
  const checked = checkedParseResponse({
    eventId: mapping.eventId ?? null,
    weatherId: mapping.weatherId ?? null,
    styleId: mapping.styleId ?? null,
    color: null,
    needCodes: mapping.needCodes,
    garmentId: mapping.garmentId ?? null,
    accessoryIds: [],
    summary: '',
  }, request, false);
  const confirmationRequired = new Set(checked.confirmationRequired);
  if (!checked.eventId) confirmationRequired.add('event');
  if (!checked.weatherId) confirmationRequired.add('weather');
  if (!checked.styleId) confirmationRequired.add('style');
  confirmationRequired.add('color');
  const found = [checked.eventId, checked.weatherId, checked.styleId, checked.garmentId].filter(Boolean).length + checked.needCodes.length;
  return {
    ...checked,
    confirmationRequired: [...confirmationRequired],
    summary: found
      ? 'Gemini chưa sẵn sàng nên Vstyle nhận diện theo từ khóa. Hãy kiểm tra lại các lựa chọn.'
      : MANUAL_PARSE_FALLBACK.summary,
    usedFallback: true,
  };
}

// ---------------------------------------------------------------------------
// 2. Rank deterministic, culture-checked candidates (Gemini never creates outfits)
// ---------------------------------------------------------------------------

function getSafeCandidateDetails(candidates: DeterministicRecommendation[]) {
  const garments = new Map(getApprovedGarments().map((garment) => [garment.id, garment]));
  const accessories = new Map(getApprovedAccessories().map((accessory) => [accessory.id, accessory]));
  const approvedSources = new Map(getApprovedSources().map((source) => [source.id, source]));
  const adjustments = new Map(getValidatedAdaptiveAdjustments().map((adjustment) => [adjustment.id, adjustment]));

  return candidates.flatMap((candidate) => {
    const garment = garments.get(candidate.garmentId);
    const candidateAccessories = candidate.accessoryIds.map((id) => accessories.get(id));
    if (!garment || candidateAccessories.some((item) => !item)) return [];

    const cultureResult = checkCulture({
      garmentId: candidate.garmentId,
      accessoryIds: candidate.accessoryIds,
      eventId: candidate.eventId,
      primaryColor: candidate.color,
    });
    if (cultureResult.status === 'WARNING') return [];

    return [{
      candidateId: candidate.outfitId,
      garment: { id: garment.id, name: garment.name },
      accessories: candidateAccessories.map((item) => ({ id: item!.id, name: item!.name })),
      color: candidate.color,
      colorName: garment.baseColors.find((color) => color.hex.toLowerCase() === candidate.color.toLowerCase())?.name,
      style: candidate.style,
      deterministicScore: candidate.score,
      reasons: candidate.reasons.slice(0, 4),
      cultureStatus: cultureResult.status,
      cultureScore: cultureResult.score,
      sources: cultureResult.sourceIds.flatMap((id) => {
        const source = approvedSources.get(id);
        return source ? [{ id: source.id, title: source.title }] : [];
      }),
      adaptiveAdjustments: candidate.adaptiveAdjustmentIds.flatMap((id) => {
        const adjustment = adjustments.get(id);
        if (!adjustment || !approvedSources.has(adjustment.sourceId)) return [];
        return [{ id: adjustment.id, needName: adjustment.needName, adjustment: adjustment.adjustment }];
      }),
    }];
  });
}

export async function rankGeminiCandidates(
  request: GeminiRecommendRequest,
  availableCandidates: DeterministicRecommendation[],
  config: GeminiServiceConfig,
): Promise<GeminiRecommendResponse> {
  const requestedIds = new Set(request.candidateIds);
  const allowedCandidates = availableCandidates
    .filter((candidate) => requestedIds.has(candidate.outfitId) && (candidate.cultureStatus as string) !== 'WARNING')
    .slice(0, 12);
  const fallback = (usedFallback = true): GeminiRecommendResponse => ({
    candidateIds: allowedCandidates.slice(0, 3).map((candidate) => candidate.outfitId),
    usedFallback,
  });
  if (!allowedCandidates.length) return fallback();

  const allowedIds = [...new Set(allowedCandidates.map((candidate) => candidate.outfitId))];
  const allowedIdSet = new Set(allowedIds);
  const generation: StructuredGenerationResult<ReturnType<typeof GeminiRecommendModelOutputSchema.parse>> = await generateStructuredJson({
    ...baseOptions(config),
    systemInstruction: [
      'You rank candidate outfits for Vstyle, a Vietnamese heritage-clothing stylist for Gen Z.',
      'Every candidate already passed a deterministic cultural rule engine; treat cultureStatus, scores, reasons and sources as fixed facts.',
      'Rank by how well each candidate fits the user context (occasion, weather, requested style, colour, adaptive needs), prefer cultureStatus KEEP, and keep the top three visually diverse (different garments or colours).',
      'Never create, rename or alter outfits or IDs. Return one to three distinct candidateId values from the list, best first, as JSON.',
    ].join(' '),
    prompt: JSON.stringify({ context: request.context, candidates: getSafeCandidateDetails(allowedCandidates) }),
    schema: GeminiRecommendModelOutputSchema,
    jsonSchema: {
      type: 'object',
      properties: { candidateIds: { type: 'array', items: stringEnum(allowedIds), minItems: 1, maxItems: 3 } },
      required: ['candidateIds'],
    },
    fallback: () => ({ candidateIds: fallback().candidateIds }),
    validate: (value) => value.candidateIds.length > 0 &&
      value.candidateIds.length <= 3 &&
      new Set(value.candidateIds).size === value.candidateIds.length &&
      value.candidateIds.every((id) => allowedIdSet.has(id)),
    maxOutputTokens: 2048,
  });
  return {
    candidateIds: generation.value.candidateIds,
    usedFallback: generation.usedFallback,
  };
}

// ---------------------------------------------------------------------------
// 3. Stylist commentary grounded in the fixed cultural result
// ---------------------------------------------------------------------------

function fallbackExplanation(request: GeminiExplainPromptContext): GeminiExplainResponse {
  const observedReasons = request.cultureResult.reasons.slice(0, 3);
  const retained = request.retainedCharacteristics.slice(0, 3);
  return {
    headline: `${request.garmentName} · ${request.eventName}`.slice(0, 140),
    editorialReview: `Bản phối kết hợp ${request.garmentName} với phong cách ${request.styleId.replaceAll('_', ' ').toLowerCase()} cho ${request.eventName}. Đây là bản minh họa theo dữ liệu Vstyle, không phải thử đồ thực tế.`,
    culturalHarmony: observedReasons.join(' ') || `Kết quả kiểm tra văn hóa: ${request.cultureResult.status}, ${request.cultureResult.score}/100.`,
    styleRemixVerdict: `Điểm Chuẩn ${request.cultureResult.score}/100 và phong cách được đánh giá riêng; phần giải thích không thay đổi kết quả văn hóa.`,
    adviceForWearing: retained.length ? retained : ['Tham khảo kết quả và nguồn đã xác minh trong thẻ Chuẩn văn hóa.'],
    usedFallback: true,
  };
}

const EXPLAIN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'Catchy Vietnamese title, max 12 words.' },
    editorialReview: { type: 'string', description: '2-3 Vietnamese sentences on why the look works for the occasion.' },
    culturalHarmony: { type: 'string', description: 'Paraphrase ONLY the supplied cultural reasons/characteristics.' },
    styleRemixVerdict: { type: 'string', description: 'How the look balances heritage and Gen Z remix, 1-2 sentences.' },
    adviceForWearing: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
  },
  required: ['headline', 'editorialReview', 'culturalHarmony', 'styleRemixVerdict', 'adviceForWearing'],
};

export async function explainStyling(
  request: GeminiExplainPromptContext,
  config: GeminiServiceConfig,
): Promise<GeminiExplainResponse> {
  const result = await generateStructuredJson({
    ...baseOptions(config),
    systemInstruction: [
      'You are the Vstyle stylist. Explain the supplied outfit and its fixed cultural result.',
      'The culture status, score, rule reasons, retained characteristics and sources are immutable facts: never revise, contradict or add to them.',
      'Do not add historical claims, dates, dynasties, materials or rules that are not in the input. If evidence is thin, say so plainly.',
      'Practical wearing advice may cover posture, movement, layering and care, but must not state new cultural facts.',
      'If an adaptive adjustment is supplied, mention it with dignity as a tailoring choice, never as a limitation.',
      VOICE,
      'Keep headline ≤ 90 characters, each other field ≤ 420 characters. Return JSON only.',
    ].join(' '),
    prompt: JSON.stringify(request),
    schema: GeminiExplainModelOutputSchema,
    jsonSchema: EXPLAIN_JSON_SCHEMA,
    fallback: () => {
      const { usedFallback: _usedFallback, ...output } = fallbackExplanation(request);
      return output;
    },
    maxOutputTokens: 2048,
  });
  return { ...result.value, usedFallback: result.usedFallback };
}

function fallbackCaption(request: GeminiCaptionPromptContext): GeminiCaptionResponse {
  const fact = request.retainedCharacteristics[0] ?? request.cultureReasons[0] ?? '';
  const highlight = fact
    ? `Đặc trưng trong dữ liệu: ${fact}`.slice(0, 240)
    : `Kết quả kiểm tra Chuẩn ${request.chuanScore}/100.`;
  return {
    instagramCaption: `Diện ${request.garmentName} cho ${request.eventTitle}, theo phong cách ${request.vibe.replaceAll('_', ' ').toLowerCase()}. Chuẩn ${request.chuanScore}/100 · Chất ${request.chatScore}/100. #Vstyle #VietPhucRemix`,
    shortPunchyHook: `${request.garmentName}, chọn theo gu của bạn.`.slice(0, 120),
    culturalHighlight: highlight,
    hashtags: ['#Vstyle', '#VietPhucRemix'],
    usedFallback: true,
  };
}

export async function createGeminiCaption(
  request: GeminiCaptionPromptContext,
  config: GeminiServiceConfig,
): Promise<GeminiCaptionResponse> {
  const result = await generateStructuredJson({
    ...baseOptions(config),
    systemInstruction: [
      'Write a short social caption (Instagram/TikTok) for the supplied Vstyle outfit.',
      'Do not invent historical or cultural facts, rules, materials or provenance; the cultural highlight must paraphrase a supplied reason or retained characteristic.',
      'Do not claim this is a real try-on or a real photo.',
      VOICE,
      'instagramCaption ≤ 450 characters, shortPunchyHook ≤ 110 characters, culturalHighlight ≤ 230 characters, 3-6 hashtags without spaces or diacritics (letters, numbers, underscore). Return JSON only.',
    ].join(' '),
    prompt: JSON.stringify(request),
    schema: GeminiCaptionModelOutputSchema,
    jsonSchema: {
      type: 'object',
      properties: {
        instagramCaption: { type: 'string' },
        shortPunchyHook: { type: 'string' },
        culturalHighlight: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
      },
      required: ['instagramCaption', 'shortPunchyHook', 'culturalHighlight', 'hashtags'],
    },
    fallback: () => {
      const { usedFallback: _usedFallback, ...output } = fallbackCaption(request);
      return output;
    },
    maxOutputTokens: 2048,
  });
  return { ...result.value, usedFallback: result.usedFallback };
}

export function approvedSourceReferences(sourceIds: string[]) {
  const sources = new Map(getApprovedSources().map((source) => [source.id, source]));
  return sourceIds.flatMap((id) => {
    const source = sources.get(id);
    return source ? [{ id: source.id, title: source.title, publisher: source.publisher }] : [];
  });
}

// ---------------------------------------------------------------------------
// 4. Vision: the user's photo (fabric, favourite outfit, colour inspiration) → palette + suggestions
// ---------------------------------------------------------------------------

export function matchPaletteToGarments(
  colors: Array<{ hex: string }>,
  garmentIds: string[],
): GeminiColorMatch[] {
  const garments = getApprovedGarments();
  const preferred = garmentIds.length
    ? garmentIds.flatMap((id) => garments.filter((garment) => garment.id === id))
    : garments;
  const matches: GeminiColorMatch[] = [];
  for (const color of colors.slice(0, 3)) {
    let best: GeminiColorMatch | null = null;
    for (const garment of preferred) {
      const nearest = nearestColor(color.hex, garment.baseColors);
      if (nearest && (!best || nearest.distance < best.distance)) {
        best = {
          sourceHex: color.hex,
          garmentId: garment.id,
          colorName: nearest.color.name,
          colorHex: nearest.color.hex,
          distance: Math.round(nearest.distance * 10) / 10,
        };
      }
    }
    if (best) matches.push(best);
  }
  return matches.sort((left, right) => left.distance - right.distance);
}

function visionFallback(): GeminiVisionResponse {
  return {
    summary: 'Chưa phân tích được ảnh lúc này. Bạn vẫn có thể chọn màu và y phục thủ công.',
    detectedItems: [],
    dominantColors: [],
    styleId: null,
    suggestedGarmentIds: [],
    eventId: null,
    colorMatches: [],
    usedFallback: true,
  };
}

export async function analyzeOutfitPhoto(
  request: GeminiVisionRequest,
  config: GeminiServiceConfig,
): Promise<GeminiVisionResponse> {
  const garments = getApprovedGarments().map((garment) => ({ id: garment.id, name: garment.name, styleTags: garment.styleTags }));
  const events = getEvents().map((event) => ({ id: event.id, name: event.name }));
  const styles = GeminiStyleIdEnum.options;

  const result = await generateStructuredJson({
    ...baseOptions(config),
    images: [{ mimeType: request.image.mimeType, data: request.image.data }],
    systemInstruction: [
      'You look at a photo a Vietnamese student uploaded as outfit inspiration (fabric, a favourite outfit, a colour mood, or themselves).',
      'Describe only clothing, fabrics, patterns and colours. If a person is visible, NEVER comment on or infer their body shape, weight, skin, face, age, gender, ethnicity, health or attractiveness.',
      'Pick up to 5 dominant clothing/fabric colours as hex values with short Vietnamese colour names (ignore background and skin).',
      'Suggest up to 3 garment IDs and up to 2 style IDs from the allow-lists that would echo the photo\'s mood; suggest an event only if the photo clearly implies one.',
      VOICE,
      'summary: 1-2 Vietnamese sentences. Return JSON only.',
    ].join(' '),
    prompt: JSON.stringify({
      userNote: request.note ?? '',
      allowedGarments: garments,
      allowedStyleIds: styles,
      allowedEventIds: events,
    }),
    schema: GeminiVisionModelOutputSchema,
    jsonSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        detectedItems: { type: 'array', items: { type: 'string' }, maxItems: 6 },
        dominantColors: {
          type: 'array',
          maxItems: 5,
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, hex: { type: 'string', description: '#RRGGBB' } },
            required: ['name', 'hex'],
          },
        },
        styleIds: { type: 'array', items: stringEnum(styles), maxItems: 2 },
        suggestedGarmentIds: { type: 'array', items: stringEnum(garments.map((garment) => garment.id)), maxItems: 3 },
        eventIds: { type: 'array', items: stringEnum(events.map((event) => event.id)), maxItems: 2 },
      },
      required: ['summary', 'detectedItems', 'dominantColors', 'styleIds', 'suggestedGarmentIds', 'eventIds'],
    },
    fallback: () => ({ summary: '', detectedItems: [], dominantColors: [], styleIds: [], suggestedGarmentIds: [], eventIds: [] }),
    timeoutMs: config.timeoutMs ?? 20000,
    maxOutputTokens: 2048,
  });

  if (result.usedFallback) return visionFallback();

  const garmentIds = new Set(garments.map((garment) => garment.id));
  const eventIds = new Set(events.map((event) => event.id));
  const suggestedGarmentIds = [...new Set(result.value.suggestedGarmentIds.filter((id) => garmentIds.has(id)))];
  const styleId = result.value.styleIds
    .map((id) => GeminiStyleIdEnum.safeParse(id))
    .find((parsed) => parsed.success)?.data ?? null;
  const eventId = result.value.eventIds.find((id) => eventIds.has(id)) ?? null;
  const dominantColors = result.value.dominantColors.slice(0, 5);

  return {
    summary: result.value.summary.slice(0, 400),
    detectedItems: result.value.detectedItems.slice(0, 6),
    dominantColors,
    styleId,
    suggestedGarmentIds,
    eventId,
    colorMatches: matchPaletteToGarments(dominantColors, suggestedGarmentIds),
    usedFallback: false,
  };
}

// ---------------------------------------------------------------------------
// 5. Render: verified outfit data → illustrative image (Nano Banana)
// ---------------------------------------------------------------------------

export interface RenderPromptResult {
  prompt: string;
  checklist: string[];
  usesReference: boolean;
}

const STYLE_DIRECTION: Record<string, string> = {
  TRUYEN_THONG_HOANG_GIA: 'classic and restrained, heritage portrait mood',
  TRUYEN_THONG: 'classic and restrained, heritage portrait mood',
  CONTEMPORARY: 'contemporary editorial, clean modern styling',
  TOI_GIAN: 'minimal, clean lines, calm neutral backdrop',
  NANG_DONG: 'youthful and energetic, candid movement',
  REMIX_GEN_Z: 'Gen Z street-editorial energy, playful but respectful',
  SANG_TRONG: 'elegant evening mood, soft dramatic light',
  THANH_LICH: 'graceful and polished',
};

const EVENT_SCENES: Record<string, string> = {
  EVENT_TET: 'a Vietnamese Tết setting with peach blossoms (hoa đào) and apricot blossoms (hoa mai)',
  EVENT_GRADUATION: 'a university campus graduation day in Vietnam',
  EVENT_YEARBOOK: 'a school yearbook photo spot at a Vietnamese heritage courtyard',
  EVENT_CULTURAL: 'a heritage exhibition hall with warm museum lighting',
  EVENT_FESTIVAL: 'a Northern Vietnamese village festival courtyard',
  EVENT_CONCERT: 'a traditional music concert foyer at night',
  EVENT_WEDDING: 'a Vietnamese family wedding ceremony (lễ gia tiên) setting',
  EVENT_CASUAL: 'an old-quarter street café in Vietnam',
};

export function buildOutfitRenderPrompt(request: GeminiRenderRequest): RenderPromptResult | null {
  const garment: Garment | undefined = getApprovedGarments().find((item) => item.id === request.garmentId);
  const event = getEventById(request.eventId);
  const character = getCharacterById(request.characterId);
  if (!garment || !event || !character) return null;
  const color = garment.baseColors.find((item) => item.hex.toLowerCase() === request.primaryColor.toLowerCase());
  if (!color) return null;

  const accessoryMap = new Map(getApprovedAccessories().map((accessory) => [accessory.id, accessory]));
  const accessories = request.accessoryIds.flatMap((id) => {
    const accessory = accessoryMap.get(id);
    return accessory && accessory.compatibleGarmentIds.includes(garment.id) ? [accessory] : [];
  });
  const approvedSourceIds = new Set(getApprovedSources().map((source) => source.id));
  const needCodes = request.adaptiveNeedCodes ?? [];
  const adjustments = getValidatedAdaptiveAdjustments().filter((adjustment) =>
    needCodes.includes(adjustment.needCode) &&
    approvedSourceIds.has(adjustment.sourceId) &&
    (adjustment.garmentId === 'ALL' || adjustment.garmentId === garment.id),
  );
  const needs = getAdaptiveNeeds().filter((need) => needCodes.includes(need.code));
  const seated = needCodes.includes('WHEELCHAIR_SEATED') || character.pose === 'WHEELCHAIR_SEATED';
  const usesReference = Boolean(request.referenceImage && request.consentToUseReference);

  const personLine = usesReference
    ? 'Use the person in the attached photo as the model. Keep their face, hairstyle, skin tone and body proportions exactly as they are; change only the clothing and the background.'
    : `Model: an adult Vietnamese person, ${character.bodyRepresentation.toLowerCase()} (${character.gender === 'MALE' ? 'man' : character.gender === 'FEMALE' ? 'woman' : 'androgynous presentation'}), natural skin tone close to ${request.skinTone ?? character.skinTone}.`;

  const checklist = [
    `${garment.name} màu ${color.name}`,
    ...garment.characteristics.slice(0, 3),
    ...garment.nonNegotiables.slice(0, 2),
    ...accessories.map((accessory) => `Phụ kiện: ${accessory.name}`),
    ...adjustments.map((adjustment) => `Thích ứng: ${adjustment.adjustment}`),
  ];

  const prompt = [
    'Create a photorealistic full-body fashion editorial photo, vertical 3:4, one person only, head to toe visible.',
    personLine,
    seated ? 'The person is seated confidently in a modern lightweight wheelchair; the garment drapes naturally while seated and the front hem stays clear of the wheels.' : '',
    `Outfit: Vietnamese traditional garment "${garment.vietnameseTitle}" (${garment.name}), historical reference: ${garment.era}.`,
    `Main garment colour: ${color.name} (${color.hex}). Trousers/skirt colour: ${request.pantColor}.`,
    'Construction details that MUST be visible and accurate (verified by Vstyle sources):',
    ...garment.characteristics.map((item) => `- ${item}`),
    'Rules that MUST NOT be broken:',
    ...garment.nonNegotiables.map((item) => `- ${item}`),
    '- The front panel closes right-over-left toward the wearer\'s right side (vạt hữu nhậm), never left-over-right.',
    accessories.length ? `Accessories: ${accessories.map((accessory) => `${accessory.name} (${accessory.description})`).join('; ')}.` : 'No extra accessories.',
    adjustments.length ? `Adaptive tailoring already applied (show it subtly and with dignity): ${adjustments.map((adjustment) => adjustment.adjustment).join(' ')}` : '',
    needs.length && !seated ? `Tailored for: ${needs.map((need) => need.name).join(', ')}.` : '',
    `Scene: ${EVENT_SCENES[event.id] ?? event.description}. Mood: ${STYLE_DIRECTION[request.styleId] ?? 'graceful and polished'}.`,
    'Natural daylight or soft studio light, realistic silk/linen fabric texture, respectful and non-sexualised pose.',
    'No text, captions, logos, watermarks or extra people. Do not mix in Chinese hanfu, Korean hanbok or Japanese kimono features.',
  ].filter(Boolean).join('\n');

  return { prompt, checklist: checklist.slice(0, 9), usesReference };
}

export class RenderUnavailableError extends Error {
  failureKind: GeminiFailureKind;

  constructor(failureKind: GeminiFailureKind) {
    super(`render unavailable: ${failureKind}`);
    this.name = 'RenderUnavailableError';
    this.failureKind = failureKind;
  }
}

export async function renderOutfitImage(
  request: GeminiRenderRequest,
  config: GeminiServiceConfig,
): Promise<{ imageDataUrl: string; model: string; usedReference: boolean; checklist: string[] }> {
  const built = buildOutfitRenderPrompt(request);
  if (!built) throw new RenderUnavailableError('invalid_ids');
  if (!config.imageProvider || !config.imageModel) throw new RenderUnavailableError('not_configured');
  const imageProvider = config.imageProvider;
  const imageModel = config.imageModel;

  try {
    const image = await withTimeout((signal) => imageProvider.generateImage({
      model: imageModel,
      prompt: built.prompt,
      images: built.usesReference && request.referenceImage
        ? [{ mimeType: request.referenceImage.mimeType, data: request.referenceImage.data }]
        : undefined,
      aspectRatio: '3:4',
      abortSignal: signal,
    }), config.imageTimeoutMs ?? 60000);
    if (!image?.data) throw new RenderUnavailableError('empty_response');
    return {
      imageDataUrl: `data:${image.mimeType};base64,${image.data}`,
      model: imageModel,
      usedReference: built.usesReference,
      checklist: built.checklist,
    };
  } catch (error) {
    if (error instanceof RenderUnavailableError) throw error;
    throw new RenderUnavailableError(failureKindFrom(error));
  }
}
