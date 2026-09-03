"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrueSolarTimeCalculator = void 0;
const eot_json_1 = __importDefault(require("../data/eot.json"));
class TrueSolarTimeCalculator {
    static resolveBirthLongitude(profile) {
        const v = profile?.birth_longitude;
        if (v === null || v === undefined || v === '')
            return null;
        const n = Number(v);
        return Number.isFinite(n) && n >= -180 && n <= 180 ? n : null;
    }
    static pad(n) { return String(n).padStart(2, '0'); }
    static isLeapYear(year) { return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0); }
    static daysInMonth(year, month) { return [31, this.isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0; }
    static isValidCivilDate(year, month, day) {
        return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) && year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= this.daysInMonth(year, month);
    }
    static isValidTimeZone(timeZone) {
        if (!timeZone)
            return false;
        try {
            new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
            return true;
        }
        catch {
            return false;
        }
    }
    static formatInZone(epochMs, timeZone) {
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }), parts = {};
        for (const p of fmt.formatToParts(new Date(epochMs)))
            if (p.type !== 'literal')
                parts[p.type] = Number(p.value);
        return [parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second];
    }
    static sameCivil(a, b) { return a.slice(0, 5).every((v, i) => v === b[i]); }
    static offsetAtInstant(epochMs, timeZone) {
        const p = this.formatInZone(epochMs, timeZone), wall = Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5] || 0), rounded = Math.floor(epochMs / 1000) * 1000;
        return Math.round((wall - rounded) / 60000);
    }
    static resolveZonedCivilTime(birthday, birthTime, timeZone) {
        if (!this.isValidTimeZone(timeZone))
            throw new Error(`无效 IANA 时区：${timeZone}`);
        const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday), tm = /^(\d{2}):(\d{2})$/.exec(birthTime);
        if (!dm || !tm)
            throw new Error('出生日期或时间格式无效');
        const local = [+dm[1], +dm[2], +dm[3], +tm[1], +tm[2], 0];
        const pseudo = Date.UTC(local[0], local[1] - 1, local[2], local[3], local[4], 0);
        let guess = pseudo;
        for (let i = 0; i < 4; i++) {
            const off = this.offsetAtInstant(guess, timeZone);
            guess = pseudo - off * 60000;
        }
        const candidates = [];
        for (let delta = -180; delta <= 180; delta += 15) {
            const c = guess + delta * 60000;
            if (this.sameCivil(this.formatInZone(c, timeZone), local) && !candidates.includes(c))
                candidates.push(c);
        }
        if (!candidates.length)
            throw new Error(`出生时间 ${birthday} ${birthTime} 在 ${timeZone} 不存在，可能处于夏令时跳时区间，请核对原始出生记录`);
        candidates.sort((a, b) => a - b);
        const chosen = candidates[0], offset = this.offsetAtInstant(chosen, timeZone);
        return { utc_epoch_ms: chosen, utc_offset_minutes: offset, timezone_id: timeZone, ambiguous: candidates.length > 1, candidates };
    }
    static calculate(birthday, birthTime, longitude, timezone = 8) {
        const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday), tm = /^(\d{2}):(\d{2})$/.exec(birthTime);
        if (!dm || !tm)
            throw new Error('出生日期或时间格式无效');
        const y = +dm[1], m = +dm[2], d = +dm[3], hh = +tm[1], mi = +tm[2];
        if (!this.isValidCivilDate(y, m, d))
            throw new Error('出生日期无效');
        if (hh < 0 || hh > 23 || mi < 0 || mi > 59)
            throw new Error('出生时间无效');
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
            throw new Error('出生地经度无效');
        let utcEpochMs, offsetMinutes, timeZoneId = '', ambiguous = false, candidates = [];
        if (typeof timezone === 'string') {
            const z = this.resolveZonedCivilTime(birthday, birthTime, timezone);
            utcEpochMs = z.utc_epoch_ms;
            offsetMinutes = z.utc_offset_minutes;
            timeZoneId = z.timezone_id;
            ambiguous = z.ambiguous;
            candidates = z.candidates;
        }
        else {
            if (!Number.isFinite(timezone) || timezone < -14 || timezone > 14)
                throw new Error('出生地时区偏移无效');
            offsetMinutes = Math.round(timezone * 60);
            utcEpochMs = Date.UTC(y, m - 1, d, hh, mi, 0) - offsetMinutes * 60000;
        }
        const eot = this.getEotCorrection(m, d), solarEpochMs = utcEpochMs + (longitude * 4 * 60 + eot) * 1000, dt = new Date(solarEpochMs);
        const parts = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), dt.getUTCHours(), dt.getUTCMinutes(), dt.getUTCSeconds()];
        const civilPseudo = Date.UTC(y, m - 1, d, hh, mi, 0), offset = Math.round((solarEpochMs - civilPseudo) / 1000), absMin = Math.floor(Math.abs(offset) / 60), absSec = Math.abs(offset) % 60, sign = offset >= 0 ? '+' : '-';
        const tzText = timeZoneId ? `${timeZoneId}（UTC${offsetMinutes >= 0 ? '+' : ''}${(offsetMinutes / 60).toFixed(offsetMinutes % 60 === 0 ? 0 : 2)}）` : `UTC${offsetMinutes >= 0 ? '+' : ''}${(offsetMinutes / 60).toFixed(offsetMinutes % 60 === 0 ? 0 : 2)}`;
        return {
            date: `${parts[0]}-${this.pad(parts[1])}-${this.pad(parts[2])}`,
            time: `${this.pad(parts[3])}:${this.pad(parts[4])}`,
            offset_seconds: offset,
            description: `当地民用时间 ${tzText} → 真太阳时${sign}${absMin}分${absSec}秒${ambiguous ? '；该民用时刻存在夏令时重复，本系统采用较早一次并标记歧义' : ''}`,
            parts, timezone_id: timeZoneId || undefined, utc_offset_minutes: offsetMinutes, civil_time_ambiguous: ambiguous,
            civil_time_candidates: candidates.map(ms => new Date(ms).toISOString())
        };
    }
    static getEotCorrection(month, day) { const key = `${month}月${day}日`; const row = eot_json_1.default.find(r => r[0] === key); if (!row)
        return 0; const [h, m, s] = String(row[1]).split(':').map(Number); return (h * 3600 + m * 60 + s) * Number(row[2]); }
}
exports.TrueSolarTimeCalculator = TrueSolarTimeCalculator;
