"use client";

import { useState } from "react";
import { useConnection, useDisconnect, useSwitchChain } from "wagmi";
import { CHAIN_ID } from "@/config/network";
import { shortAddress } from "@/lib/format";
import { useMounted } from "@/lib/game";
import { ConnectDialog } from "./ConnectDialog";

/** Connect / switch network / connected address with a disconnect menu. */
export function ConnectButton({ className = "btn btn-ink btn-sm" }: { className?: string }) {
  const mounted = useMounted();
  const { address, isConnected, chainId } = useConnection();
  const { mutate: disconnect } = useDisconnect();
  const { mutateAsync: switchChain, isPending: switching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  if (!mounted || !isConnected || !address) {
    return (
      <>
        <button type="button" className={className} onClick={() => setOpen(true)}>
          Connect wallet
        </button>
        <ConnectDialog open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  if (chainId !== CHAIN_ID) {
    return (
      <button type="button" className={className} disabled={switching} onClick={() => switchChain({ chainId: CHAIN_ID }).catch(() => {})}>
        {switching ? "Switching…" : "Switch network"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button type="button" className="btn btn-ghost btn-sm num" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="menu">
        <span className="h-2 w-2 rounded-full bg-grass" />
        {shortAddress(address)}
      </button>
      {menu ? (
        <div role="menu" className="card absolute right-0 z-40 mt-2 w-48 p-1.5">
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-2xl px-4 py-2.5 text-left font-semibold hover:bg-paper"
            onClick={() => {
              disconnect();
              setMenu(false);
            }}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
