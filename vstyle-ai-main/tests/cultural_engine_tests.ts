import {
  checkCulture,
  evaluateCultureWithData,
  formatCultureForGemini,
} from '../src/lib/culture/ruleEngine.ts';
import {
  getAdaptiveAdjustments,
  getAllSources,
  getApprovedGarments,
  getCultureRules,
} from '../src/lib/dal/index.ts';

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
console.log('--- BẮT ĐẦU CHẠY KIỂM THỬ CULTURAL RULE ENGINE VSTYLE ---\n');

// 1. Clean Outfit Test
const cleanOutfit = {
  garmentId: 'garment-ao-tac',
  accessoryIds: ['acc-khan-dong', 'acc-the-bai', 'acc-hai-sen'],
  eventId: 'EVENT_GRADUATION',
  primaryColor: '#2B5C8F',
};
const cleanResult = checkCulture(cleanOutfit);
assert(cleanResult.status === 'KEEP', 'Trang phục chuẩn mực đầy đủ phụ kiện phải có status KEEP');
assert(cleanResult.score === 100, 'Trang phục chuẩn mực không tì vết phải đạt 100 điểm Chuẩn');
assert(cleanResult.ruleIds.includes('CR-01-HUU-NHAM'), 'Phải tự động bảo lưu quy thức Vạt Hữu Nhậm');
assert(cleanResult.retainedCharacteristics.length > 0, 'Phải liệt kê các đặc trưng văn hóa được bảo lưu');
assert(
  cleanResult.reasons.some((r) => r.includes('Bản phối bảo lưu')),
  'Lý do phải dùng ngôn từ chuẩn mực, tôn vinh nét đẹp truyền thống'
);

// 2. CONSIDER Test (Potential modernization/cultural tradeoff)
const missingHeadwearOutfit = {
  garmentId: 'garment-ao-tac',
  accessoryIds: ['acc-the-bai'], // Thiếu khăn đóng
  eventId: 'EVENT_GRADUATION',
  primaryColor: '#2B5C8F',
};
const considerResult = checkCulture(missingHeadwearOutfit);
assert(considerResult.status === 'CONSIDER', 'Áo Tấc thiếu khăn đóng dịp đại lễ phải có status CONSIDER');
assert(considerResult.score >= 80 && considerResult.score <= 90, 'Điểm Chuẩn phải bị trừ một phần khi thiếu phụ kiện nghi lễ');
assert(
  considerResult.reasons.some((r) => r.includes('Phối này có một điểm cần lưu ý')),
  'Ngôn từ thông báo phải hòa nhã ("Phối này có một điểm cần lưu ý..."), không chỉ trích người dùng'
);
assert(
  !considerResult.reasons.some((r) => r.toLowerCase().includes('bạn mặc sai')),
  'Tuyệt đối không dùng cụm từ quy chụp "bạn mặc sai"'
);

// 3. CONSIDER Test (Color in holiday)
const blackTetOutfit = {
  garmentId: 'garment-ngu-than-tay-chen',
  accessoryIds: ['acc-khan-dong'],
  eventId: 'EVENT_TET',
  primaryColor: '#1C1C1E', // Đen tuyền ngày Tết
};
const blackTetResult = checkCulture(blackTetOutfit);
assert(blackTetResult.status === 'CONSIDER', 'Mặc đen tuyền ngày Tết phải có status CONSIDER');
assert(
  blackTetResult.reasons.some((r) => r.includes('Tết')),
  'Lý do phải giải thích về không khí tươi sáng, ấm áp của ngày Tết cổ truyền'
);

// 4. WARNING Test (Clear conflict with approved rule)
const noYemTuThanOutfit = {
  garmentId: 'garment-ao-tu-than',
  accessoryIds: ['acc-non-quai-thao'], // Thiếu áo yếm bên trong
  eventId: 'EVENT_FESTIVAL',
  primaryColor: '#5A3825',
};
const warningResult = checkCulture(noYemTuThanOutfit);
assert(warningResult.status === 'WARNING', 'Áo tứ thân không mặc kèm áo yếm phải có status WARNING');
assert(warningResult.score <= 75, 'Vi phạm quy tắc cấu trúc bắt buộc phải bị trừ điểm lớn');
assert(warningResult.nonNegotiablesSatisfied === false, 'nonNegotiablesSatisfied phải là false khi có WARNING');
assert(
  warningResult.reasons.some((r) => r.includes('áo yếm')),
  'Lý do phải nêu rõ tính cần thiết của áo yếm trong áo tứ thân'
);

// 5. Multiple Issues Test (Accumulation of deductions)
const multiIssueOutfit = {
  garmentId: 'garment-ao-tac',
  accessoryIds: ['acc-sneaker-retro'], // Thiếu khăn đóng + đi sneaker vào lễ cưới hỷ sự
  eventId: 'EVENT_WEDDING',
  primaryColor: '#1C1C1E', // Lại còn mặc màu đen tuyền ngày cưới
};
const multiResult = checkCulture(multiIssueOutfit);
assert(multiResult.score < 75, 'Nhiều điểm cần lưu ý phải được tích lũy trừ điểm hợp lý');
assert(multiResult.reasons.length >= 2, 'Phải liệt kê đầy đủ các điểm cần lưu ý');
assert(multiResult.sourceIds.length >= 2, 'Phải liên kết đầy đủ các nguồn thẩm định tương ứng');

// 6. Adaptive Adjustment That Preserves Characteristics
const adaptiveOutfit = {
  garmentId: 'garment-ngu-than-tay-chen',
  accessoryIds: ['acc-khan-dong', 'acc-the-bai'],
  eventId: 'EVENT_GRADUATION',
  primaryColor: '#1E2A38',
  adaptiveNeedCode: 'WHEELCHAIR_SEATED',
};
const adaptiveResult = checkCulture(adaptiveOutfit);
assert(adaptiveResult.status === 'KEEP', 'Thời trang thích ứng chuẩn mực phải giữ nguyên status KEEP');
assert(
  adaptiveResult.retainedCharacteristics.includes(
    getApprovedGarments().find((garment) => garment.id === adaptiveOutfit.garmentId)!.characteristics[0],
  ),
  'Đặc trưng được bảo lưu phải lấy từ dữ liệu y phục đã phê duyệt'
);
assert(
  adaptiveResult.sourceIds.includes('src-adaptive-design-lab'),
  'Phải viện dẫn nguồn nghiên cứu thời trang thích ứng'
);

// 7. Unapproved / DRAFT Rule Exclusion Test
const testRulesList = checkCulture({
  garmentId: 'garment-ao-tu-than',
  accessoryIds: ['acc-yem-co-truyen'],
  eventId: 'EVENT_FESTIVAL',
});
assert(
  !testRulesList.ruleIds.includes('CR-09-DRAFT-EXPERIMENTAL-RULE'),
  'Quy tắc DRAFT tuyệt đối không được kích hoạt trong kết quả đánh giá thực tế'
);

// 8. Missing / Orphan Source Filtering
assert(
  testRulesList.sourceIds.every((sId) => typeof sId === 'string' && sId.startsWith('src-')),
  'Tất cả nguồn trả về phải là nguồn hợp lệ, không chứa nguồn rác'
);

// 9. Deterministic Repeated Result Test (No Randomness)
const deterministicInput = {
  garmentId: 'garment-ao-nhat-binh',
  accessoryIds: ['acc-man-nu', 'acc-kieng-bac'],
  eventId: 'EVENT_WEDDING',
  primaryColor: '#9B111E',
};
const baseCheck = checkCulture(deterministicInput);
let isDeterministic = true;
for (let i = 0; i < 50; i++) {
  const repeatCheck = checkCulture(deterministicInput);
  if (
    repeatCheck.score !== baseCheck.score ||
    repeatCheck.status !== baseCheck.status ||
    repeatCheck.ruleIds.length !== baseCheck.ruleIds.length
  ) {
    isDeterministic = false;
    break;
  }
}
assert(isDeterministic, 'Chạy 50 lần liên tiếp với cùng tham số phải cho ra kết quả đồng nhất 100%');

// 10. Gemini Culture Context Format Test
const geminiContext = formatCultureForGemini(cleanResult);
assert(Boolean(geminiContext.cultureResult), 'Gemini context phải chứa cultureResult');
assert(Array.isArray(geminiContext.ruleIds), 'Gemini context phải chứa mảng ruleIds');
assert(Array.isArray(geminiContext.reasons), 'Gemini context phải chứa mảng reasons');
assert(Array.isArray(geminiContext.retainedCharacteristics), 'Gemini context phải chứa retainedCharacteristics');
assert(Array.isArray(geminiContext.sourceIds), 'Gemini context phải chứa sourceIds');

// 11. Multiple WARNING rules accumulate
const tuThanGarment = getApprovedGarments().find((garment) => garment.id === 'garment-ao-tu-than');
const availableRules = getCultureRules();
const missingYemRule = availableRules.find((rule) => rule.id === 'CR-07-TU-THAN-YEM-KIN-DAO')!;
const blackColorRule = availableRules.find((rule) => rule.id === 'CR-05-MAU-SAC-BOI-CANH-LE-HOI')!;
const multipleWarnings = evaluateCultureWithData(
  {
    garmentId: 'garment-ao-tu-than',
    accessoryIds: [],
    eventId: 'EVENT_TET',
    primaryColor: '#1C1C1E',
  },
  {
    garment: tuThanGarment,
    rules: [missingYemRule, { ...blackColorRule, severity: 'WARNING' }],
    sources: getAllSources(),
    adaptiveAdjustments: getAdaptiveAdjustments(),
  },
);
assert(multipleWarnings.status === 'WARNING', 'Nhiều quy tắc WARNING phải được tổng hợp thành WARNING');
assert(multipleWarnings.ruleIds.length === 2, 'Phải giữ lại cả hai quy tắc WARNING đã kích hoạt');
assert(multipleWarnings.score === 60, 'Mức trừ điểm của nhiều WARNING phải được cộng ổn định');

// 12. Invalid rules cannot become cultural truth
const invalidRuleResult = evaluateCultureWithData(
  { garmentId: 'garment-ao-tu-than', accessoryIds: [] },
  {
    garment: tuThanGarment,
    rules: [{ ...missingYemRule, severity: 'INVALID' }],
    sources: getAllSources(),
    adaptiveAdjustments: getAdaptiveAdjustments(),
  },
);
assert(invalidRuleResult.status === 'KEEP', 'Quy tắc sai schema không được ảnh hưởng kết quả');
assert(invalidRuleResult.ruleIds.length === 0, 'Quy tắc sai schema không được đưa vào kết quả');

// 13. Rules without a verified source cannot affect the result
const missingSourceResult = evaluateCultureWithData(
  { garmentId: 'garment-ao-tu-than', accessoryIds: [] },
  {
    garment: tuThanGarment,
    rules: [{ ...missingYemRule, sourceIds: ['src-not-found'] }],
    sources: getAllSources(),
    adaptiveAdjustments: getAdaptiveAdjustments(),
  },
);
assert(missingSourceResult.status === 'KEEP', 'Quy tắc không có nguồn hợp lệ không được cảnh báo');
assert(missingSourceResult.ruleIds.length === 0, 'Quy tắc không có nguồn không được công bố');

// 14. Pure evaluation runs without a Gemini client or runtime
const pureResult = evaluateCultureWithData(cleanOutfit, {
  garment: getApprovedGarments().find((garment) => garment.id === cleanOutfit.garmentId),
  rules: getCultureRules(),
  sources: getAllSources(),
  adaptiveAdjustments: getAdaptiveAdjustments(),
});
assert(pureResult.status === cleanResult.status, 'Rule engine phải chạy độc lập, không cần Gemini');
assert(JSON.stringify(pureResult) === JSON.stringify(cleanResult), 'Pure evaluation phải khớp checkCulture');

console.log(`\n========================================`);
console.log(`KẾT QUẢ KIỂM THỬ RULE ENGINE: ${passed} PASS, ${failed} FAIL`);
console.log(`========================================\n`);

if (process.argv[1] && process.argv[1].endsWith('cultural_engine_tests.ts')) {
  if (failed > 0) process.exit(1);
  else process.exit(0);
}

export { passed as culturePassed, failed as cultureFailed };
