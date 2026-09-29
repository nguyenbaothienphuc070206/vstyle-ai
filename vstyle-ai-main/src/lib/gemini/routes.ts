import { Router, Request, Response } from 'express';
import { FunctionalNeedCode, StyleTag } from '../../types/domain';
import {
  GeminiCaptionRequestSchema,
  GeminiExplainRequestSchema,
  GeminiParseRequestSchema,
  GeminiRecommendRequestSchema,
  GeminiStyleIdEnum,
} from '../../types/gemini';
import {
  calculateStyleScore,
  getDeterministicRecommendations,
  RecommendationContext,
} from '../recommendation/engine';
import { checkCulture } from '../culture/ruleEngine';
import {
  getAdaptiveNeeds,
  getAdaptiveAdjustments,
  getApprovedAccessories,
  getApprovedGarments,
  getApprovedSources,
  getEventById,
  getEvents,
  getValidatedAdaptiveAdjustments,
  getWeatherContexts,
} from '../dal';
import {
  approvedSourceReferences,
  createGeminiCaption,
  explainStyling,
  GeminiServiceConfig,
  parseStylingText,
  rankGeminiCandidates,
} from './service';

const KNOWN_STYLE_TAGS: StyleTag[] = [
  'TRUYEN_THONG', 'LE_NGHI', 'CUNG_DINH', 'DAN_GIAN', 'TOI_GIAN', 'REMIX_GEN_Z',
  'SANG_TRONG', 'THANH_LICH', 'NANG_DONG', 'HOA_NHAP', 'CO_DIEN',
];

function invalidRequest(res: Response): void {
  res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
}

function sourceIsApproved(sourceId: string, sourceIds: Set<string>): boolean {
  return sourceIds.has(sourceId);
}

export function createGeminiRouter(config: GeminiServiceConfig): Router {
  const router = Router();

  router.post('/parse', async (req: Request, res: Response) => {
    const body = GeminiParseRequestSchema.safeParse(req.body);
    if (!body.success) return invalidRequest(res);

    const request = body.data;
    const knownEvents = new Set(getEvents().map((event) => event.id));
    const knownWeather = new Set(getWeatherContexts().map((weather) => weather.id));
    const supportedStyles = new Set(GeminiStyleIdEnum.options);
    const approvedColors = new Map(
      getApprovedGarments().flatMap((garment) => garment.baseColors.map((color) => [color.hex.toLowerCase(), color] as const)),
    );
    const approvedSourceIds = new Set(getApprovedSources().map((source) => source.id));
    const supportedNeeds = new Set(
      getValidatedAdaptiveAdjustments()
        .filter((adjustment) => sourceIsApproved(adjustment.sourceId, approvedSourceIds))
        .map((adjustment) => adjustment.needCode),
    );

    const allowedColors = request.allowedColors.flatMap((color) => {
      const approved = approvedColors.get(color.hex.toLowerCase());
      return approved ? [{ name: approved.name, hex: approved.hex }] : [];
    });
    const filteredRequest = {
      ...request,
      allowedEvents: request.allowedEvents.filter((id) => knownEvents.has(id)),
      allowedWeatherIds: request.allowedWeatherIds.filter((id) => knownWeather.has(id)),
      allowedStyles: request.allowedStyles.filter((id) => supportedStyles.has(id)),
      allowedColors,
      allowedNeeds: request.allowedNeeds.filter((code) => supportedNeeds.has(code)),
    };

    try {
      const result = await parseStylingText(filteredRequest, config);
      return res.json(result);
    } catch {
      const fallback = await parseStylingText(filteredRequest, { ...config, provider: undefined });
      return res.json(fallback);
    }
  });

  router.post('/recommend', async (req: Request, res: Response) => {
    const body = GeminiRecommendRequestSchema.safeParse(req.body);
    if (!body.success) return invalidRequest(res);

    const rawContext = body.data.context;
    const event = getEventById(rawContext.eventId);
    const weather = rawContext.weatherId ? getWeatherContexts().find((item) => item.id === rawContext.weatherId) : undefined;
    const approvedGarments = new Set(getApprovedGarments().map((garment) => garment.id));
    const approvedAccessories = new Set(getApprovedAccessories().map((accessory) => accessory.id));
    const approvedCharacterIds = new Set((await import('../dal')).getCharacters().map((character) => character.id));
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
      const result = await rankGeminiCandidates(body.data, deterministicCandidates, config);
      return res.json(result);
    } catch {
      return res.json(await rankGeminiCandidates(body.data, deterministicCandidates, { ...config, provider: undefined }));
    }
  });

  router.post('/explain', async (req: Request, res: Response) => {
    const body = GeminiExplainRequestSchema.safeParse(req.body);
    if (!body.success) return invalidRequest(res);

    const outfit = body.data;
    const garment = getApprovedGarments().find((item) => item.id === outfit.garmentId);
    const event = getEventById(outfit.eventId);
    const accessories = getApprovedAccessories();
    const accessoryMap = new Map(accessories.map((item) => [item.id, item]));
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
    const styleId = outfit.styleId;
    const safePrompt = {
      garmentName: garment.name,
      eventName: event.name,
      styleId,
      primaryColor: outfit.primaryColor,
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

  router.post('/caption', async (req: Request, res: Response) => {
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
    const styleResult = calculateStyleScore(
      garment,
      outfit.primaryColor,
      outfit.accessoryIds,
      event.id,
      outfit.styleId,
    );
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

  return router;
}