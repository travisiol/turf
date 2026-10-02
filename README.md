# TURF

- **Name**: TURF (in `src/config/site.ts` and `package.json`)
- **Hook**: Take a turf. Earn from every trade.
- **Palette**: background `#F8F4EA`, surface `#FFFDF7`, ink `#162018`, muted `#7D857A`, accent `#28B463` (fills only, never small text on light), accent tint `#DDF3E5`, border `#D9D8CE` (tokens in `src/app/globals.css`)
- **Tile states**: free = surface + border; held = tint + green border; held by you = green fill, light label, price in a surface pill, `YOU`; just taken (last 15 min, by block time) = surface + green border + 6px tint ring, scale 1.04
- **Type**: Space Grotesk (headlines, body, big numbers with tabular-nums) and Roboto Mono (tile prices, addresses), via `next/font/google`
- **Hero**: the 10×10 map is the hero. Accent render `public/hero-turf.png` (grass tile + gold coin), multiplied into the page with a radial mask. Logo: `brand/logo-1024.png` → `public/logo-128.png`, `src/app/icon.png`
- **Concept source**: a Pons coin with 100 on-chain squares that pay their holders from trading fees. Concept only: rules, contract, copy, look and name written from scratch.

## The game (contract `contracts/contracts/Turf.sol`)

100 turfs, ids 0–99 (printed 01–100). `Turf(feeEscrow, startPrice)`; the site's defaults live in
`src/config/game.json` (start price 0.001 ETH, +20%, half of the increase) and a contract test fails if they differ.

- `take(id)` payable: pay at least `price(id)`; the excess is refunded in the same transaction. Then `price = price × 120 / 100` (rounded down).
- **Free turf**: the whole price goes to the earnings pool.
- **Held turf** at price P, holder paid `paid`: holder gets `paid + (P − paid) / 2` (rounded down), the pool gets the rest (the odd wei).
  With +20% steps: holder gets 11/12 of P (their price back + 10%), the pool 1/12.
- **Earnings pool**: every amount (creator fees through `receive()` / the escrow pull, and the pool share of takes) is split equally over **all 100 turfs**:
  `(amount + carry) / 100` each, the remainder carried to the next split. A turf's share goes to whoever holds it at that moment.
  **No turf held yet / free turfs**: a free turf keeps its shares; its first holder receives everything it collected while free. Nothing is stuck
  as long as a turf is eventually taken (a never-taken turf's shares stay in the contract).
  Within a take, the pool share is split before the turf changes hands (the outgoing holder gets this turf's 1/100 of it).
- Pull payments: the outgoing holder's payout and earnings are credited to `claimable`; a contract that rejects ETH cannot block a take.
- `claim()` pays the caller's credited balance + the earnings of the turfs it holds, in one transfer. Reentrancy-guarded.
- Fees reach it like in the previous projects: Pons V2 credits creator fees to the fee recipient in its escrow
  (`0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e`, read on chain as `factory.feeEscrow()`); every take and claim calls `escrow.claim()` first,
  and anyone can call `pull()`. A failing escrow never blocks a take or a claim. A 2300-gas `transfer()` from the escrow is supported.
- Views: `turfs()` (holder, since, takes, price, paid, earned × 100), `totals()`, `claimableOf(account)`, `quote(id)`, `pendingFees()`.
  Events: `Taken(id, from, to, price, toPrevious, toPool)`, `Funded(amount)`, `Claimed(account, amount)`.
- No owner, no pause, no upgrade. Not audited.

## Site

One screen: header, headline + live totals (paid to turfs, per turf per day measured from the first event, held, takes, your turfs + claim)
on the left third, the map on the right. Clicking a turf opens a panel: price to take, what the holder receives (and their profit), what the
turf earned for its holder and since when, the split of your payment, the price after your take, what you get if someone takes it from you,
your claimable, the turf's recent takes. Below the fold: how it works, the exact rules, the coin's price chart (GeckoTerminal via `/api/candles`,
Robinhood Chain only), Trade on Pons, recent takes, FAQ with the limits.

With the addresses unset: 100 free turfs at the start price, zeros, "No takes yet", wallet connect works, Take answers
"Taking turfs is not open yet." on click.

Vercel-safe: no background work, no local files; browser reads go through `/api/rpc`.

## Configuration

`src/config/network.ts` (chain 4663, RPC, explorer — values of `stakeback/src/config/network.ts`), env in `.env.example`:
`NEXT_PUBLIC_TOKEN_ADDRESS`, `NEXT_PUBLIC_TURF_ADDRESS`, `NEXT_PUBLIC_TURF_START_BLOCK`, optional `NEXT_PUBLIC_TRADE_URL`
(defaults to `https://www.ponsfamily.com/launchpad/<token>`), `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

## Commands

    npm install && npm --prefix contracts install
    npm test                   # 15 contract tests
    npm run dev                # http://localhost:3893
    npx eslint . && npx next typegen && npx tsc --noEmit && npx next build
    npm --prefix contracts run node                                       # local chain on 8893
    cd contracts && npx hardhat run scripts/play-local.ts --network localhost   # mock token/escrow + Turf, a short 3-wallet game
    node scripts/capture.mjs   # screenshots into shots/
    node scripts/play-ui.mjs http://localhost:3893 <hardhat account> <turf label>   # connect, take, claim in headless Chrome (local node only)

## Before launch (owner)

1. Deploy `Turf(0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e, 1000000000000000)` and make it the token's creator fee recipient
   (launch with Turf as `creatorFeeRecipient`, which needs Turf deployed first — the escrow is independent of the token — or switch the recipient
   on the curve). Verify on a fork before spending.
2. Set `NEXT_PUBLIC_TOKEN_ADDRESS`, `NEXT_PUBLIC_TURF_ADDRESS`, `NEXT_PUBLIC_TURF_START_BLOCK`.
3. Not audited. Not proven against the real Pons escrow on a fork.
