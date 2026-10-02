import { formatUnits } from "viem";

/** A token or ETH amount with at most `digits` decimals, trailing zeros removed, thousands grouped. */
export function fmt(value: bigint, decimals = 18, digits = 4): string {
  const s = formatUnits(value, decimals);
  const [int, frac = ""] = s.split(".");
  const grouped = BigInt(int).toLocaleString("en-US");
  const cut = frac.slice(0, digits).replace(/0+$/, "");
  if (!cut && value !== 0n && BigInt(int) === 0n) {
    // smaller than the shown precision: show significant digits instead of 0
    const sig = frac.match(/^0*\d{1,3}/)?.[0]?.replace(/0+$/, "") ?? "";
    return sig ? `0.${sig}` : "0";
  }
  return cut ? `${grouped}.${cut}` : grouped;
}

export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Chart prices in USD: `$0.000383431` below a dollar (3 significant digits past the zeros), `$1.234`, `$12,345`. */
export function formatPrice(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  if (p === 0) return "$0";
  const abs = Math.abs(p);
  if (abs >= 1000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (abs >= 1) return `$${p.toFixed(abs >= 100 ? 2 : 3)}`;
  const digits = Math.min(12, Math.ceil(-Math.log10(abs)) + 3);
  return `$${p.toFixed(digits)}`;
}

/** Short ETH figure for a tile: two significant digits below 1 ("0.0012"), two decimals above. */
export function compactEth(value: bigint): string {
  const n = Number(formatUnits(value, 18));
  if (n === 0) return "0";
  if (n >= 1) return n.toFixed(2).replace(/\.?0+$/, "");
  return n.toPrecision(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** "3 min ago", "2 h ago", "4 d ago" from unix seconds. */
export function ago(ts: number, now: number): string {
  const s = Math.max(0, now - ts);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

/** Turf numbers are printed 01–100 (contract ids 0–99). */
export function turfLabel(id: number): string {
  return String(id + 1).padStart(2, "0");
}
