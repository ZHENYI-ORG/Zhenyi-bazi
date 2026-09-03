import rulesJson from '../data/shensha-rules.json';
import nayinRows from '../data/nayin.json';

type Pillar = {name:string;gan:string;zhi:string;ganzhi:string;nayin:string|null;wuxing:string|null};
type Rule = {id:number;name:string;main:string;tags:string;sex:string;data:Record<string,any>};
const GAN=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const ZHI=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const WUXING=['金','木','水','火','土'];
const NAYIN:Record<string,string>=Object.fromEntries(Object.entries(nayinRows as unknown as Record<string,[string,number,number]>).map(([pillar,row])=>[pillar,row[0]]));

export class ShenShaMatcher {
  private rules=rulesJson as Rule[];
  matchAll(bazi:Record<string,any>,extra:Record<string,any>={},options:Record<string,any>={}):any[]{
    const gender=String(options.gender??'0'),includeDuplicates=!!options.include_duplicates,wuxingSource=String(options.wuxing_source??'nayin_first');
    const pillars=this.normalizePillars(bazi,extra),dayGan=pillars['日柱']?.gan??null,dayGanWuxing=dayGan?this.ganWuxing(dayGan):null,results:any[]=[];
    for(const rule of this.rules){if(!this.genderAllowed(String(rule.sex),gender))continue;let matched=this.matchRule(rule,pillars,dayGanWuxing,wuxingSource);if(!matched.length)continue;if(!includeDuplicates){const seen=new Set<string>();matched=matched.filter(r=>{const k=JSON.stringify(r);if(seen.has(k))return false;seen.add(k);return true;});}results.push({id:rule.id,name:rule.name,main:rule.main,tags:rule.tags,sex:rule.sex,matches:matched});}
    return results.sort((a,b)=>a.id-b.id);
  }
  private genderAllowed(ruleSex:string,gender:string){return ruleSex==='0'||ruleSex===gender;}
  private normalizePillars(bazi:Record<string,any>,extra:Record<string,any>):Record<string,Pillar>{const out:Record<string,Pillar>={};for(const [name,item] of Object.entries({...bazi,...extra})){const gan=String((item as any)?.gan??'').trim(),zhi=String((item as any)?.zhi??'').trim();if(!this.isGan(gan)||!this.isZhi(zhi))throw new Error(`柱 ${name} 的 gan/zhi 不合法：${gan}${zhi}`);const ganzhi=gan+zhi,nayin=NAYIN[ganzhi]??null;out[name]={name,gan,zhi,ganzhi,nayin,wuxing:nayin?this.nayinWuxing(nayin):null};}return out;}
  private matchRule(rule:Rule,pillars:Record<string,Pillar>,dayGanWuxing:string|null,wuxingSource:string):any[]{
    const data=rule.data,keys=Object.keys(data);if(!keys.length)return [];let type=this.detectRuleType(keys);if(type==='ganzhi_exact')type=this.refineGanzhiSubtype(data);let hits:any[]=[];const main=this.resolveMainSources(rule,pillars),allowedOrig=this.resolveAllowedTargets(rule);let allowedTargets=[...allowedOrig];
    if(type==='gan_to_zhi'){
      for(const [sourceName,gan] of Object.entries(main.gan)){if(!(gan in data))continue;for(const targetZhi of this.splitZhiValues(String(data[gan]))){for(const [targetName,target] of Object.entries(pillars)){if(target.zhi===targetZhi)hits.push(this.hit(type,sourceName,gan,targetName,targetZhi,target.ganzhi));}}}
    } else if(type==='zhi_to_zhi'){
      for(const [sourceName,zhi] of Object.entries(main.zhi)){if(!(zhi in data))continue;const value=String(data[zhi]),ganzhiList=this.extractGanzhiList(value);if(ganzhiList.length){let targets=main.pillars.length?main.pillars:Object.keys(pillars);if(!main.pillars.length){const tagSet=String(rule.tags??'').split(',').map(s=>s.trim()).filter(Boolean),m:any={'13':'年柱','15':'日柱','16':'月柱'};targets=tagSet.map(t=>m[t]).filter(Boolean);if(!targets.length)targets=['日柱'];}for(const gz of ganzhiList)for(const targetName of targets){const target=pillars[targetName];if(target&&target.ganzhi===gz)hits.push(this.hit('zhi_to_ganzhi',sourceName,zhi,targetName,gz,target.ganzhi));}continue;}
        const targets=this.splitZhiValues(value);if(targets.length){for(const targetZhi of targets)for(const [targetName,target] of Object.entries(pillars))if(target.zhi===targetZhi)hits.push(this.hit(type,sourceName,zhi,targetName,targetZhi,target.ganzhi));}
        else{for(const targetGan of this.splitGanValues(value))for(const [targetName,target] of Object.entries(pillars))if(target.gan===targetGan)hits.push(this.hit('zhi_to_gan',sourceName,zhi,targetName,targetGan,target.ganzhi));}
      }
    } else if(type==='ganzhi_exact'){
      const targets=main.pillars.length?main.pillars:Object.keys(pillars);for(const key of keys)for(const pn of targets){const p=pillars[pn];if(p&&p.ganzhi===key)hits.push(this.hit(type,pn,key,pn,key,p.ganzhi));}
    } else if(type==='ganzhi_to_zhi'){
      const sources=main.pillars.length?main.pillars:Object.keys(pillars);for(const sourceName of sources){const p=pillars[sourceName];if(!p||!(p.ganzhi in data))continue;for(const targetZhi of this.splitZhiValues(String(data[p.ganzhi])))for(const [targetName,target] of Object.entries(pillars))if(target.zhi===targetZhi)hits.push(this.hit(type,sourceName,p.ganzhi,targetName,targetZhi,target.ganzhi));}
    } else if(type==='combo_stems'){
      for(const combo of keys){const need=this.splitGanValues(combo),found:any[]=[];for(const gan of need){for(const [pn,p] of Object.entries(pillars)){if(p.gan===gan){found.push({pillar:pn,gan,ganzhi:p.ganzhi});break;}}}if(found.length===need.length)hits.push({rule_type:type,source_pillar:found.map(x=>x.pillar).join(','),source_value:need.join(''),target_pillar:found.map(x=>x.pillar).join(','),target_value:need.join(''),target_ganzhi:found.map(x=>x.ganzhi).join(',')});}
    } else if(type==='wuxing_to_zhi'){
      const contexts:any[]=[];if(wuxingSource==='nayin_first'){for(const [pn,p] of Object.entries(pillars))if(p.wuxing)contexts.push({source_pillar:pn,source_value:p.wuxing});if(dayGanWuxing)contexts.push({source_pillar:'日干',source_value:dayGanWuxing});}else if(dayGanWuxing)contexts.push({source_pillar:'日干',source_value:dayGanWuxing});
      for(const ctx of contexts){const wx=ctx.source_value;if(!(wx in data))continue;for(const z of this.splitZhiValues(String(data[wx])))for(const [pn,p] of Object.entries(pillars))if(p.zhi===z)hits.push(this.hit(type,ctx.source_pillar,wx,pn,z,p.ganzhi));}
    }
    if(allowedTargets.length)hits=hits.filter(h=>allowedTargets.includes(h.target_pillar??''));return hits;
  }
  private hit(type:string,sp:string,sv:string,tp:string,tv:string,tg:string){return {rule_type:type,source_pillar:sp,source_value:sv,target_pillar:tp,target_value:tv,target_ganzhi:tg};}
  private resolveAllowedTargets(rule:Rule):string[]{const codes=String(rule.tags??'').split(',').map(s=>s.trim()).filter(Boolean);if(!codes.length||codes.includes('0'))return [];const m:Record<string,string[]>={'7':['年柱'],'8':['月柱'],'9':['日柱'],'10':['时柱'],'11':['纳音'],'12':['大运','流年'],'13':['年柱'],'15':['日柱'],'16':['月柱']};return [...new Set(codes.flatMap(c=>m[c]??[]))];}
  private resolveMainSources(rule:Rule,pillars:Record<string,Pillar>):{gan:Record<string,string>;zhi:Record<string,string>;pillars:string[]}{const codes=String(rule.main??'').split(',').map(s=>s.trim()).filter(Boolean),gan:Record<string,string>={},zhi:Record<string,string>={};let ps:string[]=[];if(!codes.length){for(const [n,p] of Object.entries(pillars)){gan[n]=p.gan;zhi[n]=p.zhi;}return {gan,zhi,pillars:Object.keys(pillars)};}const mg:any={'1':'年柱','3':'日柱','5':'月柱'},mz:any={'7':'年柱','8':'月柱','9':'日柱','10':'时柱'},mp:any={'13':'年柱','15':'日柱','16':'月柱','25':'日柱','26':'年柱'};for(const c of codes){if(mg[c]&&pillars[mg[c]])gan[mg[c]]=pillars[mg[c]].gan;if(mz[c]&&pillars[mz[c]])zhi[mz[c]]=pillars[mz[c]].zhi;if(mp[c])ps.push(mp[c]);}if(!Object.keys(gan).length&&!Object.keys(zhi).length&&!ps.length){for(const [n,p] of Object.entries(pillars)){gan[n]=p.gan;zhi[n]=p.zhi;}ps=Object.keys(pillars);}return {gan,zhi,pillars:[...new Set(ps)]};}
  private detectRuleType(keys:string[]):string{const f=keys[0];if(this.isGan(f))return 'gan_to_zhi';if(this.isZhi(f))return 'zhi_to_zhi';if(WUXING.includes(f))return 'wuxing_to_zhi';const gl=this.splitGanValues(f);if(gl.length>=2&&gl.join('')===f)return 'combo_stems';if(this.isGanzhi(f))return 'ganzhi_exact';return 'unknown';}
  private refineGanzhiSubtype(data:Record<string,any>):string{const first=Object.values(data)[0];if(first===null||first===''||first===false)return 'ganzhi_exact';const v=String(first);return this.splitZhiValues(v).length&&!this.splitGanValues(v).length?'ganzhi_to_zhi':'ganzhi_exact';}
  private splitZhiValues(v:string){return [...new Set(Array.from(v).filter(c=>ZHI.includes(c)))];}
  private splitGanValues(v:string){return [...new Set(Array.from(v).filter(c=>GAN.includes(c)))];}
  private extractGanzhiList(v:string):string[]{const cs=Array.from(v),list:string[]=[];let i=0;while(i<cs.length-1){if(this.isGan(cs[i])&&this.isZhi(cs[i+1])){list.push(cs[i]+cs[i+1]);i+=2;}else return [];}if(i!==cs.length)return [];return [...new Set(list)];}
  private isGan(v:string){return GAN.includes(v);} private isZhi(v:string){return ZHI.includes(v);} private isGanzhi(v:string){const c=Array.from(v);return c.length===2&&this.isGan(c[0])&&this.isZhi(c[1]);}
  private ganWuxing(g:string){if(['庚','辛'].includes(g))return '金';if(['甲','乙'].includes(g))return '木';if(['壬','癸'].includes(g))return '水';if(['丙','丁'].includes(g))return '火';if(['戊','己'].includes(g))return '土';throw new Error(`未知天干：${g}`);}
  private nayinWuxing(n:string){for(const x of ['金','木','水','火','土'])if(n.includes(x))return x;throw new Error(`未知纳音：${n}`);}
}
