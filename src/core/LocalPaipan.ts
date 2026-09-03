import nayinRows from '../data/nayin.json';
/*
 * TypeScript port of the legacy LocalPaipan PHP engine.
 * The formulas and behavior are intentionally kept compatible with the legacy implementation.
 */
export type GanZhiInfo = Record<string, any>;

export class LocalPaipan {
  // 真一盲派：以 0 点为换日界。底层日干支公式会在 23:00 后推进到次日，
  // 因此 zwz=true 时会把 23:00-24:00 的日柱退回本日，同时保留夜子时独立时干。
  // 保留 zwz 字段用于兼容旧调用；新代码应理解为 splitZiHourAtMidnight。
  public zwz = true;
  public ctg = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  public cwx = ['木','火','土','金','水'];
  public cdz = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  public dzwx = [4,2,0,0,2,1,1,2,3,3,2,4];
  public dztg = [8,5,0,2,4,3,2,5,6,7,4,9];
  public dzcg = [[9],[5,7,9],[0,2,4],[1],[4,9,1],[2,6,4],[3,5],[5,1,3],[6,8,4],[7],[4,3,7],[8,0]];
  public csa = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
  public cxz = ['水瓶座','双鱼座','白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座'];
  public wkd = ['日','一','二','三','四','五','六'];
  public jq = ['春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒','立春','雨水','惊蛰'];
  private synmonth = 29.530588853;
  public ten_god = [['比','劫'],['食','伤'],['财','才'],['杀','官'],['枭','印']];
  public cs = ['生','沐','冠','临','旺','衰','病','死','墓','绝','胎','养'];
  public selfQi = ['禄','刃','长生','墓库','余气','死','绝'];
  public cs_tg2dz = [11,6,2,9,2,9,5,0,8,3];
  private ptsa = [485,203,199,182,156,136,77,74,70,58,52,50,45,44,29,18,17,16,14,12,12,12,9,8];
  private ptsb = [324.96,337.23,342.08,27.85,73.14,171.52,222.54,296.72,243.58,119.81,297.17,21.02,247.54,325.15,60.93,155.12,288.79,198.04,199.76,95.39,287.11,320.81,227.73,15.45];
  private ptsc = [1934.136,32964.467,20.186,445267.112,45036.886,22518.443,65928.934,3034.906,9037.513,33718.147,150.678,2281.226,29929.562,31555.956,4443.417,67555.328,4562.452,62894.029,31436.921,14577.848,31931.756,34777.259,1222.114,16859.074];
  private static readonly QIYUN_WENZHEN_BIAS_MINUTES = 48;
  private static readonly JIEQI_SEQUENCE=['立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒'];
  private static readonly HOUR_WINDOWS:Record<string,[number,number]>={子:[23,1],丑:[1,3],寅:[3,5],卯:[5,7],辰:[7,9],巳:[9,11],午:[11,13],未:[13,15],申:[15,17],酉:[17,19],戌:[19,21],亥:[21,23]};
  private static readonly BLIND_JIAOYUN_RULES:Record<number,{element:string,term:string,traditionalCountDays:number,calendarOffsetDays:number,hourBranch:string}>={
    // 资料写法采用“虚数/包含节气当天”的传统计数：前三天=>公历日期减2天；后九天=>加8天。
    // 不把口诀里的“三/九”直接当作 Date 的 +/-3、+/-9。
    0:{element:'木',term:'大寒',traditionalCountDays:0,calendarOffsetDays:0,hourBranch:'寅'},
    1:{element:'火',term:'清明',traditionalCountDays:-3,calendarOffsetDays:-2,hourBranch:'午'},
    2:{element:'土',term:'芒种',traditionalCountDays:9,calendarOffsetDays:8,hourBranch:'辰'},
    3:{element:'金',term:'处暑',traditionalCountDays:0,calendarOffsetDays:0,hourBranch:'申'},
    4:{element:'水',term:'冬至',traditionalCountDays:-3,calendarOffsetDays:-2,hourBranch:'亥'}
  };

  private mod(n: number, m: number): number { return ((n % m) + m) % m; }

  private VE(yy: number): number | false {
    if (yy < -8000 || yy > 8001) return false;
    if (yy >= 1000) {
      const m = (yy - 2000) / 1000;
      return 2451623.80984 + 365242.37404*m + 0.05169*m*m - 0.00411*m*m*m - 0.00057*m*m*m*m;
    }
    const m = yy / 1000;
    return 1721139.29189 + 365242.1374*m + 0.06134*m*m + 0.00111*m*m*m - 0.00071*m*m*m*m;
  }

  private Perturbation(jd: number): number {
    const t = (jd - 2451545) / 36525;
    let s = 0;
    for (let k=0;k<=23;k++) s += this.ptsa[k]*Math.cos(this.ptsb[k]*2*Math.PI/360 + this.ptsc[k]*2*Math.PI/360*t);
    const w = 35999.373*t - 2.47;
    const l = 1 + 0.0334*Math.cos(w*2*Math.PI/360) + 0.0007*Math.cos(2*w*2*Math.PI/360);
    return 0.00001*s/l;
  }

  private DeltaT(yy: number, mm: number): number {
    const y = yy + (mm - 0.5) / 12;
    let u=0,t=0,dt=0;
    if (y <= -500) { u=(y-1820)/100; dt=-20+32*u*u; }
    else if (y < 500) { u=y/100; dt=10583.6-1014.41*u+33.78311*u*u-5.952053*u**3-0.1798452*u**4+0.022174192*u**5+0.0090316521*u**6; }
    else if (y < 1600) { u=(y-1000)/100; dt=1574.2-556.01*u+71.23472*u*u+0.319781*u**3-0.8503463*u**4-0.005050998*u**5+0.0083572073*u**6; }
    else if (y < 1700) { t=y-1600; dt=120-0.9808*t-0.01532*t*t+t**3/7129; }
    else if (y < 1800) { t=y-1700; dt=8.83+0.1603*t-0.0059285*t*t+0.00013336*t**3-t**4/1174000; }
    else if (y < 1860) { t=y-1800; dt=13.72-0.332447*t+0.0068612*t*t+0.0041116*t**3-0.00037436*t**4+0.0000121272*t**5-0.0000001699*t**6+0.000000000875*t**7; }
    else if (y < 1900) { t=y-1860; dt=7.62+0.5737*t-0.251754*t*t+0.01680668*t**3-0.0004473624*t**4+t**5/233174; }
    else if (y < 1920) { t=y-1900; dt=-2.79+1.494119*t-0.0598939*t*t+0.0061966*t**3-0.000197*t**4; }
    else if (y < 1941) { t=y-1920; dt=21.2+0.84493*t-0.0761*t*t+0.0020936*t**3; }
    else if (y < 1961) { t=y-1950; dt=29.07+0.407*t-t*t/233+t**3/2547; }
    else if (y < 1986) { t=y-1975; dt=45.45+1.067*t-t*t/260-t**3/718; }
    else if (y < 2005) { t=y-2000; dt=63.86+0.3345*t-0.060374*t*t+0.0017275*t**3+0.000651814*t**4+0.00002373599*t**5; }
    else if (y < 2050) { t=y-2000; dt=62.92+0.32217*t+0.005589*t*t; }
    else if (y < 2150) { u=(y-1820)/100; dt=-20+32*u*u-0.5628*(2150-y); }
    else { u=(y-1820)/100; dt=-20+32*u*u; }
    if (y < 1955 || y >= 2005) dt -= 0.000012932*(y-1955)*(y-1955);
    return dt/60;
  }

  private MeanJQJD(yy: number): number[] {
    const jd = this.VE(yy); if (jd === false) return [];
    const next = this.VE(yy+1); if (next === false) return [];
    const ty = next-jd, num=26, ath=2*Math.PI/24, tx=(jd-2451545)/365250;
    const e=0.0167086342-0.0004203654*tx-0.0000126734*tx*tx+0.0000001444*tx**3-0.0000000002*tx**4+0.0000000003*tx**5;
    const tt=yy/1000, vp=111.25586939-17.0119934518333*tt-0.044091890166673*tt*tt-4.37356166661345E-4*tt**3+8.16716666602386E-6*tt**4;
    const rvp=vp*2*Math.PI/360, peri:number[]=[];
    for(let i=0;i<num;i++){
      let flag=0, th=ath*i+rvp;
      if(th>Math.PI && th<=3*Math.PI){ th=2*Math.PI-th; flag=1; }
      if(th>3*Math.PI){ th=4*Math.PI-th; flag=2; }
      const f1=2*Math.atan(Math.sqrt((1-e)/(1+e))*Math.tan(th/2));
      const f2=(e*Math.sqrt(1-e*e)*Math.sin(th))/(1+e*Math.cos(th));
      let f=(f1-f2)*ty/2/Math.PI; if(flag===1)f=ty-f; if(flag===2)f=2*ty-f; peri[i]=f;
    }
    return peri.map(x=>jd+x-peri[0]);
  }

  private GetAdjustedJQ(yy:number,start:number,end:number):number[]{
    if(start<0||start>25||end<0||end>25)return [];
    const out:number[]=[]; const jqjd=this.MeanJQJD(yy);
    jqjd.forEach((jd,k)=>{ if(k<start||k>end)return; const ptb=this.Perturbation(jd); const dt=this.DeltaT(yy,Math.floor((k+1)/2)+3); out[k]=jd+ptb-dt/60/24+1/3; });
    return out;
  }

  private GetPureJQsinceSpring(yy:number):number[]{
    const out:number[]=[]; let dj=this.GetAdjustedJQ(yy-1,19,23);
    Object.keys(dj).forEach(ks=>{const k=+ks;if(k>=19&&k<=23&&k%2!==0)out.push(dj[k]);});
    dj=this.GetAdjustedJQ(yy,0,25); Object.keys(dj).forEach(ks=>{const k=+ks;if(k%2!==0)out.push(dj[k]);});
    return out;
  }

  private GetZQsinceWinterSolstice(yy:number):number[]{
    const out:number[]=[]; let dj=this.GetAdjustedJQ(yy-1,18,23); out[0]=dj[18];out[1]=dj[20];out[2]=dj[22];
    dj=this.GetAdjustedJQ(yy,0,23); Object.keys(dj).forEach(ks=>{const k=+ks;if(k%2===0)out.push(dj[k]);}); return out;
  }

  private TrueNewMoon(k:number):number{
    const jdt=2451550.09765+k*this.synmonth, t=(jdt-2451545)/36525,t2=t*t,t3=t2*t,t4=t3*t;
    const pt=jdt+0.0001337*t2-0.00000015*t3+0.00000000073*t4;
    const m=2.5534+29.10535669*k-0.0000218*t2-0.00000011*t3;
    const mp=201.5643+385.81693528*k+0.0107438*t2+0.00001239*t3-0.000000058*t4;
    const f=160.7108+390.67050274*k-0.0016341*t2-0.00000227*t3+0.000000011*t4;
    const omega=124.7746-1.5637558*k+0.0020691*t2+0.00000215*t3, es=1-0.002516*t-0.0000074*t2, r=Math.PI/180;
    let a1=-0.4072*Math.sin(r*mp)+0.17241*es*Math.sin(r*m)+0.01608*Math.sin(r*2*mp)+0.01039*Math.sin(r*2*f)+0.00739*es*Math.sin(r*(mp-m))-0.00514*es*Math.sin(r*(mp+m))+0.00208*es*es*Math.sin(r*(2*m))-0.00111*Math.sin(r*(mp-2*f))-0.00057*Math.sin(r*(mp+2*f))+0.00056*es*Math.sin(r*(2*mp+m))-0.00042*Math.sin(r*3*mp)+0.00042*es*Math.sin(r*(m+2*f))+0.00038*es*Math.sin(r*(m-2*f))-0.00024*es*Math.sin(r*(2*mp-m))-0.00017*Math.sin(r*omega)-0.00007*Math.sin(r*(mp+2*m))+0.00004*Math.sin(r*(2*mp-2*f))+0.00004*Math.sin(r*(3*m))+0.00003*Math.sin(r*(mp+m-2*f))+0.00003*Math.sin(r*(2*mp+2*f))-0.00003*Math.sin(r*(mp+m+2*f))+0.00003*Math.sin(r*(mp-m+2*f))-0.00002*Math.sin(r*(mp-m-2*f))-0.00002*Math.sin(r*(3*mp+m))+0.00002*Math.sin(r*(4*mp));
    let a2=0.000325*Math.sin(r*(299.77+0.107408*k-0.009173*t2))+0.000165*Math.sin(r*(251.88+0.016321*k))+0.000164*Math.sin(r*(251.83+26.651886*k))+0.000126*Math.sin(r*(349.42+36.412478*k))+0.00011*Math.sin(r*(84.66+18.206239*k))+0.000062*Math.sin(r*(141.74+53.303771*k))+0.00006*Math.sin(r*(207.14+2.453732*k))+0.000056*Math.sin(r*(154.84+7.30686*k))+0.000047*Math.sin(r*(34.52+27.261239*k))+0.000042*Math.sin(r*(207.19+0.121824*k))+0.00004*Math.sin(r*(291.34+1.844379*k))+0.000037*Math.sin(r*(161.72+24.198154*k))+0.000035*Math.sin(r*(239.56+25.513099*k))+0.000023*Math.sin(r*(331.55+3.592518*k));
    return pt+a1+a2;
  }

  private MeanNewMoon(jd:number):[number,number]{ const kn=Math.floor((jd-2451550.09765)/this.synmonth),jdt=2451550.09765+kn*this.synmonth,t=(jdt-2451545)/36525; return [kn,jdt+0.0001337*t*t-0.00000015*t**3+0.00000000073*t**4]; }

  public Julian2Solar(jd:number):number[]{
    let y4h:number,init:number;if(jd>=2299160.5){y4h=146097;init=1721119.5;}else{y4h=146100;init=1721117.5;}
    const jdr=Math.floor(jd-init),yh=y4h/4,cen=Math.floor((jdr+0.75)/yh);let d=Math.floor(jdr+0.75-cen*yh);const ywl=1461/4,jy=Math.floor((d+0.75)/ywl);d=Math.floor(d+0.75-ywl*jy+1);const ml=153/5,mp=Math.floor((d-0.5)/ml);d=Math.floor((d-0.5)-30.6*mp+1);let y=100*cen+jy;const m=(mp+2)%12+1;if(m<3)y++;
    const sd=Math.floor((jd+0.5-Math.floor(jd+0.5))*86400+0.00005),mt0=Math.floor(sd/60),ss=sd%60,hh=Math.floor(mt0/60),mt=mt0%60;
    return [Math.floor(y),Math.floor(m),Math.floor(d),hh,mt,ss];
  }

  private GetZQandSMandLunarMonthCode(yy:number):[number[],number[],number[]]{
    const mc:number[]=[]; const jdzq=this.GetZQsinceWinterSolstice(yy),jdnm=this.GetSMsinceWinterSolstice(yy,jdzq[0]); let yz=0;
    if(Math.floor(jdzq[12]+0.5)>=Math.floor(jdnm[13]+0.5)){
      // The legacy PHP left mc[0] undefined in leap-month years. PHP's weak
      // numeric coercion happened to treat it as 0, while TypeScript produced
      // undefined/NaN for a few early-January dates. Month code 0 is the
      // winter month containing the solstice, so define it explicitly.
      mc[0]=0;
      for(let i=1;i<=14;i++){
        if(Math.floor((jdnm[i]+0.5)>Math.floor(jdzq[i-1-yz]+0.5) && Math.floor(jdnm[i+1]+0.5)<=Math.floor(jdzq[i-yz]+0.5) ? 1:0)){mc[i]=i-0.5;yz=1;} else mc[i]=i-yz;
      }
    }else{
      for(let i=0;i<=12;i++)mc[i]=i;
      for(let i=13;i<=14;i++){
        if(Math.floor((jdnm[i]+0.5)>Math.floor(jdzq[i-1-yz]+0.5) && Math.floor(jdnm[i+1]+0.5)<=Math.floor(jdzq[i-yz]+0.5) ? 1:0)){mc[i]=i-0.5;yz=1;} else mc[i]=i-yz;
      }
    }
    return [jdzq,jdnm,mc];
  }

  private GetSMsinceWinterSolstice(yy:number,jdws:number):number[]{
    const tjd:number[]=[]; const jd=this.Solar2Julian(yy-1,11,1,0,0,0); if(jd===false)return [];
    const [kn,thejd]=this.MeanNewMoon(jd); for(let i=0;i<=19;i++){const k=kn+i;tjd[i]=this.TrueNewMoon(k)+1/3-this.DeltaT(yy,i-1)/1440;}
    let j=0;for(j=0;j<=18;j++){if(Math.floor(tjd[j]+0.5)>Math.floor(jdws+0.5))break;} const out:number[]=[];for(let k=0;k<=15;k++)out[k]=tjd[j-1+k];return out;
  }

  private Solar2Julian(yy:number,mm:number,dd:number,hh=0,mt=0,ss=0):number|false{
    if(!this.ValidDate(yy,mm,dd)||hh<0||hh>=24||mt<0||mt>=60||ss<0||ss>=60)return false;
    const yp=yy+Math.floor((mm-3)/10); let init:number|undefined,jdy:number|undefined;
    if(yy>1582||(yy===1582&&mm>10)||(yy===1582&&mm===10&&dd>=15)){init=1721119.5;jdy=Math.floor(yp*365.25)-Math.floor(yp/100)+Math.floor(yp/400);}
    if(yy<1582||(yy===1582&&mm<10)||(yy===1582&&mm===10&&dd<=4)){init=1721117.5;jdy=Math.floor(yp*365.25);}
    if(init===undefined||jdy===undefined)return false; const mp=Math.floor(mm+9)%12,jdm=mp*30+Math.floor((mp+1)*34/57),jdd=dd-1,jdh=(hh+(mt+ss/60)/60)/24;return jdy+jdm+jdd+jdh+init;
  }

  public ValidDate(yy:number,mm:number,dd:number):boolean{
    if(yy<-1000||yy>3000||mm<1||mm>12||(yy===1582&&mm===10&&dd>=5&&dd<15))return false;
    const ndf1=-(yy%4===0?1:0),ndf2=((yy%400===0?1:0)-(yy%100===0?1:0)) && yy>1582 ? 1:0,ndf=ndf1+ndf2;
    const dom=30+((Math.abs(mm-7.5)+0.5)%2)-(mm===2?1:0)*(2+ndf); return dd>0&&dd<=dom;
  }

  public GetSolarDays(yy:number,mm:number):number{if(yy<-1000||yy>3000||mm<1||mm>12)return 0;const ndf1=-(yy%4===0?1:0),ndf2=((yy%400===0?1:0)-(yy%100===0?1:0))&&yy>1582?1:0,ndf=ndf1+ndf2;return 30+((Math.abs(mm-7.5)+0.5)%2)-(mm===2?1:0)*(2+ndf);}

  public GetLunarDays(yy:number,mm:number,isLeap:boolean|number):number{
    if(yy<-1000||yy>3000||mm<1||mm>12)return 0;const [,jdnm,mc]=this.GetZQandSMandLunarMonthCode(yy);let leap=0;for(let j=1;j<=14;j++){if(mc[j]-Math.floor(mc[j])>0){leap=Math.floor(mc[j]+0.5);break;}}mm+=2;const nofd:number[]=[];for(let i=0;i<=14;i++)nofd[i]=Math.floor(jdnm[i+1]+0.5)-Math.floor(jdnm[i]+0.5);let dy=0;
    if(isLeap){if(leap>=3&&leap===mm)dy=nofd[mm];}else{if(leap===0)dy=nofd[mm-1];else dy=nofd[mm+(mm>leap?1:0)-1];}return Math.trunc(dy);
  }
  public GetLeap(yy:number):number{const [,,mc]=this.GetZQandSMandLunarMonthCode(yy);let leap=0;for(let j=1;j<=14;j++){if(mc[j]-Math.floor(mc[j])>0){leap=Math.floor(mc[j]+0.5);break;}}return Math.max(0,leap-2);}
  public GetZodiac(mm:number,dd:number):number|false{if(mm<1||mm>12||dd<1||dd>31)return false;const dds=[20,19,21,20,21,22,23,23,23,24,22,22];let kn=mm-1;if(dd<dds[kn])kn=this.mod(kn-1,12);return kn;}
  public GetWeek(yy:number,mm:number,dd:number):number|false{const jd=this.Solar2Julian(yy,mm,dd,12);if(jd===false)return false;return this.mod(Math.floor(jd+1),7);}

  public Lunar2Solar(yy:number,mm:number,dd:number,isLeap:boolean|number):number[]|false{
    if(yy<-1000||yy>3000||mm<1||mm>12||dd<1||dd>30)return false;const [,jdnm,mc]=this.GetZQandSMandLunarMonthCode(yy);let leap=0;for(let j=1;j<=14;j++){if(mc[j]-Math.floor(mc[j])>0){leap=Math.floor(mc[j]+0.5);break;}}mm+=2;const nofd:number[]=[];for(let i=0;i<=14;i++)nofd[i]=Math.floor(jdnm[i+1]+0.5)-Math.floor(jdnm[i]+0.5);let jd=0,er=0;
    if(isLeap){if(leap<3)er=1;else if(leap!==mm)er=2;else if(dd<=nofd[mm])jd=jdnm[mm]+dd-1;else er=3;}
    else if(leap===0){if(dd<=nofd[mm-1])jd=jdnm[mm-1]+dd-1;else er=4;}
    else {const idx=mm+(mm>leap?1:0)-1;if(dd<=nofd[idx])jd=jdnm[idx]+dd-1;else er=4;}
    return er?false:this.Julian2Solar(jd).slice(0,3);
  }

  public Solar2Lunar(yy:number,mm:number,dd:number):number[]|false{
    if(!this.ValidDate(yy,mm,dd))return false;let prev=0,isLeap=0;let [jdzq,jdnm,mc]=this.GetZQandSMandLunarMonthCode(yy);const jd=this.Solar2Julian(yy,mm,dd,12,0,0);if(jd===false)return false;if(Math.floor(jd)<Math.floor(jdnm[0]+0.5)){prev=1;[jdzq,jdnm,mc]=this.GetZQandSMandLunarMonthCode(yy-1);}let mi=0;for(let i=0;i<=14;i++){if(Math.floor(jd)>=Math.floor(jdnm[i]+0.5)&&Math.floor(jd)<Math.floor(jdnm[i+1]+0.5)){mi=i;break;}}if(mc[mi]<2||prev===1)yy--;if((mc[mi]-Math.floor(mc[mi]))*2+1!==1)isLeap=1;mm=(Math.floor(mc[mi]+10)%12)+1;dd=Math.floor(jd)-Math.floor(jdnm[mi]+0.5)+1;return [yy,mm,dd,isLeap];
  }

  public Get24JieQi(yy:number):number[][]{const out:number[][]=[];let dj=this.GetAdjustedJQ(yy-1,21,23);Object.keys(dj).forEach(ks=>{const k=+ks;if(k>=21&&k<=23)out.push(this.Julian2Solar(dj[k]));});dj=this.GetAdjustedJQ(yy,0,20);Object.keys(dj).forEach(ks=>out.push(this.Julian2Solar(dj[+ks])));return out;}

  public GetGanZhi(yy:number,mm:number,dd:number,hh:number,mt=0,ss=0):[number[],number[],number,number[],number]|[]{
    const jd=this.Solar2Julian(yy,mm,dd,hh,mt,Math.max(1,ss));if(jd===false)return [];
    const tg:number[]=[],dz:number[]=[];let jq=this.GetPureJQsinceSpring(yy);if(jd<jq[1]){yy--;jq=this.GetPureJQsinceSpring(yy);}const ygz=this.mod(yy+4712+24,60);tg[0]=ygz%10;dz[0]=ygz%12;let ix=0;for(let j=0;j<=15;j++){if(jq[j]>=jd){ix=j-1;break;}}
    const tmm=this.mod((yy+4712)*12+(ix-1)+60,60),mgz=(tmm+50)%60;tg[1]=mgz%10;dz[1]=mgz%12;const jda=jd+0.5,thes=(jda-Math.floor(jda))*86400+3600,dayjd=Math.floor(jda)+thes/86400,dgz=this.mod(Math.floor(dayjd+49),60);tg[2]=dgz%10;dz[2]=dgz%12;if(this.zwz&&hh>=23){tg[2]=this.mod(tg[2]-1,10);dz[2]=this.mod(dz[2]-1,12);}const hgz=this.mod(Math.floor(dayjd*12+48),60);tg[3]=hgz%10;dz[3]=hgz%12;return [tg,dz,jd,jq,ix];
  }

  private GetXiongWang(dayTg:number,dayDz:number):any{let s=dayDz-dayTg-2;if(s<0)s+=12;if(s===12)s=0;let e=s+1;if(e===12)e=0;return {index:[s,e],char:this.cdz[s]+this.cdz[e]};}
  public GetTenGod(dayTg:number,otherTg:number):any{const l2=(dayTg+otherTg)%2,dayWx=this.GetTgWx(dayTg),otherWx=this.GetTgWx(otherTg);let l1=otherWx-dayWx;if(l1<0)l1+=5;return {index:[l1,l2],char:this.ten_god[l1][l2]};}
  public GetTgWx(tg:number):number{if(tg%2)tg--;return tg/2;}
  public getSanHe(dz:number):any{const fir=(dz%4)*3,sec=(fir+4)%12,thr=(sec+4)%12,ju=[4,0,1,3][fir/3];return {sanhe:[fir,sec,thr],ju};}
  public getChong(dz:number):number{return (dz+6)%12;}
  public getXingFrom(dz:number):number{return [3,7,5,0,4,8,6,10,2,9,1,11][dz];}
  public tgHe(monthDz:number,tgA:number):any{if(tgA>11)return false;const from=tgA>=5?tgA-5:tgA,tag=tgA>=5?tgA:tgA+5;const map=[[1,4,5,6,7,10],[4,8,9,10,1],[8,9,11,0,1],[2,3,4,11,0,1],[2,3,4,5,6,7]],ju=[2,3,4,0,1];return map[from].includes(monthDz)?{he:[from,tag],ju:ju[from]}:false;}
  public getLiuHe(dz:number):any{const tmp=dz===0?12:dz,he=(13-tmp)%12,hua=[2,2,0,1,3,4,2],ju=dz<he?hua[dz]:hua[he];return {index:he,ju};}
  public getChuan(dz:number):number{return (19-dz)%12;}
  public getPo(dz:number):number{return [9,4,11,6,1,8,6,10,5,0,2,11][dz];}
  public GetCs(tg:number,dz:number):any{const base=this.cs_tg2dz[tg];let move=tg%2===0?dz-base:base-dz;if(move<0)move+=12;return {index:move,char:this.cs[move]};}
  private GetGong(yearTg:number,monthDz:number,hourDz:number):any{const gd=(29-monthDz-hourDz)%12,xi=gd<2?1:0,gt=((yearTg%5)*2+gd+12*xi)%10;return {index:[gt,gd],char:this.ctg[gt]+this.cdz[gd]};}
  public GetShenGong(yearTg:number,monthDz:number,hourDz:number):any{const dz=(monthDz+hourDz+1)%12,xi=dz<2?1:0,tg=((yearTg%5)*2+dz+12*xi)%10;return {index:[tg,dz],char:this.ctg[tg]+this.cdz[dz]};}
  public GetTaiXi(dayTg:number,dayDz:number):any{const tg=[5,6,7,8,9,0,1,2,3,4][dayTg],dz=[1,0,11,10,9,8,7,6,5,4,3,2][dayDz];return {index:[tg,dz],char:this.ctg[tg]+this.cdz[dz]};}
  public GetCTPart(hh:number,ii:number):any{const des=['时头','时中','时尾'];hh=Math.trunc(hh);ii=Math.trunc(ii);const sc=Math.trunc((hh+1)/2)%12;let part=0;if(hh%2){if(ii>40)part=1;}else{if(ii<20)part=1;else part=2;}return {index:[sc,part],char:this.cdz[sc]+des[part]};}
  public getSelfQi(tg:number,dz:number):any{const b:any[][]=[[2,3,5,6,5,6,8,9,11,0],[3,null,6,null,7,null,9,null,0,null],[11,11,2,2,2,2,4,4,8,8],[7,7,10,10,10,4,1,1,4,4],[4,4,7,7,null,null,10,10,1,1],[6,6,9,9,9,9,0,0,3,3],[8,8,11,11,11,11,2,2,5,5]];for(let i=0;i<7;i++)if(b[i][tg]===dz)return {index:i,char:this.selfQi[i]};return {index:-1,char:'--'};}

  private computeQiyunFromJdRange(start:number,end:number):any{let total=Math.max(0,(end-start)*1440-LocalPaipan.QIYUN_WENZHEN_BIAS_MINUTES);const year=Math.floor(total/4320);total-=year*4320;const month=Math.floor(total/360);total-=month*360;const day=Math.floor(total/12);total-=day*12;const hour=Math.floor(total*2);return {year,month,day,hour};}

  private static calendarDayDistance(a:number[],b:number[]):number{
    const x=Date.UTC(a[0],a[1]-1,a[2]),y=Date.UTC(b[0],b[1]-1,b[2]);
    return Math.max(0,Math.round(Math.abs(y-x)/86400000));
  }

  private computeBlindQiyun(birth:number[],jieJd:number):{source_days:number,virtual_age:number}{
    const jie=this.Julian2Solar(jieJd),sourceDays=LocalPaipan.calendarDayDistance(birth,jie);
    const q=Math.floor(sourceDays/3),r=sourceDays%3;
    let age=q+(r>=2?1:0);
    age=Math.max(1,Math.min(10,age));
    return {source_days:sourceDays,virtual_age:age};
  }

  public getBlindJiaoyunRule(nayinElement:number):any{
    const rule=LocalPaipan.BLIND_JIAOYUN_RULES[nayinElement];
    if(!rule)return {element:'',term:'',traditional_count_days:0,calendar_offset_days:0,offset_days:0,hour_branch:'',counting_mode:'traditional_inclusive',desc:'盲派纳音交运规则未识别'};
    const n=rule.traditionalCountDays;
    const offset=n===0?'当日':n<0?`前${Math.abs(n)}日`:`后${n}日`;
    return {
      element:rule.element,term:rule.term,
      // offset_days 保留为口诀中的“虚数天数”，兼容旧输出；真正日期计算使用 calendar_offset_days。
      offset_days:n,traditional_count_days:n,calendar_offset_days:rule.calendarOffsetDays,
      counting_mode:'traditional_inclusive',includes_solar_term_day:true,hour_branch:rule.hourBranch,
      interval_years:5,desc:`${rule.element}命：${rule.term}${offset}${rule.hourBranch}时交运；五年一交，十年两交（虚数，含节气当日）`
    };
  }

  private static partsToDate(parts:number[]):Date{return new Date(Date.UTC(parts[0],parts[1]-1,parts[2],parts[3]||0,parts[4]||0,parts[5]||0));}
  private static dateParts(d:Date):number[]{return [d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()];}
  private static addCalendar(parts:number[],y:number,m:number,d:number,h:number):number[]{const dt=LocalPaipan.partsToDate(parts);dt.setUTCFullYear(dt.getUTCFullYear()+y);dt.setUTCMonth(dt.getUTCMonth()+m);dt.setUTCDate(dt.getUTCDate()+d);dt.setUTCHours(dt.getUTCHours()+h);return LocalPaipan.dateParts(dt);}
  public getSolarTermParts(calendarYear:number,term:string):number[]|null{
    for(const seedYear of [calendarYear-1,calendarYear]){
      const rows=this.Get24JieQi(seedYear);
      for(let i=0;i<rows.length;i++){
        const parts=rows[i],name=LocalPaipan.JIEQI_SEQUENCE[i];
        if(name===term&&parts?.[0]===calendarYear)return parts;
      }
    }
    return null;
  }

  public buildBlindJiaoyunEvent(calendarYear:number,nayinElement:number):any{
    const rule=this.getBlindJiaoyunRule(nayinElement);
    if(!rule||!rule.term)return null;
    const termParts=this.getSolarTermParts(calendarYear,rule.term);
    if(!termParts)return null;
    const termDate=new Date(Date.UTC(termParts[0],termParts[1]-1,termParts[2],0,0,0));
    termDate.setUTCDate(termDate.getUTCDate()+Number(rule.calendar_offset_days||0));
    const window=LocalPaipan.HOUR_WINDOWS[rule.hour_branch]||[0,2];
    const start=new Date(termDate.getTime()),end=new Date(termDate.getTime());
    start.setUTCHours(window[0],0,0,0);
    if(window[0]===23&&window[1]===1){end.setUTCDate(end.getUTCDate()+1);end.setUTCHours(1,0,0,0);}else end.setUTCHours(window[1],0,0,0);
    const fmt=(d:Date)=>`${String(d.getUTCFullYear()).padStart(4,'0')}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
    return {
      year:calendarYear,element:rule.element,term:rule.term,term_time:this.formatSolarParts(termParts),offset_days:rule.offset_days,traditional_count_days:rule.traditional_count_days,calendar_offset_days:rule.calendar_offset_days,counting_mode:rule.counting_mode,includes_solar_term_day:true,hour_branch:rule.hour_branch,
      date:`${String(start.getUTCFullYear()).padStart(4,'0')}-${String(start.getUTCMonth()+1).padStart(2,'0')}-${String(start.getUTCDate()).padStart(2,'0')}`,
      window_start:fmt(start),window_end:fmt(end),event_start_parts:LocalPaipan.dateParts(start),event_end_parts:LocalPaipan.dateParts(end),
      precision:'double_hour_window',time_basis:'traditional_inclusive_day_count_plus_shichen',desc:`${calendarYear}年${rule.term}${rule.offset_days===0?'当日':rule.offset_days<0?`前${Math.abs(rule.offset_days)}日`:`后${rule.offset_days}日`}${rule.hour_branch}时交运（含节气当日计数）`
    };
  }

  public buildBlindJiaoyunEvents(startYear:number,nayinElement:number,count=25):any[]{
    const out:any[]=[];
    for(let i=0;i<count;i++){const e=this.buildBlindJiaoyunEvent(startYear+i*5,nayinElement);if(e)out.push({...e,index:i+1});}
    return out;
  }

  private formatSolarParts(parts:number[]):string{return `${String(parts[0]).padStart(4,'0')}-${String(parts[1]).padStart(2,'0')}-${String(parts[2]).padStart(2,'0')} ${String(parts[3]||0).padStart(2,'0')}:${String(parts[4]||0).padStart(2,'0')}:${String(parts[5]||0).padStart(2,'0')}`;}
  private buildJiaoyunDesc(nayinElement:number):string{return this.getBlindJiaoyunRule(nayinElement).desc;}

  public GetInfo(gd:number,yy:number,mm:number,dd:number,hh:number,mt=0,ss=0):GanZhiInfo{
    if(![0,1].includes(gd))return {};const gz=this.GetGanZhi(yy,mm,dd,hh,mt,ss);if(gz.length===0)return {};const [tg,dz,jd,jq,ix]=gz as [number[],number[],number,number[],number];const ret:any={sex:gd};const xw=this.GetXiongWang(tg[2],dz[2]),pn=tg[0]%2,big_tg:number[]=[],big_dz:number[]=[];let spanStart:number,spanEnd:number;
    if((gd===0&&pn===0)||(gd===1&&pn===1)){spanStart=jd;spanEnd=jq[ix+1];for(let i=1;i<=12;i++){big_tg.push((tg[1]+i)%10);big_dz.push((dz[1]+i)%12);}}
    else{spanStart=jq[ix];spanEnd=jd;for(let i=1;i<=12;i++){big_tg.push((tg[1]+20-i)%10);big_dz.push((dz[1]+24-i)%12);}}
    const precisionQ=this.computeQiyunFromJdRange(spanStart,spanEnd);
    const blindQ=this.computeBlindQiyun([yy,mm,dd,hh,mt,ss],(gd===0&&pn===0)||(gd===1&&pn===1)?spanEnd:spanStart);
    ret.tg=tg;ret.dz=dz;ret.bazi=[];ret.sc=this.GetCTPart(hh,mt);ret.dz_cg=[];const gods:any[]=[],dzGod:any[]=[],dzMain:any[]=[],self:any[]=[],ny:any[]=[];
    for(let i=0;i<=3;i++){ret.bazi.push([this.ctg[tg[i]],this.cdz[dz[i]]]);gods[i]=this.GetTenGod(tg[2],tg[i]);const cg=this.dzcg[dz[i]],g:any[]=[],chars:string[]=[];for(const x of cg){g.push(this.GetTenGod(tg[2],x));chars.push(this.ctg[x]);}ret.dz_cg[i]={index:cg,char:chars};dzMain.push(this.GetTenGod(tg[2],this.dztg[dz[i]]));dzGod[i]=g;self[i]=this.getSelfQi(tg[2],dz[i]);ny[i]=this.naYin(tg[i],dz[i]);}
    const dayCs:any[]=[],yearCs:any[]=[],monthCs:any[]=[],hourCs:any[]=[];
    for(let i=0;i<=3;i++){dayCs[i]=this.GetCs(tg[2],dz[i]);yearCs[i]=this.GetCs(tg[0],dz[i]);monthCs[i]=this.GetCs(tg[1],dz[i]);hourCs[i]=this.GetCs(tg[3],dz[i]);}
    gods[2]={index:[5,5],char:'元'};ret.na_yin=ny;ret.xw=xw;ret.gong=this.GetGong(tg[0],dz[1],dz[3]);ret.shen_gong=this.GetShenGong(tg[0],dz[1],dz[3]);ret.tai_xi=this.GetTaiXi(tg[2],dz[2]);ret.birth_jd=jd;ret.jq_table=jq;ret.jq_ix=ix;ret.tg_cg_god=gods;ret.dz_main_god=dzMain;ret.dz_cg_god=dzGod;ret.day_cs=dayCs;ret.year_cs=yearCs;ret.month_cs=monthCs;ret.hour_cs=hourCs;ret.self_qi=self;ret.big_tg=big_tg;ret.big_dz=big_dz;
    ret.qiyun_method='blind_day_div_3';ret.qiyun_source_days=blindQ.source_days;ret.qiyun_virtual_age=blindQ.virtual_age;ret.precision_qiyun_ref=precisionQ;ret.start_desc=`${blindQ.virtual_age}虚岁起运（盲派三日一岁，${blindQ.source_days}天折算）`;
    const startYear=yy+blindQ.virtual_age-1;
    const nayinElement=Number(ny?.[0]?.[1]);ret.jiaoyun_rule=this.getBlindJiaoyunRule(nayinElement);ret.jiaoyun_desc=this.buildJiaoyunDesc(nayinElement);
    ret.jiaoyun_events=this.buildBlindJiaoyunEvents(startYear,nayinElement,25);
    const firstJiaoyun=ret.jiaoyun_events?.[0]??null;ret.start_time=firstJiaoyun?.event_start_parts??[startYear,1,1,0,0,0];ret.start_time_window_end=firstJiaoyun?.event_end_parts??[];ret.start_event=firstJiaoyun;
    ret.big=[];ret.big_start_time=[];ret.big_god=[];ret.big_cs=[];const zi=this.GetZodiac(mm,dd);ret.xz=zi===false?'':this.cxz[zi];ret.sx=this.csa[dz[0]];
    for(let i=0;i<12;i++){ret.big.push(this.ctg[big_tg[i]]+this.cdz[big_dz[i]]);ret.big_cs.push(this.GetCs(tg[2],big_dz[i]));ret.big_god.push(this.GetTenGod(tg[2],big_tg[i]));const ev=ret.jiaoyun_events?.[i*2];ret.big_start_time.push(ev?.event_start_parts??[startYear+i*10,1,1,0,0,0]);}
    ret.wx_fen=this.wuXingPingFen(ret);return ret;
  }

  public naYin(tg:number,dz:number):any[]{
    if(tg%2===1){tg--;dz--;}
    const pillar=(this.ctg[tg]??'')+(this.cdz[dz]??'');
    const row=(nayinRows as unknown as Record<string,[string,number,number]>)[pillar];
    return row?[row[0],row[1],row[2]]:[];
  }

  public wuXingPingFen(info:any,noNaYin=false):number[]{const wx=[0,0,0,0,0];for(const tg of info.tg){const fen=tg%2===1?6:9;wx[this.GetTgWx(tg)]+=fen;}for(const dzEntry of info.dz_cg){const arr:number[]=dzEntry.index,count=arr.length,blocks=count===1?[18]:count===2?[11,7]:[9,6,3];arr.forEach((tg,i)=>{const fen=tg%2===1?12:18;wx[this.GetTgWx(tg)]+=fen*blocks[i]/18;});}if(!noNaYin)for(const n of info.na_yin)wx[n[1]]+=n[2]/20;return wx;}
}
