"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePaipan = computePaipan;
const LocalChartAdapter_1 = require("./core/LocalChartAdapter");
const TrueSolarTimeCalculator_1 = require("./core/TrueSolarTimeCalculator");
const LocalPaipan_1 = require("./core/LocalPaipan");
const BlindJudgmentEngine_1 = require("./core/judgment/BlindJudgmentEngine");
function parseBooleanLike(value, fallback = false) {
    if (value === undefined || value === null || value === '')
        return fallback;
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number') {
        if (value === 1)
            return true;
        if (value === 0)
            return false;
    }
    if (typeof value === 'string') {
        const s = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(s))
            return true;
        if (['false', '0', 'no', 'n'].includes(s))
            return false;
    }
    throw new Error('布尔参数格式无效');
}
function parseGender(value) {
    if (value === undefined || value === null || value === '')
        return 'male';
    if (value === 'male' || value === 0 || value === '0')
        return 'male';
    if (value === 'female' || value === 1 || value === '1')
        return 'female';
    const s = String(value).trim().toLowerCase();
    if (['male', 'man', 'm', '男'].includes(s))
        return 'male';
    if (['female', 'woman', 'f', '女'].includes(s))
        return 'female';
    throw new Error('性别参数无效');
}
function attachShenSha(adapter, chart, gender) {
    const shenSha = adapter.computeShenSha(chart, gender === 'male' ? 1 : 2);
    chart.shen_sha_full = shenSha.main ?? [];
    chart.shen_sha = { year: [], month: [], day: [], hour: [] };
    const pillarMap = { '年柱': 'year', '月柱': 'month', '日柱': 'day', '时柱': 'hour' };
    for (const rule of chart.shen_sha_full)
        for (const match of rule.matches ?? []) {
            const key = pillarMap[match.target_pillar ?? ''], name = String(rule.name ?? '').trim();
            if (key && name && !chart.shen_sha[key].includes(name))
                chart.shen_sha[key].push(name);
        }
    for (let i = 0; i < (chart.da_yun ?? []).length; i++) {
        const step = chart.da_yun[i];
        step.shen_sha = shenSha.dayun?.[i]?.[1] ?? [];
        for (const ln of step.liu_nian ?? []) {
            const flow = shenSha.liunian?.[i]?.[Number(ln.year)];
            ln.shen_sha = flow?.[1] ?? [];
        }
    }
}
function attachBlindJudgment(chart) {
    try {
        const engine = new BlindJudgmentEngine_1.BlindJudgmentEngine();
        chart.blind_judgment = engine.analyze(chart);
    }
    catch (e) {
        chart.blind_judgment = { ok: false, engine_version: 'error', message: e?.message ?? String(e), warnings: ['判盘引擎暂未生成结果，基础排盘不受影响。'] };
    }
}
function computePaipan(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        return { ok: false, message: '请求数据格式无效' };
    let gender = 'male';
    try {
        gender = parseGender(input.gender);
    }
    catch (e) {
        return { ok: false, message: e?.message ?? String(e) };
    }
    const inputMode = String(input.input_mode ?? input.mode ?? '').trim().toLowerCase();
    if (inputMode === 'pillars' || inputMode === 'four-pillars' || inputMode === 'sizhu') {
        try {
            const adapter = new LocalChartAdapter_1.LocalChartAdapter();
            const profile = {
                id: 0,
                name: String(input.name ?? '').trim(),
                gender,
                input_mode: 'pillars',
                direct_pillars: input.direct_pillars ?? input.pillars ?? {},
                direct_birth_year: input.direct_birth_year ?? input.birth_year ?? '',
                direct_qiyun_year: input.direct_qiyun_year ?? input.qiyun_year ?? '',
                direct_qiyun_month: input.direct_qiyun_month ?? input.qiyun_month ?? '',
                birth_region: '四柱直排'
            };
            const chart = adapter.computeFromPillars(profile);
            attachShenSha(adapter, chart, gender);
            attachBlindJudgment(chart);
            return { ok: true, data: chart };
        }
        catch (e) {
            return { ok: false, message: e?.message ?? String(e) };
        }
    }
    const date = String(input.birthday ?? '').trim(), time = String(input.birth_time ?? '').trim(), longitudeRaw = input.longitude, longitude = (longitudeRaw === null || longitudeRaw === undefined || longitudeRaw === '') ? null : Number(longitudeRaw), timezoneId = String(input.timezone_id ?? input.birth_timezone_id ?? '').trim(), timezoneOffsetRaw = input.timezone_offset ?? input.birth_timezone_offset;
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date), tm = /^(\d{2}):(\d{2})$/.exec(time);
    if (!dm || !tm)
        return { ok: false, message: '请填写完整的出生日期和时间' };
    const y = Number(dm[1]), m = Number(dm[2]), d = Number(dm[3]), hh = Number(tm[1]), mi = Number(tm[2]);
    if (hh < 0 || hh > 23 || mi < 0 || mi > 59)
        return { ok: false, message: '出生时间无效' };
    let isLunar = false, isLeap = false, useTrueSolarTime = true;
    try {
        isLunar = parseBooleanLike(input.is_lunar, false);
        isLeap = parseBooleanLike(input.is_leap, false);
        useTrueSolarTime = parseBooleanLike(input.use_true_solar_time, true);
    }
    catch (e) {
        return { ok: false, message: e?.message ?? String(e) };
    }
    if (!isLunar && !TrueSolarTimeCalculator_1.TrueSolarTimeCalculator.isValidCivilDate(y, m, d))
        return { ok: false, message: '出生日期无效' };
    if (isLunar) {
        if (m < 1 || m > 12 || d < 1 || d > 30)
            return { ok: false, message: '农历出生日期无效' };
        const lunarEngine = new LocalPaipan_1.LocalPaipan(), leapMonth = lunarEngine.GetLeap(y), days = lunarEngine.GetLunarDays(y, m, isLeap ? 1 : 0);
        if ((isLeap && leapMonth !== m) || days <= 0 || d > days)
            return { ok: false, message: '农历出生日期无效' };
    }
    if (useTrueSolarTime && (longitude === null || !Number.isFinite(longitude) || longitude < -180 || longitude > 180))
        return { ok: false, message: '启用真太阳时时，请填写 -180—180 之间的有效出生地经度' };
    if (useTrueSolarTime && longitude === 0 && !timezoneId && (timezoneOffsetRaw === null || timezoneOffsetRaw === undefined || timezoneOffsetRaw === ''))
        return { ok: false, message: '启用真太阳时时，请填写有效的出生地经度' };
    if (!useTrueSolarTime && longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
        return { ok: false, message: '出生地经度无效' };
    if (timezoneId && !TrueSolarTimeCalculator_1.TrueSolarTimeCalculator.isValidTimeZone(timezoneId))
        return { ok: false, message: '出生地 IANA 时区无效，例如 Asia/Shanghai、America/New_York' };
    const timezoneOffset = (timezoneOffsetRaw === null || timezoneOffsetRaw === undefined || timezoneOffsetRaw === '') ? 8 : Number(timezoneOffsetRaw);
    if (!timezoneId && (!Number.isFinite(timezoneOffset) || timezoneOffset < -14 || timezoneOffset > 14))
        return { ok: false, message: '出生地 UTC 时区偏移应在 -14 到 +14 之间' };
    try {
        const profile = { id: 0, name: String(input.name ?? '').trim(), birthday: date, birth_time: time, gender, is_lunar: isLunar ? 1 : 0, is_leap: isLeap ? 1 : 0, use_true_solar_time: useTrueSolarTime, birth_longitude: longitude, birth_region: String(input.birth_region ?? '').trim(), birth_timezone_id: timezoneId, birth_timezone_offset: timezoneOffset };
        const adapter = new LocalChartAdapter_1.LocalChartAdapter(), chart = adapter.compute(profile);
        attachShenSha(adapter, chart, gender);
        attachBlindJudgment(chart);
        return { ok: true, data: chart };
    }
    catch (e) {
        return { ok: false, message: e?.message ?? String(e) };
    }
}
