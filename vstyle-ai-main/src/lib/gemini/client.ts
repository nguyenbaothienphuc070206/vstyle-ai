import { FunctionalNeedCode } from '../../types/domain';
import { Garment, CultureCheckResult } from '../../types/fashion';
import {
  GeminiCaptionResponse,
  GeminiCaptionResponseSchema,
  GeminiExplainResponse,
  GeminiExplainResponseSchema,
  GeminiParseRequest,
  GeminiParseResponse,
  GeminiParseResponseSchema,
  GeminiRecommendResponse,
  GeminiRecommendResponseSchema,
} from '../../types/gemini';
import {
  getAdaptiveNeeds,
  getApprovedGarments,
  getApprovedSources,
  getEvents,
  getValidatedAdaptiveAdjustments,
  getWeatherContexts,
} from '../dal';
import {
  DeterministicRecommendation,
  RecommendationContext,
} from '../recommendation/engine';
import { getFallbackCaptions, getFallbackExplanation } from '../fallback/templates';

const API_TIMEOUT_MS = 14000;
const ALLOWED_STYLES: GeminiParseRequest['allowedStyles'] = [
  'TRUYEN_THONG_HOANG_GIA',
  'TRUYEN_THONG',
  'CONTEMPORARY',
  'TOI_GIAN',
  'NANG_DONG',
  'REMIX_GEN_Z',
  'SANG_TRONG',
  'THANH_LICH',
];

async function postJson<T>(path: string, body: unknown, schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Gemini endpoint unavailable');
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) throw new Error('Gemini endpoint response invalid');
    return parsed.data;
  } finally {
    clearTimeout(timeout);
  }
}

function manualParseFallback(): GeminiParseResponse {
  return {
    eventId: null,
    weatherId: null,
    styleId: null,
    color: null,
    needCodes: [],
    confirmationRequired: ['event', 'weather', 'style', 'color', 'adaptiveNeeds'],
    summary: 'Chưa thể nhận diện chắc chắn. Vui lòng chọn thủ công các thông tin bên dưới.',
    usedFallback: true,
  };
}

export async function parseNaturalLanguagePrompt(text: string): Promise<GeminiParseResponse> {
  const approvedSourceIds = new Set(getApprovedSources().map((source) => source.id));
  const allowedNeeds = [...new Set(getValidatedAdaptiveAdjustments()
    .filter((adjustment) => approvedSourceIds.has(adjustment.sourceId))
    .map((adjustment) => adjustment.needCode))];
  const allowedColors = [...new Map(getApprovedGarments()
    .flatMap((garment) => garment.baseColors.map((color) => [color.hex.toLowerCase(), color] as const))).values()]
    .map(({ name, hex }) => ({ name, hex }));

  const request: GeminiParseRequest = {
    text,
    allowedEvents: getEvents().map((event) => event.id),
    allowedWeatherIds: getWeatherContexts().map((weather) => weather.id),
    allowedStyles: ALLOWED_STYLES,
    allowedColors,
    allowedNeeds,
  };

  try {
    return await postJson('/api/gemini/parse', request, GeminiParseResponseSchema);
  } catch {
    return manualParseFallback();
  }
}

function deterministicRankingFallback(candidates: DeterministicRecommendation[]): GeminiRecommendResponse {
  return {
    candidateIds: candidates.slice(0, 3).map((candidate) => candidate.outfitId),
    usedFallback: true,
  };
}

export async function getGeminiRecommendation(
  context: RecommendationContext,
  candidates: DeterministicRecommendation[],
): Promise<GeminiRecommendResponse> {
  const fallback = deterministicRankingFallback(candidates);
  if (!candidates.length) return fallback;
  const allowedIds = new Set(candidates.map((candidate) => candidate.outfitId));

  try {
    const result = await postJson('/api/gemini/recommend', {
      context,
      candidateIds: [...allowedIds],
    }, GeminiRecommendResponseSchema);
    if (!result.candidateIds.length || result.candidateIds.some((id) => !allowedIds.has(id))) return fallback;
    return result;
  } catch {
    return fallback;
  }
}

export interface ExplainOutfitParams {
  garment: Garment;
  cultureCheck: CultureCheckResult;
  eventId: string;
  eventName: string;
  styleVibe: string;
  primaryColor: string;
  accessoryIds: string[];
  accessoryNames: string[];
  adaptiveNeedCodes?: FunctionalNeedCode[];
}

export async function explainOutfit(params: ExplainOutfitParams): Promise<GeminiExplainResponse> {
  try {
    return await postJson('/api/gemini/explain', {
      garmentId: params.garment.id,
      eventId: params.eventId,
      styleId: params.styleVibe,
      primaryColor: params.primaryColor,
      accessoryIds: params.accessoryIds,
      adaptiveNeedCodes: params.adaptiveNeedCodes ?? [],
    }, GeminiExplainResponseSchema);
  } catch {
    return {
      ...getFallbackExplanation(params.garment, params.cultureCheck, params.eventName),
      usedFallback: true,
    };
  }
}

export interface OutfitCaptionParams {
  garmentId: string;
  garmentName: string;
  styleTitle: string;
  eventId: string;
  eventTitle: string;
  chuanScore: number;
  chatScore: number;
  vibe: string;
  primaryColor: string;
  accessoryIds: string[];
  adaptiveNeedCodes?: FunctionalNeedCode[];
}

export async function getOutfitCaptions(params: OutfitCaptionParams): Promise<GeminiCaptionResponse> {
  try {
    return await postJson('/api/gemini/caption', {
      garmentId: params.garmentId,
      eventId: params.eventId,
      styleId: params.vibe,
      primaryColor: params.primaryColor,
      accessoryIds: params.accessoryIds,
      adaptiveNeedCodes: params.adaptiveNeedCodes ?? [],
    }, GeminiCaptionResponseSchema);
  } catch {
    return {
      ...getFallbackCaptions(params.garmentName, params.eventTitle),
      usedFallback: true,
    };
  }
}