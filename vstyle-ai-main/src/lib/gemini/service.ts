import { CultureCheckResult } from '../../types/domain';
import {
  GeminiCaptionModelOutputSchema,
  GeminiCaptionResponse,
  GeminiExplainModelOutputSchema,
  GeminiExplainResponse,
  GeminiFunctionalNeedCodeEnum,
  GeminiParseModelOutputSchema,
  GeminiParseRequest,
  GeminiParseResponse,
  GeminiParseResponseSchema,
  GeminiRecommendModelOutputSchema,
  GeminiRecommendRequest,
  GeminiRecommendResponse,
  GeminiSourceReferenceSchema,
} from '../../types/gemini';
import {
  getApprovedAccessories,
  getApprovedGarments,
  getApprovedSources,
  getValidatedAdaptiveAdjustments,
} from '../dal';
import { checkCulture } from '../culture/ruleEngine';
import { DeterministicRecommendation } from '../recommendation/engine';
import {
  generateStructuredJson,
  GeminiTextProvider,
  StructuredGenerationResult,
} from './generation';

export interface GeminiServiceConfig {
  provider?: GeminiTextProvider;
  model: string;
  timeoutMs?: number;
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
interface GenerationBase {
  provider?: GeminiTextProvider;
  model: string;
  timeoutMs?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

const MANUAL_PARSE_FALLBACK: GeminiParseResponse = {
  eventId: null,
  weatherId: null,
  styleId: null,
  color: null,
  needCodes: [],
  confirmationRequired: ['event', 'weather', 'style', 'color', 'adaptiveNeeds'],
  summary: 'Chưa thể nhận diện chắc chắn. Vui lòng chọn thủ công các thông tin bên dưới.',
  usedFallback: true,
};

function generationOptions<T>(
  base: GenerationBase,
  options: {
    systemInstruction: string;
    prompt: string;
    schema: Parameters<typeof generateStructuredJson<T>>[0]['schema'];
    fallback: () => T;
    validate?: (value: T) => boolean;
    maxOutputTokens?: number;
  },
) {
  return {
    ...base,
    ...options,
  };
}

function checkedParseResponse(
  output: ReturnType<typeof GeminiParseModelOutputSchema.parse>,
  request: GeminiParseRequest,
  usedFallback: boolean,
): GeminiParseResponse {
  const confirmationRequired = new Set<GeminiParseResponse['confirmationRequired'][number]>();
  const eventId = output.eventId && request.allowedEvents.includes(output.eventId) ? output.eventId : null;
  if (output.eventId && !eventId) confirmationRequired.add('event');

  const weatherId = output.weatherId && request.allowedWeatherIds.includes(output.weatherId)
    ? output.weatherId
    : null;
  if (output.weatherId && !weatherId) confirmationRequired.add('weather');

  const styleId = output.styleId && request.allowedStyles.includes(output.styleId as GeminiParseRequest['allowedStyles'][number])
    ? output.styleId as GeminiParseRequest['allowedStyles'][number]
    : null;
  if (output.styleId && !styleId) confirmationRequired.add('style');

  const requestedColor = output.color?.trim().toLowerCase();
  const matchedColor = request.allowedColors.find((color) =>
    color.hex.toLowerCase() === requestedColor || color.name.trim().toLowerCase() === requestedColor,
  );
  if (output.color && !matchedColor) confirmationRequired.add('color');

  const requestedNeeds = output.needCodes ?? [];
  const allowedNeeds = new Set(request.allowedNeeds);
  const needCodes = [...new Set(requestedNeeds.filter((code) =>
    GeminiFunctionalNeedCodeEnum.safeParse(code).success && allowedNeeds.has(code as GeminiParseRequest['allowedNeeds'][number]),
  ))] as GeminiParseResponse['needCodes'];
  if (requestedNeeds.some((code) => !needCodes.includes(code as GeminiParseResponse['needCodes'][number]))) {
    confirmationRequired.add('adaptiveNeeds');
  }

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
    confirmationRequired: [...confirmationRequired],
    summary: output.summary?.trim().slice(0, 240) || MANUAL_PARSE_FALLBACK.summary,
    usedFallback,
  });
}

export async function parseStylingText(
  request: GeminiParseRequest,
  config: GeminiServiceConfig,
): Promise<GeminiParseResponse> {
  const result = await generateStructuredJson({
    ...generationOptions(config, {
      systemInstruction: [
        'You are a structured Vstyle preference parser, not a cultural authority.',
        'Return JSON only. Choose IDs only from the supplied allowed values; use null when uncertain.',
        'Never invent an event, weather, style, color, adaptive need, cultural fact, or garment ID.',
        'Only infer a need when the user explicitly requests it. Do not infer needs from appearance or context.',
        'Return needCodes only from allowedNeeds. The server will validate every value.',
      ].join(' '),
      prompt: JSON.stringify({ text: request.text, allowedEvents: request.allowedEvents, allowedWeatherIds: request.allowedWeatherIds, allowedStyles: request.allowedStyles, allowedColors: request.allowedColors, allowedNeeds: request.allowedNeeds }),
      schema: GeminiParseModelOutputSchema,
      fallback: () => ({ eventId: null, weatherId: null, styleId: null, color: null, needCodes: [], summary: '' }),
      maxOutputTokens: 240,
    }),
  });
  return checkedParseResponse(result.value, request, result.usedFallback);
}

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
      style: candidate.style,
      score: candidate.score,
      reasons: candidate.reasons,
      cultureResult,
      sources: cultureResult.sourceIds.flatMap((id) => {
        const source = approvedSources.get(id);
        return source ? [{ id: source.id, title: source.title, publisher: source.publisher }] : [];
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

  const allowedIds = new Set(allowedCandidates.map((candidate) => candidate.outfitId));
  const generation: StructuredGenerationResult<ReturnType<typeof GeminiRecommendModelOutputSchema.parse>> = await generateStructuredJson({
    ...generationOptions(config, {
      systemInstruction: [
        'You rank candidate outfit IDs for Vstyle. Do not create or alter outfits, IDs, scores, culture status, or sources.',
        'Only return candidateId values that appear in the supplied candidate list.',
        'Use the supplied cultural result as fixed data. Never create cultural rules or claims.',
        'Return one to three distinct candidate IDs, best first, as JSON.',
      ].join(' '),
      prompt: JSON.stringify({ context: request.context, candidates: getSafeCandidateDetails(allowedCandidates) }),
      schema: GeminiRecommendModelOutputSchema,
      fallback: () => ({ candidateIds: fallback().candidateIds }),
      validate: (value) => value.candidateIds.length > 0 &&
        value.candidateIds.length <= 3 &&
        new Set(value.candidateIds).size === value.candidateIds.length &&
        value.candidateIds.every((id) => allowedIds.has(id)),
      maxOutputTokens: 200,
    }),
  });
  return {
    candidateIds: generation.value.candidateIds,
    usedFallback: generation.usedFallback,
  };
}

function fallbackExplanation(request: GeminiExplainPromptContext): GeminiExplainResponse {
  const observedReasons = request.cultureResult.reasons.slice(0, 3);
  const retained = request.retainedCharacteristics.slice(0, 3);
  return {
    headline: `${request.garmentName} · ${request.eventName}`.slice(0, 140),
    editorialReview: `Bản phối kết hợp ${request.garmentName} với phong cách ${request.styleId} cho ${request.eventName}. Đây là bản minh họa theo dữ liệu Vstyle, không phải thử đồ thực tế.`,
    culturalHarmony: observedReasons.join(' ') || `Kết quả kiểm tra văn hóa: ${request.cultureResult.status}, ${request.cultureResult.score}/100.`,
    styleRemixVerdict: `Điểm Chuẩn ${request.cultureResult.score}/100 và phong cách ${request.styleId} được đánh giá riêng; phần giải thích không thay đổi kết quả văn hóa.`,
    adviceForWearing: retained.length ? retained : ['Tham khảo kết quả và nguồn đã xác minh trong thẻ Chuẩn văn hóa.'],
    usedFallback: true,
  };
}

export async function explainStyling(
  request: GeminiExplainPromptContext,
  config: GeminiServiceConfig,
): Promise<GeminiExplainResponse> {
  const result = await generateStructuredJson({
    ...generationOptions(config, {
      systemInstruction: [
        'Explain the supplied outfit and fixed cultural result for Vstyle.',
        'The culture result, score, rule IDs, retained characteristics, and sources are immutable facts; never revise or contradict them.',
        'Do not add historical claims or cultural rules. Only paraphrase the supplied reasons, characteristics, and source titles.',
        'If evidence is insufficient, say so. Return JSON only.',
      ].join(' '),
      prompt: JSON.stringify(request),
      schema: GeminiExplainModelOutputSchema,
      fallback: () => {
        const { usedFallback: _usedFallback, ...output } = fallbackExplanation(request);
        return output;
      },
      maxOutputTokens: 500,
    }),
  });
  return { ...result.value, usedFallback: result.usedFallback };
}

function fallbackCaption(request: GeminiCaptionPromptContext): GeminiCaptionResponse {
  const fact = request.retainedCharacteristics[0] ?? request.cultureReasons[0] ?? '';
  const highlight = fact
    ? `Đặc trưng trong dữ liệu: ${fact}`.slice(0, 240)
    : `Kết quả kiểm tra Chuẩn ${request.chuanScore}/100.`;
  return {
    instagramCaption: `Diện ${request.garmentName} cho ${request.eventTitle}, theo phong cách ${request.vibe}. Chuẩn ${request.chuanScore}/100 · Chất ${request.chatScore}/100. #Vstyle #VietPhucRemix`,
    shortPunchyHook: `${request.garmentName}, chọn theo gu của bạn.`,
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
    ...generationOptions(config, {
      systemInstruction: [
        'Write a concise social caption about the supplied Vstyle outfit.',
        'Do not invent historical or cultural facts, rules, materials, or provenance.',
        'Any cultural highlight must be a direct paraphrase of the provided reasons or retained characteristics.',
        'Do not claim AI virtual try-on. Return JSON only.',
      ].join(' '),
      prompt: JSON.stringify(request),
      schema: GeminiCaptionModelOutputSchema,
      fallback: () => {
        const { usedFallback: _usedFallback, ...output } = fallbackCaption(request);
        return output;
      },
      maxOutputTokens: 240,
    }),
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