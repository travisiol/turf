"use client";

import { useState } from "react";
import { BaseError, ContractFunctionRevertedError, type Address } from "viem";
import { useConnection, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { CHAIN_ID, TURF_ADDRESS, explorer } from "@/config/network";
import { RISE_PCT, split } from "@/config/game";
import { turfAbi } from "@/lib/abi";
import { ago, fmt, shortAddress, turfLabel } from "@/lib/format";
import { ZERO, hasGame, type TakeRow, type TurfRow } from "@/lib/game";

export function reason(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name === "PriceNotMet") return "Someone took this turf first, so its price went up. Check the new price and try again.";
      if (name === "AlreadyYours") return "You already hold this turf.";
      if (name === "NothingToClaim") return "Nothing to claim yet.";
      if (name) return `The contract refused: ${name}.`;
    }
    if (/User rejected|denied/i.test(e.shortMessage)) return "You cancelled in your wallet.";
    return e.shortMessage;
  }
  return (e as Error)?.message?.split("\n")[0] ?? "Something went wrong.";
}

function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-ink-2">{k}</dt>
      <dd className={`num text-right ${strong ? "font-bold" : "font-medium"}`}>{v}</dd>
    </div>
  );
}

export function TurfPanel({
  turf,
  me,
  now,
  takes,
  loading,
  onClose,
  onConnect,
  onDone,
  owed,
}: {
  turf: TurfRow;
  me: Address | undefined;
  now: number;
  takes: TakeRow[];
  loading: boolean;
  onClose: () => void;
  onConnect: () => void;
  onDone: () => void;
  owed: bigint | null;
}) {
  const client = usePublicClient();
  const { chainId } = useConnection();
  const { mutateAsync: write } = useWriteContract();
  const { mutateAsync: switchChain } = useSwitchChain();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ id: number; text: string; tx?: string } | null>(null);

  const held = turf.holder !== ZERO;
  const mine = Boolean(me && held && turf.holder.toLowerCase() === me.toLowerCase());
  const { toPrevious, toPool, nextPrice } = split(turf.price, turf.paid, held);
  const profit = held ? toPrevious - turf.paid : 0n;
  const after = split(nextPrice, turf.price, true);
  const history = takes.filter((t) => t.id === turf.id).slice(0, 5);
  const shown = msg && msg.id === turf.id ? msg : null;
  const priceText = loading ? "…" : fmt(turf.price, 18, 6);

  const take = async () => {
    setMsg(null);
    if (!me) return onConnect();
    if (!hasGame || !TURF_ADDRESS || !client) return setMsg({ id: turf.id, text: "Taking turfs is not open yet." });
    try {
      setBusy(true);
      if (chainId !== CHAIN_ID) await switchChain({ chainId: CHAIN_ID });
      const fresh = await client.readContract({ address: TURF_ADDRESS, abi: turfAbi, functionName: "price", args: [BigInt(turf.id)] });
      if (fresh !== turf.price) {
        onDone();
        return setMsg({ id: turf.id, text: `The price just changed to ${fmt(fresh, 18, 6)} ETH. Check the numbers and press again.` });
      }
      const hash = await write({ address: TURF_ADDRESS, abi: turfAbi, functionName: "take", args: [BigInt(turf.id)], value: fresh });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted.");
      setMsg({ id: turf.id, text: `Turf ${turfLabel(turf.id)} is yours. You paid ${fmt(fresh, 18, 6)} ETH.`, tx: hash });
      onDone();
    } catch (e) {
      setMsg({ id: turf.id, text: reason(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      className="sheet fixed right-0 top-0 z-40 flex h-svh w-[86vw] max-w-[440px] flex-col overflow-y-auto border-l border-line bg-surface shadow-[0_0_80px_rgba(22,32,24,0.18)]"
      aria-label={`Turf ${turfLabel(turf.id)}`}
    >
      <div className="flex items-start justify-between gap-3 px-6 pt-6">
        <div>
          <p className="eyebrow">{mine ? "You hold this" : held ? "Held" : "Free"}</p>
          <h2 className="display mt-1 text-[44px]">Turf {turfLabel(turf.id)}</h2>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-2xl text-ink-2 hover:bg-paper">
          ×
        </button>
      </div>

      <div className="px-6">
        <p className="mt-1 text-[15px] text-ink-2">
          {held ? (
            <>
              Holder{" "}
              <a href={explorer.address(turf.holder)} target="_blank" rel="noreferrer" className="mono text-ink underline decoration-line underline-offset-4">
                {mine ? "you" : shortAddress(turf.holder)}
              </a>
              {turf.since && now ? <> · took it {ago(turf.since, now)}</> : null} · taken {turf.takes} {turf.takes === 1 ? "time" : "times"}
            </>
          ) : (
            "Nobody holds this turf yet."
          )}
        </p>

        <div className="mt-5 rounded-3xl bg-paper p-5">
          <p className="text-sm font-medium text-ink-2">Price to take it</p>
          <p className="num mt-1 text-[40px] font-bold leading-none">
            {priceText} <span className="text-xl font-medium text-muted">ETH</span>
          </p>
        </div>

        <div className="mt-3 rounded-3xl bg-tint p-5">
          <p className="text-sm font-medium text-ink-2">{held ? "Earned by this turf for its holder" : "Collected while free"}</p>
          <p className="num mt-1 text-[28px] font-bold leading-none">
            {loading ? "…" : fmt(turf.earned, 18, 6)} <span className="text-lg font-medium text-ink-2">ETH</span>
          </p>
          <p className="mt-2 text-[14px] leading-snug text-ink-2">
            {held
              ? `Since ${mine ? "you" : "they"} took it${turf.since && now ? `, ${ago(turf.since, now)}` : ""}${turf.takes === 1 ? ", including what it collected while free" : ""}. ${
                  mine ? "It is yours to claim any time." : "It is theirs; they can claim it any time."
                }`
              : "A free turf keeps its share of the fees. Whoever takes it first receives all of it."}
          </p>
        </div>

        {mine ? (
          <dl className="mt-4 divide-y divide-line text-[15px]">
            <Row k="You paid" v={`${fmt(turf.paid, 18, 6)} ETH`} />
            <Row k="If someone takes it, you get" v={`${fmt(toPrevious, 18, 6)} ETH`} strong />
            <Row k="of which your profit" v={`${fmt(profit, 18, 6)} ETH`} />
            <Row k="Split over the 100 turfs" v={`${fmt(toPool, 18, 6)} ETH`} />
          </dl>
        ) : (
          <>
            <dl className="mt-4 divide-y divide-line text-[15px]">
              <Row k="You pay" v={`${priceText} ETH`} strong />
              {held ? <Row k={`To ${shortAddress(turf.holder)}`} v={`${fmt(toPrevious, 18, 6)} ETH`} /> : null}
              {held ? <Row k="of which their profit" v={`${fmt(profit, 18, 6)} ETH`} /> : null}
              <Row k="Split over the 100 turfs" v={`${fmt(toPool, 18, 6)} ETH`} />
              <Row k="Price after your take" v={`${fmt(nextPrice, 18, 6)} ETH`} />
              <Row k="If someone takes it from you" v={`you get ${fmt(after.toPrevious, 18, 6)} ETH`} strong />
            </dl>
            <p className="mt-1 text-[14px] leading-snug text-ink-2">
              That is your {priceText} ETH back plus {fmt(after.toPrevious - turf.price, 18, 6)} ETH profit, credited to you to claim. Until then this turf earns 1/100 of every
              fee that comes in.
            </p>
          </>
        )}

        {mine ? (
          <p className="mt-5 rounded-3xl bg-paper p-4 text-[15px]">You hold this turf. Its earnings are in your claimable balance.</p>
        ) : (
          <button type="button" className="btn btn-grass mt-5 h-14 w-full" disabled={busy} onClick={take}>
            {busy ? "Confirm in your wallet…" : `Take turf ${turfLabel(turf.id)} for ${priceText} ETH`}
          </button>
        )}
        {shown ? (
          <p className="mt-3 text-[15px] text-ink" role="status">
            {shown.text}{" "}
            {shown.tx ? (
              <a href={explorer.tx(shown.tx)} target="_blank" rel="noreferrer" className="font-semibold underline">
                View transaction
              </a>
            ) : null}
          </p>
        ) : null}
        <p className="mt-3 text-[14px] text-muted">Price rises {RISE_PCT}% after every take.</p>
        {owed !== null ? (
          <p className="mt-4 flex items-baseline justify-between gap-3 rounded-2xl bg-paper px-4 py-3 text-[15px]">
            <span className="text-ink-2">Your claimable, all turfs</span>
            <span className="num font-bold">{fmt(owed, 18, 6)} ETH</span>
          </p>
        ) : null}
      </div>

      <div className="mt-6 px-6 pb-8">
        <p className="eyebrow">Recent takes of this turf</p>
        {history.length ? (
          <ul className="mt-2 divide-y divide-line text-[14px]">
            {history.map((t) => (
              <li key={t.tx + t.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="mono">{shortAddress(t.to)}</span>
                <span className="num font-medium">{fmt(t.price, 18, 6)} ETH</span>
                <a href={explorer.tx(t.tx)} target="_blank" rel="noreferrer" className="text-ink-2 underline decoration-line underline-offset-4">
                  {t.time && now ? ago(t.time, now) : "tx"}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14px] text-ink-2">No takes yet.</p>
        )}
      </div>
    </aside>
  );
}
