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
        if (v !== null && v !== undefined && v !== '' && Number(v) > 0)
            return Number(v);
        return null;
    }
    static pad(n) { return String(n).padStart(2, '0'); }
    static calculate(birthday, birthTime, longitude, timezone = 8) {
        const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday), tm = /^(\d{2}):(\d{2})$/.exec(birthTime);
        if (!dm || !tm)
            throw new Error('出生日期或时间格式无效');
        const y = +dm[1], m = +dm[2], d = +dm[3], hh = +tm[1], mi = +tm[2];
        const baseLongitude = timezone * 15, lngOffsetMinutes = (longitude - baseLongitude) * 4, eot = this.getEotCorrection(m, d), offset = Math.round(lngOffsetMinutes * 60 + eot);
        const dt = new Date(Date.UTC(y, m - 1, d, hh, mi, 0) + offset * 1000);
        const parts = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), dt.getUTCHours(), dt.getUTCMinutes(), dt.getUTCSeconds()];
        const absMin = Math.abs(Math.round(offset / 60)), absSec = Math.abs(offset) % 60, sign = offset >= 0 ? '+' : '-';
        return { date: `${parts[0]}-${this.pad(parts[1])}-${this.pad(parts[2])}`, time: `${this.pad(parts[3])}:${this.pad(parts[4])}`, offset_seconds: offset, description: `经度修正${sign}${absMin}分${absSec}秒`, parts };
    }
    static getEotCorrection(month, day) { const key = `${month}月${day}日`; const row = eot_json_1.default.find(r => r[0] === key); if (!row)
        return 0; const [h, m, s] = String(row[1]).split(':').map(Number); return (h * 3600 + m * 60 + s) * Number(row[2]); }
}
exports.TrueSolarTimeCalculator = TrueSolarTimeCalculator;
