import {existsSync} from 'node:fs';
import {equity,validate} from './model.ts';
import type {Config,Snapshot} from './model.ts';
import type {Adapter} from './adapter.ts';
import {Audit} from './audit.ts';
export class Engine {
  adapter:Adapter; config:Config; audit:Audit;
  stopped=false; active=false; counter=0; baseline=0; dayBaseline=0; day='';
  latest:Snapshot|undefined; seenMints=new Set<string>();
  constructor(adapter:Adapter,config:Config,audit:Audit) {
    validate(config); this.adapter=adapter;this.config=config;this.audit=audit;
    // Never silently start again after a crash or reset the loss baseline.
    if(audit.hasState()) throw Error('Existing state: restart requires operator review; use a new directory only for a NEW simulated run. Never reset live capital history.');
  }
  persist(){this.audit.save({stopped:this.stopped,active:this.active,counter:this.counter,baseline:this.baseline,dayBaseline:this.dayBaseline,day:this.day,latest:this.latest,seenMints:[...this.seenMints]});}
  stop(reason:string){this.stopped=true;this.audit.event('stop',{reason});this.persist();}
  async reconcile(now=Date.now()):Promise<Snapshot> {
    const s=await this.adapter.poll();
    if(s.accounts.length!==2||s.accounts[0].id===s.accounts[1].id || s.accounts.some(a=>!Number.isFinite(a.cash)||a.cash<0||!Number.isFinite(a.funded)||a.funded<0||a.positions.some(x=>!Number.isFinite(x.margin)||x.margin<=0))) throw Error('Invalid account snapshot');
    const funded=s.accounts.reduce((v,a)=>v+a.funded,0);
    if(funded>2000||funded>this.config.capital) {this.stop('Actual cumulative funding exceeds capital cap');throw Error('Funding cap');}
    if(!Number.isFinite(s.quote.price)||s.quote.price<=0||!Number.isFinite(s.quote.timestamp)||now-s.quote.timestamp>this.config.maxPriceAgeMs||s.quote.timestamp>now+1000) throw Error('Stale or invalid price');
    if(this.baseline===0) this.baseline=funded;
    const value=s.accounts.reduce((v,a)=>v+equity(a,s.quote,s.parameters),0);
    const day=new Date(now).toISOString().slice(0,10);
    if(this.day!==day){this.day=day;this.dayBaseline=value;}
    for(const m of s.mints) if(!this.seenMints.has(m.id)){this.seenMints.add(m.id);this.audit.event('paper-mint',m);}
    if(this.latest) for(const a of this.latest.accounts) for(const pos of a.positions) {
      if(!s.accounts.find(x=>x.id===a.id)?.positions.some(x=>x.id===pos.id)) this.audit.event('position-removed',{account:a.id,position:pos.id,possibleLiquidation:true});
    }
    this.latest=s; this.audit.event('snapshot',s);
    if(this.baseline-value>=this.config.capital-1e-8) this.stop('Combined capital-loss stop');
    if(this.dayBaseline-value>=this.config.dailyLoss-1e-8) this.stop('Daily loss stop');
    if(existsSync(this.config.emergencyFile)) this.stop('Manual emergency stop');
    this.persist();return s;
  }
  async flatten() {
    // Poll positions: an HTTP acceptance is never treated as a confirmed fill.
    try {
      const s=await this.adapter.poll();
      for(const a of s.accounts) for(const x of a.positions) {
        this.audit.event('close-intent',{account:a.id,position:x.id});
        await this.adapter.close(a.id,x.id,`close-${x.id}`);
      }
      const after=await this.adapter.poll();
      if(after.accounts.some(a=>a.positions.length)) throw Error('Close unconfirmed; operator must intervene');
      this.active=false;this.audit.event('flat-confirmed',{});this.persist();
    } catch {this.stop('Emergency close failed or unknown: manual intervention required');}
  }
  async openPair(leverage:number) {
    try {
      const s=await this.reconcile();
      if(this.stopped) return false;
      if(this.active||s.accounts.some(a=>a.positions.length)) throw Error('Position drift / one pair limit');
      const margin=this.config.marginPerWallet, reserve=2*margin;
      const value=s.accounts.reduce((v,a)=>v+equity(a,s.quote,s.parameters),0);
      if(!Number.isFinite(leverage)||leverage<1||leverage>this.config.maxLeverage||margin>this.config.maxMarginPerWallet||reserve>this.config.maxPairLoss||reserve>this.config.capital-(this.baseline-value)||reserve>this.config.dailyLoss-(this.dayBaseline-value)||s.accounts.some(a=>a.cash<margin)) {
        this.stop('Insufficient worst-case loss budget or margin/leverage cap');return false;
      }
      this.active=true; const id=++this.counter;
      this.audit.event('pair-intent',{id,leverage,margin});this.persist();
      for(let i=0;i<2;i++) {
        if(this.stopped||existsSync(this.config.emergencyFile)) throw Error('Manual stop during submission');
        await this.adapter.open(s.accounts[i].id,i===0?1:-1,margin,leverage,`pair-${id}-${i}`);
        const check=await this.adapter.poll(), pos=check.accounts[i].positions;
        if(pos.length!==1||pos[0].side!==(i===0?1:-1)||pos[0].leverage!==leverage||pos[0].margin!==margin) throw Error('Unknown or incorrect fill');
        this.audit.event('fill-confirmed',{account:s.accounts[i].id,position:pos[0]});
      }
      const after=await this.reconcile();
      if(after.accounts.some(a=>a.positions.length!==1)||this.stopped) throw Error('Pair drift');
      return true;
    } catch {
      this.stop('Open failed / uncertain or drift; protecting outstanding leg');await this.flatten();return false;
    }
  }
  async monitor() {
    try {
      const s=await this.reconcile();
      const ps=s.accounts.flatMap(a=>a.positions);
      if(this.stopped || (this.active && (ps.length!==2||ps[0].side===ps[1].side||Math.abs(ps[0].margin*ps[0].leverage-ps[1].margin*ps[1].leverage)>0.000001))) {
        if(!this.stopped)this.stop('Position drift / possible liquidation');await this.flatten();
      }
    } catch {this.stop('Polling error / stale price');await this.flatten();}
  }
}
