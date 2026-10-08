import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defaults,settlement,mintEstimate,validate} from '../src/model.ts';
import {SimulatedRelayer,LiveUnavailable} from '../src/adapter.ts';
import {Audit} from '../src/audit.ts';
import {Engine} from '../src/engine.ts';
import {compare} from '../src/strategy.ts';
const base=JSON.parse(readFileSync('config/dry-run.json','utf8'));
function setup(){const dir=mkdtempSync(join(tmpdir(),'paper-test-'));const c={...base,stateDirectory:dir,emergencyFile:join(dir,'STOP')};const a=new SimulatedRelayer(c.capital,c.market);return {c,a,e:new Engine(a,c,new Audit(dir,false))};}
test('deadband, asymmetry, win fee, loss fee and full liquidation',()=>{
 const p=defaults('BTC'),x={id:'x',side:1 as const,entry:100,margin:25,leverage:100};
 assert.equal(settlement(x,100.001,p).pnl,0);
 const move=0.001-p.deadband,scale=0.9/(1+1/(move*15000)+100000/(1e6*move*814.598));
 assert.ok(Math.abs(settlement(x,100.1,p).pnl-2500*move*scale*0.98)<1e-9);
 assert.ok(Math.abs(settlement(x,99.9,p).basis-2.45)<1e-9);
 assert.equal(settlement(x,99.9,p,true).pnl,-25);
 assert.equal(settlement(x,99.9,p,true).basis,25);
 p.queueNonempty=true;assert.ok(Math.abs(settlement(x,99.9,p).basis-2.5)<1e-9);
});
test('mint flat, tail ratchet and threshold integration',()=>{
 const p=defaults('BTC');assert.equal(mintEstimate(100,p),10000);
 p.trackedLp=2000000;p.tailProgress=120000000;
 assert.ok(mintEstimate(100,p)<2500&&mintEstimate(100,p)>2499);
 p.trackedLp=1999999;p.tailProgress=0;assert.ok(mintEstimate(2,p)<200&&mintEstimate(2,p)>199.99);
});
test('rapid reversal can liquidate both wallets',async()=>{
 const a=new SimulatedRelayer(2000,'BTC');await a.open('sim-long',1,25,1000,'1');await a.open('sim-short',-1,25,1000,'2');
 a.tick(100.1);a.tick(99.9);assert.equal(a.accounts.flatMap(x=>x.positions).length,0);
 assert.equal(a.accounts.reduce((v,x)=>v+x.cash,0),1950);
 assert.ok(a.accounts.every(x=>x.paper>0));
});
test('partial second-leg failure flattens first, stops, audits',async()=>{
 const {a,e,c}=setup();a.failOpenAccount='sim-short';assert.equal(await e.openPair(100),false);
 assert.equal(e.stopped,true);assert.ok(a.accounts.every(x=>!x.positions.length));
 assert.match(readFileSync(join(c.stateDirectory,'events.jsonl'),'utf8'),/flat-confirmed/);
});
test('uncertain close requires manual intervention and blocks restart',async()=>{
 const {a,e,c}=setup();a.failOpenAccount='sim-short';a.failClose=true;await e.openPair(100);
 assert.equal(e.stopped,true);assert.equal(a.accounts[0].positions.length,1);
 assert.throws(()=>new Engine(a,c,new Audit(c.stateDirectory,false)),/review/);
});
test('stale price, emergency, overfunding, margin cap and daily reservation',async()=>{
 for(const kind of ['stale','emergency','funding','leverage','daily']){
  const {a,e,c}=setup();
  if(kind==='stale')a.timestamp=Date.now()-10000;
  if(kind==='emergency')writeFileSync(c.emergencyFile,'stop');
  if(kind==='funding')a.accounts[0].funded=1100;
  if(kind==='daily'){e.day=new Date().toISOString().slice(0,10);e.dayBaseline=2300;e.baseline=2000;}
  assert.equal(await e.openPair(kind==='leverage'?1001:100),false);assert.ok(e.stopped);
  assert.ok(a.accounts.every(x=>!x.positions.length));
 }
 assert.throws(()=>validate({...base,capital:2001}));
});
test('drift liquidation closes surviving leg',async()=>{
 const {a,e}=setup();assert.equal(await e.openPair(1000),true);a.tick(100.1);await e.monitor();
 assert.ok(e.stopped);assert.ok(a.accounts.every(x=>!x.positions.length));
});
test('idempotent mocked intent and deterministic strategy',async()=>{
 const a=new SimulatedRelayer(2000,'ETH');await a.open('sim-long',1,25,100,'same');await a.open('sim-long',1,25,100,'same');assert.equal(a.accounts[0].positions.length,1);
 const c={...base,leverageCandidates:[10,100,1000]};assert.deepEqual(await compare(c,10),await compare(c,10));
 const rows=await compare(c,10);assert.equal(rows.length,3);assert.ok(rows.every(x=>x.outcomes.length===4));
});
test('live cannot construct or collect keys',()=>{assert.throws(()=>new LiveUnavailable(),/LIVE DISABLED/);});
test('audit tampering detected',()=>{const {e,c}=setup();e.stop('test');const f=join(c.stateDirectory,'events.jsonl');writeFileSync(f,readFileSync(f,'utf8').replace('test','changed'));assert.throws(()=>new Audit(c.stateDirectory,false),/integrity/);});
test('full capital loss stop and a second pair cannot open',async()=>{
 const first=setup();first.a.accounts.forEach(a=>a.cash=0);await first.e.monitor();assert.ok(first.e.stopped);
 assert.match(readFileSync(join(first.c.stateDirectory,'events.jsonl'),'utf8'),/Combined capital-loss stop/);
 const second=setup();assert.ok(await second.e.openPair(10));assert.equal(await second.e.openPair(10),false);
 assert.ok(second.e.stopped);assert.ok(second.a.accounts.every(a=>a.positions.length===0));
});
