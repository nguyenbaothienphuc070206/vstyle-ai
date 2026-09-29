import { z } from 'zod';
import { getDeterministicRecommendations } from '../src/lib/recommendation/engine.ts';
import { GeminiTextProvider, generateStructuredJson } from '../src/lib/gemini/generation.ts';
import { parseStylingText, rankGeminiCandidates } from '../src/lib/gemini/service.ts';

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

const OutputSchema = z.object({ value: z.string() });
type Output = z.infer<typeof OutputSchema>;

function providerFor(...responses: Array<string | Error | { status: number } | undefined>): GeminiTextProvider & { calls: number } {
  let index = 0;
  const provider = {
    calls: 0,
    async generateContent(): Promise<{ text?: string | null }> {
      provider.calls++;
      const response = responses[Math.min(index++, responses.length - 1)];
      if (response instanceof Error || (response && typeof response === 'object' && 'status' in response)) {
        throw response;
      }
      return { text: response };
    },
  };
  return provider;
}

function generationOptions(provider: GeminiTextProvider, overrides: Partial<Parameters<typeof generateStructuredJson<Output>>[0]> = {}) {
  return {
    provider,
    model: 'mock-model',
    systemInstruction: 'JSON only',
    prompt: 'mock request',
    schema: OutputSchema,
    fallback: () => ({ value: 'fallback' }),
    retryDelayMs: 0,
    sleep: async () => undefined,
    ...overrides,
  };
}

console.log('--- MOCKED GEMINI SERVICE ---\n');

const validProvider = providerFor('{"value":"valid"}');
const validResult = await generateStructuredJson(generationOptions(validProvider));
assert(!validResult.usedFallback && validResult.value.value === 'valid', 'Valid structured response should be accepted');
assert(validProvider.calls === 1, 'Valid response should not be retried');

const invalidJsonProvider = providerFor('not-json', '{"value":"recovered"}');
const invalidJsonResult = await generateStructuredJson(generationOptions(invalidJsonProvider));
assert(!invalidJsonResult.usedFallback && invalidJsonResult.value.value === 'recovered', 'Invalid JSON should retry once and accept a valid response');
assert(invalidJsonProvider.calls === 2, 'Invalid JSON retry should be bounded to one retry');

const malformedProvider = providerFor('{"value":42}', '{"value":false}');
const malformedResult = await generateStructuredJson(generationOptions(malformedProvider));
assert(malformedResult.usedFallback && malformedResult.value.value === 'fallback', 'Schema mismatch after retry should use fallback');
assert(malformedProvider.calls === 2, 'Schema mismatch should not retry indefinitely');

const emptyProvider = providerFor('', undefined);
const emptyResult = await generateStructuredJson(generationOptions(emptyProvider));
assert(emptyResult.usedFallback && emptyResult.failureKind === 'empty_response', 'Empty model responses should fall back safely');
assert(emptyProvider.calls === 2, 'Empty response should receive exactly one retry');

const tooManyRequests = Object.assign(new Error('provider details are private'), { status: 429 });
const rateLimitProvider = providerFor(tooManyRequests, '{"value":"after-retry"}');
const rateLimitResult = await generateStructuredJson(generationOptions(rateLimitProvider));
assert(!rateLimitResult.usedFallback && rateLimitResult.value.value === 'after-retry', 'HTTP 429 should retry once');
assert(rateLimitProvider.calls === 2, 'Rate limit retries should be bounded');

const authFailure = Object.assign(new Error('do not expose'), { status: 401 });
const authProvider = providerFor(authFailure, '{"value":"must-not-run"}');
const authResult = await generateStructuredJson(generationOptions(authProvider));
assert(authResult.usedFallback && authResult.failureKind === 'authentication', 'HTTP 401 should fall back without exposing provider details');
assert(authProvider.calls === 1, 'Authentication failures should not be retried');

const forbiddenFailure = Object.assign(new Error('do not expose'), { status: 403 });
const forbiddenProvider = providerFor(forbiddenFailure, '{"value":"must-not-run"}');
const forbiddenResult = await generateStructuredJson(generationOptions(forbiddenProvider));
assert(forbiddenResult.usedFallback && forbiddenResult.failureKind === 'authentication', 'HTTP 403 should be classified as an authentication failure');
assert(forbiddenProvider.calls === 1, 'Permission failures should not be retried');

let networkCalls = 0;
const networkProvider: GeminiTextProvider = {
  async generateContent() {
    networkCalls++;
    if (networkCalls === 1) throw new TypeError('network unavailable');
    return { text: '{"value":"network-recovered"}' };
  },
};
const networkResult = await generateStructuredJson(generationOptions(networkProvider));
assert(!networkResult.usedFallback && networkResult.value.value === 'network-recovered', 'Network failures should retry once');
assert(networkCalls === 2, 'Network retries should be bounded');

let timeoutCalls = 0;
const timeoutProvider: GeminiTextProvider = {
  generateContent(request) {
    timeoutCalls++;
    return new Promise((_resolve, reject) => {
      request.abortSignal?.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      }, { once: true });
    });
  },
};
const timeoutResult = await generateStructuredJson(generationOptions(timeoutProvider, { timeoutMs: 2 }));
assert(timeoutResult.usedFallback && timeoutResult.failureKind === 'timeout', 'Timed-out requests should fall back');
assert(timeoutCalls === 2, 'Timeout retry should remain bounded');

const parseProvider = providerFor(JSON.stringify({
  eventId: 'EVENT_NOT_ALLOWED',
  weatherId: 'WEATHER_HOT',
  styleId: 'NOT_A_STYLE',
  color: '#abcdef',
  needCodes: ['UNSUPPORTED_NEED'],
  summary: 'Parsed safely',
}));
const parseResult = await parseStylingText({
  text: 'I need an outfit for an event.',
  allowedEvents: ['EVENT_GRADUATION'],
  allowedWeatherIds: ['WEATHER_HOT'],
  allowedStyles: ['TOI_GIAN'],
  allowedColors: [{ name: 'Blue', hex: '#123456' }],
  allowedNeeds: [],
}, { provider: parseProvider, model: 'mock-model', sleep: async () => undefined });
assert(parseResult.eventId === null && parseResult.styleId === null && parseResult.color === null, 'Unknown parse values should be removed');
assert(parseResult.confirmationRequired.includes('event') && parseResult.confirmationRequired.includes('adaptiveNeeds'), 'Unknown parse values should require user confirmation');
assert(parseResult.weatherId === 'WEATHER_HOT', 'Allowed parse values should be preserved');

const deterministicCandidates = getDeterministicRecommendations({ eventId: 'EVENT_GRADUATION', limit: 3 });
const allowedCandidateIds = deterministicCandidates.map((candidate) => candidate.outfitId);
const invalidIdProvider = providerFor(
  JSON.stringify({ candidateIds: ['unknown-candidate-id'] }),
  JSON.stringify({ candidateIds: ['unknown-candidate-id'] }),
);
const rankedFallback = await rankGeminiCandidates({
  context: { eventId: 'EVENT_GRADUATION', limit: 3 },
  candidateIds: allowedCandidateIds,
}, deterministicCandidates, { provider: invalidIdProvider, model: 'mock-model', sleep: async () => undefined });
assert(rankedFallback.usedFallback, 'Unknown candidate IDs should be rejected and retried before fallback');
assert(rankedFallback.candidateIds.every((id) => allowedCandidateIds.includes(id)), 'Fallback ranking should contain known deterministic candidate IDs only');
assert(invalidIdProvider.calls === 2, 'Invalid candidate IDs should trigger one retry only');

console.log(`\nGEMINI SERVICE TESTS: ${passed} PASS, ${failed} FAIL\n`);

if (process.argv[1]?.endsWith('gemini_service_tests.ts') && failed > 0) {
  process.exit(1);
}

export { passed as geminiPassed, failed as geminiFailed };