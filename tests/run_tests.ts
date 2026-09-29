import { checkCulture } from '../src/lib/culture/ruleEngine.ts';
import { checkAdaptive } from '../src/lib/adaptive/ruleEngine.ts';
import { recommendOutfitsDeterministic, calculateStyleScore } from '../src/lib/recommendation/engine.ts';
import {
  GeminiParseRequestSchema,
  GeminiParseResponseSchema,
  GeminiRecommendResponseSchema,
} from '../src/types/gemini.ts';
import garmentsData from '../data/garments.json' with { type: 'json' };

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failed++;
  }
}

console.log('--- BẮT ĐẦU CHẠY BỘ KIỂM THỬ VSTYLE (TEST SUITE) ---\n');

// 1. Cultural Rule Engine: Áo Tấc thiếu khăn đóng dịp đại lễ -> CONSIDER
const cultureAoTacNoHeadwear = checkCulture({
  garmentId: 'garment-ao-tac',
  accessoryIds: [],
  eventId: 'LE_TOT_NGHIEP',
  primaryColor: '#2B5C8F',
});
assert(cultureAoTacNoHeadwear.status === 'CONSIDER', 'Áo Tấc thiếu khăn đóng dịp đại lễ phải có status CONSIDER');
assert(cultureAoTacNoHeadwear.score < 90, 'Điểm Chuẩn Áo Tấc thiếu khăn đóng phải bị trừ điểm');

// 2. Cultural Rule Engine: Áo Tấc có khăn đóng -> KEEP & Score >= 95
const cultureAoTacFull = checkCulture({
  garmentId: 'garment-ao-tac',
  accessoryIds: ['acc-khan-dong', 'acc-the-bai'],
  eventId: 'LE_TOT_NGHIEP',
  primaryColor: '#2B5C8F',
});
assert(cultureAoTacFull.status === 'KEEP', 'Áo Tấc có khăn đóng phải có status KEEP');
assert(cultureAoTacFull.score >= 95, 'Áo Tấc chuẩn mực phải đạt điểm Chuẩn cao >= 95');
assert(cultureAoTacFull.ruleIds.includes('CR-01-HUU-NHAM'), 'Phải bảo tồn quy tắc Vạt Hữu Nhậm');

// 3. Cultural Violation: Trang phục đen tuyền đơn độc vào ngày Tết/Đám cưới
const cultureBlackTet = checkCulture({
  garmentId: 'garment-ngu-than-tay-chen',
  accessoryIds: [],
  eventId: 'TET',
  primaryColor: '#1C1C1E',
});
assert(cultureBlackTet.ruleIds.includes('CR-05-MAU-SAC-BOI-CANH-LE-HOI'), 'Đen tuyền ngày Tết phải kích hoạt quy tắc hài hòa màu sắc lễ hội');

// 4. Cultural Check: ID y phục không tồn tại -> Cảnh báo
const cultureFakeGarment = checkCulture({
  garmentId: 'fake-garment-id',
  accessoryIds: [],
});
assert(cultureFakeGarment.status === 'WARNING', 'Y phục không rõ nguồn gốc phải trả về WARNING');

// 5. Adaptive Rule Engine: Không có nhu cầu thích ứng (NONE)
const adaptiveNone = checkAdaptive(undefined);
assert(adaptiveNone.hasAdaptiveNeed === false, 'Không chọn thích ứng thì hasAdaptiveNeed = false');
assert(adaptiveNone.validated === true, 'Mặc định bình thường luôn validated');

// 6. Adaptive Rule Engine: Nhu cầu ngồi xe lăn (WHEELCHAIR_SEATED)
const adaptiveWheelchair = checkAdaptive('WHEELCHAIR_SEATED', 'garment-ngu-than-tay-chen');
assert(adaptiveWheelchair.hasAdaptiveNeed === true, 'Chọn xe lăn phải có hasAdaptiveNeed = true');
assert(adaptiveWheelchair.validated === true, 'Quy tắc xe lăn đã được xác thực (validated = true)');
assert(Boolean(adaptiveWheelchair.tailoringSpecs?.frontHemReduction), 'Quy tắc xe lăn phải có thông số hạ tà trước');

// 7. Adaptive Rule Engine: Nhu cầu chưa được xác thực
const adaptiveUnsupported = checkAdaptive('UNSUPPORTED_NEED_XYZ');
assert(adaptiveUnsupported.validated === false, 'Nhu cầu lạ không được tự bịa (validated = false)');
assert(adaptiveUnsupported.message.includes('chưa có dữ liệu thích ứng'), 'Phải hiển thị thông báo chưa có dữ liệu');

// 8. Deterministic Recommendation Engine: Phải trả về danh sách có điểm số xếp hạng
const recommendations = recommendOutfitsDeterministic({
  eventId: 'LE_TOT_NGHIEP',
  weatherId: 'WEATHER_HOT',
  styleVibe: 'TOI_GIAN',
});
assert(recommendations.length > 0, 'Recommendation engine phải trả về danh sách ứng viên');
assert(recommendations[0].totalScore >= recommendations[recommendations.length - 1].totalScore, 'Ứng viên đầu tiên phải có tổng điểm cao nhất');

// 9. Style Score: Chất theo gu
const sampleGarment = (garmentsData as any[])[0];
const styleCheck = calculateStyleScore(sampleGarment, sampleGarment.baseColors[0].hex, ['acc-khan-dong'], 'LE_TOT_NGHIEP', 'TOI_GIAN');
assert(styleCheck.score >= 50 && styleCheck.score <= 100, 'Điểm Chất phải trong khoảng 50 - 100');
assert(styleCheck.label.length > 0, 'Phải có nhãn phong cách');

// 10. Gemini Parse Zod Schema Validation
const validParsePayload = {
  eventId: 'EVENT_GRADUATION',
  weatherId: 'WEATHER_HOT',
  styleId: 'TOI_GIAN',
  color: '#2B5C8F',
  needCodes: [],
  confirmationRequired: [],
  summary: 'Mô tả hợp lệ',
  usedFallback: false,
};
const parseResult = GeminiParseResponseSchema.safeParse(validParsePayload);
assert(parseResult.success, 'GeminiParseResponseSchema phải chấp nhận JSON đúng định dạng');

// 11. Gemini Malformed Schema Rejection
const invalidParsePayload = {
  eventId: 12345, // Sai kiểu
};
const badParseResult = GeminiParseResponseSchema.safeParse(invalidParsePayload);
assert(!badParseResult.success, 'GeminiParseResponseSchema phải từ chối payload sai kiểu');
assert(
  GeminiRecommendResponseSchema.safeParse({ candidateIds: ['candidate-1'], usedFallback: false }).success,
  'GeminiRecommendResponseSchema chỉ nhận danh sách candidate IDs có cấu trúc',
);

// 12. Approved Data & Status Separation Check
const { getApprovedGarments, getGarments } = await import('../src/lib/dal/index.ts');
const approvedGarments = getApprovedGarments();
const allGarments = getGarments();
assert(approvedGarments.every((g) => g.status === 'APPROVED' && g.verified), 'Mọi y phục trong getApprovedGarments() phải có status APPROVED');
assert(allGarments.some((g) => g.status === 'DRAFT'), 'Hệ thống hỗ trợ phân định y phục bản nháp (DRAFT)');

// 13-18. Run the feature suites and aggregate their results so any failure fails `npm test`.
const suites = [
  await import('./domain_knowledge_tests.ts').then((module) => ({ name: 'Domain knowledge', passed: module.domainPassed, failed: module.domainFailed })),
  await import('./cultural_engine_tests.ts').then((module) => ({ name: 'Cultural rule engine', passed: module.culturePassed, failed: module.cultureFailed })),
  await import('./recommendation_engine_tests.ts').then((module) => ({ name: 'Recommendation engine', passed: module.recommendationPassed, failed: module.recommendationFailed })),
  await import('./visualization_tests.ts').then((module) => ({ name: 'Visualization', passed: module.visualizationPassed, failed: module.visualizationFailed })),
  await import('./gemini_service_tests.ts').then((module) => ({ name: 'Gemini service (mocked)', passed: module.geminiPassed, failed: module.geminiFailed })),
  await import('./ai_features_tests.ts').then((module) => ({ name: 'AI Arena features', passed: module.aiFeaturesPassed, failed: module.aiFeaturesFailed })),
];

const totalPassed = passed + suites.reduce((sum, suite) => sum + suite.passed, 0);
const totalFailed = failed + suites.reduce((sum, suite) => sum + suite.failed, 0);

console.log(`\n========================================`);
console.log(`Core: ${passed} PASS, ${failed} FAIL`);
for (const suite of suites) console.log(`${suite.name}: ${suite.passed} PASS, ${suite.failed} FAIL`);
console.log(`TỔNG: ${totalPassed} PASS, ${totalFailed} FAIL`);
console.log(`========================================\n`);

process.exit(totalFailed > 0 ? 1 : 0);
