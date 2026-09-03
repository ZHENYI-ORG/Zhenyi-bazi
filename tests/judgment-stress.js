'use strict';
const assert=require('node:assert/strict');
const {computePaipan}=require('../dist/api');
let ok=0;
for(let i=0;i<120;i++){
  const year=1940+(i%80),month=1+(i*7)%12,day=1+(i*11)%27,hour=(i*3)%24;
  const r=computePaipan({name:`压力${i}`,gender:i%2?'female':'male',birthday:`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,birth_time:`${String(hour).padStart(2,'0')}:30`,longitude:120,birth_region:'测试',is_lunar:false});
  assert.equal(r.ok,true,`case ${i}: ${r.message||''}`);
  assert.ok(r.data?.blind_judgment?.presentation?.title,`case ${i}: no judgment title`);
  assert.ok(Array.isArray(r.data.blind_judgment.gong_paths));
  ok++;
}
console.log(`Judgment stress: ${ok}/120 passed`);
