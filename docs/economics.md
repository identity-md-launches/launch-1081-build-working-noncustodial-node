# Economics implemented

For margin M and leverage L, notional N=M·L. Signed raw PnL is N times the price return. Winning moves first lose 1/50,000 of entry price (0.2 bp). For residual move d>0:

```
scale = (1-baseRate) / (1 + 1/(d*rateMultiplier)
                       + referenceNotional/(1e6*d*positionMultiplier))
creditedWin = N*d*scale*(1-winFee)
```

Docs launch defaults: baseRate .1, rateMultiplier 15,000, referenceNotional 100,000, BTC positionMultiplier 814.598, ETH 483.979; winFee .02. Negative PnL is capped at full margin. Solvent losing closes mint on 98% of loss; insolvent/queued closes on full loss. Liquidation loses and mints on full margin, without recovering close-path equity. Pair PnL is thus negative even at symmetric entry/exit: the winning side is reduced while losing PnL is not. PAPER per net loss can exceed 100 because positive cash payouts recycle capital, but separate wallet depletion constrains repetition.

The approximate trigger used in simulation is `entry*(1-side*(1/L-.0005))`. Exact deployed arithmetic is unavailable. At 1000x the fixed 5 bp buffer consumes about half the margin's price cushion. A up/down reversal can liquidate both isolated positions before this bot polls again. No hedge guarantees preservation of principal. At lower leverage the adverse move needed for liquidation is larger.

Documented mint defaults: flat rate 100 PAPER per eligible USDC below tracked LP 2M; tail marginal rate `100*(120M/(120M+H))^2`, with H a one-way cumulative tail-progress ratchet. We integrate this curve over the estimated mint basis, splitting threshold-crossing losses. Staker drains must not reset H. Loss cash parked for queue payment does not increase tracked LP. Actual contract accounting, rounding, queued debt destruction, LP changes by other traders and keeper activity require verified onchain reads/events. This simulation starts tracked LP=0, H=0 and an empty queue; **none are claims about current LP state**. Changing these assumptions requires changing simulation parameters deliberately, not labeling docs defaults live.

Comparison paths are +1 bp, +10 bp, +100 bp, and +10 bp then −10 bp relative to entry. They are deterministic stress inputs with equal illustrative weights. The 400-cycle cap is a planning horizon, not a claim of unlimited recycling. Daily stops in the operational engine may limit activity to fewer cycles; no scheduler resumes automatically after a stop. Reported PAPER ignores staking value, eventual transferability, taxes, USDC depeg, bridge costs and opportunity cost. There is no demonstrated profitable strategy or guaranteed maximum PAPER amount.
