import { TOKEN_ADDRESS } from "./network";

/** The brand, in one place. */
export const site = {
  name: "TURF",
  hook: "Take a turf. Earn from every trade.",
  description:
    "100 turfs on Robinhood Chain. Take one by paying its price. While you hold it, it earns an equal share of the coin's trading fees in ETH. If someone takes it from you, you get your price back plus a profit.",
  url: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3893",
  /** Where "Trade on Pons" points: the env override, else the token's Pons page. Empty: no button. */
  tradeUrl: process.env.NEXT_PUBLIC_TRADE_URL?.trim() || (TOKEN_ADDRESS ? `https://www.ponsfamily.com/launchpad/${TOKEN_ADDRESS}` : ""),
} as const;
