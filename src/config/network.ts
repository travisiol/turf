import { defineChain, getAddress, isAddress, type Address } from "viem";

/**
 * Network, token and game configuration — the only place addresses live.
 *
 * Nothing here is guessed:
 * - Chain id, RPC and explorer are the values of the verified config in
 *   `stakeback/src/config/network.ts` (official Robinhood Chain docs; chain
 *   id read from the RPC: 0x1237 = 4663). The env overrides exist for a
 *   local hardhat node only.
 * - The Pons V2 fee escrow address was read on chain (`factory.feeEscrow()`)
 *   and is the escrow the Turf contract is deployed with.
 * - Token and game contract are `null` until the owner sets them.
 */
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 4663);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL?.trim() || "https://rpc.mainnet.chain.robinhood.com";
export const EXPLORER_URL = (process.env.NEXT_PUBLIC_EXPLORER_URL?.trim() || "https://robinhoodchain.blockscout.com").replace(/\/$/, "");

/** The browser reads through our same-origin relay (see app/api/rpc); the server goes direct. */
export const BROWSER_RPC_URL = "/api/rpc";

/** Pons V2 fee escrow on Robinhood Chain (verified on chain, see README). */
export const PONS_FEE_ESCROW: Address = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";

function parseAddress(raw: string | undefined): Address | null {
  const v = raw?.trim();
  return v && isAddress(v) ? getAddress(v) : null;
}

/** The token whose trades pay the turfs. `null` until set. */
export const TOKEN_ADDRESS: Address | null = parseAddress(process.env.NEXT_PUBLIC_TOKEN_ADDRESS);

/** The Turf game contract. `null` until set. */
export const TURF_ADDRESS: Address | null = parseAddress(process.env.NEXT_PUBLIC_TURF_ADDRESS);

/** First block to read game events from (the deploy block). 0 = the last LOOKBACK_BLOCKS. */
export const TURF_START_BLOCK = BigInt(process.env.NEXT_PUBLIC_TURF_START_BLOCK || 0);
export const LOOKBACK_BLOCKS = 400_000n;

export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_ID === 4663 ? "Robinhood Chain" : "Local chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Explorer", url: EXPLORER_URL } },
  testnet: CHAIN_ID !== 4663,
});

export const explorer = {
  address: (a: string) => `${EXPLORER_URL}/address/${a}`,
  token: (a: string) => `${EXPLORER_URL}/token/${a}`,
  tx: (h: string) => `${EXPLORER_URL}/tx/${h}`,
};
