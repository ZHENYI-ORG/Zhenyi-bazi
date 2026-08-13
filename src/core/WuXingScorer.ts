export class WuXingScorer {
  private static WX=['木','火','土','金','水'];
  private static GAN_WX=[0,0,1,1,2,2,3,3,4,4];
  static judgeDayMasterStrength(dayGanIdx:number,wxScore:Record<string,number>){const dayWx=this.WX[this.GAN_WX[dayGanIdx]],generates:any={'木':'水','火':'木','土':'火','金':'土','水':'金'},yinWx=generates[dayWx],self=(wxScore[dayWx]||0)+(wxScore[yinWx]||0),total=Object.values(wxScore).reduce((a,b)=>a+b,0),other=total-self;return {strong:self>=other,day_wx:dayWx,self_score:+self.toFixed(2),other_score:+other.toFixed(2),total:+total.toFixed(2)};}
}
