"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalChartAdapter = void 0;
const LocalPaipan_1 = require("./LocalPaipan");
const TrueSolarTimeCalculator_1 = require("./TrueSolarTimeCalculator");
const WuXingScorer_1 = require("./WuXingScorer");
const ShenShaMatcher_1 = require("./ShenShaMatcher");
const nayin_json_1 = __importDefault(require("../data/nayin.json"));
const SHI_SHEN_FULL = { 比: '比肩', 劫: '劫财', 食: '食神', 伤: '伤官', 财: '偏财', 才: '正财', 杀: '七杀', 官: '正官', 枭: '偏印', 印: '正印' };
const STEM_ELEMENT = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const STEM_YIN_YANG = { 甲: '阳', 乙: '阴', 丙: '阳', 丁: '阴', 戊: '阳', 己: '阴', 庚: '阳', 辛: '阴', 壬: '阳', 癸: '阴' };
const HIDDEN_STEMS = { 子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'], 辰: ['戊', '乙', '癸'], 巳: ['丙', '戊', '庚'], 午: ['丁', '己'], 未: ['己', '丁', '乙'], 申: ['庚', '戊', '壬'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'] };
const TWELVE_STAGES = {
    甲: { 亥: '长生', 子: '沐浴', 丑: '冠带', 寅: '临官', 卯: '帝旺', 辰: '衰', 巳: '病', 午: '死', 未: '墓', 申: '绝', 酉: '胎', 戌: '养' },
    乙: { 午: '长生', 巳: '沐浴', 辰: '冠带', 卯: '临官', 寅: '帝旺', 丑: '衰', 子: '病', 亥: '死', 戌: '墓', 酉: '绝', 申: '胎', 未: '养' },
    丙: { 寅: '长生', 卯: '沐浴', 辰: '冠带', 巳: '临官', 午: '帝旺', 未: '衰', 申: '病', 酉: '死', 戌: '墓', 亥: '绝', 子: '胎', 丑: '养' },
    丁: { 酉: '长生', 申: '沐浴', 未: '冠带', 午: '临官', 巳: '帝旺', 辰: '衰', 卯: '病', 寅: '死', 丑: '墓', 子: '绝', 亥: '胎', 戌: '养' },
    戊: { 寅: '长生', 卯: '沐浴', 辰: '冠带', 巳: '临官', 午: '帝旺', 未: '衰', 申: '病', 酉: '死', 戌: '墓', 亥: '绝', 子: '胎', 丑: '养' },
    己: { 酉: '长生', 申: '沐浴', 未: '冠带', 午: '临官', 巳: '帝旺', 辰: '衰', 卯: '病', 寅: '死', 丑: '墓', 子: '绝', 亥: '胎', 戌: '养' },
    庚: { 巳: '长生', 午: '沐浴', 未: '冠带', 申: '临官', 酉: '帝旺', 戌: '衰', 亥: '病', 子: '死', 丑: '墓', 寅: '绝', 卯: '胎', 辰: '养' },
    辛: { 子: '长生', 亥: '沐浴', 戌: '冠带', 酉: '临官', 申: '帝旺', 未: '衰', 午: '病', 巳: '死', 辰: '墓', 卯: '绝', 寅: '胎', 丑: '养' },
    壬: { 申: '长生', 酉: '沐浴', 戌: '冠带', 亥: '临官', 子: '帝旺', 丑: '衰', 寅: '病', 卯: '死', 辰: '墓', 巳: '绝', 午: '胎', 未: '养' },
    癸: { 卯: '长生', 寅: '沐浴', 丑: '冠带', 子: '临官', 亥: '帝旺', 戌: '衰', 酉: '病', 申: '死', 未: '墓', 午: '绝', 巳: '胎', 辰: '养' }
};
const NAYIN = Object.fromEntries(Object.entries(nayin_json_1.default).map(([pillar, row]) => [pillar, row[0]]));
class LocalChartAdapter {
    paipan = new LocalPaipan_1.LocalPaipan();
    compute(profile) {
        const solarBirthday = this.resolveSolarBirthday(profile), birthTime = profile.birth_time ?? '12:00', gender = (profile.gender === 'male' || profile.gender === 0) ? 0 : 1;
        const useTrueSolarTime = this.useTrueSolarTime(profile), longitude = TrueSolarTimeCalculator_1.TrueSolarTimeCalculator.resolveBirthLongitude(profile);
        if (useTrueSolarTime && longitude === null)
            throw new Error('启用真太阳时时必须填写出生地点或经纬度');
        const timeZoneId = String(profile?.birth_timezone_id ?? '').trim(), timeZoneOffsetRaw = profile?.birth_timezone_offset;
        const timeBasis = timeZoneId || (timeZoneOffsetRaw !== undefined && timeZoneOffsetRaw !== null && timeZoneOffsetRaw !== '' ? Number(timeZoneOffsetRaw) : 8);
        const solarResult = longitude !== null ? TrueSolarTimeCalculator_1.TrueSolarTimeCalculator.calculate(solarBirthday, birthTime, longitude, timeBasis) : null;
        const effectiveResult = useTrueSolarTime && solarResult ? solarResult : this.buildCivilTimeResult(solarBirthday, birthTime), [yy, mm, dd, hh, mt] = effectiveResult.parts;
        const info = this.paipan.GetInfo(gender, yy, mm, dd, hh, mt, 0);
        if (!info || !Object.keys(info).length)
            throw new Error('本地排盘计算失败: GetInfo返回空');
        return this.formatResult(info, profile, solarResult, effectiveResult, gender, solarBirthday, useTrueSolarTime);
    }
    computeFromPillars(profile) {
        const raw = profile?.direct_pillars ?? {}, labels = ['年柱', '月柱', '日柱', '时柱'], keys = ['year', 'month', 'day', 'hour'];
        const pillars = keys.map((key, i) => String(raw[key] ?? raw[labels[i]] ?? '').trim());
        const tg = [], dz = [];
        for (let i = 0; i < 4; i++) {
            const chars = Array.from(pillars[i]);
            if (chars.length !== 2)
                throw new Error(`${labels[i]}格式无效，请从六十甲子中选择`);
            const gi = this.paipan.ctg.indexOf(chars[0]), zi = this.paipan.cdz.indexOf(chars[1]);
            if (gi < 0 || zi < 0 || !NAYIN[pillars[i]])
                throw new Error(`${labels[i]}“${pillars[i]}”不是合法六十甲子`);
            tg.push(gi);
            dz.push(zi);
        }
        const tigerStart = [2, 4, 6, 8, 0][tg[0] % 5], monthOffset = (dz[1] - 2 + 12) % 12, expectedMonth = (tigerStart + monthOffset) % 10;
        if (tg[1] !== expectedMonth)
            throw new Error(`月柱与年柱不符合五虎遁规则：${pillars[0]}年对应当前月支应为${this.paipan.ctg[expectedMonth]}${this.paipan.cdz[dz[1]]}`);
        const ratStart = [0, 2, 4, 6, 8][tg[2] % 5], expectedHour = (ratStart + dz[3]) % 10, nightZiHour = (expectedHour + 2) % 10, isZi = dz[3] === 0;
        if (tg[3] !== expectedHour && !(isZi && tg[3] === nightZiHour))
            throw new Error(`时柱与日柱不符合五鼠遁规则：${pillars[2]}日对应当前时支应为${this.paipan.ctg[expectedHour]}${this.paipan.cdz[dz[3]]}${isZi ? `，夜子时亦可为${this.paipan.ctg[nightZiHour]}子` : ''}`);
        const birthYearRaw = String(profile?.direct_birth_year ?? '').trim(), qyYearRaw = String(profile?.direct_qiyun_year ?? '').trim(), qyMonthRaw = String(profile?.direct_qiyun_month ?? '').trim();
        const birthYear = birthYearRaw === '' ? 0 : Number(birthYearRaw), qyYear = qyYearRaw === '' ? 0 : Number(qyYearRaw), qyMonth = qyMonthRaw === '' ? 0 : Number(qyMonthRaw), qyProvided = qyYearRaw !== '' || qyMonthRaw !== '';
        if (birthYearRaw !== '' && (!Number.isInteger(birthYear) || birthYear < 1600 || birthYear > 2200))
            throw new Error('出生年份应填写 1600—2200 之间的完整年份');
        if (birthYear) {
            const yg = ((birthYear - 4) % 10 + 10) % 10, yz = ((birthYear - 4) % 12 + 12) % 12;
            if (yg !== tg[0] || yz !== dz[0])
                throw new Error(`出生年份 ${birthYear} 与年柱 ${pillars[0]} 不一致，请检查输入`);
        }
        if (qyProvided && (!Number.isInteger(qyYear) || qyYear < 1 || qyYear > 10 || !Number.isInteger(qyMonth) || qyMonth < 0 || qyMonth > 11))
            throw new Error('盲派起运年龄应填写 1—10 虚岁；月份仅作手动补充');
        const gender = (profile.gender === 'male' || profile.gender === 0) ? 0 : 1, info = this.buildDirectInfo(tg, dz, gender, birthYear, qyYear, qyMonth, qyProvided);
        if (isZi)
            info.zi_hour_variant = tg[3] === nightZiHour ? 'night' : 'early';
        const directProfile = { ...profile, input_mode: 'pillars', direct_pillars: { year: pillars[0], month: pillars[1], day: pillars[2], hour: pillars[3] }, direct_birth_year: birthYear || '', direct_qiyun_year: qyProvided ? qyYear : '', direct_qiyun_month: qyProvided ? qyMonth : '' };
        return this.formatResult(info, directProfile, null, { date: '', time: '', parts: [] }, gender, '', false);
    }
    buildDirectInfo(tg, dz, gender, birthYear, qyYear, qyMonth, qyProvided) {
        const info = { sex: gender, tg: [...tg], dz: [...dz], bazi: [], dz_cg: [], na_yin: [], direct_mode: true, manual_qiyun_provided: qyProvided, manual_start_age: qyYear, manual_qiyun_month: qyMonth, manual_start_year: (birthYear && qyProvided) ? birthYear + qyYear - 1 : 0 };
        for (let i = 0; i < 4; i++) {
            info.bazi.push([this.paipan.ctg[tg[i]], this.paipan.cdz[dz[i]]]);
            const cg = this.paipan.dzcg[dz[i]] ?? [];
            info.dz_cg[i] = { index: [...cg], char: cg.map(x => this.paipan.ctg[x]) };
            info.na_yin[i] = this.paipan.naYin(tg[i], dz[i]);
        }
        const yangYear = tg[0] % 2 === 0, forward = (gender === 0 && yangYear) || (gender === 1 && !yangYear), big_tg = [], big_dz = [];
        for (let i = 1; i <= 12; i++) {
            big_tg.push((tg[1] + (forward ? i : 20 - i)) % 10);
            big_dz.push((dz[1] + (forward ? i : 24 - i)) % 12);
        }
        info.big_tg = big_tg;
        info.big_dz = big_dz;
        info.big = big_tg.map((g, i) => this.paipan.ctg[g] + this.paipan.cdz[big_dz[i]]);
        info.big_start_time = [];
        if (info.manual_start_year)
            for (let i = 0; i < 12; i++)
                info.big_start_time.push([info.manual_start_year + i * 10, 1, 1, 0, 0, 0]);
        const gd = (29 - dz[1] - dz[3]) % 12, xi = gd < 2 ? 1 : 0, gt = ((tg[0] % 5) * 2 + gd + 12 * xi) % 10;
        info.gong = { index: [gt, gd], char: this.paipan.ctg[gt] + this.paipan.cdz[gd] };
        info.shen_gong = this.paipan.GetShenGong(tg[0], dz[1], dz[3]);
        info.tai_xi = this.paipan.GetTaiXi(tg[2], dz[2]);
        info.sx = this.paipan.csa[dz[0]];
        info.start_desc = qyProvided ? `${qyYear}虚岁起运（四柱直排手动填写）` : '';
        info.start_time = info.manual_start_year ? [info.manual_start_year, 1, 1, 0, 0, 0] : [];
        const nayinElement = Number(info.na_yin?.[0]?.[1]);
        if (birthYear) {
            info.jiaoyun_rule = this.buildDirectJiaoyunRule(nayinElement);
            info.jiaoyun_desc = info.jiaoyun_rule.desc;
            if (qyProvided && info.manual_start_year) {
                info.jiaoyun_events = this.paipan.buildBlindJiaoyunEvents(info.manual_start_year, nayinElement, 25);
                info.start_event = info.jiaoyun_events?.[0] ?? null;
                info.start_time = info.start_event?.event_start_parts ?? info.start_time;
                info.start_time_window_end = info.start_event?.event_end_parts ?? [];
                info.big_start_time = [];
                for (let i = 0; i < 12; i++)
                    info.big_start_time.push(info.jiaoyun_events?.[i * 2]?.event_start_parts ?? [info.manual_start_year + i * 10, 1, 1, 0, 0, 0]);
            }
        }
        else
            info.jiaoyun_desc = qyProvided ? '四柱直排 · 已手动填写起运年龄；填写出生年份后可生成纳音交运规则' : '';
        info.wx_fen = this.paipan.wuXingPingFen(info);
        return info;
    }
    buildDirectJiaoyunRule(nayinElement) {
        // 四柱直排与日期排盘必须共用同一条盲派交运规则，避免两套口径漂移。
        return this.paipan.getBlindJiaoyunRule(nayinElement);
    }
    useTrueSolarTime(profile) { const v = profile?.use_true_solar_time; return !(v === false || v === 0 || v === '0' || String(v).toLowerCase() === 'false'); }
    buildCivilTimeResult(birthday, birthTime) {
        const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday), tm = /^(\d{2}):(\d{2})$/.exec(birthTime);
        if (!dm || !tm)
            throw new Error('出生日期或时间格式无效');
        const parts = [Number(dm[1]), Number(dm[2]), Number(dm[3]), Number(tm[1]), Number(tm[2]), 0];
        return { date: birthday, time: birthTime, offset_seconds: 0, description: '未启用真太阳时校正', parts };
    }
    resolveSolarBirthday(profile) {
        const birthday = String(profile.birthday ?? '').trim().split(' ')[0];
        if (!Number(profile.is_lunar ?? 0))
            return birthday;
        const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(birthday);
        if (!m)
            throw new Error('出生日期格式无效: ' + birthday);
        const solar = this.paipan.Lunar2Solar(+m[1], +m[2], +m[3], Number(profile.is_leap ?? 0));
        if (!solar || solar.length < 3)
            throw new Error(`农历转公历失败: ${+m[1]}-${+m[2]}-${+m[3]}${Number(profile.is_leap ?? 0) ? '（闰月）' : ''}`);
        return `${solar[0].toString().padStart(4, '0')}-${solar[1].toString().padStart(2, '0')}-${solar[2].toString().padStart(2, '0')}`;
    }
    formatResult(info, profile, solarResult, effectiveResult, gender, solarBirthday, useTrueSolarTime) {
        const p = this.paipan, s = p.ctg, b = p.cdz;
        const ys = s[info.tg[0]], yb = b[info.dz[0]], ms = s[info.tg[1]], mb = b[info.dz[1]], ds = s[info.tg[2]], db = b[info.dz[2]], hs = s[info.tg[3]], hb = b[info.dz[3]];
        const shi_shen = { year_stem: this.getShiShen(ds, ys), year_branch: this.getShiShen(ds, HIDDEN_STEMS[yb]?.[0] ?? ys), month_stem: this.getShiShen(ds, ms), month_branch: this.getShiShen(ds, HIDDEN_STEMS[mb]?.[0] ?? ms), day_stem: '日元', day_branch: this.getShiShen(ds, HIDDEN_STEMS[db]?.[0] ?? ds), hour_stem: this.getShiShen(ds, hs), hour_branch: this.getShiShen(ds, HIDDEN_STEMS[hb]?.[0] ?? hs) };
        const hidden_stems = {};
        for (const [pos, branch] of Object.entries({ year: yb, month: mb, day: db, hour: hb }))
            hidden_stems[pos] = this.buildHiddenStemsForBranch(ds, String(branch));
        const elements = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
        for (const st of [ys, ms, ds, hs])
            if (STEM_ELEMENT[st])
                elements[STEM_ELEMENT[st]]++;
        for (const br of [yb, mb, db, hb]) {
            const st = HIDDEN_STEMS[br]?.[0];
            if (st && STEM_ELEMENT[st])
                elements[STEM_ELEMENT[st]]++;
        }
        const missing = Object.entries(elements).filter(([, v]) => v === 0).map(([k]) => k), summary = missing.length ? '五行缺' + missing.join('、') : '五行俱全';
        const yp = ys + yb, mp = ms + mb, dp = ds + db, hp = hs + hb, nayin = { year: NAYIN[yp] ?? '未知', month: NAYIN[mp] ?? '未知', day: NAYIN[dp] ?? '未知', hour: NAYIN[hp] ?? '未知' };
        const kong_wang = { year: this.calcKongWang(yp), month: this.calcKongWang(mp), day: this.calcKongWang(dp), hour: this.calcKongWang(hp) };
        const zi_zuo = { year: TWELVE_STAGES[ys]?.[yb] ?? '', month: TWELVE_STAGES[ms]?.[mb] ?? '', day: TWELVE_STAGES[ds]?.[db] ?? '', hour: TWELVE_STAGES[hs]?.[hb] ?? '' };
        const xing_yun = { year: TWELVE_STAGES[ds]?.[yb] ?? '', month: TWELVE_STAGES[ds]?.[mb] ?? '', day: TWELVE_STAGES[ds]?.[db] ?? '', hour: TWELVE_STAGES[ds]?.[hb] ?? '' };
        const isDirect = profile.input_mode === 'pillars', birthYear = isDirect ? Number(profile.direct_birth_year || 0) : +solarBirthday.slice(0, 4), da_yun = this.buildDaYun(info, ds, birthYear), wx = info.wx_fen ?? [0, 0, 0, 0, 0], wxScore = { 木: +Number(wx[0] ?? 0).toFixed(4), 火: +Number(wx[1] ?? 0).toFixed(4), 土: +Number(wx[2] ?? 0).toFixed(4), 金: +Number(wx[3] ?? 0).toFixed(4), 水: +Number(wx[4] ?? 0).toFixed(4) };
        const taiyuan = this.calcTaiYuan(ms, mb), minggong = info.gong?.char ?? '', shenggong = info.shen_gong?.char ?? '', taixi = info.tai_xi?.char ?? '', jieqi = isDirect ? { prev_jie: null, next_jie: null, jieqi_desc: '四柱直排未提供出生日期，节气信息不参与计算' } : this.buildJieQiInfo(info);
        let lunar = { year: '', month: '', day: '', is_leap: false, year_text: '', month_text: '', day_text: '', text: '', hour: '' };
        if (!isDirect) {
            const solarParts = solarBirthday.split('-').map(Number), lunarRaw = this.paipan.Solar2Lunar(solarParts[0], solarParts[1], solarParts[2]);
            lunar = this.buildLunarInfo(lunarRaw, b[info.dz[3]] + '时');
        }
        const qiyun = isDirect ? (info.manual_qiyun_provided ? { year: Number(info.manual_start_age || 0), month: Number(info.manual_qiyun_month || 0), day: 0, hour: 0, virtual_age: true, method: 'manual_blind' } : null) : { year: Number(info.qiyun_virtual_age || 0), month: 0, day: 0, hour: 0, virtual_age: true, method: 'blind_day_div_3', source_days: Number(info.qiyun_source_days || 0), precision_reference: info.precision_qiyun_ref ?? null };
        const firstJiaoyun = info.start_event ?? info.jiaoyun_events?.[0] ?? null;
        const jiaoyun = isDirect ? { year: info.manual_start_year || '', month: firstJiaoyun?.event_start_parts?.[1] ?? '', day: firstJiaoyun?.event_start_parts?.[2] ?? '', desc: info.jiaoyun_desc || '', rule: info.jiaoyun_rule ?? null, first_event: firstJiaoyun, events: info.jiaoyun_events ?? [] } : { year: info.start_time?.[0] ?? '', month: firstJiaoyun?.event_start_parts?.[1] ?? '', day: firstJiaoyun?.event_start_parts?.[2] ?? '', desc: info.jiaoyun_desc ?? '', rule: info.jiaoyun_rule ?? null, first_event: firstJiaoyun, events: info.jiaoyun_events ?? [] };
        const blind_daxian = this.buildBlindDaXian(birthYear);
        const trueSolarText = isDirect || !solarResult ? '' : `${solarResult.date} ${solarResult.time}`, effectiveText = isDirect ? '' : `${effectiveResult.date} ${effectiveResult.time}`, civilText = isDirect ? '' : `${solarBirthday} ${profile.birth_time ?? ''}`;
        const paipanRules = isDirect ? { system: '真一盲派', day_boundary: '00:00', zi_hour: '早晚子时分排', qiyun: '四柱直排手动起运', dayun: '十年一柱，前五年运干、后五年运支' } : { system: '真一盲派', time_basis: useTrueSolarTime ? '真太阳时' : '输入民用时间', civil_timezone: profile.birth_timezone_id || (`UTC${Number(profile.birth_timezone_offset ?? 8) >= 0 ? '+' : ''}${Number(profile.birth_timezone_offset ?? 8)}`), day_boundary: '00:00', zi_hour: '23:00-24:00夜子时；00:00-01:00早子时', year_boundary: '立春', month_boundary: '精确节令', liunian_boundary: '立春', liuyue_boundary: '十二节令', qiyun: '三日一岁，余一舍、余二进，1—10虚岁', dayun: '十年一柱，前五年运干、后五年运支', jiaoyun: info.jiaoyun_desc ?? '' };
        return { profile_id: profile.id ?? 0, source: isDirect ? 'local-pillars' : 'local', input_mode: isDirect ? 'pillars' : 'datetime', solar_date: isDirect ? '' : solarBirthday, birth_year: birthYear || null, blind_daxian, bazi: { year_pillar: { heavenly_stem: ys, earthly_branch: yb }, month_pillar: { heavenly_stem: ms, earthly_branch: mb }, day_pillar: { heavenly_stem: ds, earthly_branch: db }, hour_pillar: { heavenly_stem: hs, earthly_branch: hb } }, shi_shen, hidden_stems, five_elements: { metal: elements.金, wood: elements.木, water: elements.水, fire: elements.火, earth: elements.土, summary }, nayin, da_yun, xiao_yun: this.buildXiaoYun(info, gender, 110), shen_sha: { year: [], month: [], day: [], hour: [] }, kong_wang, zi_zuo, xing_yun, day_master: { stem: ds, element: STEM_ELEMENT[ds] ?? '', yin_yang: STEM_YIN_YANG[ds] ?? '', description: `日主${ds}${STEM_ELEMENT[ds] ?? ''}` }, taiyuan, minggong, shenggong, taixi, taiyuan_nayin: NAYIN[taiyuan] ?? '', minggong_nayin: NAYIN[minggong] ?? '', shenggong_nayin: NAYIN[shenggong] ?? '', taixi_nayin: NAYIN[taixi] ?? '', animal: info.sx ?? '', lunar, jieqi, jieqi_desc: jieqi.jieqi_desc ?? '', prev_jie: jieqi.prev_jie ?? null, next_jie: jieqi.next_jie ?? null, solar_time: trueSolarText, true_solar_time: trueSolarText, civil_time: civilText, effective_time: effectiveText, use_true_solar_time: !isDirect && useTrueSolarTime, time_basis: isDirect ? 'pillars' : (useTrueSolarTime ? 'true_solar' : 'civil'), birth_timezone_id: isDirect ? '' : String(profile.birth_timezone_id ?? ''), birth_timezone_offset: isDirect ? null : (solarResult?.utc_offset_minutes != null ? solarResult.utc_offset_minutes / 60 : Number(profile.birth_timezone_offset ?? 8)), civil_time_ambiguous: !!solarResult?.civil_time_ambiguous, solar_time_description: solarResult?.description ?? '', zi_hour_variant: info.zi_hour_variant ?? ((!isDirect && Number(effectiveResult.parts?.[3]) === 23) ? 'night' : (!isDirect && Number(effectiveResult.parts?.[3]) === 0) ? 'early' : ''), paipan_rules: paipanRules, qiyun, qiyunsui: isDirect ? (qiyun?.year ?? 0) : Number(info.qiyun_virtual_age || 0), jiaoyun, wu_xing_score: wxScore, wx_fen: wx, day_master_strength: WuXingScorer_1.WuXingScorer.judgeDayMasterStrength(info.tg[2], wxScore) };
    }
    buildLunarInfo(raw, hour) {
        if (!raw || raw.length < 4)
            return { year: '', month: '', day: '', is_leap: false, year_text: '', month_text: '', day_text: '', text: '', hour };
        const [year, month, day, isLeap] = raw;
        const months = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
        const days = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
        const monthText = `${isLeap ? '闰' : ''}${months[month - 1] ?? month + '月'}`, dayText = days[day - 1] ?? String(day);
        return { year, month, day, is_leap: Boolean(isLeap), year_text: `${year}年`, month_text: monthText, day_text: dayText, text: `${year}年${monthText}${dayText}`, hour };
    }
    buildDaYun(info, dayStem, birthYear) {
        const s = this.paipan.ctg, b = this.paipan.cdz, jy = Number(info.start_time?.[0] ?? 0), direct = !!info.direct_mode, manual = !!info.manual_qiyun_provided, manualAge = Number(info.manual_start_age ?? 0), manualStartYear = Number(info.manual_start_year ?? 0), startAge = direct ? (manual ? manualAge : 0) : (Number(info.qiyun_virtual_age || 0) || (jy && birthYear ? jy - birthYear + 1 : 0)), out = [];
        const events = info.jiaoyun_events ?? [], eventByYear = new Map(events.map((e) => [Number(e.year), e]));
        const n = Math.min((info.big ?? info.big_tg ?? []).length || 12, 12);
        for (let i = 0; i < n; i++) {
            const st = s[info.big_tg[i]], br = b[info.big_dz[i]], bst = info.big_start_time?.[i], year = direct ? (manualStartYear ? manualStartYear + 10 * i : 0) : (bst ? Number(bst[0]) : (jy ? jy + 10 * i : 0)), age = direct ? (manual ? manualAge + 10 * i : 0) : (startAge ? startAge + 10 * i : 0), pillar = st + br;
            const startEvent = year ? eventByYear.get(year) ?? null : null, branchEvent = year ? eventByYear.get(year + 5) ?? null : null, endEvent = year ? eventByYear.get(year + 10) ?? null : null;
            const stemPhase = { name: `${st}运`, component: 'stem', start_age: age || null, end_age: age ? age + 4 : null, start_year: year || null, end_year: year ? year + 5 : null, start_event: startEvent, end_event: branchEvent, jiaoyun_rule: info.jiaoyun_rule ?? null };
            const branchPhase = { name: `${br}运`, component: 'branch', start_age: age ? age + 5 : null, end_age: age ? age + 9 : null, start_year: year ? year + 5 : null, end_year: year ? year + 10 : null, start_event: branchEvent, end_event: endEvent, jiaoyun_rule: info.jiaoyun_rule ?? null };
            out.push({ index: i + 1, pillar, heavenly_stem: st, earthly_branch: br, start_age: age || null, end_age: age ? age + 9 : null, start_year: year || null, start_event: startEvent, stem_to_branch_event: branchEvent, end_event: endEvent, stem_phase: stemPhase, branch_phase: branchPhase, stem_shi_shen: this.getShiShen(dayStem, st), branch_shi_shen: this.getShiShen(dayStem, HIDDEN_STEMS[br]?.[0] ?? st), nayin: NAYIN[pillar] ?? '', hidden_stems: this.buildHiddenStemsForBranch(dayStem, br), shen_sha: [] });
        }
        for (let di = 0; di < out.length; di++) {
            const dy = out[di], list = [];
            if (dy.start_year)
                for (let j = 0; j < 10; j++) {
                    const year = Number(dy.start_year) + j, age = birthYear ? year - birthYear + 1 : (Number(dy.start_age || 0) + j), si = ((year - 4) % 10 + 10) % 10, bi = ((year - 4) % 12 + 12) % 12, st = s[si], br = b[bi], pillar = st + br, isStem = j < 5, phase = isStem ? dy.stem_phase : dy.branch_phase;
                    const transitionEvent = j === 0 ? dy.start_event : j === 5 ? dy.stem_to_branch_event : null;
                    const beforeComponent = j === 0 ? (di === 0 ? 'none' : 'branch') : (j === 5 ? 'stem' : null), afterComponent = j === 0 ? 'stem' : j === 5 ? 'branch' : null;
                    const beforeValue = j === 0 ? (di === 0 ? '' : out[di - 1]?.earthly_branch || '') : (j === 5 ? dy.heavenly_stem : ''), afterValue = j === 0 ? dy.heavenly_stem : j === 5 ? dy.earthly_branch : '';
                    const transitionLabel = transitionEvent ? `${j === 0 ? (di === 0 ? '未起运' : `${out[di - 1]?.earthly_branch || '上一运'}运`) : `${dy.heavenly_stem}运`}→${j === 0 ? `${dy.heavenly_stem}运` : `${dy.earthly_branch}运`}` : '';
                    const liunianStart = this.buildTermEvent(year, '立春'), liunianEnd = this.buildTermEvent(year + 1, '立春');
                    list.push({ ganzhi: pillar, heavenly_stem: st, earthly_branch: br, year, age: age >= 0 ? `${age}岁` : '', dayun_phase: transitionEvent ? `交运年 · ${transitionLabel}` : (phase?.name || ''), active_dayun_component: isStem ? 'stem' : 'branch', active_dayun_value: isStem ? dy.heavenly_stem : dy.earthly_branch, is_transition_year: !!transitionEvent, transition_event: transitionEvent, component_before_transition: beforeComponent, component_after_transition: afterComponent, value_before_transition: beforeValue, value_after_transition: afterValue, liunian_start_event: liunianStart, liunian_end_event: liunianEnd, stem_shi_shen: this.getShiShen(dayStem, st), branch_shi_shen: this.getShiShen(dayStem, HIDDEN_STEMS[br]?.[0] ?? st), nayin: NAYIN[pillar] ?? '', hidden_stems: this.buildHiddenStemsForBranch(dayStem, br) });
                }
            dy.liu_nian = list;
        }
        return out;
    }
    buildFlowMonths(flowYear, dayStem) {
        const branches = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'], terms = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];
        const yearStemIndex = ((flowYear - 4) % 10 + 10) % 10, tigerStart = [2, 4, 6, 8, 0][yearStemIndex % 5], out = [];
        for (let i = 0; i < 12; i++) {
            const startYear = i === 11 ? flowYear + 1 : flowYear, endYear = i >= 10 ? flowYear + 1 : flowYear, startTerm = terms[i], endTerm = i === 11 ? '立春' : terms[i + 1];
            const startEvent = this.buildTermEvent(startYear, startTerm), endEvent = this.buildTermEvent(endYear, endTerm);
            if (!startEvent || !endEvent)
                continue;
            const stem = this.paipan.ctg[(tigerStart + i) % 10], branch = branches[i], pillar = stem + branch;
            out.push({ index: i + 1, pillar, heavenly_stem: stem, earthly_branch: branch, month_branch: branch, start_term: startTerm, end_term: endTerm, start_event: startEvent, end_event: endEvent, stem_shi_shen: this.getShiShen(dayStem, stem), branch_shi_shen: this.getShiShen(dayStem, HIDDEN_STEMS[branch]?.[0] ?? stem), hidden_stems: this.buildHiddenStemsForBranch(dayStem, branch), nayin: NAYIN[pillar] ?? '', boundary_rule: '十二节令', localization_only: true });
        }
        return out;
    }
    buildTermEvent(year, term) {
        const parts = this.paipan.getSolarTermParts(year, term);
        if (!parts)
            return null;
        const fmt = (p) => `${String(p[0]).padStart(4, '0')}-${String(p[1]).padStart(2, '0')}-${String(p[2]).padStart(2, '0')} ${String(p[3] || 0).padStart(2, '0')}:${String(p[4] || 0).padStart(2, '0')}:${String(p[5] || 0).padStart(2, '0')}`;
        return { term, year, date: `${String(parts[0]).padStart(4, '0')}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`, time: `${String(parts[3] || 0).padStart(2, '0')}:${String(parts[4] || 0).padStart(2, '0')}:${String(parts[5] || 0).padStart(2, '0')}`, window_start: fmt(parts), event_start_parts: [...parts], precision: 'exact_solar_term', time_basis: 'solar_term' };
    }
    buildBlindDaXian(birthYear) {
        if (!birthYear)
            return { available: false, rule_version: 'blind-majority-35', ranges: [], note: '未提供出生年份，不生成当前大限年龄背景' };
        return { available: true, rule_version: 'blind-majority-35', approximate: true, ranges: [
                { pillar: 'year', label: '年柱大限', start_age: 1, end_age: 18 },
                { pillar: 'month', label: '月柱大限', start_age: 18, end_age: 35 },
                { pillar: 'day', label: '日柱大限', start_age: 35, end_age: 55 },
                { pillar: 'hour', label: '时柱大限', start_age: 55, end_age: null }
            ], note: '多数核心资料作年1—18、月18—35、日35—55、时55以后；边界年龄属交叠过渡，只作原局应期背景，不替代大运流年。' };
    }
    buildXiaoYun(info, gender, count = 100) { const s = this.paipan.ctg, b = this.paipan.cdz, hg = info.tg?.[3] ?? 0, hb = info.dz?.[3] ?? 0, yg = info.tg?.[0] ?? 0, yang = yg % 2 === 0, forward = (gender === 0 && yang) || (gender === 1 && !yang), step = forward ? 1 : -1, out = []; for (let i = 1; i <= count; i++)
        out.push(s[((hg + step * i) % 10 + 10) % 10] + b[((hb + step * i) % 12 + 12) % 12]); return out; }
    buildHiddenStemsForBranch(dayStem, branch) { const labels = ['本气', '中气', '余气']; return (HIDDEN_STEMS[branch] ?? []).map((stem, i) => ({ stem, label: labels[i] ?? '', element: STEM_ELEMENT[stem] ?? '', shi_shen: this.getShiShen(dayStem, stem) })); }
    getShiShen(dayStem, otherStem) { if (dayStem === otherStem)
        return '比肩'; const a = this.paipan.ctg.indexOf(dayStem), b = this.paipan.ctg.indexOf(otherStem); if (a < 0 || b < 0)
        return ''; const r = this.paipan.GetTenGod(a, b); return SHI_SHEN_FULL[r.char] ?? r.char ?? ''; }
    calcKongWang(pillar) { const s = this.paipan.ctg, b = this.paipan.cdz, c = Array.from(pillar); if (c.length < 2)
        return ''; const si = s.indexOf(c[0]), bi = b.indexOf(c[1]); if (si < 0 || bi < 0)
        return ''; const start = (bi - si + 12) % 12; return b[(start + 10) % 12] + b[(start + 11) % 12]; }
    calcTaiYuan(ms, mb) { const s = this.paipan.ctg, b = this.paipan.cdz, si = s.indexOf(ms), bi = b.indexOf(mb); return si < 0 || bi < 0 ? '' : s[(si + 1) % 10] + b[(bi + 3) % 12]; }
    parseQiyun(desc) { const val = (re) => Number(re.exec(desc)?.[1] ?? 0); return { year: val(/(\d+)年/), month: val(/(\d+)月/), day: val(/(\d+)天/), hour: val(/(\d+)时/) }; }
    ;
    buildJieQiInfo(info) { const names = ['小寒', '立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒', '立春', '惊蛰', '清明'], jq = info.jq_table ?? [], ix = info.jq_ix, jd = info.birth_jd; if (ix === null || ix === undefined || jd === null || jd === undefined || !jq.length || jq[ix] === undefined || jq[ix + 1] === undefined)
        return { prev_jie: null, next_jie: null, jieqi_desc: '' }; const prev = jq[ix], next = jq[ix + 1], pn = names[ix] ?? '', nn = names[ix + 1] ?? '', pd = this.jdToDateString(prev), nd = this.jdToDateString(next), pdays = jd - prev, ndays = next - jd, pdi = Math.floor(pdays), phi = Math.floor((pdays - pdi) * 24), ndi = Math.floor(ndays), nhi = Math.floor((ndays - ndi) * 24); return { prev_jie: { name: pn, date: pd }, next_jie: { name: nn, date: nd }, jieqi_desc: `出生于${pn}后${pdi}天${phi}小时，${nn}前${ndi}天${nhi}小时` }; }
    jdToDateString(jd) { const a = this.paipan.Julian2Solar(jd); if (!a || a.length < 6)
        return ''; return `${String(a[0]).padStart(4, '0')}-${String(a[1]).padStart(2, '0')}-${String(a[2]).padStart(2, '0')} ${String(a[3]).padStart(2, '0')}:${String(a[4]).padStart(2, '0')}:${String(a[5]).padStart(2, '0')}`; }
    computeShenSha(chartData, gender = 0) { const b = chartData.bazi ?? {}, input = {}; for (const [cn, en] of Object.entries({ '年柱': 'year_pillar', '月柱': 'month_pillar', '日柱': 'day_pillar', '时柱': 'hour_pillar' })) {
        const p = b[en] ?? {};
        input[cn] = { gan: p.heavenly_stem ?? '', zhi: p.earthly_branch ?? '' };
    } const matcher = new ShenShaMatcher_1.ShenShaMatcher(), main = matcher.matchAll(input, [], { gender: String(gender) }), dayun = [], liunian = []; for (let i = 0; i < (chartData.da_yun ?? []).length; i++) {
        const step = chartData.da_yun[i], c = Array.from(step.pillar ?? '');
        if (c.length < 2)
            continue;
        const extra = { '大运': { gan: c[0], zhi: c[1] } }, matches = matcher.matchAll(input, extra, { gender: String(gender) }), names = [];
        for (const r of matches)
            for (const m of r.matches ?? [])
                if (m.target_pillar === '大运' && r.name && !names.includes(r.name))
                    names.push(r.name);
        dayun.push([step.pillar, names]);
        const each = {};
        for (const ln of step.liu_nian ?? []) {
            const lc = Array.from(ln.ganzhi ?? '');
            if (lc.length < 2)
                continue;
            const ex = { '大运': { gan: c[0], zhi: c[1] }, '流年': { gan: lc[0], zhi: lc[1] } }, lm = matcher.matchAll(input, ex, { gender: String(gender) }), nms = [];
            for (const r of lm)
                for (const m of r.matches ?? [])
                    if (m.target_pillar === '流年' && r.name && !nms.includes(r.name))
                        nms.push(r.name);
            each[Number(ln.year)] = [ln.ganzhi, nms];
        }
        liunian[i] = each;
    } return { main, dayun, liunian }; }
}
exports.LocalChartAdapter = LocalChartAdapter;
