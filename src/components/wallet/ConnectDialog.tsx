"use client";

import { useEffect, useState } from "react";
import { useConnect, useConnectors } from "wagmi";

/** Our own connect sheet: every browser wallet announced over EIP-6963, WalletConnect when configured. */
export function ConnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const connectors = useConnectors();
  const { mutateAsync: connect, isPending, variables } = useConnect();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const named = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
  const list = connectors.filter((c) => !(c.id === "injected" && named.length > 0));
  const pendingUid = isPending ? (variables as { connector?: { uid?: string } } | undefined)?.connector?.uid : undefined;

  const pick = async (uid: string) => {
    const c = connectors.find((x) => x.uid === uid);
    if (!c) return;
    setFailed(null);
    try {
      await connect({ connector: c });
      onClose();
    } catch (e) {
      const msg = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? "Connection failed.";
      setFailed(msg.split("\n")[0].slice(0, 160));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label="Connect a wallet">
      <div className="card w-full max-w-md p-6 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Connect a wallet</h2>
            <p className="mt-1 text-[15px] text-ink-2">Robinhood Chain. Connecting only shares your address.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl text-ink-2 hover:bg-paper">
            ×
          </button>
        </div>
        <ul className="mt-5 flex flex-col gap-2">
          {list.map((c) => (
            <li key={c.uid}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => pick(c.uid)}
                className="flex w-full items-center gap-3 rounded-2xl bg-paper px-4 py-3.5 text-left font-semibold transition hover:bg-line disabled:opacity-60"
              >
                {c.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.icon} alt="" className="h-8 w-8 rounded-lg" />
                ) : (
                  <span className="h-8 w-8 rounded-lg bg-grass" />
                )}
                <span className="flex-1">{c.name === "Injected" ? "Browser wallet" : c.name}</span>
                <span className="text-sm text-muted">{pendingUid === c.uid ? "Waiting…" : c.type === "walletConnect" ? "QR code" : ""}</span>
              </button>
            </li>
          ))}
        </ul>
        {failed ? (
          <p className="mt-4 text-sm text-ink-2" role="alert">
            {failed}
          </p>
        ) : null}
      </div>
    </div>
  );
}
