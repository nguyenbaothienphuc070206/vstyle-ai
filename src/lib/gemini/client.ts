import type { FunctionalNeedCode } from '../../types/domain';
import type { CultureCheckResult, Garment } from '../../types/fashion';
import {
  GeminiCaptionResponseSchema,
  GeminiExplainResponseSchema,
  GeminiParseResponseSchema,
  GeminiRecommendResponseSchema,
  GeminiRenderResponseSchema,
  GeminiVisionResponseSchema,
  type Base64Image,
  type GeminiCaptionResponse,
  type GeminiExplainResponse,
  type GeminiParseResponse,
  type GeminiRecommendResponse,
  type GeminiRenderResponse,
  type GeminiVisionResponse,
} from '../../types/gemini';
import type { DeterministicRecommendation, RecommendationContext } from '../recommendation/engine';
import { getFallbackCaptions, getFallbackExplanation } from '../fallback/templates';

const TEXT_TIMEOUT_MS = 32000;
const VISION_TIMEOUT_MS = 48000;
const IMAGE_TIMEOUT_MS = 75000;

type SafeSchema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

export class GeminiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'GeminiRequestError';
    this.status = status;
    this.code = code;
  }
}

async function postJson<T>(path: string, body: unknown, schema: SafeSchema<T>, timeoutMs = TEXT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const details = payload && typeof payload === 'object' ? payload as { error?: string; code?: string } : {};
      throw new GeminiRequestError(details.error ?? 'Gemini endpoint unavailable', response.status, details.code);
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw new GeminiRequestError('Gemini endpoint response invalid', 502);
    return parsed.data;
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GeminiRequestError('Gemini phản hồi quá lâu. Vui lòng thử lại.', 504, 'timeout');
    }
    throw new GeminiRequestError('Không kết nối được máy chủ.', 0, 'network');
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
    garmentId: null,
    accessoryIds: [],
    confirmationRequired: ['event', 'weather', 'style', 'color', 'adaptiveNeeds'],
    summary: 'Chưa thể nhận diện chắc chắn. Vui lòng chọn thủ công các thông tin bên dưới.',
    usedFallback: true,
  };
}

/** Natural language → allow-listed IDs. Allow-lists are built on the server. */
export async function parseNaturalLanguagePrompt(text: string): Promise<GeminiParseResponse> {
  try {
    return await postJson('/api/gemini/parse', { text }, GeminiParseResponseSchema);
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

/** Gemini image understanding on a user photo. Throws GeminiRequestError so the UI can explain failures. */
export async function analyzeOutfitPhoto(image: Base64Image, note?: string): Promise<GeminiVisionResponse> {
  return postJson('/api/gemini/vision', { image, note }, GeminiVisionResponseSchema, VISION_TIMEOUT_MS);
}

export interface RenderOutfitParams {
  garmentId: string;
  eventId: string;
  styleId: string;
  primaryColor: string;
  pantColor: string;
  accessoryIds: string[];
  characterId: string;
  skinTone?: string;
  adaptiveNeedCodes?: FunctionalNeedCode[];
  referenceImage?: Base64Image;
  consentToUseReference?: boolean;
}

/** Gemini native image generation (Nano Banana). Throws GeminiRequestError with a user-facing message. */
export async function renderOutfitImage(params: RenderOutfitParams): Promise<GeminiRenderResponse> {
  return postJson('/api/gemini/render', params, GeminiRenderResponseSchema, IMAGE_TIMEOUT_MS);
}

export interface ServerHealth {
  hasGeminiKey: boolean;
  textModel?: string;
  imageModel?: string;
  features?: { vision?: boolean; imageRender?: boolean };
}

export async function getServerHealth(): Promise<ServerHealth | null> {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) return null;
    return await response.json() as ServerHealth;
  } catch {
    return null;
  }
}
