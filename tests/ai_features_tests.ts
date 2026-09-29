/**
 * Tests for the AI Arena upgrade: colour maths & harmony, keyword fallback,
 * vision palette matching, render prompt guardrails, schema leniency and rate limiting.
 * Gemini itself is never called: providers are in-memory fakes.
 */
import { contrastRatio, deltaE, hexToHsl, nearestColor, normalizeHex } from '../src/lib/color/colorMath.ts';
import { colorFamily, evaluateColorHarmony, familiesFromAdvice } from '../src/lib/color/harmony.ts';
import {
  analyzeOutfitPhoto,
  buildOutfitRenderPrompt,
  buildParseJsonSchema,
  keywordParseFallback,
  matchPaletteToGarments,
  parseStylingText,
  renderOutfitImage,
  RenderUnavailableError,
} from '../src/lib/gemini/service.ts';
import { buildParseRequest } from '../src/lib/gemini/routes.ts';
import type { GeminiImageProvider, GeminiTextProvider, GeminiGenerationRequest } from '../src/lib/gemini/generation.ts';
import { GeminiCaptionModelOutputSchema, GeminiExplainModelOutputSchema, normalizeHashtags } from '../src/types/gemini.ts';
import { createRateLimiter } from '../src/lib/server/rateLimit.ts';
import { readGeminiSettings } from '../src/lib/gemini/provider.ts';
import { getEvents } from '../src/lib/dal/index.ts';

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

console.log('--- AI ARENA UPGRADE TESTS ---\n');

// Colour maths
assert(normalizeHex('#abc') === '#AABBCC' && normalizeHex('zzz') === null, 'normalizeHex expands short hex and rejects junk');
assert(Math.abs(contrastRatio('#000000', '#FFFFFF') - 21) < 0.01, 'contrastRatio black/white is 21:1');
assert(deltaE('#123456', '#123456') === 0 && deltaE('#FF0000', '#00FF00') > 50, 'deltaE is zero for equal colours and large for red/green');
assert(Math.round(hexToHsl('#FF0000').h) === 0 && Math.round(hexToHsl('#0000FF').h) === 240, 'hexToHsl hue for primaries');
assert(nearestColor('#A00000', [{ hex: '#0000FF' }, { hex: '#9B111E' }])?.color.hex === '#9B111E', 'nearestColor picks the closest palette entry');

// Harmony
assert(colorFamily('#1C1C1E') === 'DARK' && colorFamily('#F4F0E8') === 'LIGHT' && colorFamily('#A92228') === 'RED', 'colorFamily classifies dark, ivory and cinnabar red');
assert(colorFamily('#1E3A8A') === 'BLUE' && colorFamily('#4D6B53') === 'GREEN', 'colorFamily classifies blue and moss green');
const tetAdvice = getEvents().find((event) => event.id === 'EVENT_TET')?.culturalAdvice;
const tetFamilies = familiesFromAdvice(tetAdvice);
assert(tetFamilies.includes('RED') && tetFamilies.includes('YELLOW') && tetFamilies.includes('GREEN'), 'Tết colour guidance is derived from verified event advice');
const neutralBase = evaluateColorHarmony({ primaryColor: '#A92228', pantColor: '#1C1C1E', eventAdvice: tetAdvice, eventName: 'Tết' });
assert(neutralBase.relation === 'NEUTRAL_BASE' && neutralBase.matchesEventGuidance === true && neutralBase.score >= 85, 'Red coat on black trousers for Tết is harmonious and on-guidance');
const offKey = evaluateColorHarmony({ primaryColor: '#1E3A8A', pantColor: '#2E8B57' });
assert(offKey.relation === 'OFF_KEY' && offKey.score < neutralBase.score && offKey.notes.some((note) => note.tone === 'warn'), 'Off-key colour pair (blue vs green, ~80° apart) scores lower and warns');
const noisy = evaluateColorHarmony({ primaryColor: '#E11D48', pantColor: '#1E3A8A', accessoryColors: ['#059669', '#EAB308', '#9333EA'] });
assert(noisy.notes.some((note) => note.text.includes('màu rực')), 'Too many vivid accents are flagged');
assert(neutralBase.score >= 0 && neutralBase.score <= 100 && offKey.score >= 0, 'Harmony score is clamped to 0..100');

// Keyword fallback (no Gemini)
const parseRequest = buildParseRequest('Đi đám cưới ở Huế, trời se lạnh, mình ngồi xe lăn, thích áo nhật bình sang trọng');
const offline = await parseStylingText(parseRequest, { model: 'gemini-3.8-flash' });
assert(offline.usedFallback && offline.eventId === 'EVENT_WEDDING' && offline.weatherId === 'WEATHER_COOL', 'Offline parse maps explicit event and weather keywords');
assert(offline.styleId === 'SANG_TRONG' && offline.garmentId === 'garment-ao-nhat-binh', 'Offline parse maps style and garment keywords');
assert(offline.needCodes.includes('WHEELCHAIR_SEATED'), 'Offline parse maps an explicitly stated adaptive need');
const vague = keywordParseFallback(buildParseRequest('Tôi cần điều gì đó thật đặc biệt'));
assert(vague.eventId === null && vague.confirmationRequired.includes('event'), 'Vague text stays manual');
assert(parseRequest.allowedStyles.length === 6 && parseRequest.allowedGarments!.length >= 8, 'Server-side allow-lists include the six UI styles and approved garments');

const schema = buildParseJsonSchema(parseRequest) as { properties: Record<string, { enum?: string[] }> };
assert(schema.properties.eventId.enum!.includes('EVENT_WEDDING') && schema.properties.eventId.enum!.includes('NONE'), 'Parse JSON schema constrains event IDs to the allow-list plus NONE');

// Parse with a fake Gemini that answers NONE and an unknown accessory
const fakeParse: GeminiTextProvider = {
  async generateContent(request: GeminiGenerationRequest) {
    assert(Boolean(request.responseJsonSchema), 'Parse request sends a response JSON schema to Gemini');
    return { text: JSON.stringify({ eventId: 'EVENT_TET', weatherId: 'NONE', styleId: 'REMIX_GEN_Z', color: 'NONE', needCodes: [], garmentId: 'NONE', accessoryIds: ['acc-kieng-bac', 'acc-fake'], summary: 'Đi chơi Tết phong cách Gen Z.' }) };
  },
};
const geminiParse = await parseStylingText(parseRequest, { provider: fakeParse, model: 'mock', sleep: async () => undefined });
assert(!geminiParse.usedFallback && geminiParse.eventId === 'EVENT_TET' && geminiParse.weatherId === null && geminiParse.garmentId === null, 'NONE sentinels become null');
assert(geminiParse.accessoryIds.length === 1 && geminiParse.accessoryIds[0] === 'acc-kieng-bac', 'Unknown accessory IDs are dropped');

// Lenient output schemas
const longExplain = GeminiExplainModelOutputSchema.safeParse({
  headline: 'x'.repeat(300), editorialReview: 'y'.repeat(900), culturalHarmony: 'z', styleRemixVerdict: 'w', adviceForWearing: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
});
assert(longExplain.success && longExplain.data.headline.length === 140 && longExplain.data.adviceForWearing.length === 5, 'Long model text is clipped instead of rejected');
assert(normalizeHashtags(['Vstyle', '#Việt Phục', '##GenZ!', '#', 'Vstyle']).join(' ') === '#Vstyle #ViệtPhục #GenZ', 'Hashtags are normalised and de-duplicated');
assert(GeminiCaptionModelOutputSchema.safeParse({ instagramCaption: 'a', shortPunchyHook: 'b', culturalHighlight: 'c', hashtags: ['x y'] }).success, 'Caption schema accepts messy hashtags');

// Vision
const matches = matchPaletteToGarments([{ hex: '#9C1320' }], ['garment-ao-nhat-binh']);
assert(matches[0]?.garmentId === 'garment-ao-nhat-binh' && matches[0].colorHex === '#9B111E', 'Photo colours snap to the nearest approved garment colour');
const tinyImage = { mimeType: 'image/jpeg' as const, data: 'aGVsbG8gd29ybGQgdGVzdA==' };
const visionOffline = await analyzeOutfitPhoto({ image: tinyImage }, { model: 'mock' });
assert(visionOffline.usedFallback && visionOffline.colorMatches.length === 0, 'Vision without Gemini returns an explicit fallback');
let visionSawImage = false;
const fakeVision: GeminiTextProvider = {
  async generateContent(request) {
    visionSawImage = request.images?.[0]?.mimeType === 'image/jpeg';
    return { text: JSON.stringify({ summary: 'Vải lụa đỏ.', detectedItems: ['khăn lụa'], dominantColors: [{ name: 'Đỏ', hex: '#A01020' }, { name: 'Lỗi', hex: 'red' }], styleIds: ['SANG_TRONG', 'BAD'], suggestedGarmentIds: ['garment-ao-nhat-binh', 'garment-fake'], eventIds: ['EVENT_WEDDING'] }) };
  },
};
const vision = await analyzeOutfitPhoto({ image: tinyImage }, { provider: fakeVision, model: 'mock', sleep: async () => undefined });
assert(visionSawImage, 'Vision sends the photo as inline image data');
assert(!vision.usedFallback && vision.dominantColors.length === 1 && vision.styleId === 'SANG_TRONG', 'Invalid hex and style values from the model are filtered');
assert(vision.suggestedGarmentIds.length === 1 && vision.eventId === 'EVENT_WEDDING' && vision.colorMatches[0]?.colorHex === '#9B111E', 'Vision suggestions are allow-listed and colour-matched');

// Render prompt guardrails
const renderRequest = {
  garmentId: 'garment-ngu-than-tay-chen', eventId: 'EVENT_GRADUATION', styleId: 'TOI_GIAN', primaryColor: '#1E2A38', pantColor: '#1C1C1E',
  accessoryIds: ['acc-khan-dong'], characterId: 'char-hoa-nhap-xe-lan', adaptiveNeedCodes: ['WHEELCHAIR_SEATED' as const],
};
const built = buildOutfitRenderPrompt(renderRequest);
assert(Boolean(built && built.prompt.includes('hữu nhậm') && built.prompt.includes('wheelchair')), 'Render prompt carries the right-over-left rule and seated posture');
assert(Boolean(built && built.prompt.includes('Không bỏ thân con')), 'Render prompt includes verified non-negotiables');
assert(Boolean(built && !built.usesReference && built.checklist.length > 2), 'Render checklist is produced for user verification');
assert(buildOutfitRenderPrompt({ ...renderRequest, primaryColor: '#123456' }) === null, 'Render rejects colours outside the approved palette');
const withReference = buildOutfitRenderPrompt({ ...renderRequest, referenceImage: tinyImage, consentToUseReference: false });
assert(withReference?.usesReference === false, 'A reference photo is ignored without explicit consent');

let renderError: unknown;
try {
  await renderOutfitImage(renderRequest, { model: 'mock' });
} catch (error) {
  renderError = error;
}
assert(renderError instanceof RenderUnavailableError && renderError.failureKind === 'not_configured', 'Render without an image provider reports not_configured');
const fakeImage: GeminiImageProvider = { async generateImage() { return { data: 'iVBORw0KGgo=', mimeType: 'image/png' }; } };
const rendered = await renderOutfitImage(renderRequest, { model: 'mock', imageProvider: fakeImage, imageModel: 'mock-image' });
assert(rendered.imageDataUrl.startsWith('data:image/png;base64,') && rendered.model === 'mock-image', 'Render returns a data URL from the image provider');

// Settings
const settings = readGeminiSettings({ GEMINI_API_KEY: 'MY_GEMINI_API_KEY', GEMINI_THINKING_LEVEL: 'minimal' } as NodeJS.ProcessEnv);
assert(settings.apiKey === undefined && settings.thinkingLevel === 'low' && settings.textModel === 'gemini-3.8-flash', 'Placeholder keys are ignored and unsupported thinking levels fall back to low');

// Rate limiter
let now = 0;
const limiter = createRateLimiter({ windowMs: 1000, max: 2, now: () => now });
const statuses: number[] = [];
const fakeRes = () => {
  const res = { statusCode: 200, headers: {} as Record<string, string>, setHeader(name: string, value: string) { res.headers[name] = value; }, status(code: number) { res.statusCode = code; return res; }, json() { statuses.push(res.statusCode); return res; } };
  return res;
};
const request = { ip: '1.2.3.4', socket: { remoteAddress: '1.2.3.4' } };
for (let index = 0; index < 3; index++) {
  let nextCalled = false;
  limiter(request as never, fakeRes() as never, () => { nextCalled = true; statuses.push(200); });
  if (index < 2) assert(nextCalled, `Request ${index + 1} within the limit passes`);
}
assert(statuses[2] === 429, 'Third request in the window is rejected with 429');
now = 1500;
let allowedAgain = false;
limiter(request as never, fakeRes() as never, () => { allowedAgain = true; });
assert(allowedAgain, 'Limiter window resets');

console.log(`\nAI FEATURE TESTS: ${passed} PASS, ${failed} FAIL\n`);

if (process.argv[1]?.endsWith('ai_features_tests.ts') && failed > 0) {
  process.exit(1);
}

export { passed as aiFeaturesPassed, failed as aiFeaturesFailed };
