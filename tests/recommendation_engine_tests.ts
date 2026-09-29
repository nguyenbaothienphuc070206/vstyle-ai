import {
  getDeterministicRecommendations,
  recommendOutfitsDeterministic,
  RECOMMENDATION_WEIGHTS,
  RecommendationContext,
} from '../src/lib/recommendation/engine.ts';
import { checkCulture } from '../src/lib/culture/ruleEngine.ts';
import { mapSafeStylingPrompt } from '../src/lib/recommendation/promptMapper.ts';
import {
  getApprovedAccessories,
  getApprovedGarments,
  getApprovedSources,
  getCharacters,
  getEvents,
  getWeatherContexts,
} from '../src/lib/dal/index.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string): void {
  if (condition) {
    console.log(`PASS: ${testName}`);
    passed++;
  } else {
    console.error(`FAIL: ${testName}`);
    failed++;
  }
}

const approvedGarments = getApprovedGarments();
const approvedAccessories = getApprovedAccessories();
const approvedGarmentIds = new Set(approvedGarments.map((garment) => garment.id));
const approvedAccessoryMap = new Map(approvedAccessories.map((accessory) => [accessory.id, accessory]));
const approvedSourceIds = new Set(getApprovedSources().map((source) => source.id));
const eventIds = new Set(getEvents().map((event) => event.id));
const weatherIds = new Set(getWeatherContexts().map((weather) => weather.id));

console.log('--- DETERMINISTIC RECOMMENDATION ENGINE ---\n');

// Graduation, hot weather, location, character, and style
const characterId = getCharacters()[0]?.id;
const graduationContext: RecommendationContext = {
  eventId: 'EVENT_GRADUATION',
  weatherId: 'WEATHER_HOT',
  location: 'Hà Nội',
  style: 'TOI_GIAN',
  colorPreferences: ['#2B5C8F'],
  characterId,
  limit: 6,
};
const graduation = getDeterministicRecommendations(graduationContext);
assert(graduation.length > 0, 'Graduation should produce local candidates');
assert(graduation.every((candidate) => candidate.location === 'Hà Nội'), 'Location should be preserved on candidates');
assert(graduation.every((candidate) => candidate.characterId === characterId), 'A valid character should be preserved');
assert(graduation.every((candidate) => eventIds.has(candidate.eventId)), 'Candidates should reference known events');
assert(graduation.every((candidate) => !candidate.weatherId || weatherIds.has(candidate.weatherId)), 'Candidates should reference known weather');
assert(graduation.every((candidate) => approvedGarmentIds.has(candidate.garmentId)), 'Candidates should use approved garments only');
assert(
  graduation.every((candidate) => candidate.accessoryIds.every((id) => {
    const accessory = approvedAccessoryMap.get(id);
    return Boolean(accessory?.compatibleGarmentIds.includes(candidate.garmentId));
  })),
  'Candidates should contain only approved, garment-compatible accessories',
);
assert(graduation.some((candidate) => candidate.scoreBreakdown.weather === 100), 'Hot-weather candidates should reflect curated weather matches');
assert(graduation.every((candidate) => (candidate.cultureStatus as string) !== 'WARNING'), 'Culturally warned candidates must not be recommended');
assert(new Set(graduation.map((candidate) => candidate.outfitId)).size === graduation.length, 'Recommendations should not duplicate outfit IDs');
assert(new Set(graduation.map((candidate) => candidate.color)).size > 1, 'Recommendations should vary color where available');
assert(new Set(graduation.map((candidate) => candidate.accessoryIds.join('|'))).size > 1, 'Recommendations should vary accessory combinations');
assert(
  graduation.every((candidate) => candidate.score === Math.round(
    Object.keys(RECOMMENDATION_WEIGHTS).reduce((total, key) => {
      const factor = key as keyof typeof RECOMMENDATION_WEIGHTS;
      return total + candidate.scoreBreakdown[factor] * RECOMMENDATION_WEIGHTS[factor];
    }, 0) / 100,
  )),
  'Candidate scores should be reproducible from the exposed weighted breakdown',
);
assert(
  graduation.every((candidate) => candidate.sourceIds.every((id) => approvedSourceIds.has(id))),
  'Cultural evidence should remain attached through valid source IDs',
);

// Tết and concert event coverage
const tet = getDeterministicRecommendations({ eventId: 'EVENT_TET', limit: 4 });
assert(tet.length > 0 && tet.every((candidate) => candidate.eventId === 'EVENT_TET'), 'Tết should return event-compatible candidates');
const concert = getDeterministicRecommendations({ eventId: 'EVENT_CONCERT', limit: 4 });
assert(concert.length > 0 && concert.every((candidate) => candidate.eventId === 'EVENT_CONCERT'), 'Concert should return event-compatible candidates');

// No adaptive need and validated wheelchair/seated need
const noAdaptiveNeed = getDeterministicRecommendations({
  eventId: 'EVENT_GRADUATION',
  adaptiveNeedCode: 'NONE',
  limit: 3,
});
assert(noAdaptiveNeed.length > 0, 'No adaptive need should still produce candidates');
assert(noAdaptiveNeed.every((candidate) => candidate.adaptiveAdjustmentIds.length === 0), 'No adaptive need should not attach adjustments');

const wheelchair = getDeterministicRecommendations({
  eventId: 'EVENT_GRADUATION',
  adaptiveNeedCode: 'WHEELCHAIR_SEATED',
  limit: 3,
});
assert(wheelchair.length > 0, 'Validated wheelchair/seated need should produce supported candidates');
assert(
  wheelchair.every((candidate) => candidate.adaptiveAdjustmentIds.includes('AR-WHEELCHAIR-01')),
  'Adaptive candidates should cite the validated adjustment ID',
);

const multipleAdaptiveNeeds = getDeterministicRecommendations({
  eventId: 'EVENT_GRADUATION',
  adaptiveNeedCodes: ['WHEELCHAIR_SEATED', 'LIMITED_HAND_MOBILITY'],
  limit: 3,
});
assert(multipleAdaptiveNeeds.length > 0, 'Multiple explicitly selected adaptive needs should be supported when validated data exists');
assert(
  multipleAdaptiveNeeds.every((candidate) =>
    candidate.adaptiveAdjustmentIds.includes('AR-WHEELCHAIR-01') &&
    candidate.adaptiveAdjustmentIds.includes('AR-HAND-MOBILITY-01'),
  ),
  'Multiple needs should each have a validated adjustment attached',
);

const unsupportedAdaptive = getDeterministicRecommendations({
  eventId: 'EVENT_GRADUATION',
  adaptiveNeedCode: 'UNSUPPORTED_NEED' as unknown as RecommendationContext['adaptiveNeedCode'],
});
assert(unsupportedAdaptive.length === 0, 'Unsupported adaptive needs should not produce invented recommendations');

// A hard cultural warning excludes the candidate; valid accessory variants can resolve it
const tuThanOnly = getDeterministicRecommendations({
  eventId: 'EVENT_FESTIVAL',
  garmentPreferences: {
    preferredGarmentIds: ['garment-ao-tu-than'],
    excludedGarmentIds: approvedGarments
      .filter((garment) => garment.id !== 'garment-ao-tu-than')
      .map((garment) => garment.id),
  },
  limit: 6,
});
assert(tuThanOnly.length > 0, 'Culturally compatible áo tứ thân variants should remain available');
assert(tuThanOnly.every((candidate) => (candidate.cultureStatus as string) !== 'WARNING'), 'Warning outfits should never be silently recommended');
assert(
  tuThanOnly.every((candidate) => candidate.accessoryIds.includes('acc-yem-co-truyen')),
  'Áo tứ thân candidates must include the accessory required by its hard cultural rule',
);

const legacyFestival = recommendOutfitsDeterministic({ eventId: 'EVENT_FESTIVAL' });
assert(
  legacyFestival.every((candidate) => checkCulture({
    garmentId: candidate.garment.id,
    accessoryIds: candidate.recommendedAccessories.map((accessory) => accessory.id),
    eventId: 'EVENT_FESTIVAL',
    primaryColor: candidate.primaryColor,
  }).status !== 'WARNING'),
  'Legacy and Gemini-fallback candidates should also exclude cultural warnings',
);

// Conflicting preferences remain soft preferences, but incompatible accessories are never emitted
const conflictingPreferences = getDeterministicRecommendations({
  eventId: 'EVENT_FESTIVAL',
  garmentPreferences: { preferredGarmentIds: ['garment-ao-tu-than'] },
  style: 'CUNG_DINH',
  colorPreferences: ['#ABCDEF'],
  accessoryIds: ['acc-hai-sen'],
  limit: 4,
});
assert(conflictingPreferences.length > 0, 'Conflicting soft preferences should still return available safe candidates');
assert(
  conflictingPreferences.every((candidate) => !candidate.accessoryIds.includes('acc-hai-sen')),
  'An incompatible preferred accessory must be ignored, not recommended',
);

// Invalid context and exclusions produce a genuine empty result
assert(
  getDeterministicRecommendations({ eventId: 'EVENT_NOT_IN_KNOWLEDGE_BASE' }).length === 0,
  'Unknown events should not trigger a fabricated fallback event',
);
assert(
  getDeterministicRecommendations({
    eventId: 'EVENT_GRADUATION',
    characterId: 'character-not-in-knowledge-base',
  }).length === 0,
  'Unknown characters should not be attached to recommendations',
);
assert(
  getDeterministicRecommendations({
    eventId: 'EVENT_GRADUATION',
    garmentPreferences: { excludedGarmentIds: [...approvedGarmentIds] },
  }).length === 0,
  'No available garment should return an empty recommendation list',
);

const mappedPrompt = mapSafeStylingPrompt(
  'Tôi muốn mặc Việt phục đi lễ tốt nghiệp, trời nóng, thích phong cách tối giản.',
);
assert(
  mappedPrompt.eventId === 'EVENT_GRADUATION' &&
    mappedPrompt.weatherId === 'WEATHER_HOT' &&
    mappedPrompt.styleId === 'TOI_GIAN',
  'The example prompt should map only explicit local event, weather, and style values',
);
const ambiguousPrompt = mapSafeStylingPrompt('Tôi cần điều gì đó thật đặc biệt');
assert(
  !ambiguousPrompt.eventId && !ambiguousPrompt.weatherId && !ambiguousPrompt.styleId &&
    !ambiguousPrompt.garmentId && ambiguousPrompt.needCodes.length === 0,
  'Ambiguous free text should remain manual instead of being guessed',
);
const seasonPrompt = mapSafeStylingPrompt('Mùa thu đi dạo phố cà phê, mình ngồi xe lăn, thích áo nhật bình');
assert(
  seasonPrompt.weatherId === 'WEATHER_PLEASANT' && seasonPrompt.eventId === 'EVENT_CASUAL' &&
    seasonPrompt.garmentId === 'garment-ao-nhat-binh' && seasonPrompt.needCodes.includes('WHEELCHAIR_SEATED'),
  '"Mùa thu" must not be read as rain; explicit garment and need keywords are mapped',
);

console.log(`\nRECOMMENDATION TESTS: ${passed} PASS, ${failed} FAIL\n`);

if (process.argv[1]?.endsWith('recommendation_engine_tests.ts') && failed > 0) {
  process.exit(1);
}

export { passed as recommendationPassed, failed as recommendationFailed };