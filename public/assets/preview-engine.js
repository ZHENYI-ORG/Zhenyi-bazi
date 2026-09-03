(function (global) {
  'use strict';
  const SEASONS = { 寅:'春', 卯:'春', 辰:'春', 巳:'夏', 午:'夏', 未:'夏', 申:'秋', 酉:'秋', 戌:'秋', 亥:'冬', 子:'冬', 丑:'冬' };
  const CLASH = new Set(['子午','丑未','寅申','卯酉','辰戌','巳亥']);
  const COMBINE = new Set(['子丑','寅亥','卯戌','辰酉','巳申','午未']);
  const HARM = new Set(['子未','丑午','寅巳','卯辰','申亥','酉戌']);
  const PUNISH = new Set(['辰','午','酉','亥']);
  const STEM_COMBINE = new Set(['甲己','乙庚','丙辛','丁壬','戊癸']);
  let book = null;

  function pair(a, b) { return [a, b].sort().join(''); }
  function hash(value) { let h = 2166136261; for (const ch of String(value || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function stemsAndBranches(data) {
    const b = data?.bazi || {};
    const positions = ['year','month','day','hour'];
    return {
      stems: positions.map(k => b[`${k}_pillar`]?.heavenly_stem || ''),
      branches: positions.map(k => b[`${k}_pillar`]?.earthly_branch || ''),
      positions
    };
  }
  function featureBag(data) {
    const { stems, branches, positions } = stemsAndBranches(data);
    const ss = data?.shi_shen || {};
    const hidden = data?.hidden_stems || {};
    const gods = [ss.year_stem, ss.month_stem, ss.day_branch, ss.hour_stem]
      .concat(positions.flatMap(k => (hidden[k] || []).map(x => x?.shi_shen).filter(Boolean))).filter(Boolean);
    const counts = gods.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});
    return {
      stems, branches, positions,
      dayStem: stems[2], monthBranch: branches[1], season: SEASONS[branches[1]],
      shiShen: ss, hidden, godCounts: counts,
      repeatedGods: Object.keys(counts).filter(k => counts[k] >= 2)
    };
  }
  function detect(rule, f) {
    const p = rule.params || {};
    switch (rule.detector) {
      case 'daymaster_season': return !!f.dayStem && !!f.season && p.day_stem === f.dayStem && p.season === f.season;
      case 'ten_god_at_position': {
        const value = p.position === 'day_branch' ? f.shiShen.day_branch : f.shiShen[`${p.position}_stem`];
        return value === p.ten_god;
      }
      case 'ten_god_state': return p.state === 'repeated' && f.repeatedGods.includes(p.ten_god);
      case 'self_punishment': return f.branches.filter(x => x === p.branch).length >= 2 && PUNISH.has(p.branch);
      case 'branch_relation_positions': {
        const indexes = (p.positions || []).map(x => f.positions.indexOf(x));
        if (indexes.some(i => i < 0)) return false;
        const key = pair(f.branches[indexes[0]], f.branches[indexes[1]]);
        return p.relation === '冲' ? CLASH.has(key) : p.relation === '合' ? COMBINE.has(key) : p.relation === '穿' || p.relation === '害' ? HARM.has(key) : false;
      }
      case 'stem_relation': {
        const hasPair = STEM_COMBINE.has(pair(p.pair?.[0], p.pair?.[1])) && f.stems.includes(p.pair?.[0]) && f.stems.includes(p.pair?.[1]);
        if (!hasPair) return false;
        return p.role === 'involves_daymaster' ? f.dayStem === p.pair?.[0] || f.dayStem === p.pair?.[1] : p.role === 'external_only' ? f.dayStem !== p.pair?.[0] && f.dayStem !== p.pair?.[1] : true;
      }
      // Source/structure/adjudication rules require the full MP2 action graph.
      // They remain false until their explicit detector is implemented; never guess a hit.
      default: return false;
    }
  }
  function score(rule) {
    const p = rule.params || {};
    const specificity = Math.min(Object.keys(p).length, 5) * 2;
    const familyBonus = rule.family === 'daymaster_season_fallback' ? -20 : 0;
    return Number(rule.priority || 0) + specificity + Number(rule.hook_strength || 0) + familyBonus;
  }
  function pick(data, profile) {
    const f = featureBag(data);
    if (!book || !f.dayStem || !f.monthBranch) return { fallback: true, f };
    const candidates = book.rules.filter(rule => detect(rule, f)).map(rule => ({ rule, score: score(rule) }));
    candidates.sort((a, b) => b.score - a.score || String(a.rule.id).localeCompare(String(b.rule.id)));
    const selected = candidates[0]?.rule || book.rules.find(r => r.family === 'daymaster_season_fallback' && r.params?.day_stem === f.dayStem && r.params?.season === f.season) || null;
    return { f, selected, candidateCount: candidates.length, profile };
  }
  function opening(data, profile, f) {
    const cfg = book?.opening_renderer;
    if (!cfg || !f?.dayStem || !f?.monthBranch) return '';
    const stem = cfg.stem_profiles?.[f.dayStem];
    const gender = cfg.gender_labels?.[profile?.gender] || cfg.gender_labels?.unknown || '命主';
    const frame = cfg.opening_frames?.[hash(`${f.stems.join('')}${f.branches.join('')}${profile?.gender || ''}`) % cfg.opening_frames.length] || '';
    const seasonLine = cfg.season_lines?.[`${stem?.element || ''}-${f.season}`] || '';
    return frame.replaceAll('{gender}', gender).replaceAll('{dm}', stem?.label || `${f.dayStem}日主`).replaceAll('{month}', f.monthBranch).replaceAll('{season_line}', seasonLine);
  }
  async function load() {
    if (book) return book;
    try { book = await fetch('./assets/preview-rules-v3.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null); } catch { book = null; }
    return book;
  }
  function render(data, profile) {
    const generic = book?.chart_generic_fallback || {};
    const none = book?.no_chart_preview || {};
    if (!data?.bazi?.day_pillar) return { title: none.title || '人生作弊指南 · 命局点睛', opening: '', visible: none.text || '', teaser: '', tags: [], meta: '完成排盘后生成', ruleId: 'no_chart_preview' };
    const result = pick(data, profile), selected = result.selected;
    if (!selected) return { title: generic.title || '人生作弊指南 · 命局点睛', opening: opening(data, profile, result.f), visible: generic.text || '', teaser: '', tags: [], meta: '通用命局预览', ruleId: 'chart_generic_fallback' };
    return {
      title: book?.conversion_contract?.default_title || '人生作弊指南 · 命局点睛',
      opening: opening(data, profile, result.f),
      visible: selected.visible_body || '',
      teaser: selected.fade_teaser || '',
      tags: [`${result.f.dayStem}${book?.opening_renderer?.stem_profiles?.[result.f.dayStem]?.element || ''}`, result.f.season || '命局', selected.family === 'daymaster_season_fallback' ? '气象底色' : '命局主线'],
      meta: `规则预览 · ${selected.id}`,
      ruleId: selected.id
    };
  }
  global.ZHENYI_PREVIEW_ENGINE = { load, render };
})(window);
