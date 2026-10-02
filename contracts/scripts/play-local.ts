/**
 * Local only (hardhat node on 8893). Deploys a mock Pons token + curve, a mock
 * fee escrow and Turf (start price from src/config/game.json), then plays a
 * short game with three wallets so the site can be seen reading real state:
 *   A takes turfs 12, 45 and 78; fees arrive (direct + escrow credit);
 *   two days pass; B takes 45 from A; C takes 3; more fees; A claims.
 *   npm run node   (other terminal)
 *   npx hardhat run scripts/play-local.ts --network localhost
 * Prints the addresses as JSON on the last line.
 */
import { ethers, network } from "hardhat";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const game = JSON.parse(readFileSync(resolve(__dirname, "../../src/config/game.json"), "utf8")) as { startPriceWei: string };

async function main() {
  const [deployer, a, b, c, funder] = await ethers.getSigners();
  const E = ethers.parseEther;
  const curve = await (await ethers.getContractFactory("MockCurve")).deploy();
  const token = await (await ethers.getContractFactory("MockPonsToken")).deploy(await curve.getAddress());
  const escrow = await (await ethers.getContractFactory("MockFeeEscrow")).deploy();
  const start = await ethers.provider.getBlockNumber();
  const turf = await (await ethers.getContractFactory("Turf")).deploy(await escrow.getAddress(), BigInt(game.startPriceWei));
  const t = await turf.getAddress();
  await token.mint(deployer.address, E("900000000"));
  await token.mint(await curve.getAddress(), E("100000000"));
  await curve.set(E("3"), E("100000000"));

  const takeAt = async (who: typeof a, id: number) => turf.connect(who).take(id, { value: await turf.price(id) });

  await takeAt(a, 12);
  await takeAt(a, 45);
  await takeAt(a, 78);
  await funder.sendTransaction({ to: t, value: E("0.8") });
  await escrow.connect(funder).credit(t, { value: E("0.4") });
  await network.provider.send("evm_increaseTime", [2 * 86_400]);
  await network.provider.send("evm_mine", []);
  await takeAt(b, 45); // escrow credit is pulled first
  await takeAt(c, 3);
  await funder.sendTransaction({ to: t, value: E("0.5") });
  await turf.connect(a).claim();
  await takeAt(b, 61);

  const totals = await turf.totals();
  console.log(
    JSON.stringify({
      token: await token.getAddress(),
      turf: t,
      startBlock: start,
      wallets: { a: a.address, b: b.address, c: c.address },
      distributed: ethers.formatEther(totals.distributed),
      takes: totals.takes.toString(),
      claimableB: ethers.formatEther(await turf.claimableOf(b.address)),
      claimableA: ethers.formatEther(await turf.claimableOf(a.address)),
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
