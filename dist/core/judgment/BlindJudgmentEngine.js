"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlindJudgmentEngine = void 0;
const LocalPaipan_1 = require("../LocalPaipan");
/**
 * 真一盲派做功判盘引擎 v1.9.0
 *
 * 设计目标：
 * 1) 只消费已经排好的命盘，不改动排盘算法；
 * 2) 事实、关系、语义、做功、归属、岁运严格分层；
 * 3) 规则可复算、可审计，不依赖 LLM；
 * 4) 第一版只实现高确定性骨架，争议技法保守降级。
 */
const PILLARS = ["year", "month", "day", "hour"];
const PILLAR_LABEL = { year: "年柱", month: "月柱", day: "日柱", hour: "时柱" };
const STEM_ELEMENT = { 甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水" };
const BRANCH_ELEMENT = { 子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火", 午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水" };
const ELEMENT_GENERATES = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const ELEMENT_CONTROLS = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
const STEM_COMBINES = new Set(["甲己", "己甲", "乙庚", "庚乙", "丙辛", "辛丙", "丁壬", "壬丁", "戊癸", "癸戊"]);
const STEM_CLASHES = new Set(["甲庚", "庚甲", "乙辛", "辛乙", "丙壬", "壬丙", "丁癸", "癸丁"]);
const BRANCH_COMBINES = new Set(["子丑", "丑子", "寅亥", "亥寅", "卯戌", "戌卯", "辰酉", "酉辰", "巳申", "申巳", "午未", "未午"]);
const BRANCH_CLASHES = new Set(["子午", "午子", "丑未", "未丑", "寅申", "申寅", "卯酉", "酉卯", "辰戌", "戌辰", "巳亥", "亥巳"]);
const BRANCH_HARMS = new Set(["子未", "未子", "丑午", "午丑", "寅巳", "巳寅", "卯辰", "辰卯", "申亥", "亥申", "酉戌", "戌酉"]);
// 盲派关系白名单：核心资料明确把子卯、卯午归为“破”，而非子卯刑；
// 常见命理中的子酉、丑辰、寅亥、巳申、未戌等“六破”不进入 blind_core_v1 主规则。
const BRANCH_BREAKS = new Set(["子卯", "卯子", "卯午", "午卯"]);
// 午酉破只在部分课堂整理资料出现，保留 B 级研究候选，不进入生产 RelationFact。
const BRANCH_BREAK_CANDIDATES_B = new Set(["午酉", "酉午"]);
// 盲派 pairwise 刑只保留丑戌、未戌；丑未以冲为主。寅巳申仅三字齐全时强化“三刑”，两字分别以穿/冲/合为主。
const PUNISH_PAIRS = new Set(["丑戌", "戌丑", "戌未", "未戌"]);
const SELF_PUNISH = new Set();
const SANHE = [
    { branches: ["申", "子", "辰"], element: "水" },
    { branches: ["亥", "卯", "未"], element: "木" },
    { branches: ["寅", "午", "戌"], element: "火" },
    { branches: ["巳", "酉", "丑"], element: "金" }
];
const SANHUI = [
    { branches: ["寅", "卯", "辰"], element: "木" },
    { branches: ["巳", "午", "未"], element: "火" },
    { branches: ["申", "酉", "戌"], element: "金" },
    { branches: ["亥", "子", "丑"], element: "水" }
];
const SANXING = [
    { branches: ["寅", "巳", "申"], family: "寅巳申三刑" },
    { branches: ["丑", "戌", "未"], family: "丑戌未三刑" }
];
const STORE_BRANCH = { 水: "辰", 火: "戌", 金: "丑", 木: "未" };
// 根气分层只使用核心资料能稳定支持的“坐下/本气/长生/墓库/余气”口径。
// 其它柱出现同干或同五行只记 external_support，不再与“坐下通根”混成一个 root_score。
const LONGSHENG_BRANCH_BY_ELEMENT = { 木: "亥", 火: "寅", 金: "巳", 水: "申", 土: "寅" };
const RESIDUAL_QI_BRANCH_BY_ELEMENT = { 木: "辰", 火: "未", 金: "戌", 水: "丑" };
const TOMB_QI_BRANCHES_BY_ELEMENT = { 木: ["未"], 火: ["戌"], 金: ["丑"], 水: ["辰"], 土: ["辰", "戌"] };
const LU_BRANCH = { 甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳", 己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子" };
const ORIGIN_STEMS_BY_BRANCH = { 子: ["癸"], 丑: [], 寅: ["甲"], 卯: ["乙"], 辰: [], 巳: ["丙", "戊"], 午: ["丁", "己"], 未: [], 申: ["庚"], 酉: ["辛"], 戌: [], 亥: ["壬"] };
// 地支藏干白名单，用于“原局字在岁运以藏干形式出现”与“原局藏干在岁运透出”的身份事实。
const BRANCH_HIDDEN_STEMS = { 子: ["癸"], 丑: ["己", "辛", "癸"], 寅: ["甲", "丙", "戊"], 卯: ["乙"], 辰: ["戊", "癸", "乙"], 巳: ["丙", "庚", "戊"], 午: ["丁", "己"], 未: ["己", "乙", "丁"], 申: ["庚", "壬", "戊"], 酉: ["辛"], 戌: ["戊", "丁", "辛"], 亥: ["壬", "甲"] };
// 核心资料反复一致的半禄只先开放丁未、癸丑。其它课堂扩展关系保留研究态，不进入重大应期。
const HALF_LU_BRANCH = { 丁: ["未"], 癸: ["丑"] };
// 稳定墓库对应：四生支入墓，以及丑/未入辰这一特殊土墓关系。子午卯酉不因见对应墓库就自动入墓。
const DIRECT_TOMB_STORE = { 亥: "辰", 寅: "未", 巳: "戌", 申: "丑", 丑: "辰", 未: "辰" };
// 课堂整理笔记明确给出的“乙到”代表顺序，只作为 B 级仲裁覆盖，不泛化到十干。
const YI_REPRESENTATION_PRIORITY = { 卯: 1, 未: 2, 辰: 3, 乙: 4 };
const STABLE_SELF_COMBINE = new Set(["丁亥", "己亥", "辛巳", "癸巳", "壬午", "甲午", "戊子"]);
const BODY_GODS = new Set(["比肩", "劫财", "正印", "偏印", "食神"]);
const USE_GODS = new Set(["正财", "偏财", "正官", "七杀", "伤官"]);
const OUTPUT_GODS = new Set(["食神", "伤官"]);
const WEALTH_GODS = new Set(["正财", "偏财"]);
const OFFICIAL_GODS = new Set(["正官", "七杀"]);
const RESOURCE_GODS = new Set(["正印", "偏印"]);
const PEER_GODS = new Set(["比肩", "劫财"]);
function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }
function pairKey(a, b) { return `${a || ""}${b || ""}`; }
function elementGenerates(a, b) { return !!a && !!b && ELEMENT_GENERATES[a] === b; }
function elementControls(a, b) { return !!a && !!b && ELEMENT_CONTROLS[a] === b; }
function pillarDistance(a, b) { return Math.abs(PILLARS.indexOf(a) - PILLARS.indexOf(b)); }
function nodePositionLabel(n) {
    if (!n)
        return "";
    if (n.position === "hidden_stem")
        return `${PILLAR_LABEL[n.pillar] || ""}${n.hiddenLevel || "藏干"}`;
    return `${PILLAR_LABEL[n.pillar] || ""}${n.position === "stem" ? "天干" : "地支"}`;
}
function simpleNodeLabel(n) {
    if (!n)
        return "—";
    const god = n.tenGod && n.tenGod !== "日元" ? n.tenGod : (n.isDayMaster ? "日主" : "");
    return `${n.char}${god ? ` · ${god}` : ""}`;
}
function typeLabel(type) {
    return ({ zhi_yong: "制用", he_yong: "合用", hua_yong: "化用", sheng_yong: "生用", xie_yong: "泄用", mu_yong: "墓用", composite: "复合做功", xiang_fallback: "象法辅助" })[type] || type;
}
function ownershipLabel(v) {
    return ({ mostly_native: "成果主要归主", shared: "主客共享成果", mostly_external: "成果更多落在外部", unclear: "归属仍需校验" })[v] || "归属仍需校验";
}
function statusLabel(v) {
    return ({ effective: "有效成立", conditional: "条件成立", intent_only: "只有意向", broken: "主线受损", invalid: "不成立" })[v] || v;
}
class BlindJudgmentEngine {
    version;
    ruleVersion;
    constructor() {
        this.version = "1.9.0-state-replay-root-strata";
        this.ruleVersion = "blind-core-2026-09-v7-state-replay-root-strata";
    }
    analyze(chart, options = {}) {
        const facts = this.buildFacts(chart);
        const relations = this.buildRelations(facts);
        const roots = this.resolveRoots(facts);
        const semantics = this.resolveRelationSemantics(facts, relations);
        const guestHost = this.resolveGuestHost(facts, relations, options.context || "general");
        const origins = this.resolveOrigins(facts, roots, guestHost);
        const intents = this.resolveIntents(facts, relations, guestHost);
        const qishi = this.resolveQiShi(facts, relations, roots);
        const paths = this.enumerateGongPaths(facts, relations, semantics, roots, guestHost, intents, qishi);
        const validated = paths.map(p => this.validatePath(p, facts, relations, roots, guestHost, intents, qishi));
        for (const path of validated)
            path.ownership = this.resolveOwnership(path, facts, relations, guestHost, origins);
        for (const path of validated)
            path.gongDirection = this.resolveGongDirection(path, guestHost);
        for (const path of validated)
            path.zhengFan = this.resolvePathZhengFan(path, facts, intents, qishi, guestHost);
        for (const path of validated)
            path.gong_level = this.resolveGongLevel(path, qishi);
        const ranked = this.rankPaths(validated, facts, relations, roots, qishi);
        const mainline = this.resolveMainline(ranked, facts, intents, qishi);
        const xiang = this.resolveXiangFallback(facts, relations, intents, qishi, mainline);
        if (!mainline.primary && xiang.primary)
            mainline.primary = xiang.primary;
        const timing = this.resolveTiming(chart, facts, relations, mainline.primary, { ...options, _roots: roots });
        const evidence = this.buildEvidenceTrace(facts, relations, semantics, roots, intents, qishi, ranked, mainline, timing);
        const result = {
            ok: true,
            engine_version: this.version,
            rule_version: this.ruleVersion,
            generated_at: new Date().toISOString(),
            facts: {
                nodes: facts.nodes,
                visible_stems: facts.visible_stems,
                branches: facts.branches,
                hidden_stems: facts.hidden_stems,
                day_master_node_id: facts.dayMasterNodeId,
                month_branch_node_id: facts.monthBranchNodeId
            },
            relations,
            relation_semantics: semantics,
            guest_host: guestHost,
            roots,
            origins,
            intents,
            qishi,
            gong_paths: ranked,
            mainline,
            xiang,
            timing,
            evidence,
            warnings: this.buildWarnings(chart, facts, mainline)
        };
        result.presentation = this.buildPresentation(result, chart);
        return result;
    }
    buildFacts(chart) {
        const b = chart?.bazi || {};
        const ss = chart?.shi_shen || {};
        const hidden = chart?.hidden_stems || {};
        const keyMap = { year: "year_pillar", month: "month_pillar", day: "day_pillar", hour: "hour_pillar" };
        const nodes = [];
        const visibleStems = [];
        const branches = [];
        const hiddenNodes = [];
        for (const pillar of PILLARS) {
            const p = b[keyMap[pillar]] || {};
            const stem = p.heavenly_stem || "";
            const branch = p.earthly_branch || "";
            const stemGod = pillar === "day" ? "日元" : (ss[`${pillar}_stem`] || "");
            const branchGod = ss[`${pillar}_branch`] || hidden[pillar]?.[0]?.shi_shen || "";
            const stemNode = {
                id: `original.${pillar}.stem`, layer: "original", pillar, position: "stem", char: stem,
                element: STEM_ELEMENT[stem] || "", yinYang: ["甲", "丙", "戊", "庚", "壬"].includes(stem) ? "阳" : "阴",
                tenGod: stemGod, visibility: "visible", isDayMaster: pillar === "day"
            };
            const branchNode = {
                id: `original.${pillar}.branch`, layer: "original", pillar, position: "branch", char: branch,
                element: BRANCH_ELEMENT[branch] || "", tenGod: branchGod, visibility: "visible", isDayMaster: false
            };
            nodes.push(stemNode, branchNode);
            visibleStems.push(stemNode.id);
            branches.push(branchNode.id);
            (hidden[pillar] || []).forEach((h, idx) => {
                const hn = {
                    id: `original.${pillar}.hidden.${idx}`, layer: "original", pillar, position: "hidden_stem", char: h.stem || "",
                    element: h.element || STEM_ELEMENT[h.stem] || "", tenGod: h.shi_shen || "", visibility: "hidden",
                    hiddenLevel: h.label || (["本气", "中气", "余气"][idx] || "藏干"), parentBranchId: branchNode.id, isDayMaster: false
                };
                nodes.push(hn);
                hiddenNodes.push(hn.id);
            });
        }
        const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
        return {
            nodes, byId,
            visible_stems: visibleStems,
            branches,
            hidden_stems: hiddenNodes,
            dayMasterNodeId: "original.day.stem",
            dayBranchNodeId: "original.day.branch",
            monthBranchNodeId: "original.month.branch"
        };
    }
    buildRelations(facts) {
        const out = [];
        const add = (type, nodeIds, extra = {}) => {
            const id = `R${String(out.length + 1).padStart(3, "0")}`;
            out.push({ id, layer: "original", type, nodes: nodeIds, source: extra.source || "standard", status: extra.status || "fact", ...extra });
            return id;
        };
        const stems = facts.visible_stems.map(id => facts.byId[id]);
        const branches = facts.branches.map(id => facts.byId[id]);
        for (let i = 0; i < stems.length; i++)
            for (let j = i + 1; j < stems.length; j++) {
                const a = stems[i], b = stems[j];
                const distance = pillarDistance(a.pillar, b.pillar);
                if (STEM_COMBINES.has(pairKey(a.char, b.char)))
                    add("stem_combine", [a.id, b.id], { distance, adjacent: distance <= 1 });
                if (elementGenerates(a.element, b.element))
                    add("generate", [a.id, b.id], { direction: `${a.id}>${b.id}`, distance, adjacent: distance <= 1, medium: "stem" });
                if (elementGenerates(b.element, a.element))
                    add("generate", [b.id, a.id], { direction: `${b.id}>${a.id}`, distance, adjacent: distance <= 1, medium: "stem" });
                if (elementControls(a.element, b.element))
                    add("control", [a.id, b.id], { direction: `${a.id}>${b.id}`, distance, adjacent: distance <= 1, medium: "stem" });
                if (elementControls(b.element, a.element))
                    add("control", [b.id, a.id], { direction: `${b.id}>${a.id}`, distance, adjacent: distance <= 1, medium: "stem" });
                if (a.char === b.char)
                    add("same_char", [a.id, b.id], { distance, adjacent: distance <= 1 });
            }
        for (let i = 0; i < branches.length; i++)
            for (let j = i + 1; j < branches.length; j++) {
                const a = branches[i], b = branches[j];
                const k = pairKey(a.char, b.char), distance = pillarDistance(a.pillar, b.pillar);
                if (BRANCH_COMBINES.has(k))
                    add("branch_combine", [a.id, b.id], { distance, adjacent: distance <= 1 });
                if (BRANCH_CLASHES.has(k))
                    add("clash", [a.id, b.id], { distance, adjacent: distance <= 1 });
                if (BRANCH_HARMS.has(k))
                    add("harm", [a.id, b.id], { distance, adjacent: distance <= 1, school_label: "穿害" });
                if (BRANCH_BREAKS.has(k))
                    add("break", [a.id, b.id], { distance, adjacent: distance <= 1 });
                if (PUNISH_PAIRS.has(k) || (a.char === b.char && SELF_PUNISH.has(a.char)))
                    add("punish", [a.id, b.id], { distance, adjacent: distance <= 1 });
                if (a.char === b.char)
                    add("same_char", [a.id, b.id], { distance, adjacent: distance <= 1 });
                // 普通地支生克不跨柱遥推。盲派做功以贴身、实际冲合刑穿墓为优先；
                // 非相邻支之间只有元素生克，不自动生成“做功关系”，避免把全盘变成任意两支都能做功。
                if (distance <= 1 && elementGenerates(a.element, b.element))
                    add("generate", [a.id, b.id], { direction: `${a.id}>${b.id}`, distance, adjacent: true, medium: "branch" });
                if (distance <= 1 && elementGenerates(b.element, a.element))
                    add("generate", [b.id, a.id], { direction: `${b.id}>${a.id}`, distance, adjacent: true, medium: "branch" });
                if (distance <= 1 && elementControls(a.element, b.element))
                    add("control", [a.id, b.id], { direction: `${a.id}>${b.id}`, distance, adjacent: true, medium: "branch" });
                if (distance <= 1 && elementControls(b.element, a.element))
                    add("control", [b.id, a.id], { direction: `${b.id}>${a.id}`, distance, adjacent: true, medium: "branch" });
            }
        // 同柱干支：只让天干向地支输出普通生克；地支克天干不自动成立。
        for (const pillar of PILLARS) {
            const st = facts.byId[`original.${pillar}.stem`], br = facts.byId[`original.${pillar}.branch`];
            if (!st || !br)
                continue;
            if (elementGenerates(st.element, br.element))
                add("generate", [st.id, br.id], { direction: `${st.id}>${br.id}`, distance: 0, adjacent: true, medium: "same_pillar" });
            // 核心资料明确允许干支互生；地支对天干只开放“生”，不自动开放普通克。
            if (elementGenerates(br.element, st.element))
                add("generate", [br.id, st.id], { direction: `${br.id}>${st.id}`, distance: 0, adjacent: true, medium: "same_pillar" });
            if (elementControls(st.element, br.element))
                add("control", [st.id, br.id], { direction: `${st.id}>${br.id}`, distance: 0, adjacent: true, medium: "same_pillar" });
            const pillarText = `${st.char}${br.char}`;
            if (STABLE_SELF_COMBINE.has(pillarText))
                add("stem_branch_combine", [st.id, br.id], { source: "school_whitelist", school: "真一盲派", distance: 0, adjacent: true });
        }
        // 固定禄/原身互通：只作为“来源/延伸”事实，不直接判事件。
        for (const st of stems) {
            const lu = LU_BRANCH[st.char];
            for (const br of branches)
                if (br.char === lu)
                    add("tonglu", [st.id, br.id], { source: "school_whitelist", school: "真一盲派", distance: pillarDistance(st.pillar, br.pillar), adjacent: pillarDistance(st.pillar, br.pillar) <= 1 });
        }
        const presentBranches = branches.map(n => n.char);
        for (const group of SANHE)
            if (group.branches.every(z => presentBranches.includes(z))) {
                add("sanhe", group.branches.map(z => branches.find(n => n.char === z)?.id).filter(Boolean), { result_element: group.element, status: "fact" });
            }
        for (const group of SANHUI)
            if (group.branches.every(z => presentBranches.includes(z))) {
                add("sanhui", group.branches.map(z => branches.find(n => n.char === z)?.id).filter(Boolean), { result_element: group.element, status: "fact" });
            }
        for (const group of SANXING)
            if (group.branches.every(z => presentBranches.includes(z))) {
                add("sanxing", group.branches.map(z => branches.find(n => n.char === z)?.id).filter(Boolean), { source: "school_whitelist", school: "真一盲派", family: group.family, status: "fact" });
            }
        // 墓库基础事实：只标“对应墓库存在”，不自动判真正入墓。
        for (const n of facts.nodes) {
            if (!n.element || n.position === "branch")
                continue;
            const store = STORE_BRANCH[n.element];
            if (!store)
                continue;
            const storeNode = branches.find(b => b.char === store);
            if (storeNode && storeNode.id !== n.parentBranchId)
                add("tomb_candidate", [n.id, storeNode.id], { source: "school_whitelist", school: "真一盲派", status: "candidate", stored_element: n.element });
        }
        return out;
    }
    resolveRoots(facts) {
        const branches = facts.branches.map(id => facts.byId[id]).filter(Boolean);
        const hiddenByBranch = {};
        for (const br of branches)
            hiddenByBranch[br.id] = facts.hidden_stems.map(id => facts.byId[id]).filter(h => h.parentBranchId === br.id);
        const result = [];
        for (const stemId of facts.visible_stems) {
            const stem = facts.byId[stemId];
            const seatBranch = facts.byId[`original.${stem.pillar}.branch`];
            const strata = [];
            const add = (row) => { const key = `${row.kind}|${row.branchNodeId || ''}|${row.hiddenStemNodeId || ''}`; if (!strata.some(x => x._key === key))
                strata.push({ _key: key, ...row }); };
            const seatHidden = seatBranch ? (hiddenByBranch[seatBranch.id] || []) : [];
            const exactSeat = seatHidden.find((h) => h.char === stem.char);
            if (exactSeat)
                add({ kind: 'seat_direct_root', scope: 'seat', branchNodeId: seatBranch.id, hiddenStemNodeId: exactSeat.id, level: exactSeat.hiddenLevel, evidence_grade: 'A', capacity: 'strong', is_direct_root: true, source_rule: 'BLIND-ROOT-SEAT-001', detail: `${stem.char}坐${seatBranch.char}，坐下藏同干${exactSeat.char}，记直接坐根` });
            if (seatBranch && LU_BRANCH[stem.char] === seatBranch.char)
                add({ kind: 'seat_lu_root', scope: 'seat', branchNodeId: seatBranch.id, level: '禄', evidence_grade: 'A', capacity: 'strong', is_direct_root: true, source_rule: 'BLIND-ROOT-LU-001', detail: `${stem.char}坐固定禄${seatBranch.char}，记坐禄根` });
            if (seatBranch && LONGSHENG_BRANCH_BY_ELEMENT[stem.element] === seatBranch.char)
                add({ kind: 'seat_longsheng_qi', scope: 'seat', branchNodeId: seatBranch.id, level: '长生', evidence_grade: 'A', capacity: stem.element === '金' ? 'medium' : 'strong', is_direct_root: false, source_rule: 'BLIND-QI-LONGSHENG-001', detail: `${stem.char}坐${seatBranch.char}为${stem.element}长生，记坐下长生得气${stem.element === '金' ? '（金长生巳为弱长生）' : ''}` });
            if (seatBranch && (TOMB_QI_BRANCHES_BY_ELEMENT[stem.element] || []).includes(seatBranch.char))
                add({ kind: 'seat_tomb_qi', scope: 'seat', branchNodeId: seatBranch.id, level: '墓库', evidence_grade: 'A', capacity: 'medium', is_direct_root: false, source_rule: 'BLIND-QI-TOMB-001', detail: `${stem.char}坐${seatBranch.char}为${stem.element}墓库，按“坐墓通根得气”记中等承载，不等同禄根` });
            if (seatBranch && RESIDUAL_QI_BRANCH_BY_ELEMENT[stem.element] === seatBranch.char)
                add({ kind: 'seat_residual_qi', scope: 'seat', branchNodeId: seatBranch.id, level: '余气', evidence_grade: 'A', capacity: 'weak', is_direct_root: false, source_rule: 'BLIND-QI-RESIDUAL-001', detail: `${stem.char}坐${seatBranch.char}为${stem.element}余气，只记弱得气` });
            for (const br of branches) {
                if (!seatBranch || br.id === seatBranch.id)
                    continue;
                const hs = hiddenByBranch[br.id] || [];
                if (LU_BRANCH[stem.char] === br.char)
                    add({ kind: 'external_lu_support', scope: 'external', branchNodeId: br.id, level: '禄', evidence_grade: 'A', capacity: 'support', is_direct_root: false, source_rule: 'BLIND-ROOT-EXTERNAL-SEPARATION-001', detail: `其它柱见${stem.char}固定禄${br.char}，记外部禄援，不与坐下通根合并` });
                const exact = hs.find((h) => h.char === stem.char);
                if (exact)
                    add({ kind: 'external_same_stem_support', scope: 'external', branchNodeId: br.id, hiddenStemNodeId: exact.id, level: exact.hiddenLevel, evidence_grade: 'B', capacity: exact.hiddenLevel === '本气' ? 'support' : 'weak_support', is_direct_root: false, source_rule: 'BLIND-ROOT-EXTERNAL-SEPARATION-001', detail: `其它柱${br.char}藏${stem.char}，只记外部同干支持；严格“坐下通根”口径下不叫直接通根` });
                else {
                    const sameEl = hs.find((h) => h.element === stem.element);
                    if (sameEl)
                        add({ kind: 'external_same_element_support', scope: 'external', branchNodeId: br.id, hiddenStemNodeId: sameEl.id, level: sameEl.hiddenLevel, evidence_grade: 'B', capacity: 'weak_support', is_direct_root: false, source_rule: 'BLIND-ROOT-EXTERNAL-SEPARATION-001', detail: `其它柱${br.char}仅见${stem.element}同气，记弱外援，不作为直接通根` });
                }
            }
            const rows = strata.map(({ _key, ...x }) => x);
            const direct = rows.filter((x) => x.scope === 'seat');
            const support = rows.filter((x) => x.scope === 'external');
            let capacity_status = 'unsupported', actor_capable = false, stable = false;
            if (direct.some((x) => ['seat_direct_root', 'seat_lu_root'].includes(x.kind))) {
                capacity_status = 'strong_direct_root';
                actor_capable = true;
                stable = true;
            }
            else if (direct.some((x) => x.kind === 'seat_longsheng_qi' && x.capacity === 'strong')) {
                capacity_status = 'strong_qi';
                actor_capable = true;
                stable = true;
            }
            else if (direct.some((x) => ['seat_longsheng_qi', 'seat_tomb_qi'].includes(x.kind))) {
                capacity_status = 'medium_qi';
                actor_capable = true;
            }
            else if (direct.some((x) => x.kind === 'seat_residual_qi')) {
                capacity_status = 'weak_qi';
            }
            else if (support.length) {
                capacity_status = 'external_support_only';
            }
            const status = ['strong_direct_root', 'strong_qi'].includes(capacity_status) ? 'rooted' : ['medium_qi', 'weak_qi', 'external_support_only'].includes(capacity_status) ? 'weak_root' : 'rootless';
            result.push({
                stemNodeId: stem.id, roots: rows, root_strata: rows, direct_root_strata: direct, external_support_strata: support,
                direct_source_nodes: uniq(direct.map((x) => x.branchNodeId)), support_nodes: uniq(support.map((x) => x.branchNodeId)),
                capacity_status, actor_capable, status, stable,
                score: null, score_deprecated: true,
                note: 'v1.9不再把所有柱的藏干/同五行相加成 root_score；坐下直接根、长生/墓库/余气得气与其它柱外援分层记录。'
            });
        }
        return result;
    }
    resolveRelationSemantics(facts, relations) {
        const byId = facts.byId;
        const out = [];
        const push = (r, semantic, gate, evidence, counterEvidence, ruleId) => {
            out.push({ relationId: r.id, semantic, gate, evidence: uniq(evidence || []), counterEvidence: uniq(counterEvidence || []), ruleId });
        };
        for (const r of relations) {
            const a = byId[r.nodes[0]], b = byId[r.nodes[1]];
            if (!a || !b)
                continue;
            if (["stem_combine", "branch_combine", "stem_branch_combine"].includes(r.type)) {
                let semantic = "combine_hold";
                const dayActor = a.id === facts.dayMasterNodeId || b.id === facts.dayMasterNodeId;
                const target = a.id === facts.dayMasterNodeId ? b : b.id === facts.dayMasterNodeId ? a : null;
                if (dayActor && target && (WEALTH_GODS.has(target.tenGod) || OFFICIAL_GODS.has(target.tenGod)))
                    semantic = "combine_keep";
                push(r, semantic, r.adjacent || r.distance === 0 ? "passed" : "conditional", [dayActor ? "日主直接参与合" : "原局存在真实合关系", r.adjacent ? "关系贴身或相邻" : "关系隔位，语义降级"], r.adjacent ? [] : ["隔位合不直接升级为取得/合去"], "REL-COMBINE-001");
            }
            else if (r.type === "clash") {
                const storeTouched = [a, b].some(n => Object.values(STORE_BRANCH).includes(n.char));
                push(r, "clash_move", storeTouched ? "conditional" : "passed", [storeTouched ? "冲到墓库支，原局层先取冲动/扰动候选" : "原局两支真实相冲"], storeTouched ? ["原局冲墓不能直接等同开库", "必须继续检查入墓对象与开后归属"] : [], "REL-CLASH-001");
            }
            else if (r.type === "harm") {
                push(r, "wear_damage", r.adjacent ? "passed" : "conditional", [r.adjacent ? "穿害关系贴身，作用更直接" : "存在穿害，但位置较远"], ["穿害本身不是重大事件结论"], "REL-HARM-001");
            }
            else if (r.type === "punish") {
                push(r, "punish_process", "conditional", ["原局存在刑关系"], ["刑既可表示反复/加工，也可能形成有效制法，需看结果"], "REL-PUNISH-001");
            }
            else if (r.type === "break") {
                push(r, "break_disrupt", "conditional", ["原局存在破关系"], ["破只记录结构扰动，不单独决定吉凶"], "REL-BREAK-001");
            }
            else if (r.type === "generate") {
                push(r, "generate_flow", r.adjacent || r.distance === 0 ? "passed" : "conditional", ["五行相生方向客观成立", r.medium === "same_pillar" ? "同柱作用" : r.adjacent ? "相邻作用" : "隔位作用"], ["相生只说明资源/输出流向，不等于成果归主"], "REL-GENERATE-001");
            }
            else if (r.type === "control") {
                push(r, "control_candidate", r.adjacent || r.distance === 0 ? "passed" : "conditional", ["五行克制方向客观成立", r.medium === "same_pillar" ? "同柱作用" : r.adjacent ? "相邻作用" : "隔位作用"], ["有克不等于有效制用，必须校验力量、目标和结果"], "REL-CONTROL-001");
            }
            else if (r.type === "tomb_candidate") {
                push(r, "store_enter", "conditional", ["目标五行存在对应固定墓库"], ["仅墓库对应不等于已经有效入墓或归主"], "REL-TOMB-001");
            }
            else if (["sanhe", "sanhui"].includes(r.type)) {
                push(r, "group_formation", "conditional", [`${r.type === "sanhe" ? "三合" : "三会"}组合齐全`, `组合五行：${r.result_element || "—"}`], ["成局、改性、最终归属分开判断"], "REL-GROUP-001");
            }
            else if (r.type === "sanxing") {
                push(r, "sanxing_complete", "conditional", [`${r.family || "三刑"}三字齐全`], ["三刑成组后才强化刑的整体语义；仍需看位置、力量与被作用对象"], "REL-SANXING-BLIND-001");
            }
            else if (r.type === "tonglu") {
                push(r, "source_extension", "passed", ["固定禄/原身互通白名单命中"], ["互通只说明身份延伸与来源，不单独判事件"], "REL-TONGLU-001");
            }
            else if (r.type === "same_char") {
                push(r, "repeat_identity", "passed", ["原局同字重复出现"], ["同字不自动等于伏吟应事"], "REL-REPEAT-001");
            }
        }
        return out;
    }
    resolveGuestHost(facts, relations, context) {
        const nodeStates = {};
        const contextBase = {
            general: { year: 0.15, month: 0.35, day: 0.95, hour: 0.80 },
            wealth: { year: 0.10, month: 0.30, day: 0.95, hour: 0.85 },
            career: { year: 0.12, month: 0.32, day: 0.95, hour: 0.82 },
            relationship: { year: 0.18, month: 0.38, day: 1.00, hour: 0.78 },
            family: { year: 0.35, month: 0.48, day: 0.92, hour: 0.75 },
            timing: { year: 0.78, month: 0.82, day: 0.98, hour: 0.88 }
        };
        const base = contextBase[context] || contextBase.general;
        // 完整三合/三会若把日支纳入同一党局，党内成员在“做功归属”层不能仍按纯宾位处理。
        // 这不是把年月永久改成主位，而是在当前 general 判盘上下文中提升其“与命主同党”的权重。
        const dayPartyNodeIds = new Set();
        for (const r of (relations || [])) {
            if (!["sanhe", "sanhui"].includes(r.type))
                continue;
            if (!(r.nodes || []).includes(facts.dayBranchNodeId))
                continue;
            for (const id of r.nodes || [])
                dayPartyNodeIds.add(id);
        }
        for (const n of facts.nodes) {
            let weight = base[n.pillar] ?? 0;
            if (n.id === facts.dayMasterNodeId)
                weight = 1;
            if (context === "relationship" && n.id === facts.dayBranchNodeId)
                weight = 1;
            let reason = n.id === facts.dayMasterNodeId ? "日主本体" : n.pillar === "day" ? "日柱主位" : n.pillar === "hour" ? "时柱近主" : n.pillar === "month" ? "月柱近宾" : "年柱远宾";
            if (dayPartyNodeIds.has(n.id)) {
                weight = Math.max(weight, 0.72);
                reason += " · 与日支同入完整党局，当前做功上下文提升为同党";
            }
            if (n.position === "hidden_stem")
                weight = Math.max(0, weight - 0.05);
            const side = weight >= 0.65 ? "host" : weight <= 0.40 ? "guest" : "mixed";
            if (context === "family" && ["year", "month"].includes(n.pillar))
                reason += " · 家庭主题下提高亲缘权重";
            if (context === "timing")
                reason += " · 岁运主题下原局整体作为主参照";
            nodeStates[n.id] = { nodeId: n.id, context, side, hostWeight: Number(weight.toFixed(2)), reason };
        }
        return {
            context,
            levels: ["daymaster_vs_others", "daypillar_vs_others", "daytime_vs_yearmonth", "original_vs_luck", "original_dayun_vs_liunian"],
            nodeStates
        };
    }
    resolveOrigins(facts, roots, guestHost) {
        const out = [];
        const rootMap = Object.fromEntries((roots || []).map(r => [r.stemNodeId, r]));
        const sideOf = id => guestHost.nodeStates[id]?.side || "unclear";
        for (const n of facts.nodes) {
            let sourceNodes = [];
            if (n.position === "stem")
                sourceNodes = (rootMap[n.id]?.direct_source_nodes || rootMap[n.id]?.roots?.map(r => r.branchNodeId) || []);
            else if (n.position === "hidden_stem" && n.parentBranchId)
                sourceNodes = [n.parentBranchId];
            else if (n.position === "branch")
                sourceNodes = [n.id];
            sourceNodes = uniq(sourceNodes);
            const sides = uniq(sourceNodes.map(sideOf));
            const sourceSide = !sourceNodes.length ? "none" : sides.length === 1 ? sides[0] : "mixed";
            out.push({
                nodeId: n.id,
                sourceNodes,
                sourceSide,
                hasSource: sourceNodes.length > 0,
                note: n.position === "stem" ? (sourceNodes.length ? "按根气追踪来源位置" : "未见明确根源") : n.position === "hidden_stem" ? "来源于所属地支" : "地支实体自身"
            });
        }
        return out;
    }
    resolveIntents(facts, relations, guestHost) {
        const byId = facts.byId, out = [];
        const addIntent = (nodeId, type, via, confidence = "medium", note = "") => {
            let row = out.find(x => x.nodeId === nodeId);
            if (!row) {
                row = { nodeId, baseIdentity: byId[nodeId]?.tenGod || (nodeId === facts.dayMasterNodeId ? "日主" : ""), intents: [] };
                out.push(row);
            }
            if (!row.intents.some(x => x.type === type && x.viaRelationIds.join() === [via].filter(Boolean).join()))
                row.intents.push({ type, confidence, viaRelationIds: [via].filter(Boolean), note });
        };
        const dayId = facts.dayMasterNodeId;
        for (const r of relations) {
            const a = byId[r.nodes[0]], b = byId[r.nodes[1]];
            if (!a || !b)
                continue;
            if (["stem_combine", "stem_branch_combine"].includes(r.type) && r.nodes.includes(dayId)) {
                const t = r.nodes.map(id => byId[id]).find(n => n.id !== dayId);
                if (WEALTH_GODS.has(t?.tenGod))
                    addIntent(dayId, "seek_wealth", r.id, "high", "日主直接合财");
                else if (OFFICIAL_GODS.has(t?.tenGod))
                    addIntent(dayId, "seek_authority", r.id, "high", "日主直接合官杀");
                else
                    addIntent(dayId, "connect_target", r.id, "medium", "日主直接参与合");
            }
            if (r.type === "generate" && r.nodes[0] === dayId) {
                const t = byId[r.nodes[1]];
                if (OUTPUT_GODS.has(t?.tenGod))
                    addIntent(dayId, "output", r.id, r.adjacent ? "high" : "medium", "日主生食伤/输出");
            }
            if (r.type === "control" && r.nodes[0] === dayId) {
                const t = byId[r.nodes[1]];
                if (WEALTH_GODS.has(t?.tenGod))
                    addIntent(dayId, "seek_wealth", r.id, "medium", "日主直接克财");
            }
            if (r.type === "generate") {
                const from = byId[r.nodes[0]], to = byId[r.nodes[1]];
                if (OUTPUT_GODS.has(from?.tenGod) && WEALTH_GODS.has(to?.tenGod))
                    addIntent(from.id, "generate_wealth", r.id, r.adjacent ? "high" : "medium", "食伤生财");
                if (OFFICIAL_GODS.has(from?.tenGod) && RESOURCE_GODS.has(to?.tenGod))
                    addIntent(from.id, "transform_pressure", r.id, "medium", "官杀生印");
            }
            if (r.type === "control") {
                const from = byId[r.nodes[0]], to = byId[r.nodes[1]];
                if (OUTPUT_GODS.has(from?.tenGod) && OFFICIAL_GODS.has(to?.tenGod))
                    addIntent(from.id, "control_authority", r.id, r.adjacent ? "high" : "medium", "食伤制官杀");
                if (RESOURCE_GODS.has(from?.tenGod) && OUTPUT_GODS.has(to?.tenGod))
                    addIntent(from.id, "control_output", r.id, "medium", "印制食伤");
                if (WEALTH_GODS.has(from?.tenGod) && RESOURCE_GODS.has(to?.tenGod))
                    addIntent(from.id, "control_resource", r.id, "medium", "财制印");
            }
        }
        return out;
    }
    resolveQiShi(facts, relations, roots) {
        const score = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
        for (const n of facts.nodes) {
            if (!n.element)
                continue;
            let w = n.position === "stem" ? 1 : n.position === "branch" ? 1.7 : n.hiddenLevel === "本气" ? 0.45 : n.hiddenLevel === "中气" ? 0.25 : 0.15;
            if (n.id === facts.monthBranchNodeId)
                w += 0.9;
            score[n.element] += w;
        }
        const comboBoost = [];
        for (const r of relations)
            if (["sanhe", "sanhui"].includes(r.type) && r.result_element) {
                score[r.result_element] += 2.2;
                comboBoost.push({ relationId: r.id, element: r.result_element, type: r.type });
            }
        const ordered = Object.entries(score).sort((a, b) => b[1] - a[1]);
        const groups = [];
        // A. 单一元素形成明显优势。
        const [top, second] = ordered;
        const ratio = second?.[1] ? top[1] / second[1] : 9;
        if (top[1] >= 4.5 && ratio >= 1.22) {
            groups.push({
                id: `qishi_${top[0]}`,
                elements: [top[0]],
                score: Number(top[1].toFixed(2)),
                support: {
                    monthOrder: facts.byId[facts.monthBranchNodeId]?.element === top[0],
                    combination: comboBoost.some(x => x.element === top[0]),
                    weightedDominance: true,
                    alliedChain: false
                },
                targetElement: ELEMENT_CONTROLS[top[0]] || "",
                confidence: ratio >= 1.5 ? "high" : "medium"
            });
        }
        // B. 两个相生元素结成一党。核心命例中“火与燥土之势”“金水之势”不能被单元素阈值漏掉。
        // 仅在两者都具有明显实体、且合计显著压过第三方时成立，避免仅凭数量机械成势。
        let bestAlliance = null;
        for (let i = 0; i < ordered.length; i++) {
            for (let j = i + 1; j < ordered.length; j++) {
                const [e1, s1] = ordered[i], [e2, s2] = ordered[j];
                if (s1 < 3.0 || s2 < 3.0)
                    continue;
                let upstream = "", downstream = "";
                if (ELEMENT_GENERATES[e1] === e2) {
                    upstream = e1;
                    downstream = e2;
                }
                else if (ELEMENT_GENERATES[e2] === e1) {
                    upstream = e2;
                    downstream = e1;
                }
                else
                    continue;
                const rest = ordered.filter((_, k) => k !== i && k !== j).map((x) => x[1]);
                const third = Math.max(...rest, 0.01);
                const total = s1 + s2;
                const dominance = total / third;
                if (dominance < 1.72)
                    continue;
                const candidate = {
                    id: `qishi_${upstream}_${downstream}`,
                    elements: [upstream, downstream],
                    score: Number(total.toFixed(2)),
                    support: {
                        monthOrder: [upstream, downstream].includes(facts.byId[facts.monthBranchNodeId]?.element),
                        combination: comboBoost.some(x => [upstream, downstream].includes(x.element)),
                        weightedDominance: true,
                        alliedChain: true
                    },
                    // 相生党以“承接端”作为最终发力面，例如火→土之势主要可制水。
                    targetElement: ELEMENT_CONTROLS[downstream] || "",
                    confidence: dominance >= 2.25 ? "high" : "medium",
                    dominance: Number(dominance.toFixed(2))
                };
                if (!bestAlliance || candidate.score > bestAlliance.score)
                    bestAlliance = candidate;
            }
        }
        if (bestAlliance)
            groups.push(bestAlliance);
        // 优先选择有相生闭环的党势；否则用单元素优势。
        groups.sort((a, b) => (b.support.alliedChain ? 1 : 0) - (a.support.alliedChain ? 1 : 0) || b.score - a.score);
        return {
            elementScore: Object.fromEntries(Object.entries(score).map(([k, v]) => [k, Number(v.toFixed(2))])),
            groups,
            dominant: groups[0] || null,
            note: "气势只作为做功裁决的结构辅助；支持单一强势与相生党势，不以元素数量单独判吉凶。"
        };
    }
    enumerateGongPaths(facts, relations, semantics, roots, guestHost, intents, qishi) {
        const byId = facts.byId, out = [];
        const gh = id => guestHost.nodeStates[id]?.hostWeight ?? 0;
        const add = p => {
            const signature = `${p.type}|${(p.actorNodes || []).join(",")}|${(p.targetNodes || []).join(",")}|${(p.relationIds || []).join(",")}`;
            if (out.some(x => x.signature === signature))
                return;
            out.push({ id: `G${String(out.length + 1).padStart(3, "0")}`, signature, bridgeNodes: [], resultNodes: [], relationIds: [], ...p });
        };
        const classifyZhiTitle = (actor, target) => {
            if (!actor || !target)
                return "";
            if (PEER_GODS.has(actor.tenGod) && WEALTH_GODS.has(target.tenGod))
                return "比劫制财";
            if (OUTPUT_GODS.has(actor.tenGod) && OFFICIAL_GODS.has(target.tenGod))
                return target.tenGod === "七杀" ? "食伤制杀" : "食伤制官";
            if (RESOURCE_GODS.has(actor.tenGod) && OUTPUT_GODS.has(target.tenGod))
                return "印制食伤";
            if (WEALTH_GODS.has(actor.tenGod) && RESOURCE_GODS.has(target.tenGod))
                return "财制印";
            if (actor.id !== facts.dayMasterNodeId && gh(actor.id) >= 0.65 && BODY_GODS.has(actor.tenGod) && USE_GODS.has(target.tenGod))
                return `${actor.tenGod || "主位之体"}制${target.tenGod || "宾位之用"}`;
            return "";
        };
        // 1. 制用：十神组合必须与真实克制关系同时存在。
        for (const r of relations.filter(x => x.type === "control")) {
            const actor = byId[r.nodes[0]], target = byId[r.nodes[1]];
            if (!actor || !target)
                continue;
            const title = classifyZhiTitle(actor, target);
            if (!title)
                continue;
            add({ type: "zhi_yong", ruleId: "GONG-ZHI-001", title, actorNodes: [actor.id], targetNodes: [target.id], resultNodes: [target.id], relationIds: [r.id], roleMap: { [actor.id]: "tool", [target.id]: "target" }, rawReason: "真实克制关系 + 体用对象成立", actionMode: "direct_control" });
        }
        // 1B. 冲制：地支相冲先判作用方向，再决定是否能升级为制用。
        // 正常情况下按五行克制方向；若已形成高可信党势，则允许强势一方在冲中取得主导。
        for (const r of relations.filter(x => x.type === "clash")) {
            const a = byId[r.nodes[0]], b = byId[r.nodes[1]];
            if (!a || !b)
                continue;
            let actor = null, target = null, via = "";
            const q = qishi?.dominant;
            if (q && ["high", "medium"].includes(q.confidence) && q.targetElement) {
                if (q.elements.includes(a.element) && b.element === q.targetElement) {
                    actor = a;
                    target = b;
                    via = "qishi";
                }
                else if (q.elements.includes(b.element) && a.element === q.targetElement) {
                    actor = b;
                    target = a;
                    via = "qishi";
                }
            }
            if (!actor) {
                if (elementControls(a.element, b.element)) {
                    actor = a;
                    target = b;
                    via = "element";
                }
                else if (elementControls(b.element, a.element)) {
                    actor = b;
                    target = a;
                    via = "element";
                }
            }
            if (!actor || !target)
                continue;
            const title = classifyZhiTitle(actor, target);
            if (!title)
                continue;
            add({
                type: "zhi_yong", ruleId: "GONG-CLASH-ZHI-001", title,
                actorNodes: [actor.id], targetNodes: [target.id], resultNodes: [target.id], relationIds: [r.id],
                roleMap: { [actor.id]: "tool", [target.id]: "target" },
                rawReason: via === "qishi" ? "地支相冲 + 已成立党势决定制用方向" : "地支相冲 + 五行克制方向形成冲制",
                actionMode: "clash_control", qishiBased: via === "qishi"
            });
        }
        // 1C. 气势制用：只在气势与目标之间存在真实冲/合制/克制接点时生成，不能凭“成势”空断。
        if (qishi?.dominant?.targetElement && (qishi.dominant.elements || []).length) {
            const q = qishi.dominant;
            const visible = facts.nodes.filter(n => n.position !== "hidden_stem");
            const memberIds = new Set(visible.filter(n => q.elements.includes(n.element)).map(n => n.id));
            const targets = visible.filter(n => n.element === q.targetElement && n.id !== facts.dayMasterNodeId);
            for (const target of targets) {
                const connector = relations.filter(r => {
                    if (!(r.nodes || []).includes(target.id))
                        return false;
                    if (!["clash", "control", "stem_branch_combine", "branch_combine", "harm", "punish"].includes(r.type))
                        return false;
                    const members = (r.nodes || []).filter(id => memberIds.has(id) && id !== target.id);
                    if (!members.length)
                        return false;
                    // 有方向的普通克制必须真的是“党势成员 → 目标”，不能把目标反过来克成员也算成党势制用。
                    if (r.type === "control" && r.direction)
                        return members.some(id => r.direction === `${id}>${target.id}`);
                    return true;
                });
                if (!connector.length)
                    continue;
                const actors = uniq(connector.flatMap(r => (r.nodes || []).filter(id => memberIds.has(id) && id !== target.id && (r.type !== "control" || !r.direction || r.direction === `${id}>${target.id}`))));
                if (!actors.length)
                    continue;
                // 直接承担“制”的成员与仅提供党势/合刑支持的成员分开。做功方向以 leadActorNodes 为准。
                const leadActors = uniq(connector.flatMap(r => {
                    if (r.type === "control" && r.direction)
                        return (r.nodes || []).filter(id => memberIds.has(id) && r.direction === `${id}>${target.id}`);
                    if (r.type === "clash")
                        return (r.nodes || []).filter(id => memberIds.has(id) && id !== target.id);
                    return [];
                }));
                // 正向做功要求主位/同党参与；反向做功则允许宾位之体直接制主位之用。
                if (!actors.some(id => gh(id) >= 0.65) && gh(target.id) < 0.65)
                    continue;
                let objectLabel = target.tenGod || target.element;
                if (WEALTH_GODS.has(target.tenGod))
                    objectLabel = "财";
                else if (OFFICIAL_GODS.has(target.tenGod))
                    objectLabel = target.tenGod === "七杀" ? "杀" : "官";
                else if (RESOURCE_GODS.has(target.tenGod))
                    objectLabel = "印";
                const title = `${q.elements.join("、")}成势制${objectLabel}`;
                add({
                    type: "zhi_yong", ruleId: "GONG-QISHI-ZHI-001", title,
                    actorNodes: actors, leadActorNodes: leadActors.length ? leadActors : actors, targetNodes: [target.id], resultNodes: [target.id], relationIds: connector.map(r => r.id),
                    roleMap: Object.fromEntries([...actors.map(id => [id, "tool"]), [target.id, "target"]]),
                    rawReason: `${q.elements.join("、")}形成党势，并通过真实作用接点指向${target.char}${target.tenGod ? `·${target.tenGod}` : ""}`,
                    actionMode: "qishi_control", qishiBased: true
                });
            }
        }
        // 2. 合用：日主/日支/时柱直接合财官优先。
        for (const r of relations.filter(x => ["stem_combine", "branch_combine", "stem_branch_combine"].includes(x.type))) {
            const ns = r.nodes.map(id => byId[id]).filter(Boolean);
            for (const actor of ns) {
                const target = ns.find(n => n.id !== actor.id);
                if (!target)
                    continue;
                if (gh(actor.id) < 0.65)
                    continue;
                if (!(WEALTH_GODS.has(target.tenGod) || OFFICIAL_GODS.has(target.tenGod) || USE_GODS.has(target.tenGod)))
                    continue;
                const title = WEALTH_GODS.has(target.tenGod) ? "主位合财" : OFFICIAL_GODS.has(target.tenGod) ? "主位合官" : "主位合用";
                add({ type: "he_yong", ruleId: "GONG-HE-001", title, actorNodes: [actor.id], targetNodes: [target.id], resultNodes: [target.id], relationIds: [r.id], roleMap: { [actor.id]: "body", [target.id]: "use" }, rawReason: "主位直接参与真实合关系" });
            }
        }
        // 3. 生用：食伤 -> 财。
        for (const r of relations.filter(x => x.type === "generate")) {
            const actor = byId[r.nodes[0]], target = byId[r.nodes[1]];
            if (!actor || !target)
                continue;
            if (OUTPUT_GODS.has(actor.tenGod) && WEALTH_GODS.has(target.tenGod)) {
                add({ type: "sheng_yong", ruleId: "GONG-SHENG-001", title: "食伤生财", actorNodes: [actor.id], targetNodes: [target.id], resultNodes: [target.id], relationIds: [r.id], roleMap: { [actor.id]: "tool", [target.id]: "result" }, rawReason: "食伤与财之间存在真实相生方向" });
            }
            if ((actor.id === facts.dayMasterNodeId || gh(actor.id) >= 0.8) && OUTPUT_GODS.has(target.tenGod)) {
                add({ type: "xie_yong", ruleId: "GONG-XIE-001", title: "食伤泄秀", actorNodes: [actor.id], targetNodes: [target.id], resultNodes: [target.id], relationIds: [r.id], roleMap: { [actor.id]: "body", [target.id]: "result" }, rawReason: "主位向食伤形成真实输出" });
            }
        }
        // 4. 化用：官杀 -> 印 -> 日主/主位体。
        const gens = relations.filter(x => x.type === "generate");
        for (const r1 of gens) {
            const official = byId[r1.nodes[0]], resource = byId[r1.nodes[1]];
            if (!OFFICIAL_GODS.has(official?.tenGod) || !RESOURCE_GODS.has(resource?.tenGod))
                continue;
            if (!(r1.adjacent || r1.distance === 0))
                continue;
            const nextEdges = gens.filter(x => x.nodes[0] === resource.id && (x.adjacent || x.distance === 0)).sort((x, y) => (x.nodes[1] === facts.dayMasterNodeId ? -1 : 0) - (y.nodes[1] === facts.dayMasterNodeId ? -1 : 0));
            for (const r2 of nextEdges) {
                const result = byId[r2.nodes[1]];
                if (!result)
                    continue;
                if (result.id !== facts.dayMasterNodeId && !PEER_GODS.has(result.tenGod))
                    continue;
                if (result.id !== facts.dayMasterNodeId && gh(result.id) < 0.65)
                    continue;
                add({ type: "hua_yong", ruleId: "GONG-HUA-001", title: official.tenGod === "七杀" ? "杀印相生" : "官印相生", actorNodes: [official.id], bridgeNodes: [resource.id], targetNodes: [result.id], resultNodes: [result.id], relationIds: [r1.id, r2.id], roleMap: { [official.id]: "use", [resource.id]: "bridge", [result.id]: "result" }, rawReason: "官杀生印、印再入主位形成连续转化链" });
                break; // 同一官印链优先收束到日主/最近主位，不重复计功。
            }
        }
        // 5. 墓用：保守地只生成条件候选。
        for (const r of relations.filter(x => x.type === "tomb_candidate")) {
            const target = byId[r.nodes[0]], store = byId[r.nodes[1]];
            if (!target || !store)
                continue;
            const targetRelevant = WEALTH_GODS.has(target.tenGod) || OFFICIAL_GODS.has(target.tenGod) || OUTPUT_GODS.has(target.tenGod) || RESOURCE_GODS.has(target.tenGod);
            if (!targetRelevant)
                continue;
            if (gh(store.id) >= 0.65 || gh(target.id) >= 0.65) {
                add({ type: "mu_yong", ruleId: "GONG-MU-001", title: `${target.tenGod || target.element}入${store.char}库候选`, actorNodes: [store.id], targetNodes: [target.id], resultNodes: [store.id], relationIds: [r.id], roleMap: { [store.id]: "result", [target.id]: "target" }, rawReason: "存在固定墓库对应，但第一版只作条件性墓用候选", forceConditional: true });
            }
        }
        // 6. 复合路径：两条有效候选共用中间节点时合并，后续 Validator 决定是否成立。
        const simple = [...out];
        const compositeWhitelist = new Set(["sheng_yong>zhi_yong", "zhi_yong>sheng_yong", "zhi_yong>hua_yong"]);
        const allDirect = p => (p.relationIds || []).every(id => { const r = relations.find(x => x.id === id); return r && (r.adjacent || r.distance === 0 || ["sanhe", "sanhui", "stem_branch_combine"].includes(r.type)); });
        for (const a of simple)
            for (const b of simple) {
                if (a.id === b.id || !compositeWhitelist.has(`${a.type}>${b.type}`))
                    continue;
                if (!allDirect(a) || !allDirect(b))
                    continue;
                const aEnd = a.resultNodes?.[a.resultNodes.length - 1] || a.targetNodes?.[0];
                const bStart = b.actorNodes?.[0];
                if (!aEnd || !bStart || aEnd !== bStart)
                    continue;
                add({ type: "composite", ruleId: "GONG-COMPOSITE-001", title: `${a.title} → ${b.title}`, actorNodes: uniq(a.actorNodes), bridgeNodes: uniq([...(a.bridgeNodes || []), aEnd, ...(b.bridgeNodes || [])]), targetNodes: uniq(b.targetNodes), resultNodes: uniq(b.resultNodes), relationIds: uniq([...(a.relationIds || []), ...(b.relationIds || [])]), roleMap: { ...(a.roleMap || {}), ...(b.roleMap || {}) }, rawReason: "两条已知做功类型在同一节点直接衔接，形成复合候选" });
            }
        return out;
    }
    validatePath(path, facts, relations, roots, guestHost, intents, qishi) {
        const byId = facts.byId, gh = id => guestHost.nodeStates[id]?.hostWeight ?? 0;
        const actor = byId[path.actorNodes?.[0]], target = byId[path.targetNodes?.[0]];
        const relationRows = (path.relationIds || []).map(id => relations.find(r => r.id === id)).filter(Boolean);
        const direct = relationRows.some(r => r.adjacent || r.distance === 0 || ["clash", "sanhe", "sanhui", "stem_branch_combine", "tonglu"].includes(r.type));
        const actorRoot = roots.find(r => r.stemNodeId === actor?.id);
        const actorCapable = actor?.position === "branch" || actor?.position === "hidden_stem" || actorRoot?.actor_capable === true || gh(actor?.id) >= 0.8;
        const targetReachable = !!target && relationRows.length > 0;
        const pathContinuous = path.type !== "composite" || (path.bridgeNodes || []).length > 0;
        const resultExists = (path.resultNodes || []).length > 0;
        let status = "conditional";
        if (path.forceConditional)
            status = "conditional";
        else if (targetReachable && pathContinuous && resultExists && (direct || path.type === "hua_yong") && actorCapable)
            status = "effective";
        else if (targetReachable && resultExists)
            status = "conditional";
        else
            status = "intent_only";
        // 只有相邻地支的普通五行相克、却没有冲合刑穿墓或党势支持时，只能算“有作用候选”，
        // 不能直接升级成有效制用。这样避免把寅克未、土克水等普通邻支关系机械当成主功。
        const onlyPlainBranchControl = relationRows.length === 1 && relationRows[0]?.type === "control" && relationRows[0]?.medium === "branch";
        if (onlyPlainBranchControl && !path.qishiBased)
            status = "conditional";
        // 日主明确有追求但工具无根：只保留意向，不硬判做成。
        if (actor?.position === "stem" && actorRoot?.actor_capable !== true && gh(actor.id) < 0.8 && path.type !== "he_yong")
            status = "intent_only";
        return {
            ...path,
            status,
            validation: {
                relationReal: relationRows.length > 0,
                actorCapable,
                targetReachable,
                pathContinuous,
                resultExists,
                resultIntact: true,
                direct
            }
        };
    }
    resolveOwnership(path, facts, relations, guestHost, origins) {
        const gh = id => guestHost.nodeStates[id]?.hostWeight ?? 0;
        const resultIds = path.resultNodes?.length ? path.resultNodes : path.targetNodes || [];
        const resultWeights = resultIds.map(gh);
        const actorWeights = (path.actorNodes || []).map(gh);
        const hasDirectHostTake = (path.type === "he_yong" || path.type === "zhi_yong") && actorWeights.some(x => x >= 0.65);
        const allResultHost = resultWeights.length && resultWeights.every(x => x >= 0.65);
        const anyResultHost = resultWeights.some(x => x >= 0.65);
        const anyActorGuest = actorWeights.some(x => x <= 0.4);
        let result = "unclear";
        const reasons = [];
        if (allResultHost) {
            result = (path.type === "hua_yong" || path.type === "he_yong") ? "mostly_native" : (anyActorGuest ? "shared" : "mostly_native");
            reasons.push("结果节点落在日时主位");
        }
        else if (hasDirectHostTake) {
            result = anyActorGuest ? "shared" : "mostly_native";
            reasons.push(path.type === "he_yong" ? "主位直接合取目标" : "主位直接控制目标");
        }
        else if (anyResultHost) {
            result = "shared";
            reasons.push("结果同时连接主位与宾位");
        }
        else if (resultWeights.length && resultWeights.every(x => x <= 0.4)) {
            result = "mostly_external";
            reasons.push("结果节点主要停留在年月宾位");
        }
        const originMap = Object.fromEntries((origins || []).map(o => [o.nodeId, o]));
        const originSides = uniq(resultIds.map(id => originMap[id]?.sourceSide).filter(x => x && x !== "none"));
        if (result === "mostly_native" && originSides.some(x => x === "guest" || x === "mixed")) {
            result = "shared";
            reasons.push("结果落主位，但根源仍跨主客，按共享降级");
        }
        if (result === "mostly_external" && originSides.some(x => x === "host" || x === "mixed")) {
            result = "shared";
            reasons.push("结果表面落宾位，但来源连接主位，按主客共享处理");
        }
        if (path.type === "sheng_yong" && result === "mostly_native" && resultWeights.some(x => x < 0.65))
            result = "shared";
        return { result, resultNodes: resultIds, reasonChain: uniq(reasons), originSides, confidence: reasons.length ? "medium" : "low" };
    }
    resolveGongDirection(path, guestHost) {
        const gh = id => guestHost.nodeStates[id]?.hostWeight ?? 0;
        const directionActors = (path.leadActorNodes?.length ? path.leadActorNodes : path.actorNodes) || [];
        const actorWeights = directionActors.map(gh);
        const targetWeights = (path.targetNodes || []).map(gh);
        const actorHost = actorWeights.some(x => x >= 0.65);
        const actorGuest = actorWeights.length > 0 && actorWeights.every(x => x <= 0.40);
        const targetHost = targetWeights.some(x => x >= 0.65);
        const targetGuest = targetWeights.length > 0 && targetWeights.every(x => x <= 0.40);
        if (actorHost && targetGuest)
            return "forward";
        if (actorGuest && targetHost)
            return "reverse";
        if (actorHost && targetHost)
            return "internal";
        if (actorGuest && targetGuest)
            return "external";
        return "mixed";
    }
    resolveGongLevel(path, qishi) {
        if (!path || path.status === "invalid" || path.status === "broken")
            return "L0";
        if (path.status === "intent_only")
            return "L1";
        if (path.status === "conditional")
            return "L2";
        if (path.status === "effective") {
            const ownershipClear = path.ownership?.result && path.ownership.result !== "unclear";
            const multi = (path.relationIds || []).length >= 2 || path.type === "composite";
            const qishiSupport = !!qishi?.dominant;
            if (multi && ownershipClear && qishiSupport)
                return "L5";
            if (multi && ownershipClear)
                return "L4";
            return "L3";
        }
        return "L1";
    }
    resolvePathZhengFan(path, facts, intents, qishi, guestHost) {
        const day = intents.find(x => x.nodeId === facts.dayMasterNodeId);
        const targetGods = (path.targetNodes || []).map(id => facts.byId[id]?.tenGod).filter(Boolean);
        let intentMatch = false;
        if (day?.intents?.some(i => i.type === "seek_wealth") && targetGods.some(g => WEALTH_GODS.has(g)))
            intentMatch = true;
        if (day?.intents?.some(i => i.type === "seek_authority") && targetGods.some(g => OFFICIAL_GODS.has(g)))
            intentMatch = true;
        if (day?.intents?.some(i => i.type === "output") && (path.type === "sheng_yong" || path.type === "xie_yong"))
            intentMatch = true;
        const actorEl = facts.byId[path.actorNodes?.[0]]?.element;
        const q = qishi.dominant;
        if (q && actorEl && q.targetElement === actorEl && q.confidence === "high" && !intentMatch)
            return "fan";
        if (intentMatch)
            return "zheng";
        if (q && actorEl && q.elements.includes(actorEl))
            return "zheng";
        return "unclear";
    }
    rankPaths(paths, facts, relations, roots, qishi) {
        const statusWeight = { effective: 50, conditional: 32, intent_only: 12, broken: 4, invalid: 0 };
        const typeWeight = { composite: 16, zhi_yong: 15, he_yong: 14, hua_yong: 13, mu_yong: 11, sheng_yong: 10, xie_yong: 6 };
        const ownWeight = { mostly_native: 12, shared: 7, mostly_external: 1, unclear: 0 };
        const levelWeight = { L0: 0, L1: 2, L2: 5, L3: 9, L4: 13, L5: 17 };
        const ranked = paths.map(p => {
            let score = (statusWeight[p.status] || 0) + (typeWeight[p.type] || 0) + (ownWeight[p.ownership?.result] || 0) + (levelWeight[p.gong_level] || 0);
            if (p.validation?.direct)
                score += 7;
            else
                score -= 7;
            if (p.zhengFan === "zheng")
                score += 6;
            if (p.zhengFan === "fan")
                score -= 10;
            const actorEl = facts.byId[p.actorNodes?.[0]]?.element;
            if (qishi.dominant?.elements?.includes(actorEl))
                score += 5;
            if ((p.relationIds || []).length >= 2)
                score += 3;
            if (p.forceConditional)
                score -= 4;
            return { ...p, rank_score: score };
        }).sort((a, b) => b.rank_score - a.rank_score || a.id.localeCompare(b.id));
        return ranked;
    }
    resolveMainline(ranked, facts, intents, qishi) {
        // 第一主线只允许 effective。仅有 conditional 时宁可降级到象法，也不把“可能成立”包装成主线。
        const effective = ranked.filter(p => p.status === "effective");
        if (!effective.length)
            return { primary: null, secondary: null, co_primary: false, reason: "未发现足够闭合的高置信做功路径；条件候选保留在 gong_paths，不强升第一主线" };
        const primary = effective[0];
        const key = p => `${p.title}|${p.type}|${p.ownership?.result || ""}`;
        const primaryKey = key(primary);
        const second = ranked.find(p => p.id !== primary.id && ["effective", "conditional"].includes(p.status) && key(p) !== primaryKey) || null;
        const coPrimary = !!second && second.status === "effective" && Math.abs(primary.rank_score - second.rank_score) <= 2 && primary.type !== second.type;
        return { primary, secondary: second, co_primary: coPrimary, reason: "第一主线仅从有效闭环中选取；按路径闭合、主位参与、成果归属、气势与反证稳定排序" };
    }
    resolveXiangFallback(facts, relations, intents, qishi, mainline) {
        if (mainline.primary)
            return { primary: null, candidates: [], note: "已有明确做功主线，象法只作为后续细化。" };
        const day = facts.byId[facts.dayMasterNodeId];
        const dayIntent = intents.find(x => x.nodeId === day.id)?.intents?.[0];
        const title = dayIntent?.type === "output" ? "象法辅助 · 日主向外输出" : qishi.dominant ? `象法辅助 · ${qishi.dominant.elements.join("、")}成势` : "命局意向尚未形成闭环";
        const primary = {
            id: "XG001", type: "xiang_fallback", title, status: "intent_only", actorNodes: [day.id], targetNodes: [], bridgeNodes: [], resultNodes: [], relationIds: dayIntent?.viaRelationIds || [],
            roleMap: { [day.id]: "body" }, ownership: { result: "unclear", resultNodes: [], reasonChain: [], confidence: "low" }, zhengFan: "unclear", rank_score: 0,
            validation: { relationReal: false, actorCapable: true, targetReachable: false, pathContinuous: false, resultExists: false, resultIntact: true, direct: false }
        };
        return { primary, candidates: [primary], note: "做功并非唯一分析入口；此处只提供保守象法兜底，不直接扩展重大现实事件。" };
    }
    resolveLuckIdentities(luck, facts, relevantIds) {
        const claims = [];
        const add = (type, target, component, incoming, extra = {}) => {
            if (!target || !incoming)
                return;
            const key = `${type}|${target.id}|${component}|${incoming}`;
            if (claims.some(x => x._key === key))
                return;
            claims.push({
                _key: key, id: `LI${String(claims.length + 1).padStart(3, '0')}`, layer: luck.layer, incoming_component: component, incoming_char: incoming,
                targetNodeId: target.id, targetChar: target.char, targetPosition: target.position, targetPillar: target.pillar,
                type, evidence_grade: extra.evidence_grade || 'A', source_status: extra.source_status || 'school_specific', priority: extra.priority ?? 100,
                major_eligible: extra.major_eligible !== false, detail: extra.detail || '', source_rule: extra.source_rule || 'BLIND-IDENTITY-CORE', selected: false, selection_reason: ''
            });
        };
        const nodes = (facts.nodes || []).filter((n) => n.layer === 'original' && n.char);
        if (luck.stem) {
            for (const n of nodes) {
                if (n.position === 'branch' && (ORIGIN_STEMS_BY_BRANCH[n.char] || []).includes(luck.stem)) {
                    add('yuanshen_appearance', n, 'stem', luck.stem, { priority: 120, detail: `${luck.stem}为原局${n.char}的固定原身，岁运天干取得该支身份`, source_rule: 'BLIND-YUANSHEN-001' });
                }
                if (n.position === 'stem' && n.char === luck.stem) {
                    add('same_stem_appearance', n, 'stem', luck.stem, { priority: 120, detail: `岁运${luck.stem}与原局明透${n.char}同字到位`, source_rule: 'BLIND-APPEAR-001' });
                }
                if (n.position === 'hidden_stem' && n.char === luck.stem) {
                    add('hidden_stem_manifestation', n, 'stem', luck.stem, { priority: 115, detail: `原局${n.pillar}支所藏${n.char}在岁运天干透出`, source_rule: 'BLIND-HIDDEN-APPEAR-001' });
                }
            }
            // 仅实现课堂笔记明确给出的“乙到：卯→未→辰→乙”B级代表序列；不泛化十干。
            if (luck.stem === '乙') {
                for (const n of nodes) {
                    if (n.position !== 'branch' || !['未', '辰'].includes(n.char))
                        continue;
                    add(n.char === '未' ? 'tomb_qi_representative' : 'residual_qi_representative', n, 'stem', luck.stem, { priority: n.char === '未' ? 80 : 70, evidence_grade: 'B', source_status: 'class_note', major_eligible: false, detail: `课堂整理规则：乙到可代表${n.char}${n.char === '未' ? '墓气' : '余气'}，仅作B级身份候选`, source_rule: 'BLIND-IDENTITY-YI-ORDER-B' });
                }
            }
        }
        if (luck.branch) {
            for (const n of nodes) {
                if ((n.position === 'stem' || n.position === 'hidden_stem') && LU_BRANCH[n.char] === luck.branch) {
                    add('tonglu_appearance', n, 'branch', luck.branch, { priority: 120, detail: `岁运${luck.branch}为原局${n.char}固定禄，原局天干以禄形态到位`, source_rule: 'BLIND-TONGLU-001' });
                }
                if (n.position === 'branch' && n.char === luck.branch) {
                    add('same_branch_appearance', n, 'branch', luck.branch, { priority: 120, detail: `岁运${luck.branch}与原局${n.char}同支到位`, source_rule: 'BLIND-APPEAR-001' });
                }
                if (n.position === 'stem' && (BRANCH_HIDDEN_STEMS[luck.branch] || []).includes(n.char) && LU_BRANCH[n.char] !== luck.branch) {
                    add('hidden_form_appearance', n, 'branch', luck.branch, { priority: 100, detail: `原局${n.char}在岁运${luck.branch}中以藏干形式出现`, source_rule: 'BLIND-HIDDEN-FORM-001' });
                }
                if ((n.position === 'stem' || n.position === 'hidden_stem') && (HALF_LU_BRANCH[n.char] || []).includes(luck.branch)) {
                    add('half_lu_candidate', n, 'branch', luck.branch, { priority: 60, evidence_grade: 'B', source_status: 'school_specific', major_eligible: false, detail: `${n.char}见${luck.branch}为半禄候选，只作辅助身份，不单独升重大应期`, source_rule: 'BLIND-HALF-LU-B' });
                }
            }
        }
        // 身份解析必须先于主线相关性：先按来源等级与直接性选身份，再把结果交给主线仲裁。
        // 禁止“主线想看谁，就从多个身份候选里挑谁”的自证偏差。
        for (const component of ['stem', 'branch']) {
            const pool = claims.filter(x => x.incoming_component === component);
            if (!pool.length)
                continue;
            const high = pool.filter(x => x.evidence_grade === 'A');
            const base = high.length ? high : pool, top = Math.max(...base.map(x => x.priority));
            const selected = base.filter(x => x.priority === top);
            for (const c of selected) {
                c.selected = true;
                c.selection_reason = high.length ? '独立身份解析：不参考当前主线，先取A级直接身份中的最高优先级' : '独立身份解析：无A级直接身份，仅保留最高优先级降级候选';
            }
        }
        if (luck.layer === 'liuyue')
            for (const c of claims)
                c.major_eligible = false;
        for (const c of claims)
            c.mainline_relevant = relevantIds.has(c.targetNodeId);
        let schoolPriorityHint = null;
        if (luck.stem === '乙') {
            const yiClaims = claims.filter(x => x.incoming_component === 'stem' && YI_REPRESENTATION_PRIORITY[x.targetChar] != null)
                .sort((a, b) => (YI_REPRESENTATION_PRIORITY[a.targetChar] ?? 99) - (YI_REPRESENTATION_PRIORITY[b.targetChar] ?? 99));
            if (yiClaims.length)
                schoolPriorityHint = { evidence_grade: 'B', source_status: 'class_note', source_rule: 'BLIND-IDENTITY-YI-ORDER-B', ordered_target_chars: uniq(yiClaims.map(x => x.targetChar)), note: '课堂整理仅提示乙到时卯→未→辰→乙的代表顺序；生产默认不允许该B级顺序覆盖A级直接身份。' };
        }
        return {
            layer: luck.layer, incoming: { stem: luck.stem || null, branch: luck.branch || null },
            claims: claims.map(({ _key, ...x }) => x), selected: claims.filter(x => x.selected).map(({ _key, ...x }) => x), school_priority_hint: schoolPriorityHint,
            resolution_order: 'identity_first_then_mainline',
            note: luck.layer === 'liuyue' ? '流月身份只用于具体月份定位；即使A类身份成立，也不得单独升级重大事件。' : '身份先独立解析，再判断是否命中主线。A=核心资料稳定身份；B=半禄/课堂代表顺序，默认不得覆盖A级身份或单独制造重大事件。'
        };
    }
    resolveTombStates(facts, luckChars, relevantIds) {
        const out = [];
        const branches = (facts.branches || []).map((id) => facts.byId[id]).filter(Boolean);
        const chars = branches.map((n) => n.char), has = (c) => chars.includes(c);
        const add = (row) => { const key = `${row.layer}|${row.inmateNodeId || ''}|${row.storeNodeId || ''}|${row.incoming_branch || ''}|${row.action || ''}`; if (out.some(x => x._key === key))
            return; out.push({ _key: key, id: `TS${String(out.length + 1).padStart(3, '0')}`, ...row }); };
        for (const inmate of branches) {
            const store = DIRECT_TOMB_STORE[inmate.char];
            if (!store)
                continue;
            const stores = branches.filter((b) => b.char === store);
            for (const storeNode of stores) {
                const earthClashException = store === '辰' && ['丑', '未'].includes(inmate.char) && has('丑') && has('未');
                add({ layer: 'original', inmateNodeId: inmate.id, inmateChar: inmate.char, storeNodeId: storeNode.id, storeChar: store,
                    contained: !earthClashException, status: earthClashException ? 'blocked_by_chou_wei_clash' : 'contained', action: 'base_state',
                    evidence_grade: 'A', relevant: relevantIds.has(inmate.id) || relevantIds.has(storeNode.id),
                    detail: earthClashException ? `原局丑未辰同见，丑未因相冲不直接入辰墓` : `原局${inmate.char}与${store}构成稳定墓库对应，记真实入墓状态`, source_rule: 'BLIND-TOMB-DIRECT-001' });
            }
        }
        for (const luck of luckChars) {
            if (!luck.branch)
                continue;
            const lb = luck.branch;
            for (const inmate of branches) {
                const store = DIRECT_TOMB_STORE[inmate.char];
                if (!store)
                    continue;
                const earthClashException = store === '辰' && ['丑', '未'].includes(inmate.char) && has(inmate.char === '丑' ? '未' : '丑');
                if (lb === store && !earthClashException) {
                    add({ layer: luck.layer, incoming_branch: lb, inmateNodeId: inmate.id, inmateChar: inmate.char, storeChar: store, contained: luck.layer !== 'liuyue', status: luck.layer === 'liuyue' ? 'tomb_reach_localization' : 'tomb_reach', action: 'store_arrives', evidence_grade: 'A', relevant: relevantIds.has(inmate.id), detail: `${this.luckLayerName(luck.layer)}${lb}到位，原局${inmate.char}进入对应墓库的条件形成`, source_rule: 'BLIND-TOMB-DIRECT-001' });
                }
            }
            for (const storeNode of branches) {
                const possible = Object.entries(DIRECT_TOMB_STORE).filter(([, st]) => st === storeNode.char).map(([inmate]) => inmate);
                if (possible.includes(lb)) {
                    add({ layer: luck.layer, incoming_branch: lb, inmateChar: lb, storeNodeId: storeNode.id, storeChar: storeNode.char, contained: luck.layer !== 'liuyue', status: luck.layer === 'liuyue' ? 'inmate_arrival_localization' : 'inmate_arrives', action: 'inmate_arrives', evidence_grade: 'A', relevant: relevantIds.has(storeNode.id), detail: `${this.luckLayerName(luck.layer)}${lb}到位，进入原局${storeNode.char}墓库的条件形成`, source_rule: 'BLIND-TOMB-DIRECT-001' });
                }
                const rel = pairKey(lb, storeNode.char);
                if (BRANCH_CLASHES.has(rel)) {
                    add({ layer: luck.layer, incoming_branch: lb, storeNodeId: storeNode.id, storeChar: storeNode.char, contained: null, status: 'needs_arbitration', action: 'clash_tomb_candidate', evidence_grade: 'A', relevant: relevantIds.has(storeNode.id), detail: `${this.luckLayerName(luck.layer)}${lb}冲原局墓库${storeNode.char}；只记“冲墓候选”，不开库结论需结合真实入墓对象、岁运层级与归属再裁决`, source_rule: 'BLIND-TOMB-CLASH-DISPUTED' });
                }
                if (BRANCH_COMBINES.has(rel)) {
                    add({ layer: luck.layer, incoming_branch: lb, storeNodeId: storeNode.id, storeChar: storeNode.char, contained: null, status: 'needs_arbitration', action: 'combine_tomb_candidate', evidence_grade: 'B', relevant: relevantIds.has(storeNode.id), detail: `${this.luckLayerName(luck.layer)}${lb}合原局墓库${storeNode.char}；可作闭/绊候选，不机械等同关库`, source_rule: 'BLIND-TOMB-COMBINE-B' });
                }
            }
        }
        return out.map(({ _key, ...x }) => x);
    }
    resolveTombStateSnapshot(facts, luckChars, relevantIds) {
        const original = (facts.branches || []).map((id) => facts.byId[id]).filter(Boolean).map((n) => ({ id: n.id, char: n.char, layer: 'original', relevant: relevantIds.has(n.id) }));
        const active = [...original];
        for (const luck of luckChars) {
            if (luck?.branch)
                active.push({ id: `luck.${luck.layer}.branch`, char: luck.branch, layer: luck.layer, relevant: false });
        }
        const chars = active.map((x) => x.char), has = (c) => chars.includes(c);
        const states = [];
        const seen = new Set();
        for (const inmate of active) {
            const store = DIRECT_TOMB_STORE[inmate.char];
            if (!store)
                continue;
            for (const storeNode of active.filter((x) => x.char === store && x.id !== inmate.id)) {
                const key = `${inmate.id}|${storeNode.id}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                const earthConflict = store === '辰' && ['丑', '未'].includes(inmate.char) && has('丑') && has('未') && has('辰');
                states.push({
                    id: `TSS${String(states.length + 1).padStart(3, '0')}`, inmate_id: inmate.id, inmate_char: inmate.char, inmate_layer: inmate.layer, store_id: storeNode.id, store_char: storeNode.char, store_layer: storeNode.layer,
                    contained: !earthConflict, status: earthConflict ? 'blocked_by_chou_wei_clash' : 'contained', active: true, evidence_grade: 'A',
                    relevant: !!inmate.relevant || !!storeNode.relevant,
                    detail: earthConflict ? '当前时间层丑、未、辰同见，按核心资料取消丑/未直接入辰墓状态' : `当前时间层${inmate.char}与${storeNode.char}构成稳定墓库对应，记为有效入墓状态`,
                    source_rule: 'BLIND-TOMB-SNAPSHOT-001'
                });
            }
        }
        const storeActions = [];
        for (const luck of luckChars) {
            if (!luck?.branch)
                continue;
            for (const storeNode of original.filter((x) => Object.values(DIRECT_TOMB_STORE).includes(x.char))) {
                const k = pairKey(luck.branch, storeNode.char);
                if (BRANCH_CLASHES.has(k))
                    storeActions.push({ layer: luck.layer, incoming_branch: luck.branch, store_id: storeNode.id, store_char: storeNode.char, action: 'clash_tomb_candidate', status: 'needs_arbitration', evidence_grade: 'A', relevant: storeNode.relevant, detail: `${this.luckLayerName(luck.layer)}${luck.branch}冲原局墓库${storeNode.char}；只生成冲墓候选，不自动把当前 contained 改成 released`, source_rule: 'BLIND-TOMB-CLASH-DISPUTED' });
                if (BRANCH_COMBINES.has(k))
                    storeActions.push({ layer: luck.layer, incoming_branch: luck.branch, store_id: storeNode.id, store_char: storeNode.char, action: 'combine_tomb_candidate', status: 'needs_arbitration', evidence_grade: 'B', relevant: storeNode.relevant, detail: `${this.luckLayerName(luck.layer)}${luck.branch}合原局墓库${storeNode.char}；只生成闭/绊候选，不自动改变墓库状态`, source_rule: 'BLIND-TOMB-COMBINE-B' });
            }
        }
        return {
            mode: 'current_state_recompute', active_branches: active, states, store_actions: storeActions,
            note: '墓库状态按“原局→当前被引动大运→流年→流月”重新计算当前快照；历史事实不再与当前状态混用。冲墓/合墓只做语义候选，不自动开闭。'
        };
    }
    luckLayerName(layer) { return layer === 'dayun' ? '大运' : layer === 'liunian' ? '流年' : '流月'; }
    buildDayunStageGate(identityResolutions, luckRelations, relevantIds, dayunReplay = null) {
        const dayunIdentity = identityResolutions.find(x => x.layer === 'dayun');
        const selected = (dayunIdentity?.selected || []).filter((x) => x.major_eligible && relevantIds.has(x.targetNodeId));
        const directStructuralTypes = new Set(['same_char', 'combine', 'clash', 'harm', 'break', 'punish', 'tonglu_appearance', 'yuanshen_appearance', 'hidden_stem_manifestation', 'hidden_form_appearance']);
        const directStructural = luckRelations.filter((x) => x.layer === 'dayun' && relevantIds.has(x.targetNodeId) && directStructuralTypes.has(x.type));
        const shengKe = luckRelations.filter((x) => x.layer === 'dayun' && relevantIds.has(x.targetNodeId) && ['generate', 'control'].includes(x.type));
        // v1.9 收紧阶段门：普通生克只做 context，不能单独把大运“开门”。
        // 只有直接身份/结构命中，或 State Replay 确认原主线状态被改变/补足时，才允许进入重大流年应期仲裁。
        const replayEngaged = !!dayunReplay?.engaged;
        const engaged = selected.length > 0 || directStructural.length > 0 || replayEngaged;
        const strength = selected.length || directStructural.length ? 'explicit' : replayEngaged ? 'replay_confirmed' : shengKe.length ? 'shengke_context_only' : 'quiet';
        return {
            status: engaged ? 'engaged' : shengKe.length ? 'context_only' : 'quiet', engaged, strength,
            evidence: [...selected.map((x) => x.detail), ...directStructural.map((x) => x.detail), ...(dayunReplay?.evidence || [])].filter(Boolean).slice(0, 12),
            context_evidence: shengKe.map((x) => x.detail).filter(Boolean).slice(0, 8),
            identity_evidence_count: selected.length, direct_structure_count: directStructural.length, shengke_context_count: shengKe.length, replay_engaged: replayEngaged,
            note: engaged ? '当前大运已通过直接身份/结构，或经主功状态重演确认真正改变原局主线，可进入流年应期仲裁。' : shengKe.length ? '当前大运只有普通生克背景，尚不足以证明原局大事进入应验阶段；流年只保留线索。' : '当前大运未承接原局第一主线；流年不得凭空制造重大事件。'
        };
    }
    resolveLuckRootState(facts, roots, luckChars) {
        const stages = ['dayun', 'liunian', 'liuyue'];
        const states = [];
        for (const base of roots || []) {
            const stem = facts.byId[base.stemNodeId];
            if (!stem)
                continue;
            const additions = [];
            for (const luck of luckChars || []) {
                const br = luck?.branch;
                if (!br)
                    continue;
                const hidden = BRANCH_HIDDEN_STEMS[br] || [];
                const add = (kind, capacity, grade, detail, rule) => additions.push({ layer: luck.layer, branch: br, kind, capacity, evidence_grade: grade, detail, source_rule: rule, localization_only: luck.layer === 'liuyue' });
                if (LU_BRANCH[stem.char] === br)
                    add('luck_lu_root', 'strong', 'A', `${this.luckLayerName(luck.layer)}${br}为${stem.char}固定禄，形成岁运见实/禄根支持`, 'BLIND-LUCK-ROOT-LU-001');
                else if (hidden.includes(stem.char))
                    add('luck_same_stem_root', 'strong', 'A', `${this.luckLayerName(luck.layer)}${br}藏${stem.char}，形成岁运同干见实支持`, 'BLIND-LUCK-ROOT-HIDDEN-001');
                else if (LONGSHENG_BRANCH_BY_ELEMENT[stem.element] === br)
                    add('luck_longsheng_qi', stem.element === '金' ? 'medium' : 'strong', 'A', `${this.luckLayerName(luck.layer)}${br}为${stem.element}长生，增加当前得气`, 'BLIND-LUCK-QI-LONGSHENG-001');
                else if ((TOMB_QI_BRANCHES_BY_ELEMENT[stem.element] || []).includes(br))
                    add('luck_tomb_qi', 'medium', 'A', `${this.luckLayerName(luck.layer)}${br}为${stem.element}墓库，只增加墓库得气/承载，不自动等同禄根`, 'BLIND-LUCK-QI-TOMB-001');
                else if (RESIDUAL_QI_BRANCH_BY_ELEMENT[stem.element] === br)
                    add('luck_residual_qi', 'weak', 'A', `${this.luckLayerName(luck.layer)}${br}为${stem.element}余气，仅作弱得气`, 'BLIND-LUCK-QI-RESIDUAL-001');
            }
            const calc = (until, includeLocalization = false) => {
                const max = stages.indexOf(until), rows = additions.filter(x => stages.indexOf(x.layer) <= max && (includeLocalization || !x.localization_only));
                let cap = base.capacity_status;
                if (rows.some(x => x.capacity === 'strong'))
                    cap = ['strong_direct_root', 'strong_qi'].includes(cap) ? cap : 'luck_strengthened';
                else if (rows.some(x => x.capacity === 'medium') && ['unsupported', 'external_support_only', 'weak_qi'].includes(cap))
                    cap = 'luck_medium_qi';
                else if (rows.some(x => x.capacity === 'weak') && ['unsupported', 'external_support_only'].includes(cap))
                    cap = 'luck_weak_qi';
                return { capacity: cap, changed: cap !== base.capacity_status, additions: rows };
            };
            const dayun = calc('dayun'), liunian = calc('liunian'), liuyue = calc('liuyue', true);
            states.push({ stemNodeId: base.stemNodeId, stemChar: stem.char, original_capacity: base.capacity_status, current_capacity: liunian.capacity, stage_capacities: { dayun, liunian, liuyue }, original_strata: base.root_strata || base.roots || [], luck_additions: additions, changed: liunian.changed, note: '岁运根气按阶段分别计算；大运状态不会被后来的流年反写，流月只进入 localization 容量。' });
        }
        return { mode: 'root_strata_snapshot', states, note: '坐下根与外部支持分开；大运/流年见禄、同干见实、长生/墓库/余气只作为当前状态增量，并按时间层分别快照。' };
    }
    resolveCompositeLuckState(facts, luckChars, relevantIds) {
        const original = (facts.branches || []).map((id) => facts.byId[id]).filter(Boolean).map((n) => ({ id: n.id, char: n.char, layer: 'original' }));
        const stages = ['dayun', 'liunian', 'liuyue'], layerRank = (l) => l === 'original' ? -1 : stages.indexOf(l);
        const snapshots = [];
        for (let si = 0; si < stages.length; si++) {
            const stage = stages[si];
            const active = [...original];
            for (const l of luckChars || []) {
                if (l?.branch && stages.indexOf(l.layer) <= si)
                    active.push({ id: `luck.${l.layer}.branch`, char: l.branch, layer: l.layer });
            }
            const chars = active.map(x => x.char);
            const formations = [];
            const check = (kind, groups) => { for (const g of groups) {
                if (g.branches.every((z) => chars.includes(z))) {
                    const members = g.branches.map((z) => active.find(x => x.char === z)).filter(Boolean);
                    const firstRank = Math.max(...members.map((m) => layerRank(m.layer)));
                    const firstStage = firstRank < 0 ? 'original' : stages[firstRank];
                    formations.push({ kind, branches: g.branches, result_element: g.element || null, family: g.family || null, formed: true, first_formed_stage: firstStage, newly_formed: firstStage === stage, relevant: members.some((m) => m.layer === 'original' && relevantIds.has(m.id)), member_layers: members.map((m) => ({ char: m.char, layer: m.layer })), transformation: 'not_auto_assumed', source_rule: kind === 'sanxing' ? 'BLIND-SANXING-COMPLETE-001' : 'BLIND-COMPOSITE-FORMATION-001' });
                }
            } };
            check('sanhe', SANHE);
            check('sanhui', SANHUI);
            check('sanxing', SANXING);
            snapshots.push({ stage, active_branches: active, formations, note: '只确认组合是否形成及首次形成时间层；是否“化”、节点是否改性及成果归属继续分开。' });
        }
        return { mode: 'cumulative_composite_state', snapshots };
    }
    replayMainlineState(primary, facts, relations, luckRelations, timingSemantics, identityResolutions, tombReplay, rootState, compositeState) {
        if (!primary)
            return { available: false, note: '无原局第一主线，不执行状态重演。' };
        const relevantIds = new Set(uniq([...(primary.actorNodes || []), ...(primary.targetNodes || []), ...(primary.bridgeNodes || []), ...(primary.resultNodes || [])]));
        const roleOf = (id) => primary.actorNodes?.includes(id) ? 'actor' : primary.targetNodes?.includes(id) ? 'target' : primary.bridgeNodes?.includes(id) ? 'bridge' : primary.resultNodes?.includes(id) ? 'result' : 'context';
        const originalPathRelations = (primary.relationIds || []).map((id) => relations.find((r) => r.id === id)).filter(Boolean);
        const originalCombineNodeIds = new Set(originalPathRelations.filter((r) => ['stem_combine', 'branch_combine', 'stem_branch_combine'].includes(r.type)).flatMap((r) => r.nodes || []));
        const originalClashNodeIds = new Set(originalPathRelations.filter((r) => r.type === 'clash').flatMap((r) => r.nodes || []));
        const stages = ['dayun', 'liunian', 'liuyue'];
        const snapshots = [];
        const stageIndex = (l) => stages.indexOf(l);
        for (let si = 0; si < stages.length; si++) {
            const stage = stages[si], changes = [];
            const ids = (identityResolutions || []).filter((x) => stageIndex(x.layer) <= si).flatMap((x) => (x.selected || []).filter((c) => c.evidence_grade === 'A' && relevantIds.has(c.targetNodeId)));
            for (const c of ids)
                changes.push({ type: 'identity_arrival', layer: c.layer, targetNodeId: c.targetNodeId, role: roleOf(c.targetNodeId), certainty: 'fact', detail: c.detail, source_rule: c.source_rule });
            const sems = (timingSemantics || []).filter((x) => stageIndex(x.layer) <= si && (!x.targetNodeId || relevantIds.has(x.targetNodeId)));
            for (const sem of sems) {
                let type = 'relation_context', certainty = 'candidate';
                if (sem.semantic === 'appearance_arrival')
                    type = 'identity_arrival';
                else if (String(sem.semantic).startsWith('clash')) {
                    if (sem.targetNodeId && originalCombineNodeIds.has(sem.targetNodeId))
                        type = 'original_combine_released_candidate';
                    else
                        type = 'clash_impact_candidate';
                }
                else if (String(sem.semantic).startsWith('combine')) {
                    if (sem.targetNodeId && originalClashNodeIds.has(sem.targetNodeId))
                        type = 'original_clash_met_by_combine';
                    else
                        type = 'combine_impact_candidate';
                }
                else if (['wear_damage_candidate', 'break_symbolic_disruption', 'punish_candidate'].includes(sem.semantic))
                    type = 'structure_damage_candidate';
                else if (['dayun_generate_context', 'dayun_control_context'].includes(sem.semantic))
                    type = 'shengke_context';
                if (sem.status === 'fact')
                    certainty = 'fact';
                changes.push({ type, layer: sem.layer, targetNodeId: sem.targetNodeId || null, role: sem.targetNodeId ? roleOf(sem.targetNodeId) : 'dayun_context', certainty, detail: sem.detail, source_rule: sem.source_rule });
            }
            const comp = (compositeState?.snapshots || []).find((x) => x.stage === stage);
            for (const f of comp?.formations || [])
                if (f.newly_formed && f.relevant)
                    changes.push({ type: 'composite_formation_change', layer: stage, role: 'structure', certainty: 'fact', detail: `${f.kind} ${f.branches.join('')} 在当前时间层形成；只确认成局，是否改性另判`, source_rule: f.source_rule, formation: f });
            const stageTomb = tombReplay?.[stage] || { states: [], store_actions: [] };
            for (const a of stageTomb.store_actions || [])
                if (a.relevant)
                    changes.push({ type: 'tomb_action_candidate', layer: a.layer, role: 'structure', certainty: 'candidate', detail: a.detail, source_rule: a.source_rule });
            for (const ts of stageTomb.states || []) {
                const luckFormed = ts.relevant && ts.contained === true && (ts.inmate_layer !== 'original' || ts.store_layer !== 'original');
                if (luckFormed)
                    changes.push({ type: 'tomb_containment_changed', layer: stage, role: 'structure', certainty: 'fact', detail: ts.detail, source_rule: ts.source_rule });
            }
            const actorRoots = (rootState?.states || []).filter((r) => primary.actorNodes?.includes(r.stemNodeId));
            for (const r of actorRoots) {
                const sc = r.stage_capacities?.[stage];
                if (sc?.changed)
                    changes.push({ type: 'actor_capacity_changed', layer: stage, role: 'actor', certainty: 'fact', detail: `主功执行者${r.stemChar}承载在${this.luckLayerName(stage)}层由${r.original_capacity}变为${sc.capacity}`, source_rule: 'BLIND-ROOT-STATE-REPLAY-001' });
            }
            const stageOnly = changes.filter(x => stageIndex(x.layer) <= si);
            const direct = stageOnly.filter(x => !['shengke_context', 'relation_context'].includes(x.type));
            let state = 'maintained';
            if (direct.some(x => x.type === 'original_combine_released_candidate' || x.type === 'structure_damage_candidate' || x.type === 'tomb_action_candidate'))
                state = 'altered_candidate';
            else if (direct.some(x => x.type === 'composite_formation_change'))
                state = 'transformed_candidate';
            else if (direct.some(x => x.type === 'identity_arrival' || x.type === 'original_clash_met_by_combine'))
                state = 'stage_engaged';
            else if (direct.some(x => x.type === 'actor_capacity_changed'))
                state = 'strengthened_candidate';
            const engaged = stage === 'dayun' && direct.some(x => ['identity_arrival', 'original_combine_released_candidate', 'original_clash_met_by_combine', 'structure_damage_candidate', 'composite_formation_change', 'tomb_action_candidate', 'tomb_containment_changed', 'actor_capacity_changed', 'clash_impact_candidate', 'combine_impact_candidate'].includes(x.type));
            snapshots.push({ stage, state, engaged, evidence: uniq(direct.map(x => x.detail)).slice(0, 12), changes: stageOnly, note: 'State Replay只重演原局第一主功，不允许岁运凭空生成新主题；candidate 表示关系已改变但具体吉凶/完成度仍需语义仲裁。' });
        }
        return { available: true, mode: 'original_mainline_state_replay', original: { path_id: primary.id, title: primary.title, type: primary.type, status: primary.status, relation_ids: primary.relationIds || [] }, dayun: snapshots.find(x => x.stage === 'dayun'), liunian: snapshots.find(x => x.stage === 'liunian'), liuyue: snapshots.find(x => x.stage === 'liuyue'), snapshots, note: '按原局→大运→流年→流月累计重演同一第一主功；不重新挑一条岁运新主线。' };
    }
    resolveTiming(chart, facts, relations, primary, options = {}) {
        const now = options.now ? new Date(options.now) : new Date();
        const chinaParts = this.getChinaClockParts(now), currentYear = chinaParts[0], nowClock = this.partsClockNumber(chinaParts);
        const dys = chart?.da_yun || [];
        const eventClock = (e) => this.parseLocalClock(e?.window_start || '');
        let di = -1;
        for (let i = 0; i < dys.length; i++) {
            const st = eventClock(dys[i]?.start_event), en = eventClock(dys[i]?.end_event);
            if (st && nowClock >= st && (!en || nowClock < en)) {
                di = i;
                break;
            }
        }
        const allLn = dys.flatMap((d) => (d.liu_nian || []).map((y) => ({ d, y })));
        const anyLn = allLn.find((x) => { const st = eventClock(x.y?.liunian_start_event), en = eventClock(x.y?.liunian_end_event); return st ? nowClock >= st && (!en || nowClock < en) : Number(x.y?.year) === currentYear; }) || allLn.find((x) => Number(x.y?.year) === currentYear);
        if (di < 0) {
            const daxian = this.resolveBlindDaXian(chart, currentYear);
            return { available: false, current_year: currentYear, dayun: null, liunian: anyLn ? { year: anyLn.y.year, ganzhi: anyLn.y.ganzhi, start_event: anyLn.y.liunian_start_event, end_event: anyLn.y.liunian_end_event } : null, liuyue: null, daxian, effect: 'unknown', triggers: [], luck_relations: [], future: [], note: chart?.input_mode === 'pillars' ? '四柱直排未提供完整年份/起运信息，或尚未到首个交运窗口，不虚构当前大运。' : '当前时间尚未进入已生成的大运交运区间。' };
        }
        const dy = dys[di], ln = anyLn?.y || null, ly = ln ? this.resolveCurrentLiuYue(Number(ln.year), nowClock) : null, branchSwitch = eventClock(dy?.stem_to_branch_event), activeComponent = branchSwitch && nowClock >= branchSwitch ? 'branch' : 'stem';
        const daxian = this.resolveBlindDaXian(chart, currentYear);
        if (!primary)
            return { available: true, current_year: currentYear, dayun: { index: di, pillar: dy.pillar, start_year: dy.start_year, start_age: dy.start_age, phase: activeComponent === 'stem' ? dy.stem_phase?.name : dy.branch_phase?.name, active_component: activeComponent, active_value: activeComponent === 'stem' ? dy.heavenly_stem : dy.earthly_branch, start_event: dy.start_event, stem_to_branch_event: dy.stem_to_branch_event }, liunian: ln ? { year: ln.year, ganzhi: ln.ganzhi, start_event: ln.liunian_start_event, end_event: ln.liunian_end_event } : null, liuyue: ly ? { pillar: ly.pillar, heavenly_stem: ly.heavenly_stem, earthly_branch: ly.earthly_branch, start_event: ly.start_event, end_event: ly.end_event } : null, daxian, effect: 'neutral', triggers: [], luck_relations: [], future: [], note: '原局第一主线未明确，因此岁运只展示客观到位，不强行解释事件。' };
        const relevant = uniq([...(primary.actorNodes || []), ...(primary.targetNodes || []), ...(primary.bridgeNodes || []), ...(primary.resultNodes || [])]).map(id => facts.byId[id]).filter(Boolean);
        const triggers = [], luckRelations = [];
        let activeDayunStem = activeComponent === 'stem' ? dy.heavenly_stem : null, activeDayunBranch = activeComponent === 'branch' ? dy.earthly_branch : null;
        const branchRel = (a, b) => {
            if (!a || !b)
                return '';
            if (a === b)
                return 'same_char';
            const k = pairKey(a, b);
            if (BRANCH_COMBINES.has(k))
                return 'combine';
            if (BRANCH_CLASHES.has(k))
                return 'clash';
            if (BRANCH_HARMS.has(k))
                return 'harm';
            if (BRANCH_BREAKS.has(k))
                return 'break';
            if (PUNISH_PAIRS.has(k) || (a === b && SELF_PUNISH.has(a)))
                return 'punish';
            return '';
        };
        const stemRel = (a, b) => { if (!a || !b)
            return ''; if (a === b)
            return 'same_char'; const k = pairKey(a, b); if (STEM_COMBINES.has(k))
            return 'combine'; if (STEM_CLASHES.has(k))
            return 'clash'; return ''; };
        const crossRelation = ln ? (activeComponent === 'stem' ? branchRel(ln.earthly_branch, dy.earthly_branch) : stemRel(ln.heavenly_stem, dy.heavenly_stem)) : '';
        if (ln && activeComponent === 'stem' && crossRelation) {
            activeDayunBranch = dy.earthly_branch;
            triggers.push({ layer: 'dayun', type: 'cross_phase_activate', relation: crossRelation, targetNodeId: '', detail: `流年${ln.earthly_branch}与非当运运支${dy.earthly_branch}发生${this.luckRelationLabel(crossRelation)}，提前引动${dy.earthly_branch}运` });
        }
        if (ln && activeComponent === 'branch' && crossRelation) {
            activeDayunStem = dy.heavenly_stem;
            triggers.push({ layer: 'dayun', type: 'cross_phase_activate', relation: crossRelation, targetNodeId: '', detail: `流年${ln.heavenly_stem}与非当运运干${dy.heavenly_stem}发生${this.luckRelationLabel(crossRelation)}，重新引动${dy.heavenly_stem}运` });
        }
        // 除冲合外，固定禄/原身身份也可把另一半运重新叫出来；只开放直接白名单，不用半禄扩展。
        if (ln && activeComponent === 'branch' && !activeDayunStem && LU_BRANCH[dy.heavenly_stem] === ln.earthly_branch) {
            activeDayunStem = dy.heavenly_stem;
            triggers.push({ layer: 'dayun', type: 'cross_phase_identity_activate', relation: 'tonglu', targetNodeId: '', detail: `流年${ln.earthly_branch}为非当运运干${dy.heavenly_stem}之固定禄，重新引动${dy.heavenly_stem}运`, evidence_grade: 'A', source_rule: 'BLIND-CROSS-PHASE-TONGLU-001' });
        }
        if (ln && activeComponent === 'stem' && !activeDayunBranch && (ORIGIN_STEMS_BY_BRANCH[dy.earthly_branch] || []).includes(ln.heavenly_stem)) {
            activeDayunBranch = dy.earthly_branch;
            triggers.push({ layer: 'dayun', type: 'cross_phase_identity_activate', relation: 'yuanshen', targetNodeId: '', detail: `流年${ln.heavenly_stem}为非当运运支${dy.earthly_branch}之固定原身，提前引动${dy.earthly_branch}运`, evidence_grade: 'A', source_rule: 'BLIND-CROSS-PHASE-YUANSHEN-001' });
        }
        const luckChars = [{ layer: 'dayun', stem: activeDayunStem, branch: activeDayunBranch }, ...(ln ? [{ layer: 'liunian', stem: ln.heavenly_stem, branch: ln.earthly_branch }] : []), ...(ly ? [{ layer: 'liuyue', stem: ly.heavenly_stem, branch: ly.earthly_branch }] : [])];
        const relevantIds = new Set(relevant.map((n) => n.id));
        const identityResolutions = luckChars.map((luck) => this.resolveLuckIdentities(luck, facts, relevantIds));
        const addLuck = (luck, n, type, detail, extra = {}) => { const id = `LR${String(luckRelations.length + 1).padStart(3, '0')}`; luckRelations.push({ id, layer: luck.layer, type, targetNodeId: n.id, targetChar: n.char, detail, ...extra }); return id; };
        const layerName = (layer) => this.luckLayerName(layer);
        for (const luck of luckChars) {
            for (const n of relevant) {
                const isStem = n.position === 'stem' || n.position === 'hidden_stem', lc = isStem ? luck.stem : luck.branch;
                if (!lc)
                    continue;
                const rel = isStem ? stemRel(lc, n.char) : branchRel(lc, n.char);
                if (rel) {
                    addLuck(luck, n, rel, `${layerName(luck.layer)}${lc}与原局${n.char}${this.luckRelationLabel(rel)}`);
                    const type = rel === 'same_char' ? 'appearance' : rel === 'combine' ? 'combine_activate' : rel === 'clash' ? 'clash_activate' : rel === 'harm' ? 'harm_activate' : rel === 'break' ? 'break_activate' : 'punish_activate';
                    triggers.push({ layer: luck.layer, type, targetNodeId: n.id, detail: `${layerName(luck.layer)}${lc}${this.luckRelationLabel(rel)}原局${n.char}，引动主线节点` });
                }
                const luckEl = isStem ? STEM_ELEMENT[lc] : BRANCH_ELEMENT[lc], nodeEl = n.element;
                if (luckEl && nodeEl && luckEl !== nodeEl) {
                    if (elementGenerates(luckEl, nodeEl))
                        addLuck(luck, n, 'generate', `${layerName(luck.layer)}${lc}生原局${n.char}`);
                    if (elementControls(luckEl, nodeEl))
                        addLuck(luck, n, 'control', `${layerName(luck.layer)}${lc}克原局${n.char}`);
                }
                // 墓库与干支身份不再在这里用“五行=墓库”粗判；统一交给 IdentityResolver / TombStateResolver。
            }
        }
        // 将身份解析结果转成结构化岁运事实。只让 selected 且允许重大应期的身份进入 trigger；B级候选保留在 identity_resolutions。
        for (const ir of identityResolutions) {
            const luck = luckChars.find((x) => x.layer === ir.layer) || { layer: ir.layer };
            for (const c of ir.claims) {
                const n = facts.byId[c.targetNodeId];
                if (!n)
                    continue;
                addLuck(luck, n, c.type, c.detail, { identity_claim_id: c.id, evidence_grade: c.evidence_grade, source_status: c.source_status, selected: c.selected, major_eligible: c.major_eligible, source_rule: c.source_rule });
            }
            for (const c of ir.selected.filter((x) => x.major_eligible)) {
                triggers.push({ layer: ir.layer, type: 'identity_appearance', identity_type: c.type, targetNodeId: c.targetNodeId, detail: c.detail, evidence_grade: c.evidence_grade, source_rule: c.source_rule });
            }
        }
        const tombHistory = this.resolveTombStates(facts, luckChars, relevantIds);
        const luckUpTo = (stage) => { const order = ['dayun', 'liunian', 'liuyue'], i = order.indexOf(stage); return luckChars.filter((x) => order.indexOf(x.layer) <= i); };
        const tombStateReplay = { dayun: this.resolveTombStateSnapshot(facts, luckUpTo('dayun'), relevantIds), liunian: this.resolveTombStateSnapshot(facts, luckUpTo('liunian'), relevantIds), liuyue: this.resolveTombStateSnapshot(facts, luckUpTo('liuyue'), relevantIds) };
        const tombStateSnapshot = tombStateReplay.liuyue;
        const tombStates = tombStateSnapshot.states;
        const timingRelationSemantics = this.resolveTimingRelationSemantics(luckRelations, facts, primary, { dy, ln, activeComponent, crossRelation, tombSnapshot: tombStateSnapshot });
        const rootStateSnapshot = this.resolveLuckRootState(facts, options?._roots || this.resolveRoots(facts), luckChars);
        const compositeState = this.resolveCompositeLuckState(facts, luckChars, relevantIds);
        const stateReplay = this.replayMainlineState(primary, facts, relations, luckRelations, timingRelationSemantics, identityResolutions, tombStateReplay, rootStateSnapshot, compositeState);
        const stageGate = this.buildDayunStageGate(identityResolutions, luckRelations, relevantIds, stateReplay?.dayun);
        const dayunIdentity = identityResolutions.find((x) => x.layer === 'dayun');
        const liunianIdentity = identityResolutions.find((x) => x.layer === 'liunian');
        const directDayunTypes = new Set(['same_char', 'combine', 'clash', 'harm', 'break', 'punish', 'tonglu_appearance', 'yuanshen_appearance', 'hidden_stem_manifestation', 'hidden_form_appearance']);
        const dayunEngagedTargets = new Set([
            ...(dayunIdentity?.selected || []).filter((x) => x.major_eligible && relevantIds.has(x.targetNodeId)).map((x) => x.targetNodeId),
            ...luckRelations.filter((x) => x.layer === 'dayun' && relevantIds.has(x.targetNodeId) && directDayunTypes.has(x.type)).map((x) => x.targetNodeId),
            ...(stateReplay?.dayun?.changes || []).filter((x) => x.targetNodeId && x.type !== 'shengke_context').map((x) => x.targetNodeId)
        ]);
        const fanKeClaims = (liunianIdentity?.selected || []).filter((x) => x.major_eligible && relevantIds.has(x.targetNodeId) && ['tonglu_appearance', 'yuanshen_appearance', 'same_stem_appearance', 'same_branch_appearance'].includes(x.type));
        const fanKeQualified = fanKeClaims.filter((x) => stageGate.engaged && dayunEngagedTargets.has(x.targetNodeId));
        const dynamicDayunClaims = [];
        if (ln) {
            if (LU_BRANCH[dy.heavenly_stem] === ln.earthly_branch)
                dynamicDayunClaims.push({ type: 'liunian_tonglu_dayun_stem', dayun_component: 'stem', dayun_char: dy.heavenly_stem, liunian_char: ln.earthly_branch, evidence_grade: 'A', detail: `流年${ln.earthly_branch}为大运${dy.heavenly_stem}之固定禄，太岁取得大运${dy.heavenly_stem}身份` });
            if ((ORIGIN_STEMS_BY_BRANCH[dy.earthly_branch] || []).includes(ln.heavenly_stem))
                dynamicDayunClaims.push({ type: 'liunian_yuanshen_dayun_branch', dayun_component: 'branch', dayun_char: dy.earthly_branch, liunian_char: ln.heavenly_stem, evidence_grade: 'A', detail: `流年${ln.heavenly_stem}为大运${dy.earthly_branch}之固定原身，太岁取得大运${dy.earthly_branch}身份` });
            if (ln.heavenly_stem === dy.heavenly_stem)
                dynamicDayunClaims.push({ type: 'liunian_same_dayun_stem', dayun_component: 'stem', dayun_char: dy.heavenly_stem, liunian_char: ln.heavenly_stem, evidence_grade: 'A', detail: `流年天干与大运天干同字，太岁取得大运${dy.heavenly_stem}身份` });
            if (ln.earthly_branch === dy.earthly_branch)
                dynamicDayunClaims.push({ type: 'liunian_same_dayun_branch', dayun_component: 'branch', dayun_char: dy.earthly_branch, liunian_char: ln.earthly_branch, evidence_grade: 'A', detail: `流年地支与大运地支同字，太岁取得大运${dy.earthly_branch}身份` });
        }
        const fanKeWeiZhu = dynamicDayunClaims.length && stageGate.engaged ? { status: 'qualified_by_dayun_identity', qualified: true, mode: 'dayun_identity', claims: dynamicDayunClaims, note: '太岁取得当前大运某一字身份，且大运已通过 State Replay/直接结构承接原局第一主线，可进入反客为主应期仲裁；最终事件仍须回接原局。' } : dynamicDayunClaims.length ? { status: 'dayun_identity_candidate', qualified: false, mode: 'dayun_identity', claims: dynamicDayunClaims, note: '太岁取得大运字身份，但当前大运尚未证明承接原局第一主线；只保留反客为主候选，不单独升重大事件。' } : fanKeQualified.length ? { status: 'qualified', qualified: true, mode: 'original_identity', claims: fanKeQualified, note: '太岁取得原局主线身份，且当前大运在同一目标上形成阶段承接，可进入“反客为主”应期仲裁。' } : fanKeClaims.length ? { status: 'blocked_by_dayun_stage', qualified: false, mode: 'original_identity', claims: fanKeClaims, note: '流年虽取得原局身份，但当前大运未在同一目标上形成阶段承接；保留应期线索，不单独升重大事件。' } : { status: 'not_triggered', qualified: false, mode: null, claims: [], note: '当前流年未形成高置信的反客为主身份条件。' };
        for (const t of triggers) {
            if (t.layer === 'liuyue') {
                t.major_eligible = false;
                t.scope = 'localization_only';
                continue;
            }
            if (t.layer === 'liunian') {
                t.major_eligible = stageGate.engaged;
                t.scope = stageGate.engaged ? 'major_timing_eligible' : 'timing_clue_only';
                continue;
            }
            t.major_eligible = true;
            t.scope = 'stage';
        }
        const liunianSemantics = timingRelationSemantics.filter((x) => x.layer === 'liunian');
        let effect = 'neutral';
        if (fanKeWeiZhu.qualified)
            effect = 'identity_triggered';
        else if (stageGate.engaged && stateReplay?.liunian?.state && stateReplay.liunian.state !== 'maintained')
            effect = 'state_changed';
        else if (stageGate.engaged && liunianSemantics.length)
            effect = 'activated';
        else if (stageGate.engaged)
            effect = 'stage_context';
        // 未来年份只列“应期候选理由”，不再按冲合数量加权评分。
        const future = [];
        const flowBaseYear = Number(ln?.year || currentYear);
        for (let year = flowBaseYear; year < flowBaseYear + 5; year++) {
            let foundDy = null, foundLn = null;
            for (const d of dys) {
                const y = (d.liu_nian || []).find(x => Number(x.year) === year);
                if (y) {
                    foundDy = d;
                    foundLn = y;
                    break;
                }
            }
            if (!foundLn)
                continue;
            const labels = [];
            for (const n of relevant) {
                if ((n.position === 'stem' || n.position === 'hidden_stem') && foundLn.heavenly_stem === n.char)
                    labels.push(`${n.char}到位`);
                if (n.position === 'branch') {
                    const rel = branchRel(foundLn.earthly_branch, n.char);
                    if (rel)
                        labels.push(`${foundLn.earthly_branch}${this.luckRelationLabel(rel)}${n.char}`);
                }
            }
            if (foundLn.is_transition_year)
                labels.unshift('交运年');
            const reasons = uniq(labels).slice(0, 6);
            future.push({ year, ganzhi: foundLn.ganzhi, dayun: foundDy?.pillar || '', dayun_phase: foundLn.dayun_phase || '', transition_event: foundLn.transition_event || null, status: reasons.length ? 'timing_candidate' : 'no_direct_trigger', labels: reasons, note: reasons.length ? '仅列候选应期理由，不按关系数量评强弱；是否应事仍需当年重新做身份、阶段门与关系语义仲裁。' : '当前未发现与第一主线的直接到位/关系线索，不据此断平稳或无事。' });
        }
        return { available: true, current_year: currentYear, dayun: { index: di, pillar: dy.pillar, start_year: dy.start_year, start_age: dy.start_age, phase: activeComponent === 'stem' ? dy.stem_phase?.name : dy.branch_phase?.name, active_component: activeComponent, active_value: activeComponent === 'stem' ? dy.heavenly_stem : dy.earthly_branch, whole_context: dy.pillar, inactive_component: activeComponent === 'stem' ? 'branch' : 'stem', inactive_value: activeComponent === 'stem' ? dy.earthly_branch : dy.heavenly_stem, start_event: dy.start_event, stem_to_branch_event: dy.stem_to_branch_event }, liunian: ln ? { year: ln.year, ganzhi: ln.ganzhi, start_event: ln.liunian_start_event, end_event: ln.liunian_end_event } : null, liuyue: ly ? { pillar: ly.pillar, heavenly_stem: ly.heavenly_stem, earthly_branch: ly.earthly_branch, start_event: ly.start_event, end_event: ly.end_event } : null, daxian, effect, triggers, luck_relations: luckRelations, timing_relation_semantics: timingRelationSemantics, identity_resolutions: identityResolutions, stage_gate: stageGate, fan_ke_wei_zhu: fanKeWeiZhu, root_state_snapshot: rootStateSnapshot, composite_state: compositeState, state_replay: stateReplay, tomb_state_replay: tombStateReplay, tomb_states: tombStates, tomb_state_snapshot: tombStateSnapshot, tomb_history: tombHistory, future, note: 'v1.9以原局第一主功为不可被岁运凭空替换的主题，按大运→流年→流月累计重演其当前状态；根气拆成坐下直接根/长生/墓库/余气与外部支持，普通生克不再单独打开大运阶段门。' };
    }
    resolveTimingRelationSemantics(luckRelations, facts, primary, context) {
        const out = [];
        const actorIds = new Set(primary?.actorNodes || []), targetIds = new Set(primary?.targetNodes || []);
        const tombSnapshot = context?.tombSnapshot || { states: [], store_actions: [] };
        const add = (r, semantic, extra = {}) => out.push({
            id: `TRS${String(out.length + 1).padStart(3, '0')}`, relation_id: r?.id || null, layer: r?.layer || extra.layer || '', raw_type: r?.type || extra.raw_type || '', targetNodeId: r?.targetNodeId || extra.targetNodeId || '',
            semantic, evidence_grade: extra.evidence_grade || 'A', status: extra.status || 'candidate', major_conclusion_allowed: extra.major_conclusion_allowed === true,
            affects_role: r?.targetNodeId ? (actorIds.has(r.targetNodeId) ? 'actor' : targetIds.has(r.targetNodeId) ? 'target' : 'mainline_context') : (extra.affects_role || 'dayun_context'),
            detail: extra.detail || r?.detail || '', source_rule: extra.source_rule || 'BLIND-TIMING-SEMANTIC-001', alternatives: extra.alternatives || []
        });
        for (const r of luckRelations) {
            if (r.layer === 'liuyue')
                continue;
            if (r.type === 'same_char' || ['same_stem_appearance', 'same_branch_appearance', 'tonglu_appearance', 'yuanshen_appearance', 'hidden_stem_manifestation', 'hidden_form_appearance'].includes(r.type)) {
                add(r, 'appearance_arrival', { status: 'fact', major_conclusion_allowed: false, detail: `${r.detail}；这里只确认“到位/身份出现”，事件吉凶仍由原局与大运决定。`, source_rule: 'BLIND-APPEAR-SEMANTIC-001' });
            }
            else if (r.type === 'clash') {
                const node = facts.byId[r.targetNodeId];
                const touchesStore = !!node && ((tombSnapshot.store_actions || []).some((x) => x.store_id === node.id && x.layer === r.layer && x.action === 'clash_tomb_candidate'));
                add(r, touchesStore ? 'clash_tomb_candidate' : 'clash_move_candidate', {
                    detail: touchesStore ? `${r.detail}；冲到当前墓库，只生成“冲墓候选”，不可直接写开库。` : `${r.detail}；原书需继续辨冲动、冲旺、冲出、冲去、冲破/冲凶，当前证据不足时默认只记“冲动候选”。`,
                    alternatives: touchesStore ? ['冲开候选', '冲出候选', '破库候选', '仅扰动'] : ['冲动', '冲旺', '冲出', '冲去', '冲破', '冲凶'], source_rule: touchesStore ? 'BLIND-TOMB-CLASH-DISPUTED' : 'BLIND-CLASH-SEMANTICS-001'
                });
            }
            else if (r.type === 'combine') {
                add(r, 'combine_candidate', { detail: `${r.detail}；太岁合原局不能统一翻译成“合绊”，需辨合留、合动、合绊、合去、合伤。`, alternatives: ['合留', '合动', '合绊', '合去', '合伤'], source_rule: 'BLIND-COMBINE-SEMANTICS-001' });
            }
            else if (r.type === 'harm') {
                add(r, 'wear_damage_candidate', { detail: `${r.detail}；穿/害先记破坏、穿倒候选，不单凭一条穿直接下重大事件。`, source_rule: 'BLIND-WEAR-SEMANTIC-001' });
            }
            else if (r.type === 'break') {
                add(r, 'break_symbolic_disruption', { detail: `${r.detail}；盲派核心“破”以子卯、卯午为主，主要表无情、破坏、废弃、破耗等象，默认不当作独立做功完成。`, source_rule: 'BLIND-BREAK-CORE-001' });
            }
            else if (r.type === 'punish') {
                add(r, 'punish_candidate', { detail: `${r.detail}；刑需结合位置、力量及是否三刑成组，不机械等于刑灾。`, source_rule: 'BLIND-PUNISH-CORE-001' });
            }
            else if (r.type === 'generate' || r.type === 'control') {
                add(r, r.type === 'generate' ? 'dayun_generate_context' : 'dayun_control_context', { status: 'context', detail: `${r.detail}；生克可参与大运阶段判断，但本身不是具体流年事件结论。`, source_rule: 'BLIND-DAYUN-SHENGKE-001' });
            }
        }
        const { dy, ln, activeComponent, crossRelation } = context || {};
        if (ln && dy && crossRelation) {
            if (crossRelation === 'clash') {
                const activeChar = activeComponent === 'stem' ? dy.heavenly_stem : dy.earthly_branch;
                const inactiveChar = activeComponent === 'stem' ? dy.earthly_branch : dy.heavenly_stem;
                const incoming = activeComponent === 'stem' ? ln.earthly_branch : ln.heavenly_stem;
                add(null, activeComponent === 'stem' ? 'clash_activate_inactive_dayun' : 'clash_activate_inactive_dayun', { layer: 'liunian', raw_type: 'clash_dayun_cross_phase', status: 'fact', affects_role: 'dayun_context', detail: `流年${incoming}冲非当运部分${inactiveChar}，按盲派体用先取“冲起/提前引动”语义，不直接判凶。`, source_rule: 'BLIND-DAYUN-CROSS-PHASE-001' });
            }
            else if (crossRelation === 'combine') {
                add(null, 'combine_activate_dayun', { layer: 'liunian', raw_type: 'combine_dayun_cross_phase', status: 'fact', affects_role: 'dayun_context', detail: '流年与非当运的大运部分发生合，先按“合动/提前引动”处理，再回到整柱大运与原局解释。', source_rule: 'BLIND-DAYUN-CROSS-PHASE-001' });
            }
        }
        if (ln && dy) {
            const directActiveRel = activeComponent === 'stem' ? pairKey(ln.heavenly_stem, dy.heavenly_stem) : pairKey(ln.earthly_branch, dy.earthly_branch);
            const activeIsStem = activeComponent === 'stem';
            const isClash = activeIsStem ? STEM_CLASHES.has(directActiveRel) : BRANCH_CLASHES.has(directActiveRel);
            const isCombine = activeIsStem ? STEM_COMBINES.has(directActiveRel) : BRANCH_COMBINES.has(directActiveRel);
            if (isClash)
                add(null, 'clash_active_dayun_candidate', { layer: 'liunian', raw_type: 'clash_active_dayun', status: 'candidate', affects_role: 'dayun_context', detail: `流年冲当前当运${activeIsStem ? '运干' : '运支'}，核心资料先允许“冲去/暂时离开”候选，但是否为凶仍须看原局。`, alternatives: ['冲去', '暂时失效', '冲动'], source_rule: 'BLIND-DAYUN-ACTIVE-CLASH-001' });
            if (isCombine)
                add(null, 'combine_activate_active_dayun', { layer: 'liunian', raw_type: 'combine_active_dayun', status: 'fact', affects_role: 'dayun_context', detail: '流年合当前大运，先按合动处理；整柱大运仍需回接原局。', source_rule: 'BLIND-DAYUN-ACTIVE-COMBINE-001' });
        }
        return out;
    }
    resolveCurrentLiuYue(flowYear, nowClock) {
        const p = new LocalPaipan_1.LocalPaipan(), branches = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'], terms = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];
        const yearStemIndex = ((flowYear - 4) % 10 + 10) % 10, tigerStart = [2, 4, 6, 8, 0][yearStemIndex % 5];
        for (let i = 0; i < 12; i++) {
            const sy = i === 11 ? flowYear + 1 : flowYear, ey = i >= 10 ? flowYear + 1 : flowYear, startParts = p.getSolarTermParts(sy, terms[i]), endParts = p.getSolarTermParts(ey, i === 11 ? '立春' : terms[i + 1]);
            if (!startParts || !endParts)
                continue;
            const st = this.partsClockNumber(startParts), en = this.partsClockNumber(endParts);
            if (nowClock >= st && nowClock < en) {
                const stem = p.ctg[(tigerStart + i) % 10], branch = branches[i];
                return { pillar: stem + branch, heavenly_stem: stem, earthly_branch: branch, start_event: this.termPartsEvent(terms[i], startParts), end_event: this.termPartsEvent(i === 11 ? '立春' : terms[i + 1], endParts), rule: '以节令交接为流月边界，不按公历月初或农历初一切换' };
            }
        }
        return null;
    }
    termPartsEvent(term, parts) { const fmt = (p) => `${String(p[0]).padStart(4, '0')}-${String(p[1]).padStart(2, '0')}-${String(p[2]).padStart(2, '0')} ${String(p[3] || 0).padStart(2, '0')}:${String(p[4] || 0).padStart(2, '0')}:${String(p[5] || 0).padStart(2, '0')}`; return { term, window_start: fmt(parts), event_start_parts: [...parts], precision: 'exact_solar_term', time_basis: 'solar_term' }; }
    getChinaClockParts(date) {
        const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }), parts = {};
        for (const p of f.formatToParts(date))
            if (p.type !== 'literal')
                parts[p.type] = p.value;
        return [Number(parts.year), Number(parts.month), Number(parts.day), Number(parts.hour), Number(parts.minute), 0];
    }
    partsClockNumber(p) { return (((((p[0] * 100 + p[1]) * 100 + p[2]) * 100 + p[3]) * 100 + p[4]) * 100 + (p[5] || 0)); }
    parseLocalClock(v) { const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/.exec(String(v || '')); return m ? this.partsClockNumber(m.slice(1).map(Number).concat([0])) : 0; }
    luckRelationLabel(type) { return { same_char: '同字并临', combine: '合', clash: '冲', harm: '穿', break: '破', punish: '刑', generate: '生', control: '克', tomb_reach: '入墓候选', tonglu_appearance: '通禄到位', yuanshen_appearance: '原身到位', same_stem_appearance: '同干到位', same_branch_appearance: '同支到位', hidden_stem_manifestation: '藏干透出', hidden_form_appearance: '藏干形态到位', half_lu_candidate: '半禄候选', tomb_qi_representative: '墓气代表候选', residual_qi_representative: '余气代表候选' }[type] || type; }
    resolveBlindDaXian(chart, currentYear) {
        const birthYear = Number(chart?.birth_year || 0), rule = chart?.blind_daxian;
        if (!birthYear || !rule?.available)
            return { available: false, current_virtual_age: null, candidates: [], note: '缺少出生年份，不生成大限阶段' };
        const age = currentYear - birthYear + 1, cands = (rule.ranges || []).filter((r) => age >= Number(r.start_age || 0) && (r.end_age == null || age <= Number(r.end_age)));
        return { available: true, current_virtual_age: age, candidates: cands, primary: cands[cands.length - 1] || null, note: rule.note || '大限只作原局应期背景，不替代大运流年。' };
    }
    buildEvidenceTrace(facts, relations, semantics, roots, intents, qishi, ranked, mainline, timing) {
        const out = [];
        const push = (type, title, details, ruleIds = []) => out.push({ id: `E${String(out.length + 1).padStart(3, "0")}`, type, title, details: details.filter(Boolean), rule_ids: ruleIds });
        if (mainline.primary) {
            const p = mainline.primary;
            push("mainline", "第一做功主线", [p.title, statusLabel(p.status), `做功层级 ${p.gong_level || "—"}`, `做功方向 ${p.gongDirection || "—"}`, ownershipLabel(p.ownership?.result), p.rawReason], uniq(["MAINLINE-ARBITER-001", p.ruleId]));
            const relTexts = (p.relationIds || []).map(id => {
                const r = relations.find(x => x.id === id);
                if (!r)
                    return "";
                const ns = r.nodes.map(nid => facts.byId[nid]).filter(Boolean).map(simpleNodeLabel).join(" ↔ ");
                return `${r.type}: ${ns}`;
            });
            push("relation", "主线关系依据", relTexts, p.relationIds || []);
            const own = p.ownership;
            if (own)
                push("ownership", "成果归属", own.reasonChain || [], ["OWNERSHIP-001"]);
        }
        if (qishi.dominant)
            push("qishi", "气势辅助", [`${qishi.dominant.elements.join("、")}为当前加权优势气势`, `目标五行：${qishi.dominant.targetElement || "—"}`], ["QISHI-001"]);
        if (timing.available) {
            push("timing", "当前岁运", [timing.dayun?.pillar ? `大运 ${timing.dayun.pillar}` : "", timing.liunian?.ganzhi ? `流年 ${timing.liunian.year} ${timing.liunian.ganzhi}` : "", timing.liuyue?.pillar ? `流月 ${timing.liuyue.pillar}` : "", ...timing.triggers.map(t => t.detail)], ["TIMING-001"]);
            if (timing.stage_gate)
                push("timing_gate", "大运阶段门", [timing.stage_gate.status, timing.stage_gate.note, ...(timing.stage_gate.evidence || [])], ["BLIND-DAYUN-STAGE-GATE-001"]);
            if (timing.state_replay?.available) {
                const sr = timing.state_replay;
                push("state_replay", "第一主功状态重演", [
                    `原局：${sr.original?.title || '—'} · ${sr.original?.status || '—'}`,
                    sr.dayun ? `大运：${sr.dayun.state}` : '', sr.liunian ? `流年：${sr.liunian.state}` : '', sr.liuyue ? `流月：${sr.liuyue.state}` : '',
                    ...(sr.liunian?.evidence || sr.dayun?.evidence || []).slice(0, 5)
                ], ["BLIND-STATE-REPLAY-001"]);
            }
            const rootChanges = (timing.root_state_snapshot?.states || []).filter((x) => x.changed);
            if (rootChanges.length)
                push("root_state", "岁运根气状态", rootChanges.map((x) => `${x.stemChar}：${x.original_capacity} → ${x.current_capacity}`), ["BLIND-ROOT-STATE-REPLAY-001"]);
            const selectedIds = (timing.identity_resolutions || []).flatMap((x) => (x.selected || []));
            if (selectedIds.length)
                push("timing_identity", "岁运身份解析", selectedIds.map((x) => `${this.luckLayerName(x.layer)}：${x.detail} [${x.evidence_grade}]`), uniq(selectedIds.map((x) => x.source_rule)));
            if (timing.fan_ke_wei_zhu?.qualified)
                push("timing_identity", "反客为主", [timing.fan_ke_wei_zhu.note, ...(timing.fan_ke_wei_zhu.claims || []).map((x) => x.detail)], ["BLIND-FAN-KE-WEI-ZHU-001"]);
            const timingSem = (timing.timing_relation_semantics || []).filter((x) => x.layer === 'liunian');
            if (timingSem.length)
                push("timing_semantic", "岁运关系语义", timingSem.map((x) => `${x.semantic}：${x.detail}`), uniq(timingSem.map((x) => x.source_rule)));
            const tombEvidence = (timing.tomb_states || []).filter((x) => x.relevant);
            const tombActions = (timing.tomb_state_snapshot?.store_actions || []).filter((x) => x.relevant);
            if (tombEvidence.length || tombActions.length)
                push("tomb_state", "墓库当前状态", [...tombEvidence.map((x) => x.detail), ...tombActions.map((x) => x.detail)], uniq([...tombEvidence, ...tombActions].map((x) => x.source_rule)));
        }
        return out;
    }
    buildWarnings(chart, facts, mainline) {
        const out = [];
        if (!mainline.primary)
            out.push("未形成足够清晰的第一做功主线，系统已保守降级。 ");
        if (chart?.input_mode === "pillars" && !(chart.da_yun || []).some(d => d.start_year))
            out.push("四柱直排缺少完整出生年份/起运信息，当前岁运与具体流年不参与判定。 ");
        out.push("当前版本优先实现高确定性理法骨架；岁运只重演原局已成立的第一主功，不允许凭空换题。根气区分坐下直接根、长生/墓库/余气得气与外部支持；冲合、墓库开闭仍需语义仲裁。半禄、午酉破、自刑个案及部分根气扩展继续留在 Research Hold。 ");
        return out;
    }
    buildPresentation(result, chart) {
        const p = result.mainline.primary;
        const byId = result.facts.nodes.reduce((m, n) => (m[n.id] = n, m), {});
        const actor = byId[p?.actorNodes?.[0]], target = byId[p?.targetNodes?.[0]], bridge = byId[p?.bridgeNodes?.[0]], final = byId[p?.resultNodes?.[p?.resultNodes?.length - 1]];
        const timing = result.timing;
        const replayState = timing.state_replay?.liunian?.state || timing.state_replay?.dayun?.state || null;
        const replayLabel = { maintained: '主功维持', stage_engaged: '主功进入应验阶段', strengthened_candidate: '主功承载增强候选', altered_candidate: '主功结构改变候选', transformed_candidate: '组合结构改变候选' }[replayState] || '';
        const timingText = !timing.available ? "当前岁运未参与" : timing.stage_gate?.engaged === false ? "当前大运尚未承接主线，流年只保留应期线索" : timing.fan_ke_wei_zhu?.qualified ? `${replayLabel ? replayLabel + ' · ' : ''}当前流年形成反客为主身份候选，仍需回接原局裁决` : timing.effect === "identity_triggered" ? `${replayLabel ? replayLabel + ' · ' : ''}当前流年出现明确身份应期线索` : timing.effect === "state_changed" ? `${replayLabel || '主功状态已变化'}，具体吉凶仍按冲合语义、宾主与归属裁决` : timing.effect === "activated" ? `${replayLabel ? replayLabel + ' · ' : ''}当前流年已引动主线关系，具体属于冲动、冲去、合留等需继续裁决` : timing.effect === "stage_context" ? `${replayLabel ? replayLabel + ' · ' : ''}当前大运已承接主线，流年尚未形成足够直接的应期语义` : replayLabel || "当前岁运暂未形成明确应期结论";
        const summary = p ? this.pathSummary(p, actor, target, bridge, final) : "当前命局没有形成足够清晰的做功闭环，系统不强行套格局。";
        return {
            title: p?.title || "命局意向尚未形成闭环",
            type_label: p ? typeLabel(p.type) : "保守判定",
            status_label: p ? statusLabel(p.status) : "待校验",
            gong_level_label: p?.gong_level || "L0",
            summary,
            actor: actor ? { id: actor.id, label: simpleNodeLabel(actor), position: nodePositionLabel(actor) } : null,
            target: target ? { id: target.id, label: simpleNodeLabel(target), position: nodePositionLabel(target) } : null,
            bridge: bridge ? { id: bridge.id, label: simpleNodeLabel(bridge), position: nodePositionLabel(bridge) } : null,
            result: final ? { id: final.id, label: simpleNodeLabel(final), position: nodePositionLabel(final) } : null,
            ownership_label: p ? ownershipLabel(p.ownership?.result) : "归属未判",
            gong_direction_label: p?.gongDirection === "forward" ? "正向做功 · 主取宾" : p?.gongDirection === "reverse" ? "反向做功 · 宾制主用" : p?.gongDirection === "internal" ? "主位内部做功" : p?.gongDirection === "external" ? "宾位外部作用" : "主客混合作用",
            zheng_fan_label: p?.zhengFan === "zheng" ? "主线与命主意向同向" : p?.zhengFan === "fan" ? "主线存在反局风险" : "正反局暂不强判",
            timing_label: timingText,
            qishi_label: result.qishi.dominant ? `${result.qishi.dominant.elements.join("、")}气势较集中` : "未形成单一强势",
            secondary: result.mainline.secondary ? { title: result.mainline.secondary.title, type_label: typeLabel(result.mainline.secondary.type), status_label: statusLabel(result.mainline.secondary.status) } : null,
            evidence_count: result.evidence.length,
            engine_note: "确定性规则引擎 · 不依赖 AI 生成主线"
        };
    }
    pathSummary(path, actor, target, bridge, final) {
        const own = ownershipLabel(path.ownership?.result);
        if (path.type === "sheng_yong")
            return `${simpleNodeLabel(actor)}向${simpleNodeLabel(target)}形成真实相生，属于“食伤生财”路径；${own}。`;
        if (path.type === "zhi_yong")
            return `${simpleNodeLabel(actor)}对${simpleNodeLabel(target)}形成真实克制，当前按“${path.title}”识别；${own}。`;
        if (path.type === "he_yong")
            return `${simpleNodeLabel(actor)}直接合到${simpleNodeLabel(target)}，命主与目标存在直接取得/连接意向；${own}。`;
        if (path.type === "hua_yong")
            return `${simpleNodeLabel(actor)}经${simpleNodeLabel(bridge)}向主位转化，形成连续的官杀—印—主位路径；${own}。`;
        if (path.type === "mu_yong")
            return `${simpleNodeLabel(target)}与对应墓库形成候选关系，但“入墓、开闭、归属”仍按条件式处理，不直接等同得失。`;
        if (path.type === "composite")
            return `多条作用在同一节点衔接成复合做功，主线不是单一十神口诀，而是连续作用的结果；${own}。`;
        if (path.type === "xie_yong")
            return `${simpleNodeLabel(actor)}向${simpleNodeLabel(target)}形成输出，当前更接近“泄秀/表达”而非直接取财；${own}。`;
        return "当前以象法辅助理解，不强行把单一符号扩展为现实事件。";
    }
}
exports.BlindJudgmentEngine = BlindJudgmentEngine;
