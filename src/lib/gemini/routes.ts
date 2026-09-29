import express from 'express';
import type { Request, Response, Router } from 'express';
import type { StyleTag } from '../../types/domain.ts';
import {
  GeminiCaptionRequestSchema,
  GeminiExplainRequestSchema,
  GeminiParseApiRequestSchema,
  GeminiRecommendRequestSchema,
  GeminiRenderRequestSchema,
  GeminiVisionRequestSchema,
  type GeminiParseRequest,
} from '../../types/gemini.ts';
import {
  calculateStyleScore,
  getDeterministicRecommendations,
  type RecommendationContext,
} from '../recommendation/engine.ts';
import { checkCulture } from '../culture/ruleEngine.ts';
import {
  getAdaptiveNeeds,
  getApprovedAccessories,
  getApprovedGarments,
  getApprovedSources,
  getCharacters,
  getEventById,
  getEvents,
  getValidatedAdaptiveAdjustments,
  getWeatherContexts,
} from '../dal/index.ts';
import { createRateLimiter } from '../server/rateLimit.ts';
import { STYLE_CHOICE_IDS } from '../styles.ts';
import {
  analyzeOutfitPhoto,
  approvedSourceReferences,
  createGeminiCaption,
  explainStyling,
  parseStylingText,
  rankGeminiCandidates,
  renderOutfitImage,
  RenderUnavailableError,
  type GeminiServiceConfig,
} from './service.ts';

const KNOWN_STYLE_TAGS: StyleTag[] = [
  'TRUYEN_THONG', 'LE_NGHI', 'CUNG_DINH', 'DAN_GIAN', 'TOI_GIAN', 'REMIX_GEN_Z',
  'SANG_TRONG', 'THANH_LICH', 'NANG_DONG', 'HOA_NHAP', 'CO_DIEN',
];

function invalidRequest(res: Response): void {
  res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
}

/** Allow-lists are always computed on the server from approved, source-verified records. */
export function buildParseRequest(text: string): GeminiParseRequest {
  const approvedSourceIds = new Set(getApprovedSources().map((source) => source.id));
  const allowedNeeds = [...new Set(getValidatedAdaptiveAdjustments()
    .filter((adjustment) => approvedSourceIds.has(adjustment.sourceId))
    .map((adjustment) => adjustment.needCode))];
  const allowedColors = [...new Map(getApprovedGarments()
    .flatMap((garment) => garment.baseColors.map((color) => [color.hex.toLowerCase(), color] as const))).values()]
    .map(({ name, hex }) => ({ name, hex }));

  return {
    text,
    allowedEvents: getEvents().map((event) => event.id),
    allowedWeatherIds: getWeatherContexts().map((weather) => weather.id),
    allowedStyles: STYLE_CHOICE_IDS,
    allowedColors,
    allowedNeeds,
    allowedGarments: getApprovedGarments().map((garment) => ({ id: garment.id, name: garment.name })),
    allowedAccessories: getApprovedAccessories()
      .filter((accessory) => accessory.verified)
      .map((accessory) => ({ id: accessory.id, name: accessory.name })),
  };
}

const RENDER_ERRORS: Record<string, { status: number; message: string }> = {
  not_configured: { status: 503, message: 'Chưa cấu hình GEMINI_API_KEY nên chưa tạo được ảnh AI. Bản mockup vẫn dùng bình thường.' },
  authentication: { status: 503, message: 'Khóa Gemini không hợp lệ hoặc chưa được cấp quyền tạo ảnh.' },
  rate_limit: { status: 429, message: 'Hạn mức tạo ảnh của Gemini đang tạm hết. Vui lòng thử lại sau.' },
  safety: { status: 422, message: 'Gemini không tạo ảnh cho yêu cầu này. Thử bỏ ảnh tham chiếu hoặc đổi phụ kiện.' },
  timeout: { status: 504, message: 'Gemini tạo ảnh quá lâu. Vui lòng thử lại.' },
  invalid_ids: { status: 400, message: 'Bản phối chưa hợp lệ để tạo ảnh.' },
};

export function createGeminiRouter(config: GeminiServiceConfig): Router {
  const router = express.Router();
  const smallJson = express.json({ limit: '64kb' });
  const imageJson = express.json({ limit: '7mb' });
  const textLimiter = createRateLimiter({ windowMs: 60_000, max: 40, globalMax: 600 });
  const visionLimiter = createRateLimiter({ windowMs: 60_000, max: 8, globalMax: 60 });
  const renderLimiter = createRateLimiter({
    windowMs: 60 * 60_000,
    max: 12,
    globalMax: Number.parseInt(process.env.VSTYLE_RENDER_HOURLY_CAP || '120', 10),
    message: 'Mỗi người được tạo tối đa 12 ảnh AI mỗi giờ để tiết kiệm hạn mức. Bản mockup vẫn dùng bình thường.',
  });

  router.post('/parse', textLimiter, smallJson, async (req: Request, res: Response) => {
    const body = GeminiParseApiRequestSchema.safeParse(req.body);
    if (!body.success) return invalidRequest(res);
    const request = buildParseRequest(body.data.text);
    try {
      return res.json(await parseStylingText(request, config));
    } catch {
      return res.json(await parseStylingText(request, { ...config, provider: undefined }));
    }
  });

  router.post('/recommend', textLimiter, smallJson, async (req: Request, res: Response) => {
    const body = GeminiRecommendRequestSchema.safeParse(req.body);
    if (!body.success) return invalidRequest(res);

    const rawContext = body.data.context;
    const event = getEventById(rawContext.eventId);
    const weather = rawContext.weatherId ? getWeatherContexts().find((item) => item.id === rawContext.weatherId) : undefined;
    const approvedGarments = new Set(getApprovedGarments().map((garment) => garment.id));
    const approvedAccessories = new Set(getApprovedAccessories().map((accessory) => accessory.id));
    const approvedCharacterIds = new Set(getCharacters().map((character) => character.id));
    const adaptiveNeedIds = new Set(getAdaptiveNeeds().map((need) => need.code));
    if (!event || (rawContext.weatherId && !weather)) return invalidRequest(res);
    if (rawContext.characterId && !approvedCharacterIds.has(rawContext.characterId)) return invalidRequest(res);
    if ((rawContext.accessoryIds ?? []).some((id) => !approvedAccessories.has(id))) return invalidRequest(res);
    if ((rawContext.garmentPreferences?.preferredGarmentIds ?? []).some((id) => !approvedGarments.has(id))) return invalidRequest(res);
    if ((rawContext.garmentPreferences?.excludedGarmentIds ?? []).some((id) => !approvedGarments.has(id))) return invalidRequest(res);
    if ((rawContext.adaptiveNeedCodes ?? []).some((code) => !adaptiveNeedIds.has(code))) return invalidRequest(res);
    if (rawContext.adaptiveNeedCode && rawContext.adaptiveNeedCode !== 'NONE' && !adaptiveNeedIds.has(rawContext.adaptiveNeedCode)) return invalidRequest(res);
    if (rawContext.style && !KNOWN_STYLE_TAGS.includes(rawContext.style as StyleTag)) return invalidRequest(res);

    const context = rawContext as RecommendationContext;
    const deterministicCandidates = getDeterministicRecommendations({ ...context, limit: 12 });
    const deterministicIds = new Set(deterministicCandidates.map((candidate) => candidate.outfitId));
    if (body.data.candidateIds.some((id) => !deterministicIds.has(id))) return invalidRequest(res);

    try {
      return res.json(await rankGeminiCandidates(body.data, deterministicCandidates, config));
    } catch {
      return res.json(await rankGeminiCandidates(body.data, deterministicCandidates, { ...config, provider: undefined }));
    }
  });

  router.post('/explain', textLimiter, smallJson, async (req: Request, res: Response) => {
    const body = GeminiExplainRequestSchema.safeParse(req.body);
    if (!body.success) return invalidRequest(res);

    const outfit = body.data;
    const garment = getApprovedGarments().find((item) => item.id === outfit.garmentId);
    const event = getEventById(outfit.eventId);
    const accessoryMap = new Map(getApprovedAccessories().map((item) => [item.id, item]));
    const selectedAccessories = outfit.accessoryIds.map((id) => accessoryMap.get(id));
    if (!garment || !event || !garment.baseColors.some((color) => color.hex.toLowerCase() === outfit.primaryColor.toLowerCase())) return invalidRequest(res);
    if (selectedAccessories.some((item) => !item || !item.compatibleGarmentIds.includes(garment.id) ||
      (item.compatibleEventIds.length > 0 && !item.compatibleEventIds.includes(event.id)))) return invalidRequest(res);

    const approvedSourceIds = new Set(getApprovedSources().map((source) => source.id));
    const validatedAdjustments = getValidatedAdaptiveAdjustments().filter((adjustment) =>
      approvedSourceIds.has(adjustment.sourceId) &&
      (adjustment.garmentId === garment.id || adjustment.garmentId === 'ALL'),
    );
    const adaptiveNeedCode = outfit.adaptiveNeedCodes?.[0];
    const adaptiveAdjustment = adaptiveNeedCode
      ? validatedAdjustments.find((adjustment) => adjustment.needCode === adaptiveNeedCode)
      : undefined;
    const cultureResult = checkCulture({
      garmentId: garment.id,
      accessoryIds: outfit.accessoryIds,
      eventId: event.id,
      primaryColor: outfit.primaryColor,
      adaptiveNeedCode,
    });
    const colorName = garment.baseColors.find((color) => color.hex.toLowerCase() === outfit.primaryColor.toLowerCase())?.name;
    const safePrompt = {
      garmentName: garment.name,
      eventName: event.name,
      styleId: outfit.styleId,
      primaryColor: colorName ? `${colorName} (${outfit.primaryColor})` : outfit.primaryColor,
      accessoryNames: selectedAccessories.map((item) => item!.name),
      cultureResult,
      retainedCharacteristics: cultureResult.retainedCharacteristics,
      sources: approvedSourceReferences(cultureResult.sourceIds),
      adaptiveAdjustment: adaptiveAdjustment ? {
        id: adaptiveAdjustment.id,
        needName: adaptiveAdjustment.needName,
        adjustment: adaptiveAdjustment.adjustment,
        reason: adaptiveAdjustment.reason,
        sourceId: adaptiveAdjustment.sourceId,
      } : undefined,
    };

    try {
      return res.json(await explainStyling(safePrompt, config));
    } catch {
      return res.json(await explainStyling(safePrompt, { ...config, provider: undefined }));
    }
  });

  router.post('/caption', textLimiter, smallJson, async (req: Request, res: Response) => {
    const body = GeminiCaptionRequestSchema.safeParse(req.body);
    if (!body.success) return invalidRequest(res);

    const outfit = body.data;
    const garment = getApprovedGarments().find((item) => item.id === outfit.garmentId);
    const event = getEventById(outfit.eventId);
    const approvedAccessories = new Map(getApprovedAccessories().map((item) => [item.id, item]));
    const selectedAccessories = outfit.accessoryIds.map((id) => approvedAccessories.get(id));
    if (!garment || !event || !garment.baseColors.some((color) => color.hex.toLowerCase() === outfit.primaryColor.toLowerCase())) return invalidRequest(res);
    if (selectedAccessories.some((item) => !item || !item.compatibleGarmentIds.includes(garment.id) ||
      (item.compatibleEventIds.length > 0 && !item.compatibleEventIds.includes(event.id)))) return invalidRequest(res);

    const cultureResult = checkCulture({
      garmentId: garment.id,
      accessoryIds: outfit.accessoryIds,
      eventId: event.id,
      primaryColor: outfit.primaryColor,
      adaptiveNeedCode: outfit.adaptiveNeedCodes?.[0],
    });
    const styleResult = calculateStyleScore(garment, outfit.primaryColor, outfit.accessoryIds, event.id, outfit.styleId);
    const promptContext = {
      garmentName: garment.name,
      styleTitle: `${garment.name} · ${outfit.styleId}`,
      eventTitle: event.name,
      chuanScore: cultureResult.score,
      chatScore: styleResult.score,
      vibe: outfit.styleId,
      cultureReasons: cultureResult.reasons,
      retainedCharacteristics: cultureResult.retainedCharacteristics,
      sources: approvedSourceReferences(cultureResult.sourceIds),
    };
    try {
      return res.json(await createGeminiCaption(promptContext, config));
    } catch {
      return res.json(await createGeminiCaption(promptContext, { ...config, provider: undefined }));
    }
  });

  router.post('/vision', visionLimiter, imageJson, async (req: Request, res: Response) => {
    const body = GeminiVisionRequestSchema.safeParse(req.body);
    if (!body.success) return invalidRequest(res);
    try {
      return res.json(await analyzeOutfitPhoto(body.data, config));
    } catch {
      return res.json(await analyzeOutfitPhoto(body.data, { ...config, provider: undefined }));
    }
  });

  router.post('/render', renderLimiter, imageJson, async (req: Request, res: Response) => {
    const body = GeminiRenderRequestSchema.safeParse(req.body);
    if (!body.success) return invalidRequest(res);
    try {
      return res.json(await renderOutfitImage(body.data, config));
    } catch (error) {
      const kind = error instanceof RenderUnavailableError ? error.failureKind : 'provider';
      const mapped = RENDER_ERRORS[kind] ?? { status: 502, message: 'Chưa tạo được ảnh AI lúc này. Bản mockup vẫn dùng bình thường.' };
      return res.status(mapped.status).json({ error: mapped.message, code: kind });
    }
  });

  return router;
}
