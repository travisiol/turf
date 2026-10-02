import Image from "next/image";
import Link from "next/link";
import { TOKEN_ADDRESS, TURF_ADDRESS, explorer } from "@/config/network";
import { site } from "@/config/site";
import { ConnectButton } from "./wallet/ConnectButton";

export function Logo({ size = 30 }: { size?: number }) {
  return <Image src="/logo-128.png" alt="" width={size} height={size} className="rounded-[9px]" preload />;
}

export function Navbar() {
  return (
    <header className="wrap flex h-16 items-center justify-between gap-3 lg:h-[72px]">
      <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
        <Logo />
        {site.name}
      </Link>
      <nav className="flex items-center gap-1 sm:gap-2">
        <Link href="/#rules" className="hidden px-3 font-medium text-ink-2 hover:text-ink sm:inline">
          Rules
        </Link>
        {site.tradeUrl ? (
          <a href={site.tradeUrl} target="_blank" rel="noreferrer" className="hidden px-3 font-medium text-ink-2 hover:text-ink md:inline">
            Trade on Pons
          </a>
        ) : null}
        <ConnectButton />
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="wrap mt-20 flex flex-col gap-4 border-t border-line py-10 text-[15px] text-ink-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5 font-bold text-ink">
        <Logo size={24} />
        {site.name}
        <span className="font-medium text-muted">· {site.hook}</span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/#rules" className="hover:text-ink">
          Rules
        </Link>
        {TURF_ADDRESS ? (
          <a href={explorer.address(TURF_ADDRESS)} target="_blank" rel="noreferrer" className="hover:text-ink">
            Game contract
          </a>
        ) : null}
        {TOKEN_ADDRESS ? (
          <a href={explorer.token(TOKEN_ADDRESS)} target="_blank" rel="noreferrer" className="hover:text-ink">
            Token
          </a>
        ) : null}
      </div>
    </footer>
  );
}
