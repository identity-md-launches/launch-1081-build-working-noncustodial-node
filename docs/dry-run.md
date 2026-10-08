# Recorded dry-run

Executed on Node 24.21.0 with the default configuration. No wallet or network access occurred during simulation. The strategy selected 1000x under the hypothetical comparison inputs; after the second cycle a liquidation caused drift and the engine stopped and flattened the surviving leg. Amounts are floating-point simulation estimates.

```jsonl
{"kind":"simulation-start","data":{"leverage":1000,"candidateScores":[{"leverage":1000,"paper":123949.99999999725},{"leverage":500,"paper":85656.87499999584},{"leverage":250,"paper":79215.93749999654},{"leverage":100,"paper":75351.37499999686},{"leverage":50,"paper":49658.187499998414},{"leverage":25,"paper":36772.84374999921},{"leverage":10,"paper":29102.887499999713}],"warning":"No real accounts, no signatures, no transactions"}}
{"kind":"fill-confirmed","data":{"account":"sim-long","position":{"id":"pair-1-0","side":1,"margin":25,"leverage":1000,"entry":100}}}
{"kind":"fill-confirmed","data":{"account":"sim-short","position":{"id":"pair-1-1","side":-1,"margin":25,"leverage":1000,"entry":100}}}
{"kind":"flat-confirmed","data":{}}
{"kind":"paper-mint","data":{"id":"mint-pair-1-1","account":"sim-short","amount":249.99999999997246,"basis":2.4999999999997247}}
{"kind":"fill-confirmed","data":{"account":"sim-long","position":{"id":"pair-2-0","side":1,"margin":25,"leverage":1000,"entry":100.01}}}
{"kind":"fill-confirmed","data":{"account":"sim-short","position":{"id":"pair-2-1","side":-1,"margin":25,"leverage":1000,"entry":100.01}}}
{"kind":"paper-mint","data":{"id":"mint-pair-2-1","account":"sim-short","amount":2500,"basis":25}}
{"kind":"stop","data":{"reason":"Position drift / possible liquidation"}}
{"kind":"flat-confirmed","data":{}}
{"kind":"flat-confirmed","data":{}}
{"kind":"simulation-summary","data":{"paper":2749.9999999999723,"netUsdcLost":8.867500088889756,"paperPerNetUsdcLost":310.1212260990552,"stopped":true}}
```

The persistent audit includes full snapshots, intentions, event identifiers and a hash chain. The compact transcript above omits routine snapshots. Rerun with a fresh simulation state directory to reproduce the amounts.
