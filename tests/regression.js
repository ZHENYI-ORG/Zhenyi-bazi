const assert=require('node:assert/strict');
const vectors=require('./regression-vectors.json');
const {computePaipan}=require('../dist/api.js');
function pick(data){
  const b=data.bazi;
  return {
    solar_time:data.solar_time,
    pillars:['year_pillar','month_pillar','day_pillar','hour_pillar'].map(k=>b[k].heavenly_stem+b[k].earthly_branch),
    qiyun:data.qiyun,
    jiaoyun:data.jiaoyun?{year:data.jiaoyun.year,month:'',day:'',desc:data.jiaoyun.desc,rule:data.jiaoyun.rule}:data.jiaoyun,
    day_master:data.day_master.stem,
    shen_sha:data.shen_sha,
    da_yun_first:[data.da_yun[0].pillar,data.da_yun[0].start_year,data.da_yun[0].start_age],
    jieqi_desc:data.jieqi_desc
  };
}
let passed=0;
for(const v of vectors){
  const r=computePaipan(v.input);
  assert.equal(r.ok,true,`${v.id}: ${r.message||'failed'}`);
  assert.deepStrictEqual(pick(r.data),v.expected,`${v.id}: regression mismatch`);
  passed++;
}
for(const [input,msg] of [
  [{},'请填写完整的出生日期和时间'],
  [{birthday:'1990-06-15',birth_time:'12:00',longitude:0},'启用真太阳时时，请填写有效的出生地经度'],
  [{birthday:'bad',birth_time:'12:00',longitude:120},'请填写完整的出生日期和时间']
]){
  const r=computePaipan(input);assert.equal(r.ok,false);assert.equal(r.message,msg);passed++;
}
console.log(`Regression tests passed: ${passed}/${passed}`);

// Migration-fix regression coverage.
const {LocalPaipan}=require('../dist/core/LocalPaipan.js');
const {TrueSolarTimeCalculator}=require('../dist/core/TrueSolarTimeCalculator.js');
const engine=new LocalPaipan();

for(const [solar,expected] of [
  ['1919-01-01',[1918,11,30,0]],
  ['1938-01-01',[1937,11,30,0]],
  ['1984-01-01',[1983,11,29,0]],
  ['1984-01-02',[1983,11,30,0]],
  ['2052-01-01',[2051,11,30,0]],
]){
  const [y,m,d]=solar.split('-').map(Number);
  assert.deepStrictEqual(engine.Solar2Lunar(y,m,d),expected,`${solar}: Solar2Lunar boundary mismatch`);
  passed++;
}

for(const [input,msg] of [
  [{birthday:'2024-02-31',birth_time:'12:00',longitude:120},'出生日期无效'],
  [{birthday:'2024-01-01',birth_time:'25:99',longitude:120},'出生时间无效'],
  [{birthday:'2020-01-30',birth_time:'12:00',longitude:120,is_lunar:true},'农历出生日期无效'],
  [{birthday:'2020-01-01',birth_time:'12:00',longitude:120,is_lunar:true,is_leap:true},'农历出生日期无效'],
]){
  const r=computePaipan(input);assert.equal(r.ok,false);assert.equal(r.message,msg);passed++;
}

const lunarInput=computePaipan({birthday:'2020-01-01',birth_time:'12:00',longitude:120,is_lunar:true,gender:'male'});
assert.equal(lunarInput.ok,true,lunarInput.message||'lunar input failed');
assert.equal(lunarInput.data.solar_date,'2020-01-25');
assert.deepStrictEqual(
  [lunarInput.data.lunar.year,lunarInput.data.lunar.month,lunarInput.data.lunar.day,lunarInput.data.lunar.is_leap],
  [2020,1,1,false]
);
assert.equal(lunarInput.data.lunar.text,'2020年正月初一');
passed++;

const info=engine.GetInfo(0,1990,6,15,12,0,0);
for(const key of ['day_cs','year_cs','month_cs','hour_cs']){
  assert.equal(Array.isArray(info[key]),true,`${key} missing`);
  assert.equal(info[key].length,4,`${key} length mismatch`);
}
passed++;

for(const [tg,dz,name] of [[0,6,'沙中金'],[6,6,'路旁土'],[0,8,'泉中水'],[2,10,'屋上土'],[6,4,'白蜡金'],[8,0,'桑柘木']]){
  assert.equal(engine.naYin(tg,dz)[0],name,`nayin mismatch for ${engine.ctg[tg]}${engine.cdz[dz]}`);
}
passed++;

assert.throws(()=>TrueSolarTimeCalculator.calculate('2024-02-31','12:00',120),/出生日期无效/);
assert.throws(()=>TrueSolarTimeCalculator.calculate('2024-01-01','25:99',120),/出生时间无效/);
passed++;

console.log(`Extended regression total: ${passed}/${passed}`);


// v1.0.11 source audit fixes
const shenshaCase=computePaipan({birthday:'1990-01-01',birth_time:'00:00',longitude:116.4,gender:'male'});
assert.equal(shenshaCase.ok,true,shenshaCase.message||'shensha case failed');
assert.equal(Array.isArray(shenshaCase.data.da_yun[0].shen_sha),true,'da_yun shen_sha should be array');
assert.equal(Array.isArray(shenshaCase.data.da_yun[0].liu_nian[0].shen_sha),true,'liu_nian shen_sha should be array');
passed++;

const strictBool1=computePaipan({birthday:'1990-01-01',birth_time:'12:00',longitude:120,is_lunar:'false',gender:'male'});
assert.equal(strictBool1.ok,true,'string false should normalize to false');
assert.equal(strictBool1.data.solar_date,'1990-01-01');
passed++;

const strictBool2=computePaipan({birthday:'1990-01-01',birth_time:'12:00',longitude:120,is_lunar:'0',gender:'male'});
assert.equal(strictBool2.ok,true,'string 0 should normalize to false');
assert.equal(strictBool2.data.solar_date,'1990-01-01');
passed++;

const badBool=computePaipan({birthday:'1990-01-01',birth_time:'12:00',longitude:120,is_lunar:'not-bool',gender:'male'});
assert.equal(badBool.ok,false);
assert.equal(badBool.message,'布尔参数格式无效');
passed++;

const badGender=computePaipan({birthday:'1990-01-01',birth_time:'12:00',longitude:120,gender:'xxx'});
assert.equal(badGender.ok,false);
assert.equal(badGender.message,'性别参数无效');
passed++;

const {ShenShaMatcher}=require('../dist/core/ShenShaMatcher.js');
const matcher=new ShenShaMatcher();
const sample={年柱:{gan:'己',zhi:'巳'},月柱:{gan:'丙',zhi:'子'},日柱:{gan:'丙',zhi:'寅'},时柱:{gan:'戊',zhi:'子'}};
const maleRules=matcher.matchAll(sample,{}, {gender:'1'}).filter(x=>x.name==='元辰');
const femaleRules=matcher.matchAll(sample,{}, {gender:'2'}).filter(x=>x.name==='元辰');
assert.equal(maleRules.length<=1,true,'male 元辰 should not hit both gender rules');
assert.equal(femaleRules.length<=1,true,'female 元辰 should not hit both gender rules');
passed++;

console.log(`Audit fixes total: ${passed}/${passed}`);

// v1.0.20 location rigor: datetime mode must never fall back to a fake/default longitude
const missingLocation=computePaipan({birthday:'1990-01-01',birth_time:'12:00',gender:'male'});
assert.equal(missingLocation.ok,false);
assert.match(missingLocation.message,/出生地经度/);
passed++;

// v1.0.20 four-pillars direct-input coverage
const direct=computePaipan({name:'直排',gender:'male',input_mode:'pillars',direct_pillars:{year:'甲子',month:'丙寅',day:'甲子',hour:'甲子'}});
assert.equal(direct.ok,true,direct.message||'direct pillars failed');
assert.deepStrictEqual(
  ['year_pillar','month_pillar','day_pillar','hour_pillar'].map(k=>direct.data.bazi[k].heavenly_stem+direct.data.bazi[k].earthly_branch),
  ['甲子','丙寅','甲子','甲子']
);
assert.equal(direct.data.input_mode,'pillars');
assert.equal(direct.data.solar_time,'');
assert.equal(direct.data.da_yun[0].pillar,'丁卯');
assert.equal(direct.data.da_yun[0].start_year,null);
assert.deepStrictEqual(direct.data.da_yun[0].liu_nian,[]);
passed++;

const directTimed=computePaipan({name:'直排',gender:'male',input_mode:'pillars',direct_pillars:{year:'甲子',month:'丙寅',day:'甲子',hour:'甲子'},direct_birth_year:1984,direct_qiyun_year:7,direct_qiyun_month:4});
assert.equal(directTimed.ok,true,directTimed.message||'direct timed pillars failed');
assert.deepStrictEqual(directTimed.data.qiyun,{year:7,month:4,day:0,hour:0,virtual_age:true,method:'manual_blind'});
assert.equal(directTimed.data.da_yun[0].start_age,7);
assert.equal(directTimed.data.da_yun[0].start_year,1990);
assert.equal(directTimed.data.da_yun[0].liu_nian.length,10);
passed++;

const badDirectGanzhi=computePaipan({gender:'male',input_mode:'pillars',direct_pillars:{year:'甲丑',month:'丙寅',day:'甲子',hour:'甲子'}});
assert.equal(badDirectGanzhi.ok,false);
assert.match(badDirectGanzhi.message,/不是合法六十甲子/);
passed++;

const badFiveTiger=computePaipan({gender:'male',input_mode:'pillars',direct_pillars:{year:'甲子',month:'戊寅',day:'甲子',hour:'甲子'}});
assert.equal(badFiveTiger.ok,false);
assert.match(badFiveTiger.message,/五虎遁/);
passed++;

const badFiveRat=computePaipan({gender:'male',input_mode:'pillars',direct_pillars:{year:'甲子',month:'丙寅',day:'甲子',hour:'戊子'}});
assert.equal(badFiveRat.ok,false);
assert.match(badFiveRat.message,/五鼠遁/);
passed++;

const badDirectYear=computePaipan({gender:'male',input_mode:'pillars',direct_pillars:{year:'甲子',month:'丙寅',day:'甲子',hour:'甲子'},direct_birth_year:1990});
assert.equal(badDirectYear.ok,false);
assert.match(badDirectYear.message,/出生年份 1990 与年柱 甲子 不一致/);
passed++;

console.log(`v1.0.20 direct-pillars total: ${passed}/${passed}`);


// v1.4.0 盲派排盘口径：真太阳时可选、0点换日、早晚子时、粗略起运、干支分运、纳音交运。
const civilNoLocation=computePaipan({birthday:'2010-12-09',birth_time:'23:30',gender:'male',use_true_solar_time:false});
assert.equal(civilNoLocation.ok,true,civilNoLocation.message||'civil-time mode failed');
assert.equal(civilNoLocation.data.use_true_solar_time,false);
assert.equal(civilNoLocation.data.time_basis,'civil');
assert.equal(civilNoLocation.data.effective_time,'2010-12-09 23:30');
assert.deepStrictEqual(
  ['day_pillar','hour_pillar'].map(k=>civilNoLocation.data.bazi[k].heavenly_stem+civilNoLocation.data.bazi[k].earthly_branch),
  ['癸巳','甲子']
);
assert.equal(civilNoLocation.data.zi_hour_variant,'night');
passed++;

const earlyZi=computePaipan({birthday:'2010-12-09',birth_time:'00:30',gender:'male',use_true_solar_time:false});
assert.equal(earlyZi.ok,true,earlyZi.message||'early-zi mode failed');
assert.deepStrictEqual(
  ['day_pillar','hour_pillar'].map(k=>earlyZi.data.bazi[k].heavenly_stem+earlyZi.data.bazi[k].earthly_branch),
  ['癸巳','壬子']
);
assert.equal(earlyZi.data.zi_hour_variant,'early');
passed++;

const blindQiyun=computePaipan({birthday:'2005-03-15',birth_time:'10:00',gender:'male',use_true_solar_time:false});
assert.equal(blindQiyun.ok,true,blindQiyun.message||'blind qiyun case failed');
assert.equal(blindQiyun.data.qiyun.year,3);
assert.equal(blindQiyun.data.qiyun.virtual_age,true);
assert.equal(blindQiyun.data.qiyun.source_days,10);
assert.equal(blindQiyun.data.da_yun[0].start_age,3);
assert.equal(blindQiyun.data.da_yun[0].start_year,2007);
assert.deepStrictEqual(
  [blindQiyun.data.da_yun[0].stem_phase.name,blindQiyun.data.da_yun[0].stem_phase.start_age,blindQiyun.data.da_yun[0].branch_phase.name,blindQiyun.data.da_yun[0].branch_phase.start_age],
  ['戊运',3,'寅运',8]
);
assert.match(blindQiyun.data.jiaoyun.desc,/水命：冬至前3日亥时交运/);
assert.equal(blindQiyun.data.da_yun[0].liu_nian[0].active_dayun_component,'stem');
assert.equal(blindQiyun.data.da_yun[0].liu_nian[5].active_dayun_component,'branch');
passed++;

const directNightZi=computePaipan({gender:'male',input_mode:'pillars',direct_pillars:{year:'庚寅',month:'戊子',day:'癸巳',hour:'甲子'},direct_birth_year:2010,direct_qiyun_year:9});
assert.equal(directNightZi.ok,true,directNightZi.message||'direct night-zi validation failed');
assert.equal(directNightZi.data.zi_hour_variant,'night');
passed++;

console.log(`v1.4.0 blind-paipan total: ${passed}/${passed}`);


// v1.5.0 盲派岁运引擎：真实交运窗口、交运年双阶段、大限背景。
const exactJiaoyun=computePaipan({birthday:'2005-03-15',birth_time:'10:00',gender:'male',use_true_solar_time:false});
assert.equal(exactJiaoyun.ok,true,exactJiaoyun.message||'v1.5 exact jiaoyun failed');
assert.equal(exactJiaoyun.data.jiaoyun.first_event.date,'2007-12-20');
assert.equal(exactJiaoyun.data.jiaoyun.first_event.hour_branch,'亥');
assert.equal(exactJiaoyun.data.jiaoyun.first_event.counting_mode,'traditional_inclusive');
assert.equal(exactJiaoyun.data.jiaoyun.first_event.calendar_offset_days,-2);
assert.equal(exactJiaoyun.data.jiaoyun.first_event.traditional_count_days,-3);
assert.equal(exactJiaoyun.data.jiaoyun.first_event.window_start,'2007-12-20 21:00');
assert.equal(exactJiaoyun.data.jiaoyun.first_event.window_end,'2007-12-20 23:00');
assert.equal(exactJiaoyun.data.da_yun[0].stem_to_branch_event.date,'2012-12-19');
assert.equal(exactJiaoyun.data.da_yun[0].liu_nian[0].is_transition_year,true);
assert.match(exactJiaoyun.data.da_yun[0].liu_nian[0].dayun_phase,/未起运→戊运/);
assert.equal(exactJiaoyun.data.da_yun[0].liu_nian[5].is_transition_year,true);
assert.match(exactJiaoyun.data.da_yun[0].liu_nian[5].dayun_phase,/戊运→寅运/);
assert.equal(exactJiaoyun.data.blind_daxian.available,true);
passed++;

const {BlindJudgmentEngine}=require('../dist/core/judgment/BlindJudgmentEngine.js');
const timingEngine=new BlindJudgmentEngine();
const beforeHalf=timingEngine.analyze(exactJiaoyun.data,{now:'2012-06-01T00:00:00Z'}).timing;
assert.equal(beforeHalf.dayun.pillar,'戊寅');assert.equal(beforeHalf.dayun.active_component,'stem');assert.equal(beforeHalf.dayun.phase,'戊运');
const afterHalf=timingEngine.analyze(exactJiaoyun.data,{now:'2012-12-20T14:00:00Z'}).timing;
assert.equal(afterHalf.dayun.pillar,'戊寅');assert.equal(afterHalf.dayun.active_component,'branch');assert.equal(afterHalf.dayun.phase,'寅运');
const beforeNext=timingEngine.analyze(exactJiaoyun.data,{now:'2017-06-01T00:00:00Z'}).timing;
assert.equal(beforeNext.dayun.pillar,'戊寅');assert.equal(beforeNext.dayun.active_component,'branch');
const afterNext=timingEngine.analyze(exactJiaoyun.data,{now:'2017-12-21T00:00:00Z'}).timing;
assert.equal(afterNext.dayun.pillar,'丁丑');assert.equal(afterNext.dayun.active_component,'stem');
passed++;

console.log(`v1.5.0 timing total: ${passed}/${passed}`);

// v1.6.0 全球真太阳时 + 立春流年 + 节令流月。
const nySummer=TrueSolarTimeCalculator.calculate('1990-07-01','12:00',-74.006,'America/New_York');
assert.equal(nySummer.timezone_id,'America/New_York');
assert.equal(nySummer.utc_offset_minutes,-240);
assert.equal(nySummer.time,'10:59');
assert.equal(nySummer.civil_time_ambiguous,false);
passed++;

const nyWinter=TrueSolarTimeCalculator.calculate('1990-01-01','12:00',-74.006,'America/New_York');
assert.equal(nyWinter.utc_offset_minutes,-300);
assert.equal(nyWinter.time,'12:00');
passed++;

const nyAmbiguous=TrueSolarTimeCalculator.calculate('2024-11-03','01:30',-74.006,'America/New_York');
assert.equal(nyAmbiguous.civil_time_ambiguous,true);
assert.equal(nyAmbiguous.civil_time_candidates.length,2);
passed++;

assert.throws(()=>TrueSolarTimeCalculator.calculate('2024-03-10','02:30',-74.006,'America/New_York'),/不存在|夏令时跳时/);
passed++;

const globalApi=computePaipan({birthday:'1990-07-01',birth_time:'12:00',gender:'male',use_true_solar_time:true,longitude:-74.006,latitude:40.7128,timezone_id:'America/New_York',birth_region:'New York, USA'});
assert.equal(globalApi.ok,true,globalApi.message||'global timezone api failed');
assert.equal(globalApi.data.birth_timezone_id,'America/New_York');
assert.equal(globalApi.data.birth_timezone_offset,-4);
assert.match(globalApi.data.solar_time_description,/UTC-4/);
passed++;

const flowChart=computePaipan({birthday:'2005-03-15',birth_time:'10:00',gender:'male',use_true_solar_time:false});
assert.equal(flowChart.ok,true,flowChart.message||'flow calendar setup failed');
const flowEngine=new BlindJudgmentEngine();
const janTiming=flowEngine.analyze(flowChart.data,{now:'2026-01-20T04:00:00Z'}).timing;
assert.equal(janTiming.liunian.year,2025);
assert.equal(janTiming.liunian.ganzhi,'乙巳');
assert.equal(janTiming.liuyue.pillar,'己丑');
const lichunTiming=flowEngine.analyze(flowChart.data,{now:'2026-02-05T04:00:00Z'}).timing;
assert.equal(lichunTiming.liunian.year,2026);
assert.equal(lichunTiming.liunian.ganzhi,'丙午');
assert.equal(lichunTiming.liuyue.pillar,'庚寅');
const jingzheTiming=flowEngine.analyze(flowChart.data,{now:'2026-03-06T04:00:00Z'}).timing;
assert.equal(jingzheTiming.liuyue.pillar,'辛卯');
assert.ok(jingzheTiming.luck_relations.some(x=>x.layer==='liuyue'));
passed++;

const ln2026=flowChart.data.da_yun.flatMap(d=>d.liu_nian||[]).find(x=>Number(x.year)===2026);
assert.equal(ln2026.liunian_start_event.term,'立春');
assert.equal(ln2026.liunian_end_event.term,'立春');
assert.match(ln2026.liunian_start_event.window_start,/^2026-02-04 /);
assert.match(jingzheTiming.liuyue.start_event.window_start,/^2026-03-05 /);
assert.equal(jingzheTiming.liuyue.start_event.term,'惊蛰');
passed++;

console.log(`v1.6.0 global-time/liuyue total: ${passed}/${passed}`);

// v2.0.0 专业岁运 UI 数据层：每个流年附带十二节令流月，支持任意时点重算同一 v1.9 引擎。
const uiFlow=computePaipan({birthday:'1995-11-05',birth_time:'00:00',gender:'male',use_true_solar_time:true,longitude:119.186466,timezone_id:'Asia/Shanghai',birth_region:'安徽省宣城市郎溪县'});
assert.equal(uiFlow.ok,true,uiFlow.message||'v2 ui flow setup failed');
const ui2026=uiFlow.data.da_yun.flatMap(d=>d.liu_nian||[]).find(x=>Number(x.year)===2026);
assert.ok(ui2026,'v2 ui 2026 flow year missing');
assert.equal(ui2026.liu_yue,undefined,'流月不应把未来几十年的1440个月常驻主盘JSON');
const {LocalChartAdapter}=require('../dist/core/LocalChartAdapter.js');
const uiMonths=new LocalChartAdapter().buildFlowMonths(2026,'庚');
assert.equal(uiMonths.length,12);
assert.deepStrictEqual(uiMonths.slice(0,3).map(x=>[x.start_term,x.pillar]),[['立春','庚寅'],['惊蛰','辛卯'],['清明','壬辰']]);
assert.deepStrictEqual(uiMonths.slice(-2).map(x=>[x.start_term,x.pillar]),[['大雪','庚子'],['小寒','辛丑']]);
for(let i=0;i<11;i++)assert.equal(uiMonths[i].end_event.window_start,uiMonths[i+1].start_event.window_start,'流月节令边界必须首尾连续');
assert.equal(uiMonths[0].localization_only,true);
passed++;

const uiEngine=new BlindJudgmentEngine();
const beforeUiHalf=uiEngine.analyze(uiFlow.data,{now:'2028-04-02T02:59:00Z'}).timing;
const afterUiHalf=uiEngine.analyze(uiFlow.data,{now:'2028-04-02T03:01:00Z'}).timing;
assert.equal(beforeUiHalf.dayun.pillar,'癸未');assert.equal(beforeUiHalf.dayun.active_component,'stem');assert.equal(beforeUiHalf.dayun.active_value,'癸');
assert.equal(afterUiHalf.dayun.pillar,'癸未');assert.equal(afterUiHalf.dayun.active_component,'branch');assert.equal(afterUiHalf.dayun.active_value,'未');
passed++;

const uiSelectedMonth=uiEngine.analyze(uiFlow.data,{now:'2026-03-05T13:50:00Z'}).timing;
assert.equal(uiSelectedMonth.liunian.year,2026);
assert.equal(uiSelectedMonth.liuyue.pillar,'庚寅'); // 北京时间21:50，尚未到当日21:58:49惊蛰
const uiAfterJingzhe=uiEngine.analyze(uiFlow.data,{now:'2026-03-05T14:05:00Z'}).timing;
assert.equal(uiAfterJingzhe.liuyue.pillar,'辛卯');
passed++;

console.log(`v2.0.0 professional-timing-ui data total: ${passed}/${passed}`);
