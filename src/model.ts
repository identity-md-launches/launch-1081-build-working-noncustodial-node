export type Market = 'BTC' | 'ETH';
export type Parameters = {
  source: string; verifiedOnchain: boolean; observedAt: number;
  deadband: number; baseRate: number; rateMultiplier: number;
  referenceNotional: number; positionMultiplier: number; winFee: number;
  lossFee: number; liquidationBuffer: number; flatRate: number;
  threshold: number; decayScale: number; trackedLp: number; tailProgress: number;
  queueNonempty: boolean;
};
// Docs defaults, NOT a current onchain snapshot. Simulation only.
export function defaults(market: Market): Parameters {
  return {source:'official-docs-2026-10-08/simulation', verifiedOnchain:false,
    observedAt:0, deadband:1/50000, baseRate:0.1, rateMultiplier:15000,
    referenceNotional:100000, positionMultiplier:market==='BTC'?814.598:483.979,
    winFee:0.02, lossFee:0.02, liquidationBuffer:0.0005, flatRate:100,
    threshold:2000000, decayScale:120000000, trackedLp:0, tailProgress:0,
    queueNonempty:false};
}
export type Position = {id:string; side:1|-1; margin:number; leverage:number; entry:number};
export type Account = {id:string; funded:number; cash:number; paper:number; positions:Position[]};
export type Quote = {price:number; timestamp:number};
export type Mint = {id:string; account:string; amount:number; basis:number};
export type Snapshot = {accounts:Account[]; quote:Quote; parameters:Parameters; mints:Mint[]};
export type Config = {capital:number; marginPerWallet:number; maxPairLoss:number;
 dailyLoss:number; maxMarginPerWallet:number; maxLeverage:number; maxPriceAgeMs:number;
 leverageCandidates:number[]; market:Market; cycles:number; stateDirectory:string; emergencyFile:string};
export function validate(c:Config) {
  for(const k of ['capital','marginPerWallet','maxPairLoss','dailyLoss','maxMarginPerWallet','maxLeverage','maxPriceAgeMs','cycles'] as const)
    if(!Number.isFinite(c[k]) || c[k]<=0) throw Error(`Invalid ${k}`);
  if(c.capital>2000 || c.dailyLoss>c.capital || c.maxPairLoss>c.dailyLoss ||
    c.marginPerWallet>c.maxMarginPerWallet || 2*c.marginPerWallet>c.maxPairLoss ||
    c.maxLeverage>1000 || !['BTC','ETH'].includes(c.market) ||
    !c.leverageCandidates.length || c.leverageCandidates.some(x=>!Number.isFinite(x)||x<1||x>1000)) throw Error('Invalid risk configuration');
}
export function mintEstimate(basis:number, p:Parameters):number {
  // Continuous integral estimate; contract integer rounding/event amounts are authoritative.
  const flat=p.trackedLp<p.threshold?Math.min(basis,p.threshold-p.trackedLp):0;
  const tail=basis-flat, s=p.decayScale, h=p.tailProgress;
  return flat*p.flatRate + p.flatRate*s*s*tail/((s+h)*(s+h+tail));
}
export function settlement(pos:Position, price:number, p:Parameters, liquidated=false) {
  const raw=pos.margin*pos.leverage*pos.side*(price/pos.entry-1);
  if(liquidated) return {pnl:-pos.margin,basis:pos.margin,paper:mintEstimate(pos.margin,p)};
  if(raw<=0) {
    const loss=Math.min(pos.margin,-raw);
    const basis=loss*(p.queueNonempty||p.trackedLp<0?1:1-p.lossFee);
    return {pnl:-loss,basis,paper:mintEstimate(basis,p)};
  }
  const move=Math.max(0,Math.abs(price/pos.entry-1)-p.deadband);
  const scale=move===0?0:(1-p.baseRate)/(1+1/(move*p.rateMultiplier)+p.referenceNotional/(1e6*move*p.positionMultiplier));
  return {pnl:pos.margin*pos.leverage*move*scale*(1-p.winFee),basis:0,paper:0};
}
export function bust(pos:Position,p:Parameters):number {
  // Docs approximate fixed-price buffer; exact contract trigger is unpublished.
  return pos.entry*(1-pos.side*(1/pos.leverage-p.liquidationBuffer));
}
export function crossed(pos:Position,price:number,p:Parameters):boolean {
  return pos.side===1?price<=bust(pos,p):price>=bust(pos,p);
}
export function equity(a:Account,q:Quote,p:Parameters):number {
  return a.cash+a.positions.reduce((sum,x)=>sum+x.margin+settlement(x,q.price,p).pnl,0);
}
