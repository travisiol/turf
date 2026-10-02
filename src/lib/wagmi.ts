import { createConfig, http, type Config } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { BROWSER_RPC_URL, RPC_URL, robinhoodChain } from "@/config/network";
import { site } from "@/config/site";

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "";
const isBrowser = typeof window !== "undefined";

/** Every EIP-6963 browser wallet as its own entry; WalletConnect when a project id is set. */
export const wagmiConfig: Config = createConfig({
  chains: [robinhoodChain],
  connectors: [
    injected({ shimDisconnect: true }),
    ...(WALLETCONNECT_PROJECT_ID
      ? [walletConnect({ projectId: WALLETCONNECT_PROJECT_ID, showQrModal: true, metadata: { name: site.name, description: site.hook, url: site.url, icons: [] } })]
      : []),
  ],
  transports: { [robinhoodChain.id]: http(isBrowser ? BROWSER_RPC_URL : RPC_URL, { batch: true }) },
  multiInjectedProviderDiscovery: true,
  ssr: true,
});
