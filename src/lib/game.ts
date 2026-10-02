"use client";

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { Address, Hex } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { LOOKBACK_BLOCKS, TURF_ADDRESS, TURF_START_BLOCK } from "@/config/network";
import { START_PRICE, TURFS } from "@/config/game";
import { turfAbi } from "./abi";

export const ZERO: Address = "0x0000000000000000000000000000000000000000";
export const hasGame = Boolean(TURF_ADDRESS);

export interface TurfRow {
  id: number;
  holder: Address;
  since: number;
  takes: number;
  price: bigint;
  paid: bigint;
  earned: bigint;
}

export interface Totals {
  distributed: bigint;
  funded: bigint;
  takes: bigint;
  pending: bigint;
  held: bigint;
  start: bigint;
}

/** The board before anything happened: 100 free turfs at the start price, all zeros. */
const EMPTY_BOARD: TurfRow[] = Array.from({ length: TURFS }, (_, id) => ({ id, holder: ZERO, since: 0, takes: 0, price: START_PRICE, paid: 0n, earned: 0n }));
const EMPTY_TOTALS: Totals = { distributed: 0n, funded: 0n, takes: 0n, pending: 0n, held: 0n, start: START_PRICE };

export function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** All 100 turfs and the totals, from the contract (two calls, refreshed every 12 s). */
export function useBoard() {
  const board = useReadContract({ address: TURF_ADDRESS ?? ZERO, abi: turfAbi, functionName: "turfs", query: { enabled: hasGame, refetchInterval: 12_000 } });
  const totals = useReadContract({ address: TURF_ADDRESS ?? ZERO, abi: turfAbi, functionName: "totals", query: { enabled: hasGame, refetchInterval: 12_000 } });
  const rows: TurfRow[] = board.data
    ? board.data.map((t, id) => ({ id, holder: t.holder, since: Number(t.since), takes: Number(t.takes), price: t.price, paid: t.paid, earned: t.earned }))
    : EMPTY_BOARD;
  const tot: Totals = totals.data
    ? { distributed: totals.data[0], funded: totals.data[1], takes: totals.data[2], pending: totals.data[3], held: totals.data[4], start: totals.data[6] }
    : EMPTY_TOTALS;
  return {
    rows,
    totals: tot,
    /** true while a configured contract has not answered yet */
    loading: hasGame && (!board.data || !totals.data),
    refetch: () => Promise.all([board.refetch(), totals.refetch()]),
  };
}

export function useClaimable(account: Address | undefined) {
  return useReadContract({
    address: TURF_ADDRESS ?? ZERO,
    abi: turfAbi,
    functionName: "claimableOf",
    args: [account ?? ZERO],
    query: { enabled: hasGame && Boolean(account), refetchInterval: 12_000 },
  });
}

export interface TakeRow {
  id: number;
  from: Address;
  to: Address;
  price: bigint;
  toPrevious: bigint;
  toPool: bigint;
  tx: Hex;
  block: bigint;
  time: number;
}

export interface Activity {
  takes: TakeRow[];
  /** timestamp of the first Taken or Funded event, 0 when none */
  firstTime: number;
  /** timestamp of the latest block read */
  now: number;
}

/** Taken and Funded events since the deploy block: recent takes, and when ETH started flowing. */
export function useActivity() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["turf-activity", TURF_ADDRESS],
    enabled: Boolean(TURF_ADDRESS && client),
    refetchInterval: 20_000,
    queryFn: async (): Promise<Activity> => {
      if (!TURF_ADDRESS || !client) return { takes: [], firstTime: 0, now: 0 };
      const latest = await client.getBlock();
      const from = TURF_START_BLOCK > 0n ? TURF_START_BLOCK : latest.number > LOOKBACK_BLOCKS ? latest.number - LOOKBACK_BLOCKS : 0n;
      const [taken, funded] = await Promise.all([
        client.getContractEvents({ address: TURF_ADDRESS, abi: turfAbi, eventName: "Taken", fromBlock: from, toBlock: latest.number }),
        client.getContractEvents({ address: TURF_ADDRESS, abi: turfAbi, eventName: "Funded", fromBlock: from, toBlock: latest.number }),
      ]);
      const firstBlock = [...taken, ...funded].reduce<bigint | null>((m, l) => (l.blockNumber !== null && (m === null || l.blockNumber < m) ? l.blockNumber : m), null);
      const sorted = [...taken].sort((a, b) => (a.blockNumber === b.blockNumber ? (b.logIndex ?? 0) - (a.logIndex ?? 0) : (a.blockNumber ?? 0n) > (b.blockNumber ?? 0n) ? -1 : 1)).slice(0, 40);
      const blocks = new Set<bigint>(sorted.map((l) => l.blockNumber ?? 0n));
      if (firstBlock !== null) blocks.add(firstBlock);
      const times = new Map<bigint, number>();
      await Promise.all(
        [...blocks].map(async (n) => {
          const b = await client.getBlock({ blockNumber: n });
          times.set(n, Number(b.timestamp));
        }),
      );
      return {
        takes: sorted.map((l) => ({
          id: Number(l.args.id ?? 0n),
          from: (l.args.from ?? ZERO) as Address,
          to: (l.args.to ?? ZERO) as Address,
          price: l.args.price ?? 0n,
          toPrevious: l.args.toPrevious ?? 0n,
          toPool: l.args.toPool ?? 0n,
          tx: l.transactionHash as Hex,
          block: l.blockNumber ?? 0n,
          time: times.get(l.blockNumber ?? 0n) ?? 0,
        })),
        firstTime: firstBlock !== null ? (times.get(firstBlock) ?? 0) : 0,
        now: Number(latest.timestamp),
      };
    },
  });
}

/** ETH per turf per day since ETH started flowing; null when under an hour of history (not measurable). */
export function perTurfPerDay(distributed: bigint, a: Activity | undefined): bigint | null {
  if (!a || !a.firstTime || distributed === 0n) return null;
  const elapsed = a.now - a.firstTime;
  if (elapsed < 3600) return null;
  return (distributed * 86_400n) / (BigInt(TURFS) * BigInt(elapsed));
}
