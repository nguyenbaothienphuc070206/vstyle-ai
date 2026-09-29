/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navbar } from './components/Navbar';
import { AiStylistComposer, type StylistProgress } from './components/AiStylistComposer';
import { OutfitMockupCanvas } from './components/OutfitMockupCanvas';
import { ContextSelector } from './components/ContextSelector';
import { AdaptiveSelector } from './components/AdaptiveSelector';
import { CharacterSelector } from './components/CharacterSelector';
import { GarmentDiscovery } from './components/GarmentDiscovery';
import { StyleCustomizer } from './components/StyleCustomizer';
import { RecommendationGallery } from './components/RecommendationGallery';
import { CultureCheckCard } from './components/CultureCheckCard';
import { AIRecommendationPanel } from './components/AIRecommendationPanel';
import { ColorHarmonyCard } from './components/ColorHarmonyCard';
import { PhotoInspirationCard } from './components/PhotoInspirationCard';
import { AiRenderPanel, type RenderState } from './components/AiRenderPanel';
import { SealStamp } from './components/ui/SealStamp';
import { Dialog } from './components/ui/Dialog';
import type { LookSnapshot } from './components/CompareView';

import type {
  Garment,
  CharacterItem,
  Outfit,
  CultureCheckResult,
  StyleScoreResult,
} from './types/fashion';
import type { FunctionalNeedCode } from './types/domain';
import type { GeminiCaptionResponse, GeminiExplainResponse, GeminiVisionResponse } from './types/gemini';
import {
  getApprovedAccessories,
  getApprovedGarments,
  getAdaptiveNeeds,
  getApprovedSources,
  getCharacters,
  getEventById,
  getEvents,
  getValidatedAdaptiveAdjustments,
  getWeatherContexts,
} from './lib/dal';
import { checkCulture } from './lib/culture/ruleEngine';
import {
  calculateStyleScore,
  type DeterministicRecommendation,
  getDeterministicRecommendations,
  type RecommendationContext,
} from './lib/recommendation/engine';
import {
  analyzeOutfitPhoto,
  explainOutfit,
  GeminiRequestError,
  getGeminiRecommendation,
  getOutfitCaptions,
  getServerHealth,
  parseNaturalLanguagePrompt,
  renderOutfitImage,
  type ServerHealth,
} from './lib/gemini/client';
import { evaluateColorHarmony } from './lib/color/harmony';
import { prepareImageForGemini, type PreparedImage } from './lib/image/prepareImage';
import { STYLE_CHOICES, STYLE_VIBE_BY_TAG, styleLabel, styleTagFor } from './lib/styles';
import { getSavedOutfits, saveOutfitToLookbook } from './lib/storage/lookbook';

const GarmentDetailModal = lazy(() => import('./components/GarmentDetailModal').then((module) => ({ default: module.GarmentDetailModal })));
const CompareView = lazy(() => import('./components/CompareView').then((module) => ({ default: module.CompareView })));
const LookbookDrawer = lazy(() => import('./components/LookbookDrawer').then((module) => ({ default: module.LookbookDrawer })));
const ShareModal = lazy(() => import('./components/ShareModal').then((module) => ({ default: module.ShareModal })));
const AdaptiveTailoringSheet = lazy(() => import('./components/AdaptiveTailoringSheet').then((module) => ({ default: module.AdaptiveTailoringSheet })));
const AdminKnowledgeModal = lazy(() => import('./components/AdminKnowledgeModal').then((module) => ({ default: module.AdminKnowledgeModal })));

type JourneyStep = 'CONTEXT' | 'ADAPTIVE' | 'CHARACTER' | 'GARMENT' | 'STYLE' | 'COLOR' | 'ACCESSORIES' | 'RECOMMENDATION' | 'RESULT';

const JOURNEY_STEPS: { id: JourneyStep; label: string }[] = [
  { id: 'CONTEXT', label: 'Bối cảnh' },
  { id: 'ADAPTIVE', label: 'Thích ứng' },
  { id: 'CHARACTER', label: 'Nhân vật' },
  { id: 'GARMENT', label: 'Y phục' },
  { id: 'STYLE', label: 'Phong cách' },
  { id: 'COLOR', label: 'Màu sắc' },
  { id: 'ACCESSORIES', label: 'Phụ kiện' },
  { id: 'RECOMMENDATION', label: 'Gợi ý' },
  { id: 'RESULT', label: 'Kết quả' },
];

const garments = getApprovedGarments();
const characters = getCharacters();
const accessories = getApprovedAccessories();
const events = getEvents();
const weatherIds = new Set(getWeatherContexts().map((weather) => weather.id));
const accessoriesById = new Map(accessories.map((accessory) => [accessory.id, accessory]));

function isAccessoryAllowed(accessoryId: string, garment: Garment, eventId: string): boolean {
  const accessory = accessoriesById.get(accessoryId);
  return Boolean(accessory &&
    garment.compatibleAccessoryIds.includes(accessoryId) &&
    accessory.compatibleGarmentIds.includes(garment.id) &&
    (!accessory.compatibleEventIds.length || accessory.compatibleEventIds.includes(eventId)));
}

function defaultPantColor(garment: Garment): string {
  return garment.id === 'garment-ao-tac' || garment.id === 'garment-ao-nhat-binh' || garment.id === 'garment-ao-dai-truyen-thong'
    ? '#F4F0E8'
    : '#1C1C1E';
}

function scrollToId(id: string) {
  window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

export default function App() {
  const [activeMainTab, setActiveMainTab] = useState<'STYLING' | 'DISCOVERY'>('STYLING');

  // Outfit state
  const [selectedGarment, setSelectedGarment] = useState<Garment>(garments[0]);
  const [primaryColorHex, setPrimaryColorHex] = useState<string>(garments[0].baseColors[0].hex);
  const [pantColorHex, setPantColorHex] = useState<string>('#1C1C1E');
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState<string[]>(['acc-khan-dong', 'acc-the-bai']);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterItem>(characters[0]);
  const [skinTone, setSkinTone] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('EVENT_GRADUATION');
  const [selectedWeatherId, setSelectedWeatherId] = useState<string>('WEATHER_HOT');
  const [selectedStyleVibe, setSelectedStyleVibe] = useState<string>('TOI_GIAN');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedEventDate, setSelectedEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedAdaptiveNeedCodes, setSelectedAdaptiveNeedCodes] = useState<FunctionalNeedCode[]>([]);
  const adaptiveNeedCode = selectedAdaptiveNeedCodes[0];

  // Journey + recommendations
  const [journeyStep, setJourneyStep] = useState<JourneyStep>('CONTEXT');
  const [recommendations, setRecommendations] = useState<DeterministicRecommendation[]>([]);
  const [recommendationState, setRecommendationState] = useState<'IDLE' | 'LOADING' | 'READY' | 'EMPTY' | 'UNSUPPORTED' | 'ERROR'>('IDLE');
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationUsedFallback, setRecommendationUsedFallback] = useState(true);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);

  // Gemini
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [healthChecked, setHealthChecked] = useState(false);
  const [stylistProgress, setStylistProgress] = useState<StylistProgress>({ stage: 'idle' });
  const [aiExplanation, setAiExplanation] = useState<GeminiExplainResponse | null>(null);
  const [aiCaption, setAiCaption] = useState<{ key: string; caption: GeminiCaptionResponse } | null>(null);
  const [isLoadingExplain, setIsLoadingExplain] = useState(false);
  const [isLoadingCaption, setIsLoadingCaption] = useState(false);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const explainRequestRef = useRef(0);
  const [explainNonce, setExplainNonce] = useState(0);

  // Photo (Gemini Vision) + AI render
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [photoAnalysis, setPhotoAnalysis] = useState<GeminiVisionResponse | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [useReferenceForRender, setUseReferenceForRender] = useState(false);
  const [renderStates, setRenderStates] = useState<Record<string, RenderState>>({});
  const [visualTab, setVisualTab] = useState<'MOCKUP' | 'AI'>('MOCKUP');

  // UI
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [isLookbookOpen, setIsLookbookOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isTailoringSheetOpen, setIsTailoringSheetOpen] = useState(false);
  const [tailoringNeedCode, setTailoringNeedCode] = useState<string>('WHEELCHAIR_SEATED');
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<Outfit | null>(null);
  const [inspectedGarment, setInspectedGarment] = useState<Garment | null>(null);
  const [lookbookCount, setLookbookCount] = useState(0);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMessage(null), 4200);
  }, []);

  const displayCharacter = useMemo<CharacterItem>(() => (
    skinTone ? { ...selectedCharacter, skinTone, defaultSkinTone: skinTone } : selectedCharacter
  ), [selectedCharacter, skinTone]);

  // Mount: health check, lookbook count, shared-link hydration
  useEffect(() => {
    setLookbookCount(getSavedOutfits().length);
    getServerHealth().then((result) => {
      setHealth(result);
      setHealthChecked(true);
    });

    const params = new URLSearchParams(window.location.search);
    const garment = garments.find((item) => item.id === params.get('garment'));
    if (!garment) return;
    const color = garment.baseColors.find((item) => item.hex.toLowerCase() === `#${params.get('color') ?? ''}`.toLowerCase());
    const eventId = getEventById(params.get('event') ?? '')?.id ?? 'EVENT_GRADUATION';
    const pant = params.get('pant');
    const vibe = params.get('vibe');
    const accessoryIds = (params.get('acc') ?? '').split(',').filter((id) => isAccessoryAllowed(id, garment, eventId));
    const adaptiveCodes = (params.get('adaptive') ?? '').split(',').filter((code) =>
      getAdaptiveNeeds().some((need) => need.code === code)) as FunctionalNeedCode[];

    setSelectedGarment(garment);
    setPrimaryColorHex(color?.hex ?? garment.baseColors[0].hex);
    if (pant && /^[0-9a-fA-F]{6}$/.test(pant)) setPantColorHex(`#${pant}`);
    setSelectedEventId(eventId);
    if (vibe && STYLE_CHOICES.some((style) => style.id === vibe)) setSelectedStyleVibe(vibe);
    setSelectedAccessoryIds(accessoryIds);
    setSelectedAdaptiveNeedCodes(adaptiveCodes);
    setJourneyStep('RESULT');
    showToast(`Đã mở bản phối được chia sẻ: ${garment.name}`);
    scrollToId('styling-flow');
  }, [showToast]);

  const activeAccessories = useMemo(
    () => accessories.filter((accessory) => selectedAccessoryIds.includes(accessory.id)),
    [selectedAccessoryIds],
  );
  const currentEvent = getEventById(selectedEventId);
  const currentEventName = currentEvent?.name ?? 'Sự kiện đã chọn';

  const cultureResult: CultureCheckResult = useMemo(() => checkCulture({
    garmentId: selectedGarment.id,
    accessoryIds: selectedAccessoryIds,
    eventId: selectedEventId,
    primaryColor: primaryColorHex,
    adaptiveNeedCode,
  }), [selectedGarment.id, selectedAccessoryIds, selectedEventId, primaryColorHex, adaptiveNeedCode]);

  const styleResult: StyleScoreResult = useMemo(() => calculateStyleScore(
    selectedGarment,
    primaryColorHex,
    selectedAccessoryIds,
    selectedEventId,
    selectedStyleVibe,
  ), [selectedGarment, primaryColorHex, selectedAccessoryIds, selectedEventId, selectedStyleVibe]);

  const harmonyResult = useMemo(() => evaluateColorHarmony({
    primaryColor: primaryColorHex,
    pantColor: pantColorHex,
    accessoryColors: activeAccessories.map((accessory) => accessory.colors[0]).filter(Boolean),
    eventAdvice: currentEvent?.culturalAdvice,
    eventName: currentEvent?.name,
  }), [primaryColorHex, pantColorHex, activeAccessories, currentEvent]);

  const harmonySwatches = useMemo(() => {
    const colorName = selectedGarment.baseColors.find((color) => color.hex.toLowerCase() === primaryColorHex.toLowerCase())?.name ?? 'Tà áo';
    return [
      { label: colorName, hex: primaryColorHex },
      { label: 'Quần / váy', hex: pantColorHex },
      ...activeAccessories.slice(0, 4).map((accessory) => ({ label: accessory.name, hex: accessory.colors[0] ?? '#888888' })),
    ];
  }, [selectedGarment, primaryColorHex, pantColorHex, activeAccessories]);

  // ---------------------------------------------------------------------------
  // Gemini: explanation (auto on result), caption (on demand)
  // ---------------------------------------------------------------------------

  const outfitKey = [
    selectedGarment.id, primaryColorHex, selectedEventId, selectedStyleVibe,
    [...selectedAccessoryIds].sort().join('+'), selectedAdaptiveNeedCodes.join('+'),
  ].join('|');

  const requestOutfitExplanation = useCallback(async () => {
    const requestId = ++explainRequestRef.current;
    setIsLoadingExplain(true);
    try {
      const response = await explainOutfit({
        garment: selectedGarment,
        cultureCheck: cultureResult,
        eventId: selectedEventId,
        eventName: currentEventName,
        styleVibe: selectedStyleVibe,
        primaryColor: primaryColorHex,
        accessoryIds: selectedAccessoryIds,
        accessoryNames: activeAccessories.map((accessory) => accessory.name),
        adaptiveNeedCodes: selectedAdaptiveNeedCodes,
      });
      if (requestId === explainRequestRef.current) setAiExplanation(response);
    } finally {
      if (requestId === explainRequestRef.current) {
        setIsLoadingExplain(false);
        setStylistProgress((progress) => (progress.stage === 'writing' ? { ...progress, stage: 'done' } : progress));
      }
    }
    // outfitKey captures every input the explanation depends on.
  }, [outfitKey]);

  useEffect(() => {
    if (journeyStep !== 'RESULT') return;
    // Debounce so clicking through colours does not fire one Gemini call per click.
    const timer = window.setTimeout(() => void requestOutfitExplanation(), 450);
    return () => window.clearTimeout(timer);
  }, [journeyStep, requestOutfitExplanation, explainNonce]);

  const requestCaptionFor = async (outfit: Outfit, key: string) => {
    const garment = garments.find((item) => item.id === outfit.garmentId);
    if (!garment) return;
    setIsLoadingCaption(true);
    try {
      const caption = await getOutfitCaptions({
        garmentId: outfit.garmentId,
        garmentName: garment.name,
        styleTitle: `${garment.name} · ${styleLabel(outfit.styleVibe)}`,
        eventId: outfit.eventId,
        eventTitle: getEventById(outfit.eventId)?.name ?? 'dịp đặc biệt',
        chuanScore: outfit.chuanScore,
        chatScore: outfit.chatScore,
        vibe: outfit.styleVibe,
        primaryColor: outfit.primaryColor,
        accessoryIds: outfit.accessoryIds.filter((id) => isAccessoryAllowed(id, garment, outfit.eventId)),
        adaptiveNeedCodes: outfit.adaptiveNeedCodes,
      });
      setAiCaption({ key, caption });
    } finally {
      setIsLoadingCaption(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Natural language (Context step) + one-shot AI Stylist
  // ---------------------------------------------------------------------------

  const handleNaturalLanguageSubmit = async (promptText: string) => {
    setIsAiParsing(true);
    try {
      const parsed = await parseNaturalLanguagePrompt(promptText);
      if (parsed.eventId) setSelectedEventId(parsed.eventId);
      if (parsed.weatherId) setSelectedWeatherId(parsed.weatherId);
      if (parsed.styleId && STYLE_CHOICES.some((style) => style.id === parsed.styleId)) setSelectedStyleVibe(parsed.styleId);
      if (parsed.needCodes.length) setSelectedAdaptiveNeedCodes(parsed.needCodes);
      const garment = garments.find((item) => item.id === parsed.garmentId);
      if (garment) {
        setSelectedGarment(garment);
        setPrimaryColorHex(garment.baseColors.find((color) => color.hex.toLowerCase() === parsed.color?.toLowerCase())?.hex ?? garment.baseColors[0].hex);
      } else if (parsed.color && selectedGarment.baseColors.some((color) => color.hex.toLowerCase() === parsed.color?.toLowerCase())) {
        setPrimaryColorHex(parsed.color);
      }
      showToast(parsed.usedFallback || parsed.confirmationRequired.length
        ? `${parsed.summary} Các mục chưa rõ vẫn để bạn tự chọn.`
        : `Gemini đã điền: ${parsed.summary}`);
    } finally {
      setIsAiParsing(false);
    }
  };

  const applyCandidate = (candidate: DeterministicRecommendation, styleOverride?: string) => {
    const garment = garments.find((item) => item.id === candidate.garmentId);
    if (!garment) return;
    if (garment.id !== selectedGarment.id) setPantColorHex(defaultPantColor(garment));
    setSelectedGarment(garment);
    setPrimaryColorHex(candidate.color);
    setSelectedAccessoryIds(candidate.accessoryIds);
    setSelectedStyleVibe(styleOverride ?? STYLE_VIBE_BY_TAG[candidate.style] ?? candidate.style);
    setSelectedRecommendationId(candidate.outfitId);
    setVisualTab('MOCKUP');
  };

  const runAiStylist = async (text: string) => {
    setActiveMainTab('STYLING');
    setStylistProgress({ stage: 'parsing' });
    try {
      const parsed = await parseNaturalLanguagePrompt(text);
      const eventId = parsed.eventId ?? selectedEventId;
      const weatherId = parsed.weatherId && weatherIds.has(parsed.weatherId) ? parsed.weatherId : selectedWeatherId;
      const styleId = parsed.styleId && STYLE_CHOICES.some((style) => style.id === parsed.styleId) ? parsed.styleId : selectedStyleVibe;
      const needCodes = parsed.needCodes.length ? parsed.needCodes : selectedAdaptiveNeedCodes;
      const photoColor = photoAnalysis?.colorMatches[0];
      const colorPreference = parsed.color ?? photoColor?.colorHex;
      const garmentPreference = parsed.garmentId ?? (photoAnalysis?.suggestedGarmentIds[0] || undefined);

      setStylistProgress({ stage: 'filtering', summary: parsed.summary, usedFallback: parsed.usedFallback });
      const baseContext: RecommendationContext = {
        eventId,
        weatherId,
        location: selectedLocation || undefined,
        style: styleTagFor(styleId),
        colorPreferences: colorPreference ? [colorPreference] : [],
        accessoryIds: parsed.accessoryIds,
        characterId: selectedCharacter.id,
        adaptiveNeedCodes: needCodes,
        garmentPreferences: garmentPreference ? { preferredGarmentIds: [garmentPreference] } : undefined,
        limit: 6,
      };
      let context = baseContext;
      let candidates = getDeterministicRecommendations(context);
      if (!candidates.length && needCodes.length) {
        context = { ...baseContext, adaptiveNeedCodes: [] };
        candidates = getDeterministicRecommendations(context);
        if (candidates.length) showToast('Chưa có điều chỉnh thích ứng đã xác thực cho dịp này, Vstyle gợi ý bản phối tiêu chuẩn.');
      }
      if (!candidates.length) {
        setStylistProgress({ stage: 'error', summary: parsed.summary, usedFallback: parsed.usedFallback, message: 'Chưa có bản phối đã duyệt cho tổ hợp này. Thử đổi dịp hoặc phong cách.' });
        return;
      }

      setStylistProgress({ stage: 'ranking', summary: parsed.summary, usedFallback: parsed.usedFallback });
      const ranking = await getGeminiRecommendation(context, candidates);
      const byId = new Map(candidates.map((candidate) => [candidate.outfitId, candidate]));
      const ordered = ranking.candidateIds.flatMap((id) => byId.get(id) ?? []);
      const finalCandidates = (ordered.length ? ordered : candidates).slice(0, 3);

      setSelectedEventId(eventId);
      setSelectedWeatherId(weatherId);
      setSelectedAdaptiveNeedCodes(context.adaptiveNeedCodes ?? []);
      setRecommendations(finalCandidates);
      setRecommendationUsedFallback(ranking.usedFallback);
      setRecommendationState('READY');
      applyCandidate(finalCandidates[0], styleId);
      setStylistProgress({ stage: 'writing', summary: parsed.summary, usedFallback: parsed.usedFallback || ranking.usedFallback });
      setJourneyStep('RESULT');
      setExplainNonce((value) => value + 1);
      scrollToId('styling-flow');
    } catch {
      setStylistProgress({ stage: 'error', message: 'Có lỗi khi phối đồ. Bạn thử lại hoặc chọn "Tự phối từng bước".' });
    }
  };

  // ---------------------------------------------------------------------------
  // Manual recommendation step
  // ---------------------------------------------------------------------------

  const handleRequestRecommendations = async () => {
    setJourneyStep('RECOMMENDATION');
    setRecommendationState('LOADING');
    setRecommendationError(null);
    setRecommendations([]);
    setSelectedRecommendationId(null);

    try {
      const context: RecommendationContext = {
        eventId: selectedEventId,
        location: selectedLocation || undefined,
        weatherId: selectedWeatherId,
        garmentPreferences: { preferredGarmentIds: [selectedGarment.id] },
        style: styleTagFor(selectedStyleVibe),
        colorPreferences: [primaryColorHex],
        accessoryIds: selectedAccessoryIds,
        characterId: selectedCharacter.id,
        adaptiveNeedCodes: selectedAdaptiveNeedCodes,
        limit: 6,
      };
      const candidates = getDeterministicRecommendations(context);
      const ranking = await getGeminiRecommendation(context, candidates);
      const candidatesById = new Map(candidates.map((candidate) => [candidate.outfitId, candidate]));
      const orderedCandidates = ranking.candidateIds.flatMap((id) => candidatesById.get(id) ?? []);
      const finalCandidates = (orderedCandidates.length ? orderedCandidates : candidates).slice(0, 3);
      setRecommendationUsedFallback(ranking.usedFallback);
      setRecommendations(finalCandidates);
      setRecommendationState(finalCandidates.length ? 'READY' : selectedAdaptiveNeedCodes.length ? 'UNSUPPORTED' : 'EMPTY');
    } catch {
      setRecommendationError('Không thể tạo gợi ý lúc này. Các lựa chọn của bạn vẫn được giữ nguyên.');
      setRecommendationState('ERROR');
    }
  };

  const handleUseRecommendation = (candidate: DeterministicRecommendation) => {
    applyCandidate(candidate);
    setJourneyStep('RESULT');
  };

  // ---------------------------------------------------------------------------
  // Photo inspiration (Gemini Vision)
  // ---------------------------------------------------------------------------

  const handlePickPhoto = async (file: File) => {
    setPhotoError(null);
    setPhotoAnalysis(null);
    try {
      const prepared = await prepareImageForGemini(file);
      setPhoto(prepared);
      setPhotoConsent(false);
      setUseReferenceForRender(false);
      void analyzePhoto(prepared);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Không đọc được ảnh.');
    }
  };

  const analyzePhoto = async (prepared: PreparedImage | null = photo) => {
    if (!prepared) return;
    setIsAnalyzingPhoto(true);
    setPhotoError(null);
    try {
      const analysis = await analyzeOutfitPhoto(prepared.image);
      setPhotoAnalysis(analysis);
      if (!analysis.usedFallback) showToast('Gemini đã đọc bảng màu từ ảnh của bạn.');
    } catch (error) {
      setPhotoError(error instanceof GeminiRequestError && error.status === 429
        ? error.message
        : 'Chưa phân tích được ảnh. Bạn vẫn có thể chọn màu thủ công.');
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const clearPhoto = () => {
    setPhoto(null);
    setPhotoAnalysis(null);
    setPhotoError(null);
    setPhotoConsent(false);
    setUseReferenceForRender(false);
  };

  const applyPhotoMatch = (garmentId: string, colorHex: string) => {
    const garment = garments.find((item) => item.id === garmentId);
    if (!garment) return;
    if (garment.id !== selectedGarment.id) {
      setSelectedGarment(garment);
      setPantColorHex(defaultPantColor(garment));
      setSelectedAccessoryIds((ids) => ids.filter((id) => isAccessoryAllowed(id, garment, selectedEventId)));
    }
    setPrimaryColorHex(colorHex);
    showToast(`Đã chọn ${garment.name} với màu gần ảnh của bạn.`);
  };

  // ---------------------------------------------------------------------------
  // AI render (Nano Banana)
  // ---------------------------------------------------------------------------

  const canUseReference = Boolean(photo && photoConsent);
  const renderKey = `${outfitKey}|${pantColorHex}|${displayCharacter.id}|${skinTone ?? ''}|${canUseReference && useReferenceForRender ? 'ref' : 'noref'}`;
  const renderState: RenderState = renderStates[renderKey] ?? { status: 'idle' };

  const generateRender = async () => {
    const key = renderKey;
    setRenderStates((states) => ({ ...states, [key]: { status: 'loading' } }));
    try {
      const result = await renderOutfitImage({
        garmentId: selectedGarment.id,
        eventId: selectedEventId,
        styleId: selectedStyleVibe,
        primaryColor: primaryColorHex,
        pantColor: pantColorHex,
        accessoryIds: selectedAccessoryIds,
        characterId: selectedCharacter.id,
        skinTone: skinTone ?? undefined,
        adaptiveNeedCodes: selectedAdaptiveNeedCodes,
        referenceImage: canUseReference && useReferenceForRender ? photo?.image : undefined,
        consentToUseReference: canUseReference && useReferenceForRender,
      });
      setRenderStates((states) => ({ ...states, [key]: { status: 'ready', result } }));
    } catch (error) {
      setRenderStates((states) => ({
        ...states,
        [key]: { status: 'error', error: error instanceof Error ? error.message : 'Chưa tạo được ảnh AI.' },
      }));
    }
  };

  // ---------------------------------------------------------------------------
  // Outfit editing helpers
  // ---------------------------------------------------------------------------

  const handleSelectGarment = (garment: Garment) => {
    setSelectedGarment(garment);
    setPrimaryColorHex(garment.baseColors[0].hex);
    setPantColorHex(defaultPantColor(garment));
    const compatible = accessories
      .filter((accessory) => isAccessoryAllowed(accessory.id, garment, selectedEventId))
      .slice(0, 2)
      .map((accessory) => accessory.id);
    setSelectedAccessoryIds(compatible);
    setActiveMainTab('STYLING');
    showToast(`Đã chọn ${garment.name}`);
  };

  const handleToggleAccessory = (accessoryId: string) => {
    if (!isAccessoryAllowed(accessoryId, selectedGarment, selectedEventId)) return;
    setSelectedAccessoryIds((previous) =>
      previous.includes(accessoryId) ? previous.filter((id) => id !== accessoryId) : [...previous, accessoryId]);
  };

  const buildCurrentOutfit = (id: string): Outfit => ({
    id,
    title: `${selectedGarment.name} · ${styleLabel(selectedStyleVibe)}`,
    garmentId: selectedGarment.id,
    primaryColor: primaryColorHex,
    pantColor: pantColorHex,
    accessoryIds: selectedAccessoryIds,
    characterId: selectedCharacter.id,
    hairStyle: 'TRUYEN_THONG',
    footwear: 'HAI_SEN',
    adaptiveNeedCode,
    adaptiveNeedCodes: selectedAdaptiveNeedCodes,
    eventId: selectedEventId,
    eventDate: selectedEventDate,
    location: selectedLocation,
    weatherId: selectedWeatherId,
    styleVibe: selectedStyleVibe,
    chuanScore: cultureResult.score,
    chatScore: styleResult.score,
    cultureStatus: cultureResult.status,
    retainedCharacteristics: cultureResult.retainedCharacteristics,
    sources: cultureResult.sourceIds,
    explanation: aiExplanation && !aiExplanation.usedFallback ? aiExplanation.editorialReview : undefined,
    caption: aiCaption?.key === outfitKey ? aiCaption.caption.instagramCaption : undefined,
    createdAt: new Date().toISOString(),
  });

  const handleSaveOutfit = () => {
    const saved = saveOutfitToLookbook(buildCurrentOutfit(`outfit-${Date.now()}`));
    setLookbookCount(getSavedOutfits().length);
    showToast(saved ? 'Đã lưu vào Lookbook.' : 'Trình duyệt đang chặn lưu trữ, chưa lưu được Lookbook.');
  };

  const handleLoadOutfit = (outfit: Outfit) => {
    const garment = garments.find((item) => item.id === outfit.garmentId);
    if (!garment) return;
    setSelectedGarment(garment);
    setPrimaryColorHex(garment.baseColors.some((color) => color.hex.toLowerCase() === outfit.primaryColor.toLowerCase()) ? outfit.primaryColor : garment.baseColors[0].hex);
    setPantColorHex(outfit.pantColor);
    const eventId = getEventById(outfit.eventId)?.id ?? 'EVENT_GRADUATION';
    setSelectedEventId(eventId);
    setSelectedAccessoryIds(outfit.accessoryIds.filter((id) => isAccessoryAllowed(id, garment, eventId)));
    const character = characters.find((item) => item.id === outfit.characterId);
    if (character) setSelectedCharacter(character);
    setSelectedEventDate(outfit.eventDate ?? new Date().toISOString().slice(0, 10));
    setSelectedLocation(outfit.location ?? '');
    if (weatherIds.has(outfit.weatherId)) setSelectedWeatherId(outfit.weatherId);
    setSelectedStyleVibe(STYLE_CHOICES.some((style) => style.id === outfit.styleVibe) ? outfit.styleVibe : 'TRUYEN_THONG_HOANG_GIA');
    setSelectedAdaptiveNeedCodes(outfit.adaptiveNeedCodes ?? (outfit.adaptiveNeedCode ? [outfit.adaptiveNeedCode as FunctionalNeedCode] : []));
    setActiveMainTab('STYLING');
    setJourneyStep('RESULT');
    showToast(`Đã mở bản phối: ${outfit.title}`);
    scrollToId('styling-flow');
  };

  const compareLooks = useMemo<LookSnapshot[]>(() => {
    const current: LookSnapshot = {
      id: 'current',
      title: `Hiện tại · ${selectedGarment.name}`,
      garmentId: selectedGarment.id,
      primaryColor: primaryColorHex,
      pantColor: pantColorHex,
      accessoryIds: selectedAccessoryIds,
      eventId: selectedEventId,
      styleVibe: selectedStyleVibe,
      adaptiveNeedCodes: selectedAdaptiveNeedCodes,
    };
    const fromRecommendations = recommendations.map<LookSnapshot>((candidate, index) => ({
      id: candidate.outfitId,
      title: `Gợi ý ${index + 1} · ${garments.find((garment) => garment.id === candidate.garmentId)?.name ?? ''}`,
      garmentId: candidate.garmentId,
      primaryColor: candidate.color,
      pantColor: pantColorHex,
      accessoryIds: candidate.accessoryIds,
      eventId: candidate.eventId,
      styleVibe: STYLE_VIBE_BY_TAG[candidate.style] ?? candidate.style,
      adaptiveNeedCodes: selectedAdaptiveNeedCodes,
    }));
    const fromLookbook = isCompareOpen ? getSavedOutfits().map<LookSnapshot>((outfit) => ({
      id: `lookbook-${outfit.id}`,
      title: `Lookbook · ${outfit.title}`,
      garmentId: outfit.garmentId,
      primaryColor: outfit.primaryColor,
      pantColor: outfit.pantColor,
      accessoryIds: outfit.accessoryIds,
      eventId: getEventById(outfit.eventId)?.id ?? 'EVENT_GRADUATION',
      styleVibe: outfit.styleVibe,
      adaptiveNeedCodes: outfit.adaptiveNeedCodes,
    })) : [];
    // Drop options that are identical to one already listed (e.g. the applied top suggestion = current look).
    const signature = (look: LookSnapshot) => [look.garmentId, look.primaryColor.toLowerCase(), look.pantColor.toLowerCase(), [...look.accessoryIds].sort().join('+'), look.eventId, look.styleVibe].join('|');
    const seen = new Set<string>();
    return [current, ...fromRecommendations, ...fromLookbook].filter((look) => {
      if (!garments.some((garment) => garment.id === look.garmentId)) return false;
      const key = signature(look);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [selectedGarment, primaryColorHex, pantColorHex, selectedAccessoryIds, selectedEventId, selectedStyleVibe, selectedAdaptiveNeedCodes, recommendations, isCompareOpen]);

  const handleUseComparedLook = (look: LookSnapshot) => {
    const garment = garments.find((item) => item.id === look.garmentId);
    if (!garment) return;
    setSelectedGarment(garment);
    setPrimaryColorHex(look.primaryColor);
    setPantColorHex(look.pantColor);
    setSelectedEventId(look.eventId);
    setSelectedAccessoryIds(look.accessoryIds.filter((id) => isAccessoryAllowed(id, garment, look.eventId)));
    setSelectedStyleVibe(look.styleVibe);
    setIsCompareOpen(false);
    setJourneyStep('RESULT');
    scrollToId('styling-flow');
  };

  const selectedRecommendation = recommendations.find((candidate) => candidate.outfitId === selectedRecommendationId);
  const verifiedSourceIds = new Set(getApprovedSources().map((source) => source.id));
  const currentAdaptiveAdjustments = getValidatedAdaptiveAdjustments().filter((adjustment) =>
    selectedAdaptiveNeedCodes.includes(adjustment.needCode) &&
    (adjustment.garmentId === 'ALL' || adjustment.garmentId === selectedGarment.id) &&
    verifiedSourceIds.has(adjustment.sourceId));
  const journeyStepIndex = JOURNEY_STEPS.findIndex((step) => step.id === journeyStep);
  const geminiOnline = healthChecked ? Boolean(health?.hasGeminiKey) : null;
  const shareCaption = shareTarget && aiCaption?.key === (shareTarget.id === 'current' ? outfitKey : shareTarget.id) ? aiCaption.caption : null;

  const navButton = 'press rounded-xl border border-stone-700 px-4 py-2.5 text-sm text-stone-300 hover:border-stone-500 hover:text-stone-100';
  const primaryButton = 'press rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-stone-950 hover:bg-amber-300';

  return (
    <div className="min-h-dvh pb-24 text-stone-100 font-sans">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-amber-400 focus:px-4 focus:py-2 focus:text-stone-950">
        Bỏ qua tới nội dung chính
      </a>
      <Navbar
        onOpenLookbook={() => setIsLookbookOpen(true)}
        onOpenCompare={() => setIsCompareOpen(true)}
        onOpenTailoringSheet={() => setIsTailoringSheetOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        lookbookCount={lookbookCount}
      />

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-5 z-[55] flex justify-center sm:inset-x-auto sm:right-6">
        {toastMessage && (
          <div className="pointer-events-auto max-w-md rounded-2xl border border-amber-500/40 bg-stone-900/95 px-4 py-3 text-sm text-stone-100 shadow-2xl shadow-black/50 backdrop-blur animate-rise">
            {toastMessage}
          </div>
        )}
      </div>

      <main id="main" className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <AiStylistComposer
          progress={stylistProgress}
          geminiOnline={geminiOnline}
          photoPreviewUrl={photo?.previewUrl ?? null}
          onRun={runAiStylist}
          onPickPhoto={(file) => {
            void handlePickPhoto(file);
            showToast('Đang đọc ảnh cảm hứng… kết quả hiện ở bước Bối cảnh.');
          }}
          onManualStart={() => {
            setActiveMainTab('STYLING');
            setJourneyStep('CONTEXT');
            scrollToId('styling-flow');
          }}
          onExplore={() => {
            setActiveMainTab('DISCOVERY');
            scrollToId('main-tabs');
          }}
        />

        <div id="main-tabs" className="mb-6 flex scroll-mt-24 flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3">
          <div role="tablist" aria-label="Khu vực chính" className="flex items-center gap-2">
            {([
              ['STYLING', 'Phối đồ'],
              ['DISCOVERY', `Bách khoa y phục (${garments.length})`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeMainTab === id}
                onClick={() => setActiveMainTab(id)}
                className={`press min-h-10 rounded-xl px-4 text-sm font-semibold ${activeMainTab === id ? 'bg-stone-100 text-stone-950' : 'border border-stone-800 text-stone-400 hover:text-stone-100'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-400 tabular">
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-son-500" />Chuẩn {cultureResult.score}</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-amber-400" />Chất {styleResult.score}</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-emerald-400" />Màu {harmonyResult.score}</span>
          </div>
        </div>

        {activeMainTab === 'STYLING' && (
          <section id="styling-flow" aria-label="Tạo bản phối" className="scroll-mt-24 space-y-5">
            <div className="border-b border-stone-800 pb-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-300 tabular">Bước {journeyStepIndex + 1}/{JOURNEY_STEPS.length}</p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold text-stone-100">{JOURNEY_STEPS[journeyStepIndex]?.label}</h2>
                </div>
                <p className="text-xs text-stone-400">{currentEventName}{selectedLocation ? ` · ${selectedLocation}` : ''}</p>
              </div>
              <nav aria-label="Các bước tạo bản phối" className="-mx-1 mt-4 overflow-x-auto pb-1">
                <ol className="flex min-w-max gap-1.5 px-1">
                  {JOURNEY_STEPS.map((step, index) => (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() => setJourneyStep(step.id)}
                        aria-current={journeyStep === step.id ? 'step' : undefined}
                        className={`press flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs ${
                          journeyStep === step.id
                            ? 'border-amber-400 bg-amber-950/40 text-amber-100'
                            : index < journeyStepIndex
                              ? 'border-stone-700 bg-stone-900 text-stone-200'
                              : 'border-stone-800 text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-black/25 text-[10px] tabular">{index + 1}</span>
                        {step.label}
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>

            {journeyStep === 'CONTEXT' && (
              <div className="space-y-4">
                <ContextSelector
                  selectedEventId={selectedEventId}
                  selectedWeatherId={selectedWeatherId}
                  selectedLocation={selectedLocation}
                  selectedDate={selectedEventDate}
                  onEventChange={setSelectedEventId}
                  onWeatherChange={setSelectedWeatherId}
                  onLocationChange={setSelectedLocation}
                  onDateChange={setSelectedEventDate}
                  onNaturalLanguageSubmit={handleNaturalLanguageSubmit}
                  isAiParsing={isAiParsing}
                />
                <PhotoInspirationCard
                  previewUrl={photo?.previewUrl ?? null}
                  analysis={photoAnalysis}
                  isAnalyzing={isAnalyzingPhoto}
                  error={photoError}
                  consentForRender={photoConsent}
                  onPickPhoto={(file) => void handlePickPhoto(file)}
                  onAnalyze={() => void analyzePhoto()}
                  onClear={clearPhoto}
                  onConsentChange={(value) => {
                    setPhotoConsent(value);
                    setUseReferenceForRender(value);
                  }}
                  onApplyMatch={applyPhotoMatch}
                  onApplyContext={(styleId, eventId) => {
                    if (styleId && STYLE_CHOICES.some((style) => style.id === styleId)) setSelectedStyleVibe(styleId);
                    if (eventId && getEventById(eventId)) setSelectedEventId(eventId);
                    showToast('Đã áp dụng gợi ý từ ảnh.');
                  }}
                />
                <div className="flex justify-end">
                  <button type="button" onClick={() => setJourneyStep('ADAPTIVE')} className={primaryButton}>Tiếp tục · Thích ứng</button>
                </div>
              </div>
            )}

            {journeyStep === 'ADAPTIVE' && (
              <div className="space-y-4">
                <AdaptiveSelector
                  selectedNeedCodes={selectedAdaptiveNeedCodes}
                  onChange={(codes) => setSelectedAdaptiveNeedCodes(codes as FunctionalNeedCode[])}
                  onOpenTailoringSheet={(needCode) => {
                    setTailoringNeedCode(needCode);
                    setIsTailoringSheetOpen(true);
                  }}
                />
                <div className="flex flex-wrap justify-between gap-2">
                  <button type="button" onClick={() => setJourneyStep('CONTEXT')} className={navButton}>Quay lại</button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setSelectedAdaptiveNeedCodes([]); setJourneyStep('CHARACTER'); }} className={navButton}>Bỏ qua</button>
                    <button type="button" onClick={() => setJourneyStep('CHARACTER')} className={primaryButton}>Tiếp tục</button>
                  </div>
                </div>
              </div>
            )}

            {journeyStep === 'CHARACTER' && (
              <div className="space-y-4">
                <CharacterSelector
                  selectedCharacterId={selectedCharacter.id}
                  onSelect={setSelectedCharacter}
                  skinTone={skinTone}
                  onSkinToneChange={setSkinTone}
                />
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setJourneyStep('ADAPTIVE')} className={navButton}>Quay lại</button>
                  <button type="button" onClick={() => setJourneyStep('GARMENT')} className={primaryButton}>Tiếp tục · Chọn y phục</button>
                </div>
              </div>
            )}

            {journeyStep === 'GARMENT' && (
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(250px,0.75fr)_minmax(0,1.5fr)]">
                <div className="space-y-3 lg:sticky lg:top-20">
                  <OutfitMockupCanvas
                    garment={selectedGarment}
                    primaryColor={primaryColorHex}
                    pantColor={pantColorHex}
                    accessories={activeAccessories}
                    character={displayCharacter}
                    adaptiveNeedCodes={selectedAdaptiveNeedCodes}
                    styleId={selectedStyleVibe}
                  />
                  <div className="rounded-xl border border-stone-800 bg-stone-900 p-3">
                    <p className="font-serif text-base font-semibold text-stone-100">{selectedGarment.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-400">{selectedGarment.description}</p>
                    <button type="button" onClick={() => setInspectedGarment(selectedGarment)} className="mt-2 min-h-9 text-xs font-medium text-amber-300 underline underline-offset-4">
                      Xem nguồn gốc &amp; ý nghĩa
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  <GarmentDiscovery
                    selectedGarmentId={selectedGarment.id}
                    onSelectGarment={handleSelectGarment}
                    onViewDetails={setInspectedGarment}
                    approvedOnly
                  />
                  <div className="flex justify-between gap-2">
                    <button type="button" onClick={() => setJourneyStep('CHARACTER')} className={navButton}>Quay lại</button>
                    <button type="button" onClick={() => setJourneyStep('STYLE')} className={primaryButton}>Tiếp tục · Phong cách</button>
                  </div>
                </div>
              </div>
            )}

            {journeyStep === 'STYLE' && (
              <div className="space-y-4">
                <div role="radiogroup" aria-label="Chọn phong cách" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {STYLE_CHOICES.map((style) => {
                    const selected = selectedStyleVibe === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSelectedStyleVibe(style.id)}
                        className={`press min-h-28 rounded-2xl border p-4 text-left ${selected ? 'border-amber-400 bg-amber-950/35' : 'border-stone-800 bg-stone-900 hover:border-stone-600'}`}
                      >
                        <span className="block font-serif text-xl font-semibold text-stone-100">{style.label}</span>
                        <span className="mt-1 block text-sm leading-relaxed text-stone-400">{style.description}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setJourneyStep('GARMENT')} className={navButton}>Quay lại</button>
                  <button type="button" onClick={() => setJourneyStep('COLOR')} className={primaryButton}>Tiếp tục · Màu sắc</button>
                </div>
              </div>
            )}

            {journeyStep === 'COLOR' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
                  <StyleCustomizer
                    garment={selectedGarment}
                    selectedColorHex={primaryColorHex}
                    selectedPantColorHex={pantColorHex}
                    selectedAccessoryIds={selectedAccessoryIds}
                    eventId={selectedEventId}
                    showAccessories={false}
                    onColorChange={setPrimaryColorHex}
                    onPantColorChange={setPantColorHex}
                    onToggleAccessory={handleToggleAccessory}
                  />
                  <ColorHarmonyCard result={harmonyResult} swatches={harmonySwatches} />
                </div>
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setJourneyStep('STYLE')} className={navButton}>Quay lại</button>
                  <button type="button" onClick={() => setJourneyStep('ACCESSORIES')} className={primaryButton}>Tiếp tục · Phụ kiện</button>
                </div>
              </div>
            )}

            {journeyStep === 'ACCESSORIES' && (
              <div className="space-y-4">
                {cultureResult.status === 'WARNING' && (
                  <div role="alert" className="rounded-xl border border-son-600/60 bg-son-700/15 p-3 text-sm text-son-300">
                    Cách phối này đang làm sai lệch một đặc trưng văn hóa. Xem lý do ở thẻ Chuẩn văn hóa; phần Gợi ý sẽ tự loại các phối bị cảnh báo.
                  </div>
                )}
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
                  <StyleCustomizer
                    garment={selectedGarment}
                    selectedColorHex={primaryColorHex}
                    selectedPantColorHex={pantColorHex}
                    selectedAccessoryIds={selectedAccessoryIds}
                    eventId={selectedEventId}
                    showColors={false}
                    showPantColors={false}
                    onColorChange={setPrimaryColorHex}
                    onPantColorChange={setPantColorHex}
                    onToggleAccessory={handleToggleAccessory}
                  />
                  <CultureCheckCard result={cultureResult} />
                </div>
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setJourneyStep('COLOR')} className={navButton}>Quay lại</button>
                  <button type="button" onClick={handleRequestRecommendations} className={primaryButton}>Gợi ý giúp tôi</button>
                </div>
              </div>
            )}

            {journeyStep === 'RECOMMENDATION' && (
              <section className="space-y-4" aria-live="polite" aria-busy={recommendationState === 'LOADING'}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="font-serif text-xl font-semibold text-stone-100">Gợi ý cho bạn</h3>
                    <p className="mt-1 text-xs text-stone-400">Tối đa 3 bản phối · đã kiểm tra tương thích và quy tắc văn hóa.</p>
                  </div>
                  {recommendationState !== 'LOADING' && (
                    <button type="button" onClick={handleRequestRecommendations} className={navButton}>Tạo gợi ý mới</button>
                  )}
                </div>
                {recommendationState === 'IDLE' && (
                  <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6 text-center">
                    <p className="text-sm text-stone-300">Bối cảnh và lựa chọn đã sẵn sàng.</p>
                    <button type="button" onClick={handleRequestRecommendations} className={`${primaryButton} mt-4`}>Gợi ý giúp tôi</button>
                  </div>
                )}
                {recommendationState === 'LOADING' && (
                  <div role="status" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <span className="sr-only">Đang đối chiếu bối cảnh, thời tiết và quy tắc văn hóa…</span>
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
                        <div className="skeleton aspect-[4/5]" />
                        <div className="space-y-2 p-4"><div className="skeleton h-5 w-2/3 rounded" /><div className="skeleton h-3 w-full rounded" /><div className="skeleton h-10 w-full rounded-xl" /></div>
                      </div>
                    ))}
                  </div>
                )}
                {recommendationState === 'ERROR' && (
                  <div role="alert" className="rounded-2xl border border-son-600/60 bg-son-700/15 p-5">
                    <p className="text-sm text-son-300">{recommendationError}</p>
                    <button type="button" onClick={handleRequestRecommendations} className={`${navButton} mt-3`}>Thử lại</button>
                  </div>
                )}
                {recommendationState === 'EMPTY' && (
                  <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6 text-center">
                    <h4 className="font-serif text-lg font-semibold text-stone-100">Chưa có bản phối phù hợp</h4>
                    <p className="mt-2 text-sm text-stone-400">Thử đổi dịp, màu sắc hoặc y phục để mở rộng lựa chọn.</p>
                    <button type="button" onClick={() => setJourneyStep('GARMENT')} className={`${navButton} mt-4`}>Điều chỉnh lựa chọn</button>
                  </div>
                )}
                {recommendationState === 'UNSUPPORTED' && (
                  <div role="status" className="rounded-2xl border border-amber-800 bg-amber-950/25 p-6">
                    <h4 className="font-serif text-lg font-semibold text-amber-100">Chưa có điều chỉnh đã xác thực cho tổ hợp này</h4>
                    <p className="mt-2 text-sm leading-relaxed text-amber-100/75">Vstyle không áp dụng điều chỉnh chưa kiểm chứng. Bỏ chọn một nhu cầu hoặc chọn dịp/y phục khác để tiếp tục.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setJourneyStep('ADAPTIVE')} className={navButton}>Sửa nhu cầu</button>
                      <button type="button" onClick={() => { setSelectedAdaptiveNeedCodes([]); void handleRequestRecommendations(); }} className={primaryButton}>Tiếp tục không có thích ứng</button>
                    </div>
                  </div>
                )}
                {recommendationState === 'READY' && (
                  <RecommendationGallery
                    candidates={recommendations}
                    character={displayCharacter}
                    pantColor={pantColorHex}
                    adaptiveNeedCodes={selectedAdaptiveNeedCodes}
                    rankedByGemini={!recommendationUsedFallback}
                    onSelect={handleUseRecommendation}
                  />
                )}
              </section>
            )}

            {journeyStep === 'RESULT' && (
              <section aria-label="Kết quả bản phối" className="space-y-5">
                {cultureResult.status === 'WARNING' && (
                  <div role="alert" className="rounded-xl border border-son-600/60 bg-son-700/15 p-3 text-sm text-son-300">
                    Bản phối này có điểm làm sai lệch đặc trưng văn hóa. Xem lý do và nguồn ở thẻ Chuẩn văn hóa trước khi chia sẻ.
                  </div>
                )}

                <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="space-y-3 xl:sticky xl:top-20">
                    <div>
                      <p className="text-xs font-medium text-amber-300">{currentEventName} · {selectedEventDate}{selectedLocation ? ` · ${selectedLocation}` : ''}</p>
                      <h3 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-stone-50">{selectedGarment.name}</h3>
                      <p className="mt-1 text-sm text-stone-400">{styleLabel(selectedStyleVibe)} · {selectedGarment.era}</p>
                    </div>

                    <div role="tablist" aria-label="Kiểu hiển thị bản phối" className="grid grid-cols-2 gap-1 rounded-xl border border-stone-800 bg-stone-950 p-1">
                      {([
                        ['MOCKUP', 'Mockup vector'],
                        ['AI', 'Ảnh AI · Gemini'],
                      ] as const).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={visualTab === id}
                          onClick={() => setVisualTab(id)}
                          className={`press min-h-10 rounded-lg text-sm font-medium ${visualTab === id ? 'bg-stone-800 text-stone-50' : 'text-stone-400 hover:text-stone-200'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {visualTab === 'MOCKUP' ? (
                      <OutfitMockupCanvas
                        garment={selectedGarment}
                        primaryColor={primaryColorHex}
                        pantColor={pantColorHex}
                        accessories={activeAccessories}
                        character={displayCharacter}
                        adaptiveNeedCodes={selectedAdaptiveNeedCodes}
                        styleId={selectedStyleVibe}
                        onColorChange={setPrimaryColorHex}
                      />
                    ) : (
                      <AiRenderPanel
                        state={renderState}
                        garmentName={selectedGarment.name}
                        canUseReference={canUseReference}
                        useReference={useReferenceForRender}
                        imageRenderAvailable={healthChecked ? Boolean(health?.features?.imageRender) : null}
                        onToggleReference={setUseReferenceForRender}
                        onGenerate={() => void generateRender()}
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4 rounded-2xl border border-stone-800 bg-stone-900 p-4">
                      <SealStamp score={cultureResult.score} status={cultureResult.status} size="lg" animate />
                      <dl className="grid flex-1 grid-cols-2 gap-3">
                        <div>
                          <dt className="text-xs text-stone-400">Chất theo gu</dt>
                          <dd className="font-serif text-3xl font-semibold text-amber-200 tabular">{styleResult.score}<span className="text-sm text-stone-500">/100</span></dd>
                          <dd className="text-xs text-stone-400">{styleResult.label}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-stone-400">Hài hòa màu</dt>
                          <dd className="font-serif text-3xl font-semibold text-emerald-300 tabular">{harmonyResult.score}<span className="text-sm text-stone-500">/100</span></dd>
                          <dd className="text-xs text-stone-400">{harmonyResult.label}</dd>
                        </div>
                      </dl>
                    </div>

                    <AIRecommendationPanel
                      explanation={aiExplanation}
                      caption={aiCaption?.key === outfitKey ? aiCaption.caption : null}
                      isLoadingExplain={isLoadingExplain}
                      isLoadingCaption={isLoadingCaption}
                      onRefreshExplain={() => void requestOutfitExplanation()}
                      onRequestCaption={() => void requestCaptionFor(buildCurrentOutfit('current'), outfitKey)}
                    />

                    <section className="rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-5">
                      <h3 className="font-serif text-lg font-semibold text-stone-100">Vì sao bản phối này phù hợp</h3>
                      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-300">
                        {(selectedRecommendation?.reasons ?? styleResult.feedback).slice(0, 5).map((reason) => (
                          <li key={reason} className="flex gap-2"><span aria-hidden="true" className="text-amber-400">·</span>{reason}</li>
                        ))}
                      </ul>
                    </section>

                    {currentAdaptiveAdjustments.length > 0 && (
                      <section className="rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-5">
                        <h3 className="font-serif text-lg font-semibold text-stone-100">Điều chỉnh thích ứng</h3>
                        <div className="mt-3 space-y-3">
                          {currentAdaptiveAdjustments.map((adjustment) => (
                            <div key={adjustment.id} className="border-l-2 border-amber-400 pl-3">
                              <p className="text-sm font-semibold text-amber-200">{adjustment.needName}</p>
                              <p className="mt-1 text-sm leading-relaxed text-stone-300">{adjustment.adjustment}</p>
                              <button type="button" onClick={() => { setTailoringNeedCode(adjustment.needCode); setIsTailoringSheetOpen(true); }} className="mt-1 min-h-9 text-xs text-amber-300 underline underline-offset-4">
                                Xem thông số may đã xác thực
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
                  <CultureCheckCard result={cultureResult} />
                  <div className="space-y-4">
                    <ColorHarmonyCard result={harmonyResult} swatches={harmonySwatches} />
                    <button type="button" onClick={() => setInspectedGarment(selectedGarment)} className="press w-full rounded-2xl border border-stone-800 bg-stone-900 p-4 text-left hover:border-stone-600">
                      <span className="block text-xs text-stone-400">Nguồn gốc &amp; ý nghĩa</span>
                      <span className="mt-1 block font-serif text-lg font-semibold text-stone-100">{selectedGarment.vietnameseTitle}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-stone-300 line-clamp-3">{selectedGarment.culturalMeaning ?? selectedGarment.description}</span>
                    </button>
                  </div>
                </div>

                <div className="sticky bottom-3 z-30 grid grid-cols-2 gap-2 rounded-2xl border border-stone-800 bg-stone-950/90 p-2 shadow-2xl shadow-black/60 backdrop-blur sm:grid-cols-5">
                  <button type="button" onClick={handleSaveOutfit} className="press min-h-11 rounded-xl bg-amber-400 px-3 text-sm font-semibold text-stone-950 hover:bg-amber-300">Lưu Lookbook</button>
                  <button type="button" onClick={() => setShareTarget(buildCurrentOutfit('current'))} className="press min-h-11 rounded-xl border border-stone-700 px-3 text-sm font-medium text-stone-100 hover:border-stone-500">Chia sẻ</button>
                  <button type="button" onClick={() => setIsCompareOpen(true)} className="press min-h-11 rounded-xl border border-stone-700 px-3 text-sm font-medium text-stone-100 hover:border-stone-500">So sánh</button>
                  <button type="button" onClick={() => setJourneyStep('COLOR')} className="press min-h-11 rounded-xl border border-stone-700 px-3 text-sm font-medium text-stone-100 hover:border-stone-500">Chỉnh sửa</button>
                  <button type="button" onClick={() => void handleRequestRecommendations()} className="press col-span-2 min-h-11 rounded-xl border border-stone-700 px-3 text-sm font-medium text-stone-100 hover:border-stone-500 sm:col-span-1">Gợi ý khác</button>
                </div>
              </section>
            )}
          </section>
        )}

        {activeMainTab === 'DISCOVERY' && (
          <GarmentDiscovery
            selectedGarmentId={selectedGarment.id}
            onSelectGarment={(garment) => {
              handleSelectGarment(garment);
              setJourneyStep('COLOR');
              scrollToId('styling-flow');
            }}
            onViewDetails={setInspectedGarment}
          />
        )}

        <footer className="mt-16 border-t border-stone-800 pt-6 text-xs leading-relaxed text-stone-500">
          <p>Vstyle · Việt phục Remix — bài dự thi AI Arena: Viet Nam 2026. Gợi ý văn hóa dựa trên nguồn đã thẩm định trong Cơ sở tri thức; ảnh AI chỉ mang tính minh họa.</p>
          <p className="mt-1">Ảnh bạn tải lên chỉ được gửi tới Gemini khi bạn yêu cầu phân tích hoặc tạo ảnh và không được lưu trên máy chủ Vstyle.</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            <button type="button" onClick={() => setIsAdminOpen(true)} className="min-h-9 text-stone-300 underline underline-offset-4 hover:text-stone-100">Cơ sở tri thức &amp; nguồn</button>
            <button type="button" onClick={() => setIsTailoringSheetOpen(true)} className="min-h-9 text-stone-300 underline underline-offset-4 hover:text-stone-100">Cẩm nang may đo thích ứng</button>
            <button type="button" onClick={() => setIsCompareOpen(true)} className="min-h-9 text-stone-300 underline underline-offset-4 hover:text-stone-100">So sánh phương án</button>
          </div>
        </footer>
      </main>

      <Suspense fallback={null}>
        {inspectedGarment && (
          <GarmentDetailModal
            garment={inspectedGarment}
            onClose={() => setInspectedGarment(null)}
            onSelectForStyling={(garment) => {
              handleSelectGarment(garment);
              setJourneyStep('COLOR');
              scrollToId('styling-flow');
            }}
          />
        )}

        {isCompareOpen && (
          <CompareView
            looks={compareLooks}
            character={displayCharacter}
            onClose={() => setIsCompareOpen(false)}
            onUseLook={handleUseComparedLook}
          />
        )}

        {isLookbookOpen && (
          <LookbookDrawer
            isOpen={isLookbookOpen}
            onClose={() => {
              setIsLookbookOpen(false);
              setLookbookCount(getSavedOutfits().length);
            }}
            onLoadOutfit={handleLoadOutfit}
            onShareOutfit={(outfit) => setShareTarget(outfit)}
          />
        )}

        {shareTarget && (
          <ShareModal
            outfit={shareTarget}
            caption={shareCaption}
            isLoadingCaption={isLoadingCaption}
            onRequestCaption={() => void requestCaptionFor(shareTarget, shareTarget.id === 'current' ? outfitKey : shareTarget.id)}
            onClose={() => setShareTarget(null)}
          />
        )}

        {isTailoringSheetOpen && (
          <Dialog bare title="Cẩm nang may đo thích ứng" size="2xl" onClose={() => setIsTailoringSheetOpen(false)}>
            <AdaptiveTailoringSheet
              needCode={tailoringNeedCode}
              garmentName={selectedGarment.name}
              onClose={() => setIsTailoringSheetOpen(false)}
            />
          </Dialog>
        )}

        {isAdminOpen && <AdminKnowledgeModal onClose={() => setIsAdminOpen(false)} />}
      </Suspense>
    </div>
  );
}
