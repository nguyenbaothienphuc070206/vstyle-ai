/**
 * Live smoke test against the real Gemini API (uses GEMINI_API_KEY from .env).
 *   npm run smoke:gemini            → text + vision tasks
 *   npm run smoke:gemini -- --render → also generates one image (uses image quota)
 * Prints only statuses and short snippets; never prints the API key.
 */
import dotenv from 'dotenv';
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { createGeminiProviders, readGeminiSettings } from '../src/lib/gemini/provider.ts';
import {
  analyzeOutfitPhoto,
  createGeminiCaption,
  explainStyling,
  parseStylingText,
  rankGeminiCandidates,
  renderOutfitImage,
  approvedSourceReferences,
  type GeminiServiceConfig,
} from '../src/lib/gemini/service.ts';
import { buildParseRequest } from '../src/lib/gemini/routes.ts';
import { getDeterministicRecommendations } from '../src/lib/recommendation/engine.ts';
import { checkCulture } from '../src/lib/culture/ruleEngine.ts';

dotenv.config({ quiet: true });
const settings = readGeminiSettings(process.env);
if (!settings.apiKey) {
  console.error('Thiếu GEMINI_API_KEY trong .env — không thể chạy smoke test thật.');
  process.exit(2);
}
const providers = createGeminiProviders(settings);
const config: GeminiServiceConfig = {
  model: settings.textModel,
  provider: providers.text,
  imageModel: settings.imageModel,
  imageProvider: providers.image,
  thinkingLevel: settings.thinkingLevel === 'off' ? undefined : settings.thinkingLevel,
};

// Wrap the provider so we can see real errors instead of silent fallbacks.
const realText = providers.text!;
config.provider = {
  async generateContent(request) {
    try {
      return await realText.generateContent(request);
    } catch (error) {
      const status = (error as { status?: number; statusCode?: number }).status ?? (error as { statusCode?: number }).statusCode;
      console.error(`   ↳ Gemini error (${status ?? 'no status'}): ${(error as Error).message?.slice(0, 300)}`);
      throw error;
    }
  },
};

/** 48×48 PNG with a red top half and gold bottom half (fabric-swatch stand-in). */
function swatchPng(): string {
  const width = 48;
  const height = 48;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const [r, g, b] = y < height / 2 ? [169, 34, 40] : [212, 163, 56];
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buffer: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png.toString('base64');
}

let failures = 0;
async function step<T>(name: string, run: () => Promise<T>, check: (value: T) => string | null) {
  const started = Date.now();
  try {
    const value = await run();
    const problem = check(value);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (problem) {
      failures++;
      console.log(`✗ ${name} (${seconds}s): ${problem}`);
    } else {
      console.log(`✓ ${name} (${seconds}s)`);
    }
    return value;
  } catch (error) {
    failures++;
    console.log(`✗ ${name}: ${(error as Error).message}`);
    return undefined;
  }
}

console.log(`Models: text=${settings.textModel} (fallback ${settings.textFallbackModel}), image=${settings.imageModel}, thinking=${settings.thinkingLevel}\n`);

const parsed = await step('parse', () => parseStylingText(buildParseRequest('Chụp kỷ yếu ở Văn Miếu cuối tuần, trời nắng nóng, mình thích Remix Gen Z màu xanh, có túi cói'), config), (value) => {
  console.log(`   ${JSON.stringify({ eventId: value.eventId, weatherId: value.weatherId, styleId: value.styleId, color: value.color, garmentId: value.garmentId, accessoryIds: value.accessoryIds, summary: value.summary })}`);
  return value.usedFallback ? 'used fallback' : null;
});

const context = { eventId: parsed?.eventId ?? 'EVENT_YEARBOOK', weatherId: parsed?.weatherId ?? 'WEATHER_HOT', style: 'REMIX_GEN_Z' as const, limit: 12 };
const candidates = getDeterministicRecommendations(context);
await step('rank', () => rankGeminiCandidates({ context, candidateIds: candidates.map((candidate) => candidate.outfitId) }, candidates, config), (value) => {
  console.log(`   top: ${value.candidateIds.join(', ').slice(0, 200)}`);
  return value.usedFallback ? 'used fallback' : null;
});

const culture = checkCulture({ garmentId: 'garment-ngu-than-tay-chen', accessoryIds: ['acc-khan-dong', 'acc-the-bai'], eventId: 'EVENT_GRADUATION', primaryColor: '#1E2A38' });
await step('explain', () => explainStyling({
  garmentName: 'Áo Ngũ Thân Tay Chẽn',
  eventName: 'Lễ Tốt Nghiệp',
  styleId: 'TOI_GIAN',
  primaryColor: 'Xanh Chàm Đậm (#1E2A38)',
  accessoryNames: ['Khăn Đóng', 'Thẻ Bài'],
  cultureResult: culture,
  retainedCharacteristics: culture.retainedCharacteristics,
  sources: approvedSourceReferences(culture.sourceIds),
}, config), (value) => {
  console.log(`   “${value.headline}” — ${value.editorialReview.slice(0, 160)}…`);
  return value.usedFallback ? 'used fallback' : null;
});

await step('caption', () => createGeminiCaption({
  garmentName: 'Áo Ngũ Thân Tay Chẽn',
  styleTitle: 'Áo Ngũ Thân Tay Chẽn · Tối giản',
  eventTitle: 'Lễ Tốt Nghiệp',
  chuanScore: culture.score,
  chatScore: 90,
  vibe: 'TOI_GIAN',
  cultureReasons: culture.reasons,
  retainedCharacteristics: culture.retainedCharacteristics,
  sources: approvedSourceReferences(culture.sourceIds),
}, config), (value) => {
  console.log(`   ${value.shortPunchyHook} | ${value.hashtags.join(' ')}`);
  return value.usedFallback ? 'used fallback' : null;
});

await step('vision', () => analyzeOutfitPhoto({ image: { mimeType: 'image/png', data: swatchPng() }, note: 'Mảnh vải mình thích' }, config), (value) => {
  console.log(`   ${value.summary.slice(0, 140)} | colors: ${value.dominantColors.map((color) => color.hex).join(' ')} | match: ${value.colorMatches[0]?.colorName ?? '-'}`);
  return value.usedFallback ? 'used fallback' : null;
});

if (process.argv.includes('--render')) {
  await step('render (image)', () => renderOutfitImage({
    garmentId: 'garment-ngu-than-tay-chen',
    eventId: 'EVENT_GRADUATION',
    styleId: 'TOI_GIAN',
    primaryColor: '#1E2A38',
    pantColor: '#1C1C1E',
    accessoryIds: ['acc-khan-dong'],
    characterId: 'char-nam-nho-nha',
  }, config), (value) => {
    const base64 = value.imageDataUrl.split(',')[1] ?? '';
    writeFileSync('smoke-render.png', Buffer.from(base64, 'base64'));
    console.log(`   saved smoke-render.png (${Math.round(base64.length * 0.75 / 1024)} KB) via ${value.model}`);
    return null;
  });
}

console.log(failures ? `\n${failures} bước lỗi.` : '\nTất cả bước Gemini chạy thật thành công.');
process.exit(failures ? 1 : 0);
