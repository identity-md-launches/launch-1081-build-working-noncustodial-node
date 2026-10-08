import {defaults, crossed, settlement} from './model.ts';
import type {Account, Market, Snapshot, Position, Parameters, Mint} from './model.ts';
export interface Adapter {
  poll():Promise<Snapshot>;
  open(account:string, side:1|-1, margin:number, leverage:number, intentId:string):Promise<void>;
  close(account:string, positionId:string, intentId:string):Promise<void>;
}
export class LiveUnavailable implements Adapter {
  constructor() {throw Error('LIVE DISABLED: authorized relayer URL, request schema, EIP-712 domain/types, deployed contracts and scoped session registration are unverified. See docs/verification.md');}
  async poll():Promise<Snapshot>{throw Error('Unavailable');}
  async open():Promise<void>{throw Error('Unavailable');}
  async close():Promise<void>{throw Error('Unavailable');}
}
export class SimulatedRelayer implements Adapter {
  accounts:Account[];
  parameters:Parameters;
  price=100;
  timestamp=Date.now();
  mints:Mint[]=[];
  intents=new Set<string>();
  failOpenAccount:string|undefined;
  failClose=false;
  constructor(capital:number,market:Market) {
    this.parameters=defaults(market);
    this.accounts=['sim-long','sim-short'].map(id=>({id,funded:capital/2,cash:capital/2,paper:0,positions:[]}));
  }
  async poll():Promise<Snapshot>{return structuredClone({accounts:this.accounts,quote:{price:this.price,timestamp:this.timestamp},parameters:this.parameters,mints:this.mints});}
  async open(account:string, side:1|-1, margin:number, leverage:number, intentId:string) {
    if(this.intents.has(intentId)) return;
    if(account===this.failOpenAccount) throw Error('Mock relayer rejection');
    const a=this.accounts.find(x=>x.id===account);
    if(!a||a.positions.length||a.cash<margin||margin<=0||leverage<1||leverage>1000) throw Error('Mock open rejected');
    this.intents.add(intentId); a.cash-=margin;
    a.positions.push({id:intentId,side,margin,leverage,entry:this.price});
  }
  finish(a:Account,x:Position,liquidated:boolean) {
    const s=settlement(x,this.price,this.parameters,liquidated);
    a.cash+=x.margin+s.pnl; a.paper+=s.paper;
    a.positions=a.positions.filter(y=>y.id!==x.id);
    if(s.basis>0) {
      this.mints.push({id:`mint-${x.id}`,account:a.id,amount:s.paper,basis:s.basis});
      if(!this.parameters.queueNonempty) {
        const tail=Math.max(0,this.parameters.trackedLp+s.basis-this.parameters.threshold)-Math.max(0,this.parameters.trackedLp-this.parameters.threshold);
        this.parameters.tailProgress+=tail; this.parameters.trackedLp+=s.basis;
      }
    } else this.parameters.trackedLp-=s.pnl;
  }
  async close(account:string, positionId:string, intentId:string) {
    if(this.intents.has(intentId)) return;
    if(this.failClose) throw Error('Mock close failure');
    const a=this.accounts.find(x=>x.id===account), x=a?.positions.find(x=>x.id===positionId);
    if(!a||!x) return;
    this.intents.add(intentId); this.finish(a,x,false);
  }
  tick(price:number, timestamp=Date.now()) {
    if(!Number.isFinite(price)||price<=0) throw Error('Bad price');
    this.price=price; this.timestamp=timestamp;
    for(const a of this.accounts) for(const x of [...a.positions]) if(crossed(x,price,this.parameters)) this.finish(a,x,true);
  }
}
