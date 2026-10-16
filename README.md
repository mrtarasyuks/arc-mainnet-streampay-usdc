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
of the product). If the hackathon's "built in Arc Studio" requirement means the submission must be generated through
studio.arc.io itself, re-running that exact prompt there is a separate step the human needs to do before submitting;
see `_private/` notes for what's still open.

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
   file).
2. `npm run deploy:testnet` (or `deploy:mainnet`) — prints the deployed address.
3. Put that address into `docs/config.js` under `contractAddresses.arcTestnet` (or `arcMainnet`).
4. Reload `docs/index.html` — the status line switches from "no contract deployed yet" to the live address.

**Verify the contract addresses you rely on (USDC itself, if you ever need the ERC-20 wrapper) directly against
[docs.arc.io/arc/references/contract-addresses](https://docs.arc.io/arc/references/contract-addresses) or
[explorer.arc.io](https://explorer.arc.io/) before using them** — don't trust a cached copy.

## Known limitation: native USDC decimals assumption

Arc's docs describe USDC's ERC-20 wrapper as using 6 decimals. This build assumes the chain's native value
(`msg.value`, `address.balance`) uses the same 6-decimal convention, so `docs/config.js` sets `usdcDecimals: 6` and
every amount typed into the UI (e.g. "0.01") is converted with `ethers.parseUnits(x, 6)`. **This has not been
verified against a live Arc RPC** (this build environment has no network access to check it). If Arc's native
currency instead follows the common 18-decimal EVM convention, every amount in this app would be off by 10^12 and
must be rescaled before any real deployment. Confirm this against docs.arc.io or by sending a tiny top-up on testnet
and checking the resulting balance delta before moving real USDC.

## What's mocked / not done

- No contract is deployed yet on testnet or mainnet — `contractAddresses` in `docs/config.js` are empty.
- The live-activity screenshot in `screenshots/` was taken against a local Hardhat node standing in for Arc Testnet
  (real testnet/mainnet deployment needs a funded key, which this build stage does not hold).
- No video yet — record it after a real testnet (or mainnet) deployment, once channel credit and the activity log
  reflect genuine on-chain transactions.
