import game from "./game.json";

/**
 * The game's numbers as the site prints them. They are the Turf contract's
 * constants (a contract test fails if they differ). When a contract address is
 * set, the live start price is read from it; this value is only the default.
 */
export const TURFS = game.turfs;
export const START_PRICE = BigInt(game.startPriceWei);
export const PRICE_STEP_PCT = BigInt(game.priceStepPct);
/** "+20%" */
export const RISE_PCT = game.priceStepPct - 100;
/** Share of the increase paid to the previous holder, in percent ("half"). */
export const PREVIOUS_SHARE_PCT = BigInt(game.previousShareOfIncreasePct);

/** Exactly the contract's quote(): what a take at `price` pays, given what the holder paid (0n = free turf). */
export function split(price: bigint, paid: bigint, held: boolean) {
  const toPrevious = held ? paid + ((price - paid) * PREVIOUS_SHARE_PCT) / 100n : 0n;
  const toPool = price - toPrevious;
  const nextPrice = (price * PRICE_STEP_PCT) / 100n;
  return { toPrevious, toPool, nextPrice };
}
