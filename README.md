# AgentMeter

Pay-per-call USDC metering for software-to-software payments on [Arc](https://arc.network/) — built for the
[Arc Microgrants round 2](https://dorahacks.io/hackathon/arc-microgrants-2/detail) ("Built with Arc Studio") hackathon.

A service (a "provider") registers a price per call. A caller — another service or an AI agent — prepays USDC
credit into a channel with that provider. The provider reports usage as it happens; the contract charges exactly
`calls × pricePerCall` out of the caller's prepaid credit and reverts if credit runs out. The provider pulls what
it earned whenever it wants; the caller can pull back whatever credit is left.

No milestones, no escrow dispute window, no approvals — USDC is Arc's native gas token, so credit moves as plain
native value (`payable` calls and native transfers), not an ERC-20 `approve`/`transferFrom` dance.

## Who this is for

An AI agent or backend service that charges another agent/service per API call (inference, data, a tool call) and
wants a trust-minimized settlement layer: the caller only risks the credit it has already prepaid, the provider
only gets paid for calls it actually reports, and either side can see the running balance on-chain at any time.

## Honesty note

This is a one-person build with AI assistance (Claude Code) for a hackathon submission. The contract and frontend
were written directly rather than captured as a literal Arc Studio session transcript — **the Arc Studio prompt used
to shape this build is in `_private/idea-decision.md`** (not published; it is the internal planning note, not part
of the product). The DoraHacks submission form for this hackathon asks for an Arc Studio project URL as one of its
fields, so running that exact prompt through studio.arc.io (and comparing what it generates against what's already
in this repo) is a required step before submitting, not an optional one; see `_private/` notes for what's still
open.

No contract address is filled in below until the contract is actually deployed. No private key, seed phrase, or API
token lives anywhere in this repo.

## How it works

1. `registerProvider(pricePerCallUSDC)` — a service registers once and gets a `providerId`.
2. `topUp(providerId)` — a caller prepays USDC credit against that provider's channel (a native-value payable call).
3. `recordUsage(providerId, caller, calls)` — only the registered provider's address can call this; it charges
   `calls × pricePerCall` straight out of the caller's channel credit, or reverts if the credit is too low.
4. `withdrawEarned()` — the provider pulls its accumulated USDC.
5. `withdrawUnused(providerId)` — the caller pulls back whatever credit is left in its channel.

The frontend (`docs/`) shows every provider's price and earned balance, a caller's live channel credit (polled every
few seconds and refreshed on every transaction), and a running log of every event the contract has emitted, each
linked to the explorer.

## Contract

`contracts/AgentMeter.sol` — Solidity 0.8.24, no external dependencies, no oracles, no timestamp math (unlike a
streaming/vesting design, this is pure per-call arithmetic, so there is no rounding window to get wrong). 12 Hardhat
tests in `test/AgentMeter.test.ts` cover registration, top-ups, usage charging, insufficient-credit reverts,
dust-sized amounts (price = 1 smallest unit), and both withdrawal paths.

```bash
npm install
npm run compile
npm test
```

## Running the frontend locally

`docs/` is a static site (plain HTML/JS, ethers v6 vendored in `docs/vendor/` — no CDN dependency, no backend, no
API key). Serve it with any static file server, e.g.:

```bash
npx serve docs
```

It reads `docs/config.js` for the ABI, chain configs, and deployed contract addresses. Reading provider/channel data
works with no wallet connected (it talks to the network's public RPC directly); connecting a wallet (MetaMask or
similar) is only needed to send a transaction (register, top up, record usage, withdraw).

Shareable links: `?network=arcTestnet&provider=0&caller=0x...` prefills the provider id and caller address fields.

## Deploying (a human step — this repo never signs or sends a transaction on its own)

1. Copy `.env.example` to `.env` and fill in `PRIVATE_KEY` (a funded testnet or mainnet key — never commit this
   file). Optionally also set `PRIVATE_KEY_CALLER` to a second funded key, so the demo has a real provider address
   and a real caller address instead of one address playing both roles.
2. `npm run demo:testnet` (or `demo:mainnet`) — one command that deploys the contract, writes the address into
   `docs/config.js` under `contractAddresses.arcTestnet` (or `arcMainnet`), and immediately runs the full
   `registerProvider → topUp → recordUsage ×2 → withdrawEarned → withdrawUnused` cycle against it, printing every tx
   hash as an `explorer.{testnet.}arc.io` link ready to paste into the submission/video script. Override
   `PRICE_PER_CALL`, `TOPUP_AMOUNT`, `CALLS_PER_BATCH` env vars to change the demo amounts (defaults keep the whole
   cycle under $1 USDC: price 0.01, top-up 0.5, 5 calls per batch).
   - To deploy and run the cycle as two separate steps instead (e.g. to re-run the cycle later against the same
     contract), use `npm run deploy:testnet`/`deploy:mainnet` followed by `npm run cycle:testnet`/`cycle:mainnet`
     with `CONTRACT_ADDRESS` set to the deployed address.
3. Reload `docs/index.html` — the status line switches from "no contract deployed yet" to the live address.

**Verify the contract addresses you rely on (USDC itself, if you ever need the ERC-20 wrapper) directly against
[docs.arc.io/arc/references/contract-addresses](https://docs.arc.io/arc/references/contract-addresses) or
[explorer.arc.io](https://explorer.arc.io/) before using them** — don't trust a cached copy.

## Known limitation: native USDC decimals assumption

Arc's docs describe USDC — including its native gas role — as 6-decimal. This build assumes the chain's native value
(`msg.value`, `address.balance`) uses that same 6-decimal convention, so `docs/config.js` sets `usdcDecimals: 6` and
every amount typed into the UI (e.g. "0.01") is converted with `ethers.parseUnits(x, 6)`. This build stage has no
network access to call a live Arc RPC itself, so the assumption is still only a documentation read, not a live
measurement. `npm run cycle:testnet` now prints the exact value sent in a `topUp` call next to the caller's actual
balance drop (in both raw units and USDC-formatted) specifically so the human running that command can eyeball the
two numbers once real testnet funds are involved — if the balance drop is off from the sent value by roughly `10^12`,
the assumption is wrong and `usdcDecimals` in `docs/config.js` must change to `18` before any real amount can be
trusted.

## What's mocked / not done

- No contract is deployed yet on testnet or mainnet — `contractAddresses` in `docs/config.js` are empty. The
  `demo:testnet`/`demo:mainnet` npm scripts above (and the `deploy:*`/`cycle:*` pair they're built from) are ready
  and were verified end-to-end against a local Hardhat node (both self-dealing and two-address modes); running them
  for real against Arc still needs a human with a funded key, which this build stage never holds.
- The live-activity screenshot in `screenshots/` was taken against a local Hardhat node standing in for Arc Testnet.
- No video yet — record it after a real testnet (or mainnet) deployment, once channel credit and the activity log
  reflect genuine on-chain transactions.
- **This submission requires a literal Arc Studio project URL** (per the DoraHacks submission form fields — see
  `_private/idea-decision.md`). The contract and frontend here were written directly, not generated through a
  studio.arc.io session; running the Arc Studio prompt in `_private/idea-decision.md` through studio.arc.io and
  getting that project URL is a required human step before submitting, not an optional one — this build stage has no
  web access to do it itself.
