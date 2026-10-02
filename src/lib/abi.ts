/** The parts of Turf.sol the site uses. */
export const turfAbi = [
  {
    type: "function",
    name: "turfs",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "holder", type: "address" },
          { name: "since", type: "uint64" },
          { name: "takes", type: "uint32" },
          { name: "price", type: "uint256" },
          { name: "paid", type: "uint256" },
          { name: "earned", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "totals",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "distributed", type: "uint256" },
      { name: "funded", type: "uint256" },
      { name: "takes", type: "uint256" },
      { name: "pending", type: "uint256" },
      { name: "held", type: "uint256" },
      { name: "carried", type: "uint256" },
      { name: "start", type: "uint256" },
    ],
  },
  { type: "function", name: "claimableOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "price", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "take", stateMutability: "payable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [{ name: "amount", type: "uint256" }] },
  { type: "function", name: "pull", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "event",
    name: "Taken",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "toPrevious", type: "uint256", indexed: false },
      { name: "toPool", type: "uint256", indexed: false },
    ],
  },
  { type: "event", name: "Funded", inputs: [{ name: "amount", type: "uint256", indexed: false }] },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "BadTurf", inputs: [] },
  { type: "error", name: "PriceNotMet", inputs: [{ name: "price", type: "uint256" }, { name: "sent", type: "uint256" }] },
  { type: "error", name: "AlreadyYours", inputs: [] },
  { type: "error", name: "NothingToClaim", inputs: [] },
  { type: "error", name: "PaymentFailed", inputs: [] },
  { type: "error", name: "Reentrancy", inputs: [] },
] as const;
