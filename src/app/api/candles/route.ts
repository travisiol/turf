import { CHAIN_ID, TOKEN_ADDRESS } from "@/config/network";
import { dexScreenerUrl, geckoTerminalUrl, isTimeframe, poolCandles, tokenMarket } from "@/lib/geckoterminal";

export const dynamic = "force-dynamic";

// The configured token's main pool on Robinhood Chain (GeckoTerminal) and, with `tf`, its
// candles for that timeframe. Only the configured token is ever read. Served from the
// 5-minute cache in lib/geckoterminal, so visitors never cause one upstream call each.
//   GET /api/candles          -> { market }
//   GET /api/candles?tf=1h    -> { market, candles, links }
export async function GET(request: Request) {
  const tf = new URL(request.url).searchParams.get("tf");
  if (tf !== null && !isTimeframe(tf)) return Response.json({ error: "unknown timeframe" }, { status: 400 });
  const headers = { "cache-control": "public, max-age=60" };
  if (!TOKEN_ADDRESS || CHAIN_ID !== 4663) return Response.json({ market: null, candles: [], links: [] }, { headers });
  const market = await tokenMarket(TOKEN_ADDRESS);
  if (tf === null) return Response.json({ market }, { headers });
  const candles = market ? await poolCandles(market.pool, tf) : [];
  const links = market
    ? [
        { label: "DexScreener", href: dexScreenerUrl(market.pool) },
        { label: "GeckoTerminal", href: geckoTerminalUrl(market.pool) },
      ]
    : [];
  return Response.json({ market, candles, links }, { headers });
}
