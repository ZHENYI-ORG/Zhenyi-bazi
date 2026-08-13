import {LocalChartAdapter} from './core/LocalChartAdapter';

export interface ApiResponse { ok:boolean; data?:any; message?:string }

export function computePaipan(input:any):ApiResponse {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {ok:false,message:'请求数据格式无效'};
  const date=String(input.birthday??'').trim(),time=String(input.birth_time??'').trim(),longitude=Number(input.longitude??0);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return {ok:false,message:'请填写完整的出生日期和时间'};
  if(!(longitude>0&&longitude<=180))return {ok:false,message:'请填写有效的出生地经度'};
  try{
    const profile={id:0,name:String(input.name??'').trim(),birthday:date,birth_time:time,gender:input.gender==='female'?'female':'male',is_lunar:input.is_lunar?1:0,is_leap:input.is_leap?1:0,birth_longitude:longitude,birth_region:String(input.birth_region??'').trim()};
    const adapter=new LocalChartAdapter(),chart=adapter.compute(profile),shenSha=adapter.computeShenSha(chart,profile.gender==='male'?0:1);
    chart.shen_sha_full=shenSha.main??[];chart.shen_sha={year:[],month:[],day:[],hour:[]};
    const pillarMap:Record<string,string>={'年柱':'year','月柱':'month','日柱':'day','时柱':'hour'};
    for(const rule of chart.shen_sha_full)for(const match of rule.matches??[]){const key=pillarMap[match.target_pillar??''],name=String(rule.name??'').trim();if(key&&name&&!chart.shen_sha[key].includes(name))chart.shen_sha[key].push(name);}
    return {ok:true,data:chart};
  }catch(e:any){return {ok:false,message:e?.message??String(e)};}
}
