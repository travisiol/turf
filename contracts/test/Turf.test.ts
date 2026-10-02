import { expect } from "chai";
import { ethers } from "hardhat";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The numbers the site prints come from this file; the contract must agree with it.
const game = JSON.parse(readFileSync(resolve(__dirname, "../../src/config/game.json"), "utf8")) as {
  turfs: number;
  startPriceWei: string;
  priceStepPct: number;
  previousShareOfIncreasePct: number;
};
const START = BigInt(game.startPriceWei);
const E = ethers.parseEther;

async function deploy(escrowKind: "none" | "mock" | "stingy" = "mock") {
  const signers = await ethers.getSigners();
  let escrowAddr = ethers.ZeroAddress;
  let escrow: Awaited<ReturnType<typeof deployEscrow>> | null = null;
  async function deployEscrow() {
    return (await ethers.getContractFactory("MockFeeEscrow")).deploy();
  }
  let stingy = null as null | Awaited<ReturnType<Awaited<ReturnType<typeof ethers.getContractFactory>>["deploy"]>>;
  if (escrowKind === "mock") {
    escrow = await deployEscrow();
    escrowAddr = await escrow.getAddress();
  } else if (escrowKind === "stingy") {
    stingy = await (await ethers.getContractFactory("MockStingyEscrow")).deploy();
    escrowAddr = await stingy.getAddress();
  }
  const turf = await (await ethers.getContractFactory("Turf")).deploy(escrowAddr, START);
  return { turf, escrow, stingy, signers, addr: await turf.getAddress() };
}

describe("Turf", () => {
  it("prints the same numbers as the contract (site config = constants)", async () => {
    const { turf } = await deploy();
    expect(await turf.TURFS()).to.equal(BigInt(game.turfs));
    expect(await turf.PRICE_STEP_PCT()).to.equal(BigInt(game.priceStepPct));
    expect(await turf.PREVIOUS_SHARE_OF_INCREASE_PCT()).to.equal(BigInt(game.previousShareOfIncreasePct));
    expect(await turf.startPrice()).to.equal(START);
    // the site says "+20%" and "half of the increase"
    expect(game.priceStepPct - 100).to.equal(20);
    expect(game.previousShareOfIncreasePct).to.equal(50);
  });

  it("first take: whole price to the pool, the first holder inherits the turf's share", async () => {
    const { turf, signers } = await deploy();
    const [, a] = signers;
    await expect(turf.connect(a).take(7, { value: START }))
      .to.emit(turf, "Taken")
      .withArgs(7, ethers.ZeroAddress, a.address, START, 0, START);
    const each = START / 100n;
    expect(await turf.accPerTurf()).to.equal(each);
    expect(await turf.carry()).to.equal(START - each * 100n);
    expect(await turf.totalDistributed()).to.equal(each * 100n);
    // turf 7 had debt 0, so its first holder gets its 1/100 of their own payment
    expect(await turf.earned(7)).to.equal(each);
    expect(await turf.claimableOf(a.address)).to.equal(each);
    expect(await turf.price(7)).to.equal((START * 120n) / 100n);
    expect(await turf.totalTakes()).to.equal(1n);
  });

  it("no turf held yet: fees accrue to free turfs and roll to each turf's first holder", async () => {
    const { turf, signers, addr } = await deploy();
    const [, a, b] = signers;
    await b.sendTransaction({ to: addr, value: E("1") });
    expect(await turf.accPerTurf()).to.equal(E("0.01"));
    // turf 42 is free: its first holder will receive 0.01 ETH
    expect(await turf.earned(42)).to.equal(E("0.01"));
    await turf.connect(a).take(42, { value: START });
    expect(await turf.claimableOf(a.address)).to.equal(E("0.01") + START / 100n);
    // nothing is lost: contract balance covers every free turf's share + the holder's
    const bal = await ethers.provider.getBalance(addr);
    const acc = await turf.accPerTurf();
    expect(bal).to.equal(acc * 100n + (await turf.carry()));
  });

  it("re-take: payouts exact to the wei, price progression", async () => {
    const { turf, signers } = await deploy("none");
    const [, a, b, c] = signers;
    await turf.connect(a).take(3, { value: START });
    const p1 = (START * 120n) / 100n;
    expect(await turf.price(3)).to.equal(p1);
    const q = await turf.quote(3);
    const toPrev = START + (p1 - START) / 2n;
    expect(q.toPrevious).to.equal(toPrev);
    expect(q.toPool).to.equal(p1 - toPrev);
    expect(q.nextPrice).to.equal((p1 * 120n) / 100n);

    const accBefore = await turf.accPerTurf();
    const carryBefore = await turf.carry();
    await expect(turf.connect(b).take(3, { value: p1 }))
      .to.emit(turf, "Taken")
      .withArgs(3, a.address, b.address, p1, toPrev, p1 - toPrev);
    const accAfter = await turf.accPerTurf();
    expect(accAfter).to.equal(accBefore + (p1 - toPrev + carryBefore) / 100n);
    // a: what they paid + half the increase + everything turf 3 earned while they held it (incl. this take's share)
    expect(await turf.claimable(a.address)).to.equal(toPrev + accAfter);
    expect(await turf.earned(3)).to.equal(0n);

    // a third take from b at 1.44x
    const p2 = (p1 * 120n) / 100n;
    await turf.connect(c).take(3, { value: p2 });
    expect(await turf.price(3)).to.equal((p2 * 120n) / 100n);
    const prevB = p1 + (p2 - p1) / 2n;
    expect(await turf.claimable(b.address)).to.equal(prevB + ((await turf.accPerTurf()) - accAfter));
  });

  it("odd increase: the odd wei goes to the pool", async () => {
    const odd = 1_000_000_000_000_001n;
    const [, a, b] = await ethers.getSigners();
    const turf = await (await ethers.getContractFactory("Turf")).deploy(ethers.ZeroAddress, odd);
    await turf.connect(a).take(0, { value: odd });
    const p1 = await turf.price(0);
    expect(p1).to.equal((odd * 120n) / 100n);
    const q = await turf.quote(0);
    const inc = p1 - odd;
    expect(q.toPrevious).to.equal(odd + inc / 2n);
    expect(q.toPool).to.equal(inc - inc / 2n);
    expect(q.toPool).to.be.greaterThanOrEqual(q.toPrevious - odd);
    await turf.connect(b).take(0, { value: p1 });
  });

  it("refunds the excess and rejects a value below the price", async () => {
    const { turf, signers, addr } = await deploy();
    const [, a] = signers;
    const before = await ethers.provider.getBalance(a.address);
    const tx = await turf.connect(a).take(1, { value: E("1") });
    const r = await tx.wait();
    const gas = r!.gasUsed * r!.gasPrice;
    expect(await ethers.provider.getBalance(a.address)).to.equal(before - START - gas);
    expect(await ethers.provider.getBalance(addr)).to.equal(START);
    await expect(turf.connect(a).take(2, { value: START - 1n })).to.be.revertedWithCustomError(turf, "PriceNotMet");
    await expect(turf.connect(a).take(1, { value: E("1") })).to.be.revertedWithCustomError(turf, "AlreadyYours");
  });

  it("bounds: ids 0..99 only", async () => {
    const { turf, signers } = await deploy();
    const [, a] = signers;
    await turf.connect(a).take(99, { value: START });
    await expect(turf.connect(a).take(100, { value: START })).to.be.revertedWithCustomError(turf, "BadTurf");
    await expect(turf.price(100)).to.be.revertedWithCustomError(turf, "BadTurf");
    const all = await turf.turfs();
    expect(all.length).to.equal(100);
    expect(all[99].holder).to.equal(a.address);
    expect(all[0].price).to.equal(START);
  });

  it("splits earnings over 100 turfs and carries the remainder", async () => {
    const { turf, signers, addr } = await deploy();
    const [, a, b, funder] = signers;
    await turf.connect(a).take(0, { value: START });
    await turf.connect(b).take(1, { value: START });
    const acc0 = await turf.accPerTurf();
    const carry0 = await turf.carry();
    await expect(funder.sendTransaction({ to: addr, value: 1234n })).to.emit(turf, "Funded").withArgs(1234n);
    const total = 1234n + carry0;
    expect(await turf.accPerTurf()).to.equal(acc0 + total / 100n);
    expect(await turf.carry()).to.equal(total % 100n);
    await funder.sendTransaction({ to: addr, value: 66n });
    expect(await turf.accPerTurf()).to.equal(acc0 + (total + 66n) / 100n);
    expect(await turf.carry()).to.equal((total + 66n) % 100n);
    expect(await turf.totalFunded()).to.equal(1300n);
  });

  it("earnings follow the holder across a take", async () => {
    const { turf, signers, addr } = await deploy("none");
    const [, a, b, funder] = signers;
    await turf.connect(a).take(5, { value: START });
    await funder.sendTransaction({ to: addr, value: E("1") }); // 0.01 per turf
    const p1 = await turf.price(5);
    const accMid = await turf.accPerTurf();
    await turf.connect(b).take(5, { value: p1 });
    const accTake = await turf.accPerTurf();
    await funder.sendTransaction({ to: addr, value: E("2") }); // 0.02 per turf
    const accEnd = await turf.accPerTurf();
    // a keeps what the turf earned up to the take; b earns from then on
    expect(await turf.claimableOf(a.address)).to.equal(accTake + (START + (p1 - START) / 2n));
    expect(await turf.claimableOf(b.address)).to.equal(accEnd - accTake);
    expect(accMid).to.be.greaterThan(0n);
  });

  it("claim pays everything owed once, then reverts on nothing", async () => {
    const { turf, signers, addr } = await deploy("none");
    const [, a, b, funder] = signers;
    await turf.connect(a).take(10, { value: START });
    await turf.connect(a).take(11, { value: START });
    await funder.sendTransaction({ to: addr, value: E("1") });
    const owed = await turf.claimableOf(a.address);
    await expect(turf.connect(a).claim()).to.changeEtherBalances([a, turf], [owed, -owed]);
    expect(await turf.claimableOf(a.address)).to.equal(0n);
    await expect(turf.connect(a).claim()).to.be.revertedWithCustomError(turf, "NothingToClaim");
    await expect(turf.connect(b).claim()).to.be.revertedWithCustomError(turf, "NothingToClaim");
    // solvency: the balance covers every turf's unsettled share + credits + carry
    const all = await turf.turfs();
    const unsettled = all.reduce((s, t) => s + t.earned, 0n);
    expect(await ethers.provider.getBalance(addr)).to.equal(unsettled + (await turf.carry()));
  });

  it("a holder that reverts on receive cannot block a take", async () => {
    const { turf, signers } = await deploy();
    const [, , b] = signers;
    const bad = await (await ethers.getContractFactory("RevertingHolder")).deploy();
    await bad.takeTurf(await turf.getAddress(), 20, { value: START });
    const p1 = await turf.price(20);
    await expect(turf.connect(b).take(20, { value: p1 })).to.not.be.reverted;
    expect((await turf.turfs())[20].holder).to.equal(b.address);
    expect(await turf.claimable(await bad.getAddress())).to.be.greaterThan(0n);
    // it can only hurt itself: its own claim fails
    await expect(bad.claimFrom(await turf.getAddress())).to.be.reverted;
  });

  it("claim is reentrancy-safe", async () => {
    const { turf, signers, addr } = await deploy();
    const [, , , funder] = signers;
    const att = await (await ethers.getContractFactory("ReentrantClaimer")).deploy(addr);
    await att.takeTurf(30, { value: START });
    await funder.sendTransaction({ to: addr, value: E("1") });
    const owed = await turf.claimableOf(await att.getAddress());
    await expect(att.attack()).to.changeEtherBalance(att, owed);
    expect(await att.reentered()).to.equal(true);
    expect(await att.reentryFailed()).to.equal(true);
    expect(await turf.claimableOf(await att.getAddress())).to.equal(0n);
  });

  it("pulls creator fees from the escrow: permissionless pull() and on every take", async () => {
    const { turf, escrow, signers, addr } = await deploy("mock");
    const [, a, b, funder] = signers;
    await escrow!.connect(funder).credit(addr, { value: E("0.5") });
    expect(await turf.pendingFees()).to.equal(E("0.5"));
    await expect(turf.connect(b).pull()).to.emit(turf, "Funded").withArgs(E("0.5"));
    expect(await turf.pendingFees()).to.equal(0n);
    expect(await turf.accPerTurf()).to.equal(E("0.005"));
    expect(await turf.totalFunded()).to.equal(E("0.5"));

    await escrow!.connect(funder).credit(addr, { value: E("1") });
    await turf.connect(a).take(0, { value: START });
    expect(await turf.totalFunded()).to.equal(E("1.5"));
    expect(await turf.claimableOf(a.address)).to.equal(E("0.015") + START / 100n);

    // a broken escrow never blocks a take
    await escrow!.connect(funder).credit(addr, { value: E("1") });
    await escrow!.setBroken(true);
    const p = await turf.price(0);
    await expect(turf.connect(b).take(0, { value: p })).to.not.be.reverted;
    expect(await turf.pendingFees()).to.equal(E("1"));
  });

  it("an escrow paying with transfer() (2300 gas) still lands", async () => {
    const { turf, stingy, signers, addr } = await deploy("stingy");
    const [, , , funder] = signers;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (stingy as any).connect(funder).credit(addr, { value: E("0.3") });
    await turf.pull();
    expect(await turf.totalFunded()).to.equal(E("0.3"));
    expect(await turf.accPerTurf()).to.equal(E("0.003"));
  });

  it("totals() reports what the UI shows", async () => {
    const { turf, signers, addr } = await deploy();
    const [, a, , funder] = signers;
    await turf.connect(a).take(4, { value: START });
    await funder.sendTransaction({ to: addr, value: E("1") });
    const t = await turf.totals();
    expect(t.takes).to.equal(1n);
    expect(t.held).to.equal(1n);
    expect(t.funded).to.equal(E("1"));
    expect(t.start).to.equal(START);
    expect(t.distributed).to.equal(await turf.totalDistributed());
  });
});
