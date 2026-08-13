const assert=require('node:assert/strict');
const vectors=require('./regression-vectors.json');
const {computePaipan}=require('../dist/api.js');
function pick(data){
  const b=data.bazi;
  return {
    solar_time:data.solar_time,
    pillars:['year_pillar','month_pillar','day_pillar','hour_pillar'].map(k=>b[k].heavenly_stem+b[k].earthly_branch),
    qiyun:data.qiyun,
    jiaoyun:data.jiaoyun,
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
  [{birthday:'1990-06-15',birth_time:'12:00',longitude:0},'请填写有效的出生地经度'],
  [{birthday:'bad',birth_time:'12:00',longitude:120},'请填写完整的出生日期和时间']
]){
  const r=computePaipan(input);assert.equal(r.ok,false);assert.equal(r.message,msg);passed++;
}
console.log(`Regression tests passed: ${passed}/${passed}`);
