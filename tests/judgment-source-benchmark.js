'use strict';
const assert=require('node:assert/strict');
const vectors=require('./judgment-source-benchmark-vectors.json');
const {computePaipan}=require('../dist/api');

function run(v){
  const [year,month,day,hour]=v.pillars;
  const r=computePaipan({name:v.id,gender:v.gender,input_mode:'pillars',direct_pillars:{year,month,day,hour}});
  assert.equal(r.ok,true,`${v.id}: ${r.message||'paipan failed'}`);
  return r.data.blind_judgment;
}

let passed=0;
const rows=[];
for(const v of vectors){
  const j=run(v), p=j.mainline.primary, e=v.expected;
  const checks=[];
  if(e.primary_title!==undefined) checks.push(['primary_title',p?.title===e.primary_title,p?.title,e.primary_title]);
  if(e.primary_title_contains!==undefined) checks.push(['primary_title_contains',String(p?.title||'').includes(e.primary_title_contains),p?.title,e.primary_title_contains]);
  if(e.primary_type!==undefined) checks.push(['primary_type',p?.type===e.primary_type,p?.type,e.primary_type]);
  if(e.primary_status!==undefined) checks.push(['primary_status',p?.status===e.primary_status,p?.status,e.primary_status]);
  if(e.gong_direction!==undefined) checks.push(['gong_direction',p?.gongDirection===e.gong_direction,p?.gongDirection,e.gong_direction]);
  if(e.no_effective_standard_gong){
    const effective=j.gong_paths.filter(x=>x.status==='effective');
    checks.push(['no_effective_standard_gong',effective.length===0,effective.map(x=>x.title),[]]);
  }
  if(e.qishi_contains){
    const els=j.qishi?.dominant?.elements||[];
    checks.push(['qishi_contains',e.qishi_contains.every(x=>els.includes(x)),els,e.qishi_contains]);
  }
  const ok=checks.every(x=>x[1]);
  if(ok) passed++;
  rows.push({id:v.id,ok,primary:p?.title||'',direction:p?.gongDirection||'',checks:checks.map(([name,pass,actual,expected])=>({name,pass,actual,expected}))});
  console.log(`${ok?'✓':'✗'} ${v.id}: ${p?.title||'无标准主线'} / ${p?.gongDirection||'-'}`);
  if(!ok){ for(const c of checks.filter(x=>!x[1])) console.log('   ',c[0],'actual=',c[2],'expected=',c[3]); }
}
console.log(`\nSource consistency benchmark: ${passed}/${vectors.length} passed`);
if(passed!==vectors.length){
  process.exitCode=1;
}
