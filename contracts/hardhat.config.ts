import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

/**
 * Local only. There is no deploy network on purpose: the owner deploys
 * Turf himself (see README). `npm run node` starts a local chain on 8893.
 */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8893", chainId: 31337 },
  },
  typechain: { outDir: "typechain-types", target: "ethers-v6" },
  mocha: { timeout: 120_000 },
};

export default config;
