"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { useConnection, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { CHAIN_ID, TURF_ADDRESS, explorer } from "@/config/network";
import { RISE_PCT } from "@/config/game";
import { site } from "@/config/site";
import { turfAbi } from "@/lib/abi";
import { compactEth, fmt, turfLabel } from "@/lib/format";
import { ZERO, hasGame, perTurfPerDay, useActivity, useBoard, useClaimable, useMounted, type TurfRow } from "@/lib/game";
import { TurfPanel, reason } from "./TurfPanel";
import { ConnectDialog } from "./wallet/ConnectDialog";

const FRESH_SECONDS = 15 * 60;

function Stat({ k, v, unit }: { k: string; v: string; unit?: string }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-ink-2">{k}</p>
      <p className="num mt-0.5 text-[22px] font-bold leading-tight lg:text-[28px]">
        {v}
        {unit ? <span className="ml-1 text-[15px] font-medium text-muted lg:text-lg">{unit}</span> : null}
      </p>
    </div>
  );
}

export function Game() {
  const mounted = useMounted();
  const { address } = useConnection();
  const me = mounted ? address : undefined;
  const { rows, totals, loading, refetch } = useBoard();
  const activity = useActivity();
  const claimable = useClaimable(me);
  const client = usePublicClient();
  const { chainId } = useConnection();
  const { mutateAsync: write } = useWriteContract();
  const { mutateAsync: switchChain } = useSwitchChain();
  const [selected, setSelected] = useState<number | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ text: string; tx?: string } | null>(null);
  const [claiming, setClaiming] = useState(false);

  const now = activity.data?.now ?? 0;
  const takes = activity.data?.takes ?? [];
  const perDay = perTurfPerDay(totals.distributed, activity.data);
  const mine = me ? rows.filter((r) => r.holder.toLowerCase() === me.toLowerCase()) : [];
  const owed = claimable.data ?? 0n;
  const cheapest = rows.reduce((m, r) => (r.price < m ? r.price : m), rows[0]?.price ?? 0n);

  const stateOf = (r: TurfRow) => {
    if (r.holder === ZERO) return "free";
    if (me && r.holder.toLowerCase() === me.toLowerCase()) return "you";
    if (now && r.since && now - r.since < FRESH_SECONDS) return "fresh";
    return "held";
  };

  const done = useCallback(() => {
    void refetch();
    void activity.refetch();
    void claimable.refetch();
  }, [refetch, activity, claimable]);

  const claim = async () => {
    setClaimMsg(null);
    if (!hasGame || !TURF_ADDRESS || !client) return setClaimMsg({ text: "Claiming is not open yet." });
    try {
      setClaiming(true);
      if (chainId !== CHAIN_ID) await switchChain({ chainId: CHAIN_ID });
      const hash = await write({ address: TURF_ADDRESS, abi: turfAbi, functionName: "claim" });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted.");
      setClaimMsg({ text: `Claimed ${fmt(owed, 18, 6)} ETH.`, tx: hash });
      done();
    } catch (e) {
      setClaimMsg({ text: reason(e) });
    } finally {
      setClaiming(false);
    }
  };

  const sel = selected === null ? null : rows[selected];

  return (
    <section className="wrap grid grid-cols-1 gap-5 pb-6 min-h-[calc(100svh-64px)] lg:min-h-[calc(100svh-72px)] content-start lg:content-center lg:grid-cols-[34%_1fr] lg:items-center lg:gap-6 lg:pb-4">
      <div className="min-w-0">
        <h1 className="display text-[34px] lg:text-[clamp(48px,4.6vw,76px)]">
          Take a turf.
          <br />
          Earn from every trade.
        </h1>
        <p className="mt-3 max-w-[460px] text-[15px] leading-snug text-ink-2 lg:mt-5 lg:text-lg lg:leading-relaxed">
          {rows.length} turfs. Pay a turf&apos;s price to take it. While you hold it, it earns 1/100 of the coin&apos;s trading fees in ETH. If someone takes it, you get your price back
          plus a profit.
        </p>

        <div className={`relative -my-3 -ml-12 hidden h-[227px] w-[340px] ${me ? "" : "lg:block"}`} aria-hidden>
          <Image src="/hero-turf.png" alt="" fill sizes="340px" className="render object-contain" preload />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 lg:mt-1 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-4">
          <Stat k="Paid to turfs" v={loading ? "…" : compactEth(totals.distributed)} unit="ETH" />
          <Stat k="Per turf, per day" v={perDay === null ? "—" : compactEth(perDay)} unit={perDay === null ? undefined : "ETH"} />
          <Stat k="Cheapest turf" v={loading ? "…" : compactEth(cheapest)} unit="ETH" />
          <div className="hidden lg:block">
            <Stat k="Turfs held" v={loading ? "…" : `${totals.held}`} unit={totals.takes > 0n ? `/ ${rows.length} · ${totals.takes} ${totals.takes === 1n ? "take" : "takes"}` : `/ ${rows.length}`} />
          </div>
        </div>

        {me ? (
          <div className="mt-5 rounded-3xl bg-surface p-4 shadow-[0_10px_30px_-18px_rgba(22,32,24,0.35)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink-2">Your turfs</p>
                <p className="mt-0.5 truncate font-bold">{mine.length ? mine.map((r) => turfLabel(r.id)).join(" · ") : "None yet. Pick one on the map."}</p>
              </div>
              {owed > 0n ? (
                <button type="button" className="btn btn-ink btn-sm" disabled={claiming} onClick={claim}>
                  {claiming ? "Claiming…" : `Claim ${fmt(owed, 18, 6)} ETH`}
                </button>
              ) : (
                <span className="text-[14px] text-ink-2">Nothing to claim yet.</span>
              )}
            </div>
            {claimMsg ? (
              <p className="mt-2 text-[14px]" role="status">
                {claimMsg.text}{" "}
                {claimMsg.tx ? (
                  <a href={explorer.tx(claimMsg.tx)} target="_blank" rel="noreferrer" className="font-semibold underline">
                    View transaction
                  </a>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 hidden flex-wrap gap-2 lg:flex">
          {site.tradeUrl ? (
            <a href={site.tradeUrl} target="_blank" rel="noreferrer" className="btn btn-ink">
              Trade on Pons
            </a>
          ) : null}
          <a href="#rules" className="btn btn-ghost">
            How it works
          </a>
        </div>
      </div>

      <div className="flex min-w-0 flex-col items-center justify-center">
        <div className="board" role="grid" aria-label="The 100 turfs">
          {rows.map((r) => {
            const st = stateOf(r);
            return (
              <button
                key={r.id}
                type="button"
                className="tile"
                data-state={st}
                aria-pressed={selected === r.id}
                aria-label={`Turf ${turfLabel(r.id)}, ${st === "free" ? "free" : st === "you" ? "yours" : "held"}, ${fmt(r.price, 18, 6)} ETH`}
                onClick={() => setSelected(r.id)}
              >
                <span className="tile-n">{turfLabel(r.id)}</span>
                {st === "you" ? <span className="tile-you">YOU</span> : null}
                <span className="tile-p">{loading ? "…" : compactEth(r.price)}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[13px] text-ink-2 lg:mt-4">
          Prices in ETH. Tap a turf to see what it pays. Price rises {RISE_PCT}% after every take.
        </p>
      </div>

      {sel ? (
        <>
          <div className="fixed inset-0 z-30 bg-ink/20 lg:bg-transparent" onClick={() => setSelected(null)} aria-hidden />
          <TurfPanel
            key={sel.id}
            turf={sel}
            me={me}
            now={now}
            takes={takes}
            loading={loading}
            onClose={() => setSelected(null)}
            onConnect={() => setConnectOpen(true)}
            onDone={done}
            owed={me ? owed : null}
          />
        </>
      ) : null}
      <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
    </section>
  );
}
