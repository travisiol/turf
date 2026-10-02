"use client";

import { explorer } from "@/config/network";
import { ago, fmt, shortAddress, turfLabel } from "@/lib/format";
import { ZERO, useActivity } from "@/lib/game";

/** Every take, newest first, from the contract's Taken events. */
export function RecentTakes() {
  const a = useActivity();
  const rows = a.data?.takes ?? [];
  const now = a.data?.now ?? 0;
  return (
    <div className="card p-6 sm:p-8">
      <h2 className="text-2xl font-bold tracking-tight">Recent takes</h2>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-3xl bg-paper p-5 text-ink-2">{a.isFetching && !a.data ? "Reading takes…" : "No takes yet."}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[15px]">
            <thead>
              <tr className="text-[13px] text-ink-2">
                <th className="py-2 font-medium">Turf</th>
                <th className="py-2 font-medium">Taken by</th>
                <th className="py-2 font-medium">From</th>
                <th className="py-2 text-right font-medium">Paid</th>
                <th className="py-2 text-right font-medium">To previous</th>
                <th className="py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.slice(0, 15).map((t) => (
                <tr key={t.tx + t.id}>
                  <td className="py-2.5 font-bold">{turfLabel(t.id)}</td>
                  <td className="mono py-2.5 text-[14px]">{shortAddress(t.to)}</td>
                  <td className="mono py-2.5 text-[14px] text-ink-2">{t.from === ZERO ? "free" : shortAddress(t.from)}</td>
                  <td className="num py-2.5 text-right">{fmt(t.price, 18, 6)} ETH</td>
                  <td className="num py-2.5 text-right">{t.toPrevious > 0n ? `${fmt(t.toPrevious, 18, 6)} ETH` : "—"}</td>
                  <td className="py-2.5 text-right">
                    <a href={explorer.tx(t.tx)} target="_blank" rel="noreferrer" className="text-ink-2 underline decoration-line underline-offset-4">
                      {t.time && now ? ago(t.time, now) : "tx"}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
