/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { OutfitMockupCanvas } from './components/OutfitMockupCanvas';
import { ContextSelector } from './components/ContextSelector';
import { AdaptiveSelector } from './components/AdaptiveSelector';
import { CharacterSelector } from './components/CharacterSelector';
import { GarmentDiscovery } from './components/GarmentDiscovery';
import { GarmentDetailModal } from './components/GarmentDetailModal';
import { StyleCustomizer } from './components/StyleCustomizer';
import { RecommendationGallery } from './components/RecommendationGallery';
import { CultureCheckCard } from './components/CultureCheckCard';
import { StyleScoreCard } from './components/StyleScoreCard';
import { CompareView } from './components/CompareView';
import { LookbookDrawer } from './components/LookbookDrawer';
import { ShareModal } from './components/ShareModal';
import { AdaptiveTailoringSheet } from './components/AdaptiveTailoringSheet';
import { AdminKnowledgeModal } from './components/AdminKnowledgeModal';

import {
  Garment,
  CharacterItem,
  Accessory,
  Outfit,
  CultureCheckResult,
  StyleScoreResult,
} from './types/fashion';
import { FunctionalNeedCode, StyleTag } from './types/domain';
import {
  getApprovedAccessories,
  getApprovedGarments,
  getAdaptiveNeeds,
  getApprovedSources,
  getCharacters,
  getEvents,
  getValidatedAdaptiveAdjustments,
} from './lib/dal';

import { checkCulture } from './lib/culture/ruleEngine';
import {
  calculateStyleScore,
  DeterministicRecommendation,
  getDeterministicRecommendations,
  RecommendationContext,
} from './lib/recommendation/engine';
import { parseNaturalLanguagePrompt, getGeminiRecommendation, explainOutfit, getOutfitCaptions } from './lib/gemini/client';
import { GeminiCaptionResponse, GeminiExplainResponse } from './types/gemini';
import {
  getSavedOutfits,
  saveOutfitToLookbook,
} from './lib/storage/lookbook';

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

const STYLE_CHOICES: { id: string; label: string; description: string; tag: StyleTag }[] = [
  { id: 'TRUYEN_THONG_HOANG_GIA', label: 'Traditional', description: 'Nét cổ điển, tiết chế và trang nhã.', tag: 'TRUYEN_THONG' },
  { id: 'CONTEMPORARY', label: 'Contemporary', description: 'Phối Việt phục cùng tinh thần hiện đại.', tag: 'REMIX_GEN_Z' },
  { id: 'TOI_GIAN', label: 'Minimal', description: 'Đường nét gọn, tập trung vào phom dáng.', tag: 'TOI_GIAN' },
  { id: 'NANG_DONG', label: 'Youthful', description: 'Nhẹ nhàng, linh hoạt và tươi mới.', tag: 'NANG_DONG' },
  { id: 'REMIX_GEN_Z', label: 'Gen Z', description: 'Tự do phối lớp theo nhịp sống trẻ.', tag: 'REMIX_GEN_Z' },
  { id: 'SANG_TRONG', label: 'Elegant', description: 'Sắc thái thanh lịch cho dịp trang trọng.', tag: 'SANG_TRONG' },
];

const STYLE_VIBE_BY_TAG: Partial<Record<StyleTag, string>> = {
  TRUYEN_THONG: 'TRUYEN_THONG_HOANG_GIA',
  LE_NGHI: 'TRUYEN_THONG_HOANG_GIA',
  CUNG_DINH: 'SANG_TRONG',
  DAN_GIAN: 'TRUYEN_THONG_HOANG_GIA',
  CO_DIEN: 'TRUYEN_THONG_HOANG_GIA',
  REMIX_GEN_Z: 'REMIX_GEN_Z',
  HOA_NHAP: 'REMIX_GEN_Z',
  TOI_GIAN: 'TOI_GIAN',
  NANG_DONG: 'NANG_DONG',
  SANG_TRONG: 'SANG_TRONG',
  THANH_LICH: 'SANG_TRONG',
};

export default function App() {
  const garments = getApprovedGarments();
  const characters = getCharacters();
  const accessories = getApprovedAccessories();
  const events = getEvents();

  // App Navigation View
  const [activeMainTab, setActiveMainTab] = useState<'STYLING' | 'DISCOVERY'>('STYLING');

  // Styling Flow State
  const [selectedGarment, setSelectedGarment] = useState<Garment>(garments[0]);
  const [primaryColorHex, setPrimaryColorHex] = useState<string>(garments[0].baseColors[0].hex);
  const [pantColorHex, setPantColorHex] = useState<string>('#1C1C1E');
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState<string[]>([
    'acc-khan-dong',
    'acc-the-bai',
  ]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterItem>(characters[0]);
  const [selectedEventId, setSelectedEventId] = useState<string>('EVENT_GRADUATION');
  const [selectedWeatherId, setSelectedWeatherId] = useState<string>('WEATHER_HOT');
  const [selectedStyleVibe, setSelectedStyleVibe] = useState<string>('TOI_GIAN');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedEventDate, setSelectedEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedAdaptiveNeedCodes, setSelectedAdaptiveNeedCodes] = useState<FunctionalNeedCode[]>([]);
  const adaptiveNeedCode = selectedAdaptiveNeedCodes[0];
  const [journeyStep, setJourneyStep] = useState<JourneyStep>('CONTEXT');
  const [recommendations, setRecommendations] = useState<DeterministicRecommendation[]>([]);
  const [recommendationState, setRecommendationState] = useState<'IDLE' | 'LOADING' | 'READY' | 'EMPTY' | 'UNSUPPORTED' | 'ERROR'>('IDLE');
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationUsedFallback, setRecommendationUsedFallback] = useState(true);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [tailoringNeedCode, setTailoringNeedCode] = useState<string>('WHEELCHAIR_SEATED');
  const [aiExplanation, setAiExplanation] = useState<GeminiExplainResponse | null>(null);
  const [aiCaption, setAiCaption] = useState<GeminiCaptionResponse | null>(null);
  const [isLoadingExplain, setIsLoadingExplain] = useState(false);
  const [isLoadingCaption, setIsLoadingCaption] = useState(false);

  // Journey feedback state
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [isLookbookOpen, setIsLookbookOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isTailoringSheetOpen, setIsTailoringSheetOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [inspectedGarment, setInspectedGarment] = useState<Garment | null>(null);
  const [lookbookCount, setLookbookCount] = useState(0);

  // Notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync lookbook count on mount
  useEffect(() => {
    setLookbookCount(getSavedOutfits().length);

    // Check URL parameters for shared outfit
    const params = new URLSearchParams(window.location.search);
    const garmentParam = params.get('garment');
    if (garmentParam) {
      const found = garments.find((g) => g.id === garmentParam);
      if (found) {
        setSelectedGarment(found);
        const colorParam = params.get('color');
        if (colorParam) setPrimaryColorHex(`#${colorParam}`);
        const vibeParam = params.get('vibe');
        if (vibeParam) setSelectedStyleVibe(vibeParam);
        const adaptiveParam = params.get('adaptive');
        if (adaptiveParam) {
          const requestedCodes = adaptiveParam.split(',').filter((code) =>
            getAdaptiveNeeds().some((need) => need.code === code),
          ) as FunctionalNeedCode[];
          setSelectedAdaptiveNeedCodes(requestedCodes);
        }
        showToast(`Đã mở bản phối chia sẻ: ${found.name}`);
      }
    }
  }, []);

  // Compute selected accessories objects
  const activeAccessories = useMemo(() => {
    return accessories.filter((a) => selectedAccessoryIds.includes(a.id));
  }, [accessories, selectedAccessoryIds]);

  // Compute Deterministic Culture Check (Chuẩn Bản Sắc)
  const cultureResult: CultureCheckResult = useMemo(() => {
    return checkCulture({
      garmentId: selectedGarment.id,
      accessoryIds: selectedAccessoryIds,
      eventId: selectedEventId,
      primaryColor: primaryColorHex,
      adaptiveNeedCode,
    });
  }, [selectedGarment.id, selectedAccessoryIds, selectedEventId, primaryColorHex, adaptiveNeedCode]);

  // Compute Deterministic Style Score (Chất Theo Gu)
  const styleResult: StyleScoreResult = useMemo(() => {
    return calculateStyleScore(
      selectedGarment,
      primaryColorHex,
      selectedAccessoryIds,
      selectedEventId,
      selectedStyleVibe
    );
  }, [selectedGarment, primaryColorHex, selectedAccessoryIds, selectedEventId, selectedStyleVibe]);

  const handleNaturalLanguageSubmit = async (promptText: string) => {
    setIsAiParsing(true);
    try {
      const parsed = await parseNaturalLanguagePrompt(promptText);
      if (parsed.eventId) setSelectedEventId(parsed.eventId);
      if (parsed.weatherId) setSelectedWeatherId(parsed.weatherId);
      if (parsed.styleId) setSelectedStyleVibe(parsed.styleId);
      if (parsed.color && selectedGarment.baseColors.some((color) => color.hex.toLowerCase() === parsed.color?.toLowerCase())) {
        setPrimaryColorHex(parsed.color);
      }
      if (parsed.needCodes.length) setSelectedAdaptiveNeedCodes(parsed.needCodes);

      if (parsed.usedFallback || parsed.confirmationRequired.length) {
        showToast('Một số lựa chọn cần bạn xác nhận. Các giá trị chưa rõ vẫn để trống để chọn thủ công.');
      } else {
        showToast('Đã áp dụng các lựa chọn nhận diện từ Gemini. Bạn có thể kiểm tra và chỉnh lại.');
      }
    } catch {
      showToast('Chưa thể phân tích yêu cầu. Các trường vẫn có thể chọn thủ công.');
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleRequestRecommendations = async () => {
    setJourneyStep('RECOMMENDATION');
    setRecommendationState('LOADING');
    setRecommendationError(null);
    setRecommendations([]);
    setSelectedRecommendationId(null);

    await new Promise<void>((resolve) => window.setTimeout(resolve, 60));
    try {
      const context: RecommendationContext = {
        eventId: selectedEventId,
        location: selectedLocation || undefined,
        weatherId: selectedWeatherId,
        garmentPreferences: { preferredGarmentIds: [selectedGarment.id] },
        style: STYLE_CHOICES.find((style) => style.id === selectedStyleVibe)?.tag ?? 'TRUYEN_THONG',
        colorPreferences: [primaryColorHex],
        accessoryIds: selectedAccessoryIds,
        characterId: selectedCharacter.id,
        adaptiveNeedCodes: selectedAdaptiveNeedCodes,
        limit: 3,
      };
      const candidates = getDeterministicRecommendations(context);
      const ranking = await getGeminiRecommendation(context, candidates);
      const candidatesById = new Map(candidates.map((candidate) => [candidate.outfitId, candidate]));
      const orderedCandidates = ranking.candidateIds.flatMap((id) => {
        const candidate = candidatesById.get(id);
        return candidate ? [candidate] : [];
      });
      const finalCandidates = orderedCandidates.length ? orderedCandidates : candidates;
      setRecommendationUsedFallback(ranking.usedFallback);
      setRecommendations(finalCandidates);
      setRecommendationState(finalCandidates.length ? 'READY' : selectedAdaptiveNeedCodes.length ? 'UNSUPPORTED' : 'EMPTY');
    } catch {
      setRecommendationError('Không thể tạo gợi ý lúc này. Các lựa chọn của bạn vẫn được giữ nguyên.');
      setRecommendationState('ERROR');
    }
  };

  const handleUseRecommendation = (candidate: DeterministicRecommendation) => {
    const garment = garments.find((item) => item.id === candidate.garmentId);
    if (!garment) return;
    setSelectedGarment(garment);
    setPrimaryColorHex(candidate.color);
    setSelectedAccessoryIds(candidate.accessoryIds);
    setSelectedStyleVibe(STYLE_VIBE_BY_TAG[candidate.style] ?? candidate.style);
    setSelectedRecommendationId(candidate.outfitId);
    setAiCaption(null);
    setJourneyStep('RESULT');
  };

  const requestOutfitExplanation = async () => {
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
      setAiExplanation(response);
    } finally {
      setIsLoadingExplain(false);
    }
  };

  useEffect(() => {
    if (journeyStep !== 'RESULT') return;
    void requestOutfitExplanation();
  }, [journeyStep, selectedGarment.id, selectedEventId, selectedStyleVibe, primaryColorHex, selectedAccessoryIds.join(','), selectedAdaptiveNeedCodes.join(',')]);

  const requestOutfitCaption = async () => {
    setIsLoadingCaption(true);
    try {
      const response = await getOutfitCaptions({
        garmentId: selectedGarment.id,
        garmentName: selectedGarment.name,
        styleTitle: `${selectedGarment.name} · ${selectedStyleVibe}`,
        eventId: selectedEventId,
        eventTitle: currentEventName,
        chuanScore: cultureResult.score,
        chatScore: styleResult.score,
        vibe: selectedStyleVibe,
        primaryColor: primaryColorHex,
        accessoryIds: selectedAccessoryIds,
        adaptiveNeedCodes: selectedAdaptiveNeedCodes,
      });
      setAiCaption(response);
    } finally {
      setIsLoadingCaption(false);
    }
  };

  // Switch garment
  const handleSelectGarment = (g: Garment) => {
    setSelectedGarment(g);
    setPrimaryColorHex(g.baseColors[0].hex);
    // Keep compatible accessories
    const compatibleList = g.compatibleAccessoryIds || g.compatibleAccessories || [];
    const defaultAccs = accessories
      .filter((a) => compatibleList.includes(a.id) && a.compatibleGarmentIds.includes(g.id) &&
        (!a.compatibleEventIds.length || a.compatibleEventIds.includes(selectedEventId)))
      .slice(0, 2)
      .map((a) => a.id);
    setSelectedAccessoryIds(defaultAccs);
    setActiveMainTab('STYLING');
    showToast(`Đã chọn: ${g.name}`);
  };

  // Toggle accessory
  const handleToggleAccessory = (accId: string) => {
    const accessory = accessories.find((item) => item.id === accId);
    if (!accessory || !selectedGarment.compatibleAccessoryIds.includes(accId) ||
        !accessory.compatibleGarmentIds.includes(selectedGarment.id) ||
        (accessory.compatibleEventIds.length > 0 && !accessory.compatibleEventIds.includes(selectedEventId))) return;
    setSelectedAccessoryIds((prev) =>
      prev.includes(accId) ? prev.filter((id) => id !== accId) : [...prev, accId]
    );
  };

  // Handle Save Outfit
  const handleSaveOutfit = () => {
    const currentOutfit: Outfit = {
      id: `outfit-${Date.now()}`,
      title: `${selectedGarment.name} - ${styleResult.label}`,
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
      createdAt: new Date().toISOString(),
    };

    saveOutfitToLookbook(currentOutfit);
    setLookbookCount(getSavedOutfits().length);
    showToast('Đã lưu bản phối vào Lookbook thành công!');
  };

  // Load outfit from Lookbook
  const handleLoadOutfit = (outfit: Outfit) => {
    const g = garments.find((item) => item.id === outfit.garmentId);
    if (g) setSelectedGarment(g);
    setPrimaryColorHex(outfit.primaryColor);
    setPantColorHex(outfit.pantColor);
    setSelectedAccessoryIds(outfit.accessoryIds);
    const c = characters.find((char) => char.id === outfit.characterId);
    if (c) setSelectedCharacter(c);
    const eventAliases: Record<string, string> = { LE_TOT_NGHIEP: 'EVENT_GRADUATION', TET: 'EVENT_TET', DAM_CUOI: 'EVENT_WEDDING', DAO_PHO: 'EVENT_CASUAL' };
    setSelectedEventId(events.some((event) => event.id === outfit.eventId) ? outfit.eventId : eventAliases[outfit.eventId] ?? 'EVENT_GRADUATION');
    setSelectedEventDate(outfit.eventDate ?? new Date().toISOString().slice(0, 10));
    setSelectedLocation(outfit.location ?? '');
    setSelectedWeatherId(outfit.weatherId);
    setSelectedStyleVibe(outfit.styleVibe);
    setSelectedAdaptiveNeedCodes(outfit.adaptiveNeedCodes ?? (outfit.adaptiveNeedCode ? [outfit.adaptiveNeedCode as FunctionalNeedCode] : []));
    setJourneyStep('RESULT');
    showToast(`Đã tải bản phối: ${outfit.title}`);
  };

  // Current outfit object for share modal
  const currentOutfitForShare: Outfit = {
    id: `share-${selectedGarment.id}`,
    title: `${selectedGarment.name} (${styleResult.label})`,
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
    createdAt: new Date().toISOString(),
  };
  const selectedRecommendation = recommendations.find((candidate) => candidate.outfitId === selectedRecommendationId);
  const currentEventName = events.find((event) => event.id === selectedEventId)?.name ?? 'Sự kiện đã chọn';
  const verifiedSourceIds = new Set(getApprovedSources().map((source) => source.id));
  const currentAdaptiveAdjustments = getValidatedAdaptiveAdjustments().filter((adjustment) =>
    selectedAdaptiveNeedCodes.includes(adjustment.needCode) &&
    (adjustment.garmentId === 'ALL' || adjustment.garmentId === selectedGarment.id) &&
    verifiedSourceIds.has(adjustment.sourceId),
  );
  const previousJourneyStep = JOURNEY_STEPS[JOURNEY_STEPS.findIndex((step) => step.id === journeyStep) - 1];
  const journeyStepIndex = JOURNEY_STEPS.findIndex((step) => step.id === journeyStep);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-amber-500 selection:text-stone-950 pb-16">
      {/* Top Global Navigation */}
      <Navbar
        onOpenLookbook={() => setIsLookbookOpen(true)}
        onOpenCompare={() => setIsCompareOpen(true)}
        onOpenTailoringSheet={() => setIsTailoringSheetOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        lookbookCount={lookbookCount}
      />

      {/* Toast message notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 border border-amber-500 text-stone-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-bounce text-xs font-medium">
          <span className="text-amber-400">✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* Hero Banner */}
        <HeroBanner
          onQuickStart={() => {
            setActiveMainTab('STYLING');
            setJourneyStep('CONTEXT');
            window.setTimeout(() => document.getElementById('styling-flow')?.scrollIntoView({ behavior: 'smooth' }), 0);
          }}
          onExploreGarments={() => {
            setActiveMainTab('DISCOVERY');
            window.scrollTo({ top: 380, behavior: 'smooth' });
          }}
        />

        {/* Tab Switcher: Sàn Phối Đồ vs. Khám Phá */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveMainTab('STYLING')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeMainTab === 'STYLING'
                  ? 'bg-amber-600 text-stone-950 shadow-md'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              <span>👘 Sàn Phối Đồ Trực Quan</span>
            </button>
            <button
              onClick={() => setActiveMainTab('DISCOVERY')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeMainTab === 'DISCOVERY'
                  ? 'bg-amber-600 text-stone-950 shadow-md'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              <span>📚 Bách Khoa Y Phục ({garments.length})</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-stone-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Chuẩn: {cultureResult.score}/100
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Chất: {styleResult.score}/100
            </span>
          </div>
        </div>

        {/* Guided styling flow */}
        {activeMainTab === 'STYLING' && (
          <section id="styling-flow" className="scroll-mt-6 space-y-5">
            <div className="border-b border-stone-800 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-amber-300">Tạo bản phối · {journeyStepIndex + 1}/9</p>
                  <h1 className="mt-1 font-serif text-2xl font-bold text-stone-100">
                    {JOURNEY_STEPS.find((step) => step.id === journeyStep)?.label}
                  </h1>
                </div>
                <p className="text-xs text-stone-400">{currentEventName}{selectedLocation ? ` · ${selectedLocation}` : ''}</p>
              </div>
              <nav aria-label="Các bước tạo bản phối" className="mt-4 -mx-1 overflow-x-auto pb-1">
                <ol className="flex min-w-max gap-1.5 px-1">
                  {JOURNEY_STEPS.map((step, index) => (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() => setJourneyStep(step.id)}
                        aria-current={journeyStep === step.id ? 'step' : undefined}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                          journeyStep === step.id
                            ? 'border-amber-500 bg-amber-950/40 text-amber-200'
                            : index < journeyStepIndex
                              ? 'border-stone-700 bg-stone-900 text-stone-200'
                              : 'border-stone-800 bg-stone-950 text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        <span className="grid size-5 place-items-center rounded-full bg-black/20 text-[10px]">{index + 1}</span>
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
                />
                <div className="flex justify-end">
                  <button type="button" onClick={() => setJourneyStep('ADAPTIVE')} className="rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 hover:bg-amber-400">Tiếp tục · Thích ứng</button>
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
                  <button type="button" onClick={() => setJourneyStep('CONTEXT')} className="rounded-lg border border-stone-700 px-4 py-2.5 text-sm text-stone-300">Quay lại</button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setSelectedAdaptiveNeedCodes([]); setJourneyStep('CHARACTER'); }} className="rounded-lg border border-stone-700 px-4 py-2.5 text-sm text-stone-300">Bỏ qua</button>
                    <button type="button" onClick={() => setJourneyStep('CHARACTER')} className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-stone-950">Tiếp tục</button>
                  </div>
                </div>
              </div>
            )}

            {journeyStep === 'CHARACTER' && (
              <div className="space-y-4">
                <CharacterSelector selectedCharacterId={selectedCharacter.id} onSelect={setSelectedCharacter} />
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setJourneyStep('ADAPTIVE')} className="rounded-lg border border-stone-700 px-4 py-2.5 text-sm text-stone-300">Quay lại</button>
                  <button type="button" onClick={() => setJourneyStep('GARMENT')} className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-stone-950">Tiếp tục · Chọn y phục</button>
                </div>
              </div>
            )}

            {journeyStep === 'GARMENT' && (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(250px,0.75fr)_minmax(0,1.5fr)] gap-4 items-start">
                <div className="space-y-3 lg:sticky lg:top-20">
                  <OutfitMockupCanvas
                    garment={selectedGarment}
                    primaryColor={primaryColorHex}
                    pantColor={pantColorHex}
                    accessories={activeAccessories}
                    character={selectedCharacter}
                    adaptiveNeedCodes={selectedAdaptiveNeedCodes}
                    styleId={selectedStyleVibe}
                    adaptiveNeedCode={selectedAdaptiveNeedCodes.includes('WHEELCHAIR_SEATED') ? 'WHEELCHAIR_SEATED' : undefined}
                  />
                  <div className="rounded-lg border border-stone-800 bg-stone-900 p-3">
                    <p className="font-serif text-base font-bold text-stone-100">{selectedGarment.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-400">{selectedGarment.description}</p>
                    <p className="mt-2 text-[11px] text-emerald-300">Đã duyệt · {selectedGarment.region.replaceAll('_', ' ')}</p>
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
                    <button type="button" onClick={() => setJourneyStep('CHARACTER')} className="rounded-lg border border-stone-700 px-4 py-2.5 text-sm text-stone-300">Quay lại</button>
                    <button type="button" onClick={() => setJourneyStep('STYLE')} className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-stone-950">Tiếp tục · Phong cách</button>
                  </div>
                </div>
              </div>
            )}

            {journeyStep === 'STYLE' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {STYLE_CHOICES.map((style) => {
                    const selected = selectedStyleVibe === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedStyleVibe(style.id)}
                        className={`min-h-28 rounded-xl border p-4 text-left transition ${selected ? 'border-amber-500 bg-amber-950/35' : 'border-stone-800 bg-stone-900 hover:border-stone-600'}`}
                      >
                        <span className="text-[10px] font-semibold uppercase text-amber-300">{style.tag.replaceAll('_', ' ')}</span>
                        <span className="mt-2 block font-serif text-lg font-bold text-stone-100">{style.label}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-stone-400">{style.description}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setJourneyStep('GARMENT')} className="rounded-lg border border-stone-700 px-4 py-2.5 text-sm text-stone-300">Quay lại</button>
                  <button type="button" onClick={() => setJourneyStep('COLOR')} className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-stone-950">Tiếp tục · Màu sắc</button>
                </div>
              </div>
            )}

            {journeyStep === 'COLOR' && (
              <div className="space-y-4">
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
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setJourneyStep('STYLE')} className="rounded-lg border border-stone-700 px-4 py-2.5 text-sm text-stone-300">Quay lại</button>
                  <button type="button" onClick={() => setJourneyStep('ACCESSORIES')} className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-stone-950">Tiếp tục · Phụ kiện</button>
                </div>
              </div>
            )}

            {journeyStep === 'ACCESSORIES' && (
              <div className="space-y-4">
                {cultureResult.status === 'WARNING' && (
                  <div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">
                    Phối này có một điểm cần lưu ý về đặc trưng văn hóa. Gợi ý sẽ loại các phối cảnh báo này.
                  </div>
                )}
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
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setJourneyStep('COLOR')} className="rounded-lg border border-stone-700 px-4 py-2.5 text-sm text-stone-300">Quay lại</button>
                  <button type="button" onClick={handleRequestRecommendations} className="rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 hover:bg-amber-400">Gợi ý giúp tôi</button>
                </div>
              </div>
            )}

            {journeyStep === 'RECOMMENDATION' && (
              <section className="space-y-4" aria-live="polite">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-stone-100">Gợi ý từ dữ liệu Vstyle</h2>
                    <p className="mt-1 text-xs text-stone-400">Tối đa 3 bản phối · đã kiểm tra tương thích và quy tắc văn hóa.</p>
                  </div>
                  {recommendationState !== 'LOADING' && <button type="button" onClick={handleRequestRecommendations} className="rounded-lg border border-stone-700 px-3 py-2 text-xs font-semibold text-stone-200">Tạo gợi ý mới</button>}
                </div>
                {recommendationState === 'IDLE' && (
                  <div className="rounded-xl border border-stone-800 bg-stone-900 p-6 text-center">
                    <p className="text-sm text-stone-300">Bối cảnh và lựa chọn đã sẵn sàng.</p>
                    <button type="button" onClick={handleRequestRecommendations} className="mt-4 rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950">Gợi ý giúp tôi</button>
                  </div>
                )}
                {recommendationState === 'LOADING' && (
                  <div className="rounded-xl border border-stone-800 bg-stone-900 p-6 text-center" role="status">
                    <span className="mx-auto block size-6 animate-spin rounded-full border-2 border-stone-600 border-t-amber-400" />
                    <p className="mt-3 text-sm text-stone-200">Đang đối chiếu bối cảnh, thời tiết và quy tắc văn hóa…</p>
                  </div>
                )}
                {recommendationState === 'ERROR' && (
                  <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/30 p-5">
                    <p className="text-sm text-rose-200">{recommendationError}</p>
                    <button type="button" onClick={handleRequestRecommendations} className="mt-3 rounded-lg bg-rose-900 px-4 py-2 text-sm font-semibold text-rose-100">Thử lại</button>
                  </div>
                )}
                {recommendationState === 'EMPTY' && (
                  <div className="rounded-xl border border-stone-800 bg-stone-900 p-6 text-center">
                    <h3 className="font-serif text-lg font-semibold text-stone-100">Chưa có bản phối phù hợp</h3>
                    <p className="mt-2 text-sm text-stone-400">Thử đổi dịp, màu sắc hoặc y phục để mở rộng lựa chọn.</p>
                    <button type="button" onClick={() => setJourneyStep('GARMENT')} className="mt-4 rounded-lg border border-stone-700 px-4 py-2.5 text-sm text-stone-200">Điều chỉnh lựa chọn</button>
                  </div>
                )}
                {recommendationState === 'UNSUPPORTED' && (
                  <div role="status" className="rounded-xl border border-amber-800 bg-amber-950/25 p-6">
                    <h3 className="font-serif text-lg font-semibold text-amber-100">Chưa có điều chỉnh đã xác thực cho tổ hợp này</h3>
                    <p className="mt-2 text-sm leading-relaxed text-amber-100/75">Không áp dụng điều chỉnh chưa kiểm chứng. Bỏ chọn một nhu cầu hoặc chọn dịp/y phục khác để tiếp tục.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setJourneyStep('ADAPTIVE')} className="rounded-lg border border-amber-800 px-4 py-2.5 text-sm text-amber-100">Sửa nhu cầu</button>
                      <button type="button" onClick={() => { setSelectedAdaptiveNeedCodes([]); handleRequestRecommendations(); }} className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-stone-950">Tiếp tục không có thích ứng</button>
                    </div>
                  </div>
                )}
                {recommendationState === 'READY' && (
                  <RecommendationGallery candidates={recommendations} onSelect={handleUseRecommendation} />
                )}
              </section>
            )}

            {journeyStep === 'RESULT' && (
              <section className="space-y-5">
                {cultureResult.status === 'WARNING' && (
                  <div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">
                    Phối này có một điểm cần lưu ý về đặc trưng văn hóa. Hãy xem lý do và nguồn bên dưới trước khi chia sẻ.
                  </div>
                )}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-amber-300">{currentEventName} · {selectedEventDate}</p>
                      <h2 className="mt-1 font-serif text-2xl font-bold text-stone-100">{selectedGarment.name}</h2>
                      <p className="mt-1 text-sm text-stone-400">{selectedStyleVibe.replaceAll('_', ' ')}{selectedLocation ? ` · ${selectedLocation}` : ''}</p>
                    </div>
                    <OutfitMockupCanvas
                      garment={selectedGarment}
                      primaryColor={primaryColorHex}
                      pantColor={pantColorHex}
                      accessories={activeAccessories}
                      character={selectedCharacter}
                      adaptiveNeedCodes={selectedAdaptiveNeedCodes}
                      styleId={selectedStyleVibe}
                      adaptiveNeedCode={selectedAdaptiveNeedCodes.includes('WHEELCHAIR_SEATED') ? 'WHEELCHAIR_SEATED' : undefined}
                      onColorChange={setPrimaryColorHex}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-emerald-900 bg-emerald-950/25 p-4">
                        <p className="text-xs text-emerald-200">Chuẩn văn hóa</p>
                        <p className="mt-1 text-3xl font-bold text-emerald-300">{cultureResult.score}<span className="text-sm text-emerald-200/60">/100</span></p>
                        <p className="mt-1 text-xs text-emerald-200/70">{cultureResult.status}</p>
                      </div>
                      <div className="rounded-xl border border-amber-900 bg-amber-950/25 p-4">
                        <p className="text-xs text-amber-200">Chất theo gu</p>
                        <p className="mt-1 text-3xl font-bold text-amber-300">{styleResult.score}<span className="text-sm text-amber-200/60">/100</span></p>
                        <p className="mt-1 text-xs text-amber-200/70">{styleResult.label}</p>
                      </div>
                    </div>

                    <section className="rounded-xl border border-stone-800 bg-stone-900 p-4">
                      <h3 className="font-serif text-lg font-bold text-stone-100">Vì sao bản phối này phù hợp</h3>
                      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-300">
                        {(selectedRecommendation?.reasons ?? styleResult.feedback).slice(0, 5).map((reason) => <li key={reason}>• {reason}</li>)}
                      </ul>
                    </section>

                    {currentAdaptiveAdjustments.length > 0 && (
                      <section className="rounded-xl border border-stone-800 bg-stone-900 p-4">
                        <h3 className="font-serif text-lg font-bold text-stone-100">Điều chỉnh thích ứng</h3>
                        <div className="mt-3 space-y-3">
                          {currentAdaptiveAdjustments.map((adjustment) => (
                            <div key={adjustment.id} className="border-l-2 border-amber-500 pl-3">
                              <p className="text-sm font-semibold text-amber-200">{adjustment.needName}</p>
                              <p className="mt-1 text-xs leading-relaxed text-stone-300">{adjustment.adjustment}</p>
                              <button type="button" onClick={() => { setTailoringNeedCode(adjustment.needCode); setIsTailoringSheetOpen(true); }} className="mt-2 text-xs text-amber-300 underline underline-offset-4">Xem chi tiết đã xác thực</button>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </div>

                <CultureCheckCard result={cultureResult} />
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-t border-stone-800 pt-4">
                  <button type="button" onClick={handleSaveOutfit} className="rounded-lg bg-amber-500 px-3 py-3 text-sm font-bold text-stone-950">Lưu</button>
                  <button type="button" onClick={handleRequestRecommendations} className="rounded-lg border border-stone-700 px-3 py-3 text-sm font-semibold text-stone-200">Tạo lại</button>
                  <button type="button" onClick={() => setJourneyStep('ACCESSORIES')} className="rounded-lg border border-stone-700 px-3 py-3 text-sm font-semibold text-stone-200">Chỉnh sửa</button>
                  <button type="button" onClick={() => setIsCompareOpen(true)} className="rounded-lg border border-stone-700 px-3 py-3 text-sm font-semibold text-stone-200">So sánh</button>
                  <button type="button" onClick={() => setIsShareModalOpen(true)} className="rounded-lg border border-stone-700 px-3 py-3 text-sm font-semibold text-stone-200">Chia sẻ</button>
                </div>
              </section>
            )}
          </section>
        )}

        {/* TAB 2: BÁCH KHOA KHÁM PHÁ Y PHỤC */}
        {activeMainTab === 'DISCOVERY' && (
          <GarmentDiscovery
            selectedGarmentId={selectedGarment.id}
            onSelectGarment={handleSelectGarment}
            onViewDetails={(g) => setInspectedGarment(g)}
          />
        )}
      </main>

      {/* MODALS */}
      {/* 1. Garment Detail Inspection Modal */}
      {inspectedGarment && (
        <GarmentDetailModal
          garment={inspectedGarment}
          onClose={() => setInspectedGarment(null)}
          onSelectForStyling={handleSelectGarment}
        />
      )}

      {/* 2. Side-by-side Compare Modal */}
      {isCompareOpen && <CompareView onClose={() => setIsCompareOpen(false)} />}

      {/* 3. Lookbook Drawer */}
      <LookbookDrawer
        isOpen={isLookbookOpen}
        onClose={() => setIsLookbookOpen(false)}
        onLoadOutfit={handleLoadOutfit}
        onShareOutfit={(outfit) => {
          setIsShareModalOpen(true);
        }}
      />

      {/* 4. Share Outfit Modal */}
      {isShareModalOpen && (
        <ShareModal
          outfit={currentOutfitForShare}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}

      {/* 5. Adaptive Tailoring Sheet Modal */}
      {isTailoringSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-3xl w-full my-auto">
            <AdaptiveTailoringSheet
              needCode={tailoringNeedCode}
              garmentName={selectedGarment.name}
              onClose={() => setIsTailoringSheetOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 6. Admin / Verified Knowledge Base Modal */}
      {isAdminOpen && <AdminKnowledgeModal onClose={() => setIsAdminOpen(false)} />}
    </div>
  );
}
