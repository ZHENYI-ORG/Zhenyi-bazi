'use strict';
const assert = require('node:assert/strict');
const { BlindJudgmentEngine } = require('../dist/core/judgment/BlindJudgmentEngine');
const { computePaipan } = require('../dist/api');

const engine = new BlindJudgmentEngine();
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { console.error(`✗ ${name}`); throw e; }
}

function fakeChart(stems=['乙','辛','甲','己'], branches=['子','丑','寅','卯']) {
  const pk=['year','month','day','hour'];
  const bp={};
  pk.forEach((p,i)=>bp[`${p}_pillar`]={heavenly_stem:stems[i],earthly_branch:branches[i]});
  return {
    input_mode:'pillars', bazi:bp,
    shi_shen:{year_stem:'劫财',month_stem:'正官',day_stem:'日元',hour_stem:'正财',year_branch:'正印',month_branch:'偏财',day_branch:'比肩',hour_branch:'劫财'},
    hidden_stems:{year:[{stem:'癸',label:'本气',element:'水',shi_shen:'正印'}],month:[{stem:'己',label:'本气',element:'土',shi_shen:'正财'}],day:[{stem:'甲',label:'本气',element:'木',shi_shen:'比肩'}],hour:[{stem:'乙',label:'本气',element:'木',shi_shen:'劫财'}]},
    da_yun:[]
  };
}

test('普通日期排盘会附带盲派判盘结果', () => {
  const r=computePaipan({name:'回归A',gender:'male',birthday:'1990-01-01',birth_time:'12:00',longitude:120,birth_region:'杭州',is_lunar:false});
  assert.equal(r.ok,true);
  assert.ok(r.data.blind_judgment);
  assert.ok(r.data.blind_judgment.presentation.title);
  assert.ok(Array.isArray(r.data.blind_judgment.evidence));
});

test('女命普通日期同样可稳定生成', () => {
  const r=computePaipan({name:'回归B',gender:'female',birthday:'2000-05-12',birth_time:'08:30',longitude:121.47,birth_region:'上海',is_lunar:false});
  assert.equal(r.ok,true);
  assert.ok(r.data.blind_judgment.mainline.primary);
});

test('四柱直排缺年份时不虚构当前岁运', () => {
  const r=computePaipan({name:'直排',gender:'male',input_mode:'pillars',direct_pillars:{year:'己巳',month:'丙子',day:'丙寅',hour:'甲午'}});
  assert.equal(r.ok,true);
  assert.equal(r.data.blind_judgment.timing.available,false);
  assert.match(r.data.blind_judgment.timing.note,/不虚构|不参与/);
});

test('乙辛不被错误识别为天干五合，甲己会识别', () => {
  const j=engine.analyze(fakeChart());
  const rs=j.relations.filter(x=>x.type==='stem_combine');
  const chars=rs.map(r=>r.nodes.map(id=>j.facts.nodes.find(n=>n.id===id)?.char).join(''));
  assert.ok(chars.includes('甲己') || chars.includes('己甲'));
  assert.ok(!chars.includes('乙辛') && !chars.includes('辛乙'));
});

test('原局冲墓不会直接被写成开库', () => {
  const c=fakeChart(['甲','丙','戊','庚'],['辰','戌','子','午']);
  const j=engine.analyze(c);
  const clashIds=j.relations.filter(r=>r.type==='clash' && r.nodes.some(id=>j.facts.nodes.find(n=>n.id===id)?.char==='辰') && r.nodes.some(id=>j.facts.nodes.find(n=>n.id===id)?.char==='戌')).map(r=>r.id);
  const sem=j.relation_semantics.filter(s=>clashIds.includes(s.relationId));
  assert.ok(sem.length>0);
  assert.ok(sem.every(s=>s.semantic!=='store_open'));
});

test('所有路径都有明确状态，做功不会用布尔值粗暴表示', () => {
  const j=engine.analyze(fakeChart());
  const allowed=new Set(['effective','conditional','intent_only','broken','invalid']);
  assert.ok(j.gong_paths.every(p=>allowed.has(p.status)));
});

test('成果归属只使用四态枚举', () => {
  const j=engine.analyze(fakeChart());
  const allowed=new Set(['mostly_native','shared','mostly_external','unclear']);
  assert.ok(j.gong_paths.every(p=>allowed.has(p.ownership.result)));
});

test('同一命盘重复运行第一主线稳定', () => {
  const c=fakeChart();
  const a=engine.analyze(c), b=engine.analyze(c);
  assert.equal(a.mainline.primary?.title,b.mainline.primary?.title);
  assert.equal(a.mainline.primary?.type,b.mainline.primary?.type);
  assert.equal(a.mainline.primary?.ownership?.result,b.mainline.primary?.ownership?.result);
});

test('关系事实与关系语义分层输出', () => {
  const j=engine.analyze(fakeChart());
  assert.ok(j.relations.length>0);
  assert.ok(Array.isArray(j.relation_semantics));
  const generated=j.relations.find(r=>r.type==='generate');
  if(generated)assert.ok(j.relation_semantics.some(s=>s.relationId===generated.id&&s.semantic==='generate_flow'));
});

test('节点来源与根气分开记录', () => {
  const j=engine.analyze(fakeChart());
  assert.ok(Array.isArray(j.origins));
  const dayOrigin=j.origins.find(x=>x.nodeId==='original.day.stem');
  assert.ok(dayOrigin);
  assert.ok(Object.hasOwn(dayOrigin,'sourceSide'));
  assert.ok(Array.isArray(j.roots));
});

test('做功层级使用 L0-L5 序位而非财富金额', () => {
  const j=engine.analyze(fakeChart());
  const allowed=new Set(['L0','L1','L2','L3','L4','L5']);
  assert.ok(j.gong_paths.every(p=>allowed.has(p.gong_level)));
  assert.ok(!JSON.stringify(j).match(/百万级|千万级|亿级|厅级|省部级/));
});

test('主线证据可追溯到规则 ID', () => {
  const j=engine.analyze(fakeChart());
  const main=j.evidence.find(e=>e.type==='mainline');
  if(j.mainline.primary){
    assert.ok(main);
    assert.ok(main.rule_ids.includes('MAINLINE-ARBITER-001'));
    assert.ok(main.rule_ids.some(x=>String(x).startsWith('GONG-')));
  }
});



test('大运后五年流年天干冲非当运运干会重新引动', () => {
  const r=computePaipan({gender:'male',birthday:'1950-06-15',birth_time:'12:00',use_true_solar_time:false});
  assert.equal(r.ok,true,r.message||'timing clash source failed');
  const j=engine.analyze(r.data,{now:'1992-12-30T04:00:00Z'});
  assert.equal(j.timing.dayun.pillar,'丙戌');
  assert.equal(j.timing.dayun.active_component,'branch');
  assert.ok(j.timing.triggers.some(x=>x.type==='cross_phase_activate'&&x.relation==='clash'&&/重新引动丙运/.test(x.detail)));
});

test('岁运关系以结构化 luck_relations 输出，不只保留文字 trigger', () => {
  const r=computePaipan({gender:'male',birthday:'2005-03-15',birth_time:'10:00',use_true_solar_time:false});
  assert.equal(r.ok,true);
  const j=engine.analyze(r.data,{now:'2013-07-01T00:00:00Z'});
  assert.ok(Array.isArray(j.timing.luck_relations));
  assert.ok(j.timing.luck_relations.some(x=>['generate','control','combine','clash','harm','break','punish','same_char'].includes(x.type)));
});



test('固定原身双向身份成立，但辰戌丑未不主观配置原身', () => {
  const c=fakeChart(['乙','辛','甲','己'],['子','丑','寅','辰']);
  const facts=engine.buildFacts(c),all=new Set(facts.nodes.map(n=>n.id));
  const jia=engine.resolveLuckIdentities({layer:'liunian',stem:'甲',branch:null},facts,all);
  assert.ok(jia.claims.some(x=>x.type==='yuanshen_appearance'&&x.targetChar==='寅'&&x.evidence_grade==='A'));
  const wu=engine.resolveLuckIdentities({layer:'liunian',stem:'戊',branch:null},facts,all);
  assert.ok(!wu.claims.some(x=>x.type==='yuanshen_appearance'&&x.targetChar==='辰'));
});

test('岁运地支可让原局天干以藏干形式出现，半禄只作B级候选', () => {
  const facts=engine.buildFacts(fakeChart(['乙','辛','丁','己'],['子','丑','寅','辰'])),all=new Set();
  for(const n of facts.nodes)all.add(n.id);
  const chen=engine.resolveLuckIdentities({layer:'liunian',stem:null,branch:'辰'},facts,all);
  assert.ok(chen.claims.some(x=>x.type==='hidden_form_appearance'&&x.targetChar==='乙'&&x.evidence_grade==='A'));
  const wei=engine.resolveLuckIdentities({layer:'liunian',stem:null,branch:'未'},facts,all);
  assert.ok(wei.claims.some(x=>x.type==='half_lu_candidate'&&x.targetChar==='丁'&&x.evidence_grade==='B'&&x.major_eligible===false));
});

test('身份解析先于主线：乙到保留A级直接身份，B级课堂顺序只作提示', () => {
  const facts=engine.buildFacts(fakeChart(['乙','辛','甲','己'],['子','未','辰','卯'])),all=new Set();
  for(const n of facts.nodes)all.add(n.id);
  const onlyChen=new Set(facts.nodes.filter(x=>x.char==='辰').map(x=>x.id));
  const r=engine.resolveLuckIdentities({layer:'liunian',stem:'乙',branch:null},facts,onlyChen);
  assert.ok(r.claims.some(x=>x.targetChar==='乙'));
  assert.ok(r.claims.some(x=>x.targetChar==='未'&&x.evidence_grade==='B'));
  assert.ok(r.claims.some(x=>x.targetChar==='辰'&&x.evidence_grade==='B'));
  assert.ok(r.selected.some(x=>x.targetChar==='乙'&&x.evidence_grade==='A'));
  assert.ok(r.selected.some(x=>x.targetChar==='卯'&&x.evidence_grade==='A'));
  assert.ok(!r.selected.some(x=>['未','辰'].includes(x.targetChar)));
  assert.equal(r.resolution_order,'identity_first_then_mainline');
  assert.deepEqual(r.school_priority_hint.ordered_target_chars.slice(0,4),['卯','未','辰','乙']);
});

test('墓库状态只认稳定对应：寅入未，卯见未不自动入墓', () => {
  const a=engine.buildFacts(fakeChart(['甲','乙','丙','丁'],['子','丑','寅','未'])),aa=new Set();for(const n of a.nodes)aa.add(n.id);
  const sa=engine.resolveTombStates(a,[],aa);
  assert.ok(sa.some(x=>x.layer==='original'&&x.inmateChar==='寅'&&x.storeChar==='未'&&x.contained===true));
  const b=engine.buildFacts(fakeChart(['甲','乙','丙','丁'],['子','丑','卯','未'])),bb=new Set();for(const n of b.nodes)bb.add(n.id);
  const sb=engine.resolveTombStates(b,[],bb);
  assert.ok(!sb.some(x=>x.inmateChar==='卯'&&x.storeChar==='未'&&x.contained===true));
});

test('丑未辰同见时不机械判丑未入辰，冲墓只进入待仲裁状态', () => {
  const facts=engine.buildFacts(fakeChart(['甲','乙','丙','丁'],['子','丑','未','辰'])),all=new Set();for(const n of facts.nodes)all.add(n.id);
  const base=engine.resolveTombStates(facts,[],all);
  assert.ok(base.some(x=>x.inmateChar==='丑'&&x.storeChar==='辰'&&x.status==='blocked_by_chou_wei_clash'));
  assert.ok(base.some(x=>x.inmateChar==='未'&&x.storeChar==='辰'&&x.status==='blocked_by_chou_wei_clash'));
  const clash=engine.resolveTombStates(facts,[{layer:'liunian',branch:'戌'}],all);
  assert.ok(clash.some(x=>x.action==='clash_tomb_candidate'&&x.status==='needs_arbitration'));
  assert.ok(!JSON.stringify(clash).includes('store_open'));
});


test('盲派刑破专属白名单：子卯为破不为刑，常见六破和自刑不混入主规则', () => {
  const f1=engine.buildFacts(fakeChart(['甲','乙','丙','丁'],['子','卯','辰','午']));
  const r1=engine.buildRelations(f1);
  const pair=(type,a,b)=>r1.some(x=>x.type===type&&x.nodes.map(id=>f1.byId[id]?.char).sort().join('')===[a,b].sort().join(''));
  assert.ok(pair('break','子','卯'));
  assert.ok(!pair('punish','子','卯'));
  assert.ok(!r1.some(x=>x.type==='punish'&&x.nodes.every(id=>f1.byId[id]?.char==='午')));
  const f2=engine.buildFacts(fakeChart(['甲','乙','丙','丁'],['子','酉','丑','辰']));
  const r2=engine.buildRelations(f2);
  assert.ok(!r2.some(x=>x.type==='break'&&x.nodes.map(id=>f2.byId[id]?.char).sort().join('')==='子酉'.split('').sort().join('')));
  const f3=engine.buildFacts(fakeChart(['甲','乙','丙','丁'],['寅','巳','申','子']));
  const r3=engine.buildRelations(f3);
  assert.ok(r3.some(x=>x.type==='sanxing'));
  assert.ok(r3.some(x=>x.type==='harm'&&x.nodes.map(id=>f3.byId[id]?.char).sort().join('')==='寅巳'.split('').sort().join('')));
});

test('墓库当前状态按岁运重算：流年未到后撤销原先丑入辰的 active contained', () => {
  const facts=engine.buildFacts(fakeChart(['甲','乙','丙','丁'],['子','丑','酉','辰'])),all=new Set();for(const n of facts.nodes)all.add(n.id);
  const base=engine.resolveTombStateSnapshot(facts,[],all);
  assert.ok(base.states.some(x=>x.inmate_char==='丑'&&x.store_char==='辰'&&x.contained===true));
  const after=engine.resolveTombStateSnapshot(facts,[{layer:'liunian',branch:'未'}],all);
  assert.ok(after.states.some(x=>x.inmate_char==='丑'&&x.store_char==='辰'&&x.contained===false&&x.status==='blocked_by_chou_wei_clash'));
  assert.ok(!after.states.some(x=>x.inmate_char==='丑'&&x.store_char==='辰'&&x.contained===true));
  assert.equal(after.mode,'current_state_recompute');
});

test('大运阶段门未承接主线时，流年身份只能保留为线索', () => {
  const ids=[{layer:'dayun',selected:[]}];
  const gate=engine.buildDayunStageGate(ids,[],new Set(['original.day.branch']));
  assert.equal(gate.engaged,false);
  assert.equal(gate.status,'quiet');
});



test('流年以固定禄取得大运运干身份，可跨五年重新引动并形成反客为主候选', () => {
  const c=fakeChart(['庚','庚','庚','乙'],['子','辰','午','酉']);
  c.birth_year=1980;c.blind_daxian={available:true,ranges:[],note:''};
  c.da_yun=[{
    pillar:'甲申',heavenly_stem:'甲',earthly_branch:'申',start_year:2000,start_age:21,
    start_event:{window_start:'2000-01-01 00:00'},stem_to_branch_event:{window_start:'2005-01-01 00:00'},end_event:{window_start:'2010-01-01 00:00'},
    stem_phase:{name:'甲运'},branch_phase:{name:'申运'},
    liu_nian:[{year:2008,ganzhi:'戊寅',heavenly_stem:'戊',earthly_branch:'寅',liunian_start_event:{window_start:'2008-02-04 00:00'},liunian_end_event:{window_start:'2009-02-04 00:00'}}]
  }];
  const facts=engine.buildFacts(c),primary={actorNodes:['original.day.stem'],targetNodes:['original.hour.stem'],bridgeNodes:[],resultNodes:[]};
  const t=engine.resolveTiming(c,facts,[],primary,{now:'2008-06-01T00:00:00Z'});
  assert.equal(t.dayun.active_component,'branch');
  assert.ok(t.triggers.some(x=>x.type==='cross_phase_identity_activate'&&x.relation==='tonglu'&&/重新引动甲运/.test(x.detail)));
  assert.equal(t.fan_ke_wei_zhu.status,'qualified_by_dayun_identity');
  assert.ok(t.fan_ke_wei_zhu.claims.some(x=>x.type==='liunian_tonglu_dayun_stem'&&x.dayun_char==='甲'&&x.liunian_char==='寅'));
  assert.ok(t.timing_relation_semantics.some(x=>x.semantic==='clash_active_dayun_candidate'));
  assert.ok(t.future.every(x=>!('intensity' in x)&&!('level' in x)));
  assert.ok(t.future.every(x=>['timing_candidate','no_direct_trigger'].includes(x.status)));
});


test('根气分层：坐下通根与其它柱外援不再混成一个 root_score', () => {
  const c=fakeChart(['乙','辛','甲','己'],['寅','丑','子','卯']);
  c.hidden_stems={
    year:[{stem:'甲',label:'本气',element:'木',shi_shen:'比肩'},{stem:'丙',label:'中气',element:'火',shi_shen:'食神'},{stem:'戊',label:'余气',element:'土',shi_shen:'偏财'}],
    month:[{stem:'己',label:'本气',element:'土',shi_shen:'正财'},{stem:'辛',label:'中气',element:'金',shi_shen:'正官'},{stem:'癸',label:'余气',element:'水',shi_shen:'正印'}],
    day:[{stem:'癸',label:'本气',element:'水',shi_shen:'正印'}],
    hour:[{stem:'乙',label:'本气',element:'木',shi_shen:'劫财'}]
  };
  const facts=engine.buildFacts(c),roots=engine.resolveRoots(facts),day=roots.find(x=>x.stemNodeId==='original.day.stem');
  assert.equal(day.capacity_status,'external_support_only');
  assert.equal(day.actor_capable,false);
  assert.ok(day.external_support_strata.some(x=>x.branchNodeId==='original.year.branch'));
  assert.ok(!day.direct_root_strata.some(x=>x.branchNodeId==='original.year.branch'));
  assert.equal(day.score,null);
  assert.equal(day.score_deprecated,true);
});

test('根气分层：坐禄/坐墓/余气分别保留不同承载等级', () => {
  const mk=(dayBranch,hiddenDay)=>{const c=fakeChart(['乙','辛','甲','己'],['子','丑',dayBranch,'卯']);c.hidden_stems={...c.hidden_stems,day:hiddenDay};return engine.resolveRoots(engine.buildFacts(c)).find(x=>x.stemNodeId==='original.day.stem');};
  const lu=mk('寅',[{stem:'甲',label:'本气',element:'木',shi_shen:'比肩'},{stem:'丙',label:'中气',element:'火',shi_shen:'食神'},{stem:'戊',label:'余气',element:'土',shi_shen:'偏财'}]);
  assert.equal(lu.capacity_status,'strong_direct_root');
  assert.ok(lu.direct_root_strata.some(x=>x.kind==='seat_lu_root'));
  const tomb=mk('未',[{stem:'己',label:'本气',element:'土',shi_shen:'正财'},{stem:'乙',label:'中气',element:'木',shi_shen:'劫财'},{stem:'丁',label:'余气',element:'火',shi_shen:'伤官'}]);
  assert.equal(tomb.capacity_status,'medium_qi');
  assert.ok(tomb.direct_root_strata.some(x=>x.kind==='seat_tomb_qi'));
  const residual=mk('辰',[{stem:'戊',label:'本气',element:'土',shi_shen:'偏财'},{stem:'癸',label:'中气',element:'水',shi_shen:'正印'},{stem:'乙',label:'余气',element:'木',shi_shen:'劫财'}]);
  assert.equal(residual.capacity_status,'weak_qi');
  assert.ok(residual.direct_root_strata.some(x=>x.kind==='seat_residual_qi'));
});

test('大运阶段门收紧：只有普通生克背景时不打开重大应期门', () => {
  const gate=engine.buildDayunStageGate([{layer:'dayun',selected:[]}],[{layer:'dayun',type:'generate',targetNodeId:'original.day.branch',detail:'大运生原局节点'}],new Set(['original.day.branch']),{engaged:false,evidence:[]});
  assert.equal(gate.engaged,false);
  assert.equal(gate.status,'context_only');
  assert.equal(gate.strength,'shengke_context_only');
});

test('State Replay：原局合逢大运冲只记“原合被解候选”，不直接判反局或完成', () => {
  const c=fakeChart(['甲','乙','丙','丁'],['亥','丑','寅','卯']);
  c.hidden_stems={year:[{stem:'壬',label:'本气',element:'水',shi_shen:'七杀'},{stem:'甲',label:'中气',element:'木',shi_shen:'偏印'}],month:[{stem:'己',label:'本气',element:'土',shi_shen:'伤官'}],day:[{stem:'甲',label:'本气',element:'木',shi_shen:'偏印'},{stem:'丙',label:'中气',element:'火',shi_shen:'比肩'},{stem:'戊',label:'余气',element:'土',shi_shen:'食神'}],hour:[{stem:'乙',label:'本气',element:'木',shi_shen:'正印'}]};
  const facts=engine.buildFacts(c),rels=engine.buildRelations(facts);
  const comb=rels.find(r=>r.type==='branch_combine'&&r.nodes.includes('original.year.branch')&&r.nodes.includes('original.day.branch'));
  assert.ok(comb);
  const primary={id:'PTEST',title:'测试主线',type:'he_yong',status:'effective',actorNodes:['original.day.branch'],targetNodes:['original.year.branch'],bridgeNodes:[],resultNodes:['original.day.branch'],relationIds:[comb.id]};
  const sem=[{layer:'dayun',semantic:'clash_move_candidate',targetNodeId:'original.day.branch',status:'candidate',detail:'大运申冲原局寅',source_rule:'BLIND-CLASH-SEMANTICS-001'}];
  const replay=engine.replayMainlineState(primary,facts,rels,[],sem,[],{store_actions:[]},{states:[]},{snapshots:[]});
  assert.equal(replay.mode,'original_mainline_state_replay');
  assert.equal(replay.dayun.engaged,true);
  assert.equal(replay.dayun.state,'altered_candidate');
  assert.ok(replay.dayun.changes.some(x=>x.type==='original_combine_released_candidate'));
  assert.ok(!JSON.stringify(replay.dayun).includes('reversed'));
});

test('岁运根气快照：流年见禄可增强当前承载，但不回写原局根气', () => {
  const c=fakeChart(['乙','辛','甲','己'],['子','丑','子','卯']);
  c.hidden_stems={...c.hidden_stems,day:[{stem:'癸',label:'本气',element:'水',shi_shen:'正印'}]};
  const facts=engine.buildFacts(c),roots=engine.resolveRoots(facts),snap=engine.resolveLuckRootState(facts,roots,[{layer:'liunian',branch:'寅'}]);
  const day=snap.states.find(x=>x.stemNodeId==='original.day.stem');
  assert.equal(day.original_capacity,'external_support_only');
  assert.equal(day.current_capacity,'luck_strengthened');
  assert.ok(day.luck_additions.some(x=>x.kind==='luck_lu_root'&&x.layer==='liunian'));
  assert.equal(roots.find(x=>x.stemNodeId==='original.day.stem').capacity_status,'external_support_only');
});


test('岁运根气分阶段：流年见禄不会反写大运阶段容量', () => {
  const c=fakeChart(['乙','辛','甲','己'],['子','丑','子','卯']);
  c.hidden_stems={...c.hidden_stems,day:[{stem:'癸',label:'本气',element:'水',shi_shen:'正印'}]};
  const facts=engine.buildFacts(c),roots=engine.resolveRoots(facts);
  const snap=engine.resolveLuckRootState(facts,roots,[{layer:'dayun',branch:'丑'},{layer:'liunian',branch:'寅'}]);
  const day=snap.states.find(x=>x.stemNodeId==='original.day.stem');
  assert.equal(day.original_capacity,'external_support_only');
  assert.equal(day.stage_capacities.dayun.capacity,'external_support_only');
  assert.equal(day.stage_capacities.dayun.changed,false);
  assert.equal(day.stage_capacities.liunian.capacity,'luck_strengthened');
  assert.equal(day.stage_capacities.liunian.changed,true);
  assert.ok(day.stage_capacities.liunian.additions.some(x=>x.kind==='luck_lu_root'&&x.layer==='liunian'));
});

test('组合状态按首次形成计：大运已成三合，流年不重复标记 newly_formed', () => {
  const c=fakeChart(['乙','辛','甲','己'],['巳','酉','子','卯']);
  const facts=engine.buildFacts(c);
  const comp=engine.resolveCompositeLuckState(facts,[{layer:'dayun',branch:'丑'},{layer:'liunian',branch:'午'},{layer:'liuyue',branch:'申'}],new Set(facts.branches));
  const dy=comp.snapshots.find(x=>x.stage==='dayun').formations.find(x=>x.kind==='sanhe'&&x.branches.join('')==='巳酉丑');
  const ly=comp.snapshots.find(x=>x.stage==='liunian').formations.find(x=>x.kind==='sanhe'&&x.branches.join('')==='巳酉丑');
  const lm=comp.snapshots.find(x=>x.stage==='liuyue').formations.find(x=>x.kind==='sanhe'&&x.branches.join('')==='巳酉丑');
  assert.ok(dy&&ly&&lm);
  assert.equal(dy.first_formed_stage,'dayun');
  assert.equal(dy.newly_formed,true);
  assert.equal(ly.first_formed_stage,'dayun');
  assert.equal(ly.newly_formed,false);
  assert.equal(lm.newly_formed,false);
  assert.equal(dy.transformation,'not_auto_assumed');
});

console.log(`\nJudgment regression: ${passed}/${passed} passed`);
