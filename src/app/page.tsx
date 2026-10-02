import { Game } from "@/components/Game";
import { PriceChart } from "@/components/PriceChart";
import { RecentTakes } from "@/components/RecentTakes";
import { RISE_PCT, START_PRICE } from "@/config/game";
import { site } from "@/config/site";
import { fmt } from "@/lib/format";

const start = fmt(START_PRICE, 18, 6);

const STEPS = [
  { n: "1", title: "Take", body: `Pick one of the 100 turfs and pay its price in ETH. A free turf costs ${start} ETH. Each take raises the price by ${RISE_PCT}%.` },
  { n: "2", title: "Hold and earn", body: "The coin's trading fees arrive in ETH and are split equally over the 100 turfs. Your turf's share is yours, whenever it arrives." },
  { n: "3", title: "Claim", body: "Claim what you earned at any time. If someone takes your turf, you get what you paid back plus a profit, ready to claim." },
];

const RULES = [
  `There are exactly 100 turfs. Every turf starts free at ${start} ETH.`,
  `Taking a turf costs its current price. After the take, its price is ${100 + RISE_PCT}% of what you paid (rounded down to the wei). ETH sent above the price is refunded in the same transaction.`,
  "Taking a free turf: the whole price is split over the 100 turfs.",
  `Taking a held turf: the holder paid P, you pay ${(100 + RISE_PCT) / 100}×P. The holder gets P back plus half of the increase. The other half is split over the 100 turfs (an odd wei goes to the split).`,
  "Fees: creator fees from trading the coin are paid in ETH to the game contract. Every amount is divided by 100; each turf earns one share. What does not divide by 100 is carried into the next split, never lost.",
  "A turf's share goes to whoever holds it at that moment. A free turf keeps its shares; the first person to take it receives all of them.",
  "When your turf is taken, what it earned for you and your payout are credited to you. Nothing is pushed to your wallet: you claim it, at any time, in one transaction.",
  "The contract has no owner, no pause and no upgrade. ETH leaves it only through claims and the refund of an overpayment.",
];

const FAQ = [
  {
    q: "Where does the money come from?",
    a: "From trading. Every buy and sell of the coin pays a creator fee in ETH, and the game contract is the fee recipient. Takes add to it too: part of every take is split over the turfs.",
  },
  {
    q: "How much will a turf earn?",
    a: "Nobody knows in advance. It depends only on how much the coin is traded. The page shows what was paid to turfs so far and the average per turf per day, measured from the contract's events. Nothing here is a promise.",
  },
  {
    q: "Can I lose money?",
    a: "Yes. If nobody takes your turf and fees are low, you may earn less than you paid. If someone takes it, you get your price back plus half of the increase, so that part never loses. Prices only go up, so late takes are expensive.",
  },
  {
    q: "When do fees reach the game?",
    a: "Pons, the launchpad, moves creator fees from its trading curve into its fee escrow, credited to the game contract. Every take and every claim collects that credit first, and anyone can collect it with the contract's pull(). Fees still on the curve wait until Pons moves them.",
  },
  {
    q: "Can I hold several turfs?",
    a: "Yes. Each one earns its own share. One claim pays everything you are owed from all of them.",
  },
  {
    q: "Is it audited?",
    a: "No. The contract is small and tested, but it has not been audited. Only use what you can afford to lose.",
  },
];

export default function Home() {
  return (
    <>
      <Game />

      <section id="rules" className="wrap scroll-mt-6 pt-16">
        <h2 className="display text-[40px] sm:text-[56px]">How it works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6 sm:p-7">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-grass font-bold text-ink">{s.n}</span>
              <h3 className="mt-4 text-2xl font-bold tracking-tight">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="card p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight">The exact rules</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 leading-relaxed text-ink-2 marker:font-bold marker:text-ink">
              {RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-6">
            <PriceChart />
            {site.tradeUrl ? (
              <a href={site.tradeUrl} target="_blank" rel="noreferrer" className="btn btn-ink self-start">
                Trade on Pons
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="wrap pt-6">
        <RecentTakes />
      </section>

      <section className="wrap pt-16">
        <h2 className="display text-[40px] sm:text-[56px]">Questions</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q} className="card p-6 sm:p-7">
              <h3 className="text-xl font-bold tracking-tight">{f.q}</h3>
              <p className="mt-2 leading-relaxed text-ink-2">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
