# Public-interface verification — 2026-10-08 UTC

Inspected the canonical [landing page](https://papertrade.xyz/), its linked [docs](https://docs.papertrade.xyz/), and linked [exchange](https://exchange.papertrade.xyz/). Fetching exchange HTML returned HTTP 404, `Not found`, no frontend asset references. We did not probe guessed APIs, credentials, bypasses or browser clicks. Documentation is a client-rendered site: public bundle `https://docs.papertrade.xyz/assets/index-Crm0Tgz1.js` contains its articles, with an indicated update date of 2026-10-06. [Connectivity record](connectivity.json) includes URLs, timestamps, HTTP status, byte lengths and SHA-256 hashes. The reproducible connectivity command only GETs these public pages and the script explicitly linked by the docs HTML.

| Required live information | Finding |
|---|---|
| Authorized relayer base URL / route | Not published in inspected docs; unavailable frontend |
| Open/close HTTP request schema | Unverified; none shipped |
| Response, error and fill status schema | Unverified; none shipped |
| EIP-712 domain (name/version/chain/verifyingContract) | Unverified; none shipped |
| Primary types, fields/order, nonce/deadline/signature encoding | Unverified; none shipped |
| Session registration/scopes/delegation schema | Unverified; docs describe open/close permissions only |
| Deployment addresses / ABI / PAPER event schema | All eight listed contract addresses TBA |
| Relayer access / authorization for this bot | Unverified; no access attempted |
| Current LP, queue, markets, mint parameters | No deployed read interface available; docs defaults only |

Evidence articles (hash routes are rendered from the same bundle):

- [Architecture](https://docs.papertrade.xyz/#/how/architecture): BatchExecutor accepts authorized relayers, user intents are checked onchain. Third-party frontends still require the relayer.
- [Contract addresses](https://docs.papertrade.xyz/#/dev/contract-addresses): HyperEVM mainnet chain 999; deployment address entries TBA. We use no guessed contract addresses or RPCs.
- [Session keys](https://docs.papertrade.xyz/#/learn/session-keys): trading permissions, no withdrawal/staking authority, 30-day sessions, hour-long trade intents, wallet-driven revocation.
- [Asymmetric impact](https://docs.papertrade.xyz/#/how/asymmetric-impact), [risk](https://docs.papertrade.xyz/#/how/risk), [liquidations](https://docs.papertrade.xyz/#/learn/liquidations), [mint curve](https://docs.papertrade.xyz/#/how/mint-curve): economics encoded as simulation defaults.

This is **not** a verified live adapter. An interface name such as `openPositionBySig` does not reveal its ABI or typed signature. No fabricated endpoint or signing schema is present. Mock adapter types in `src/model.ts` describe this simulator, not Papertrade's HTTP wire protocol.

A future live release needs official deployment addresses with matching code/ABI, versioned intent and relayer specifications, independently verified scoped session permissions, non-secret read methods/event definitions and authorized access. Implement signature/domain/nonce/deadline tests against official vectors, receipt/event reconciliation, cumulative deposit accounting (including queued debt and withdrawals), parameter/oracle polling with finality handling, and an explicit operator approval gate. Do not turn this simulator into live trading by supplying an arbitrary URL or key. No requirement to give a private key to obtain these public specifications.
