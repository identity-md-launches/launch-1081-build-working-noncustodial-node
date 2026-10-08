# Paper capital bot

A dependency-free Node 24 / TypeScript two-wallet PAPER farming simulator and risk engine. It evaluates cumulative PAPER minted under a combined 2,000 USDC capital budget, not trading profit. **Live trading is unavailable and cannot be enabled in this version.** No keys are requested or read.

The official docs are reachable, but the linked exchange returned HTTP 404 during inspection on 2026-10-08. Contract addresses are TBA; no authorized relayer URL or exact signed-intent schema could be verified. The bot does not invent these, submit contract transactions, or automate browser clicks. See [verification evidence](docs/verification.md).

## Run offline

Install Node **24** as the runtime prerequisite. There are no npm dependencies, package downloads, build step, compiler, or submodules. Node 24 executes the erasable TypeScript directly. `npm install` is unnecessary.

```sh
node --test test/*.test.ts
node src/cli.ts compare
node src/cli.ts dry-run
node src/cli.ts connectivity   # optional: read-only network check
node src/cli.ts live           # always refuses, nonzero exit
```

The default command is dry-run. It persists `runtime/dry-run/state.json` and a hash-chained, fsynced `events.jsonl`; alerts are JSON lines on stdout for journald. These are public simulated data, never secrets. Reusing an existing state directory refuses to run: review its history, then use a fresh directory **for a new simulation only**. Edit a copy of [config/dry-run.json](config/dry-run.json) and pass its path as the second argument. A new directory must never be used to reset a real capital-loss history.

To stop, create `runtime/STOP` or send SIGINT/SIGTERM. The engine attempts to close known outstanding positions and blocks new opens. A failed/unconfirmed close emits a manual-intervention stop. Nothing can guarantee immediate close during outages.

## What the strategy measures

Each account gets half the simulated funding. A pair has equal margin and leverage, hence equal entry notional. Only one pair is permitted. Closing and reopening implements rebalancing; capital is not transferred between wallets. Trading stops when either account lacks margin. Profitable payouts are assumed immediately spendable in the solvent simulation; queued payouts cannot be treated as available cash in a future live implementation.

The comparison replays seven leverages (10–1000x), four explicit price paths, and at most 400 cycles per path. Equal path weights are hypothetical, not a volatility forecast. It ranks **estimated cumulative PAPER**, also reporting PAPER/net USDC lost and the worst scenario. [Recorded comparison](docs/comparison.json) includes every result. The horizon, asymmetric wallet depletion, LP state, and fast reversals all change rankings. No globally optimal leverage or profitable hedge is established. This example ranks 1000x first under its assumptions; that is not authorization or a recommendation to trade at 1000x.

Documentation-default deadband, asymmetric haircut, 2% win fee, LP-side loss fee, approximate liquidation buffer, and flat/ratcheting mint curve are implemented. The exact liquidation trigger and contract integer rounding are unverified; mint calculations use a continuous curve integral estimate. Simulator mint events are estimates, not evidence of minted tokens. Read [economics and limitations](docs/economics.md).

The comparison models price ticks arriving faster than intervention. The operational dry-run checks each pair, then halts and closes a surviving leg after liquidation/drift. It can therefore stop much earlier than the comparison horizon. A stop is intentional risk behavior, not a demonstration of completing a capital-spending campaign.

## Safety and verification

- Funding >2,000 USDC is rejected, including a lower configured capital cap. Worst-case full loss of both margins is reserved before opening; per-pair, daily (UTC), margin, leverage and lifetime capital-loss limits apply. Gains do not reset the initial funding baseline.
- Each quote must be positive and fresh. Position/account snapshots and PAPER events are polled and persisted; fills require reconciliation, not just request acceptance. A failed second leg, unknown fill, drift, stale quote or polling failure stops entry and attempts flattening. Opens are never blindly retried.
- Restart requires review, preserving crash ambiguity. Pair intentions precede submission in the durable audit log. Hash chaining detects accidental corruption/tampering relative to local history; it is not an external audit or proof against a filesystem administrator.
- Live construction fails before reading secrets or making requests. The adapter interface and simulated relayer are implemented and tested; **no supported live trading, actual account/position polling, onchain parameter polling, PAPER event indexing or session-key signing was verified or implemented**. These require published deployment/interface evidence, not arbitrary owner-supplied endpoints.

Eleven deterministic tests cover economics, mint thresholds, both-wallet liquidation, partial/uncertain execution, risk gates, idempotent mock intents, drift, replay and audit integrity. They passed on Node 24.21.0. See [demo](docs/dry-run.md), [read-only checks](docs/connectivity.json), and [separate-service deployment guide](docs/deployment.md). Runtime type stripping is not static TypeScript type checking.

## Before any future live release

The user must manually fund and register **two distinct revocable session keys**, scoped to open/close only, account-bound and expiring. Store keys separately in protected OS credentials, never source, logs, seed phrases, submission artifacts or GitHub. Owner signatures, withdrawals, key registration/revocation and bridging remain manual. A compromised session key can lose the funded balance even though it cannot withdraw it.

Actually fund **no more than 2,000 USDC total across the two isolated bot wallets**, including later deposits. Keep unrelated assets and unlimited approvals out of them. Software stops alone cannot guarantee a loss ceiling; full margin on both sides can disappear in a fast reversal. Budget bridge/gas costs within the user's total spending and fund less accordingly. PAPER is nontransferable at launch; its value and staking returns are uncertain and excluded from optimization. Do not count PAPER as USDC or withdrawable profit.

## Operators and trust

The user funds, registers/revokes keys, approves risk and starts/stops the service to acquire PAPER; the incentive may not cover their USDC losses. The bot's scheduler would sign open/close intents; only the authorized relayer can submit them and pay gas. Protocol keepers trigger liquidation and queue maintenance, incentivized/operated by the protocol. None of these transitions happens automatically just because a timer exists. Protocol owners can upgrade implementations and change parameters; the relayer can refuse service; oracle and keeper failures remain risks. Account activity would be public onchain. HyperEVM execution is distinct from HyperCore and Arbitrum; this project sends no bridges or transfers and uses timestamps for freshness/daily windows, not block numbers.

The repository is source ready for GitHub. It was not published: no GitHub destination or publishing credentials were supplied, and no external service was changed.
