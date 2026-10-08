import {SimulatedRelayer} from './adapter.ts';
import type {Config} from './model.ts';
export const scenarios = [
  {name:'tiny',moves:[1.0001],weight:0.25},
  {name:'moderate',moves:[1.001],weight:0.25},
  {name:'large',moves:[1.01],weight:0.25},
  {name:'rapid-reversal',moves:[1.001,0.999],weight:0.25}
];
export async function compare(c:Config,horizon=400) {
  const rows=[];
  for(const leverage of c.leverageCandidates.filter(x=>x<=c.maxLeverage)) {
    const outcomes=[];
    for(const scenario of scenarios) {
      const sim=new SimulatedRelayer(c.capital,c.market);
      let cycles=0;
      for(;cycles<horizon;cycles++) {
        if(sim.accounts.some(a=>a.cash<c.marginPerWallet))break;
        const cash=sim.accounts.reduce((v,a)=>v+a.cash,0);
        if(2*c.marginPerWallet>c.capital-Math.max(0,c.capital-cash))break;
        const entry=sim.price;
        for(let i=0;i<2;i++) await sim.open(sim.accounts[i].id,i===0?1:-1,c.marginPerWallet,leverage,`s-${cycles}-${i}`);
        // No intervention between ticks: models reversals faster than monitoring.
        for(const move of scenario.moves)sim.tick(entry*move);
        for(const a of sim.accounts)for(const p of [...a.positions])await sim.close(a.id,p.id,`c-${p.id}`);
      }
      const lost=c.capital-sim.accounts.reduce((v,a)=>v+a.cash,0), paper=sim.accounts.reduce((v,a)=>v+a.paper,0);
      outcomes.push({scenario:scenario.name,cycles,netUsdcLost:lost,paper,paperPerNetUsdcLost:lost>0?paper/lost:null});
    }
    rows.push({leverage,estimatedWeightedPaper:outcomes.reduce((v,x,i)=>v+x.paper*scenarios[i].weight,0),worstScenarioPaper:Math.min(...outcomes.map(x=>x.paper)),outcomes});
  }
  return rows.sort((a,b)=>b.estimatedWeightedPaper-a.estimatedWeightedPaper);
}
