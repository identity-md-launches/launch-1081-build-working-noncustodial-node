import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {SimulatedRelayer,LiveUnavailable} from './adapter.ts';
import {validate} from './model.ts';
import type {Config} from './model.ts';
import {Audit} from './audit.ts';
import {Engine} from './engine.ts';
import {compare,scenarios} from './strategy.ts';
import {connectivity} from './connectivity.ts';
async function main() {
  const command=process.argv[2]??'dry-run';
  if(command==='live') {new LiveUnavailable();return;}
  if(command==='connectivity'){console.log(JSON.stringify(await connectivity(),null,2));return;}
  if(!['dry-run','compare'].includes(command))throw Error('Usage: node src/cli.ts [dry-run|compare|connectivity|live] [config.json]');
  const c:Config=JSON.parse(readFileSync(process.argv[3]??resolve('config/dry-run.json'),'utf8'));validate(c);
  const candidates=await compare(c);
  if(command==='compare'){console.log(JSON.stringify({warning:'SIMULATION: documentation defaults; equal scenario weights are assumptions, not forecasts. 400-cycle horizon, no staking value, no current LP snapshot. Daily stops may extend the elapsed time.',candidates},null,2));return;}
  const adapter=new SimulatedRelayer(c.capital,c.market);
  const audit=new Audit(c.stateDirectory), engine=new Engine(adapter,c,audit);
  process.on('SIGINT',()=>{engine.stop('SIGINT emergency stop');});
  process.on('SIGTERM',()=>{engine.stop('SIGTERM emergency stop');});
  const leverage=candidates[0].leverage;
  audit.event('simulation-start',{leverage,candidateScores:candidates.map(x=>({leverage:x.leverage,paper:x.estimatedWeightedPaper})),warning:'No real accounts, no signatures, no transactions'});
  for(let cycle=0;cycle<c.cycles&&!engine.stopped;cycle++) {
    if(!await engine.openPair(leverage))break;
    const scenario=scenarios[cycle%scenarios.length],entry=adapter.price;
    for(const move of scenario.moves)adapter.tick(entry*move);
    await engine.monitor();await engine.flatten();await engine.reconcile();
  }
  const s=await adapter.poll(),paper=s.accounts.reduce((v,a)=>v+a.paper,0),lost=c.capital-s.accounts.reduce((v,a)=>v+a.cash,0);
  audit.event('simulation-summary',{paper,netUsdcLost:lost,paperPerNetUsdcLost:lost>0?paper/lost:null,stopped:engine.stopped});
}
main().catch(()=>{console.error(process.argv[2]==='live'?'LIVE DISABLED: no verified authorized relayer URL, typed-signature schema or deployed contracts. See docs/verification.md.':'Command failed. Review configuration, existing audit state, and docs/verification.md. No secrets are printed.');process.exitCode=1;});
