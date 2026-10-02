// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Pons V2 fee escrow, as far as a fee recipient sees it: a native balance
/// and claim(), which pays the caller its whole native balance.
interface IFeeEscrow {
    function balanceOf(address account) external view returns (uint256);

    function claim() external;
}

/**
 * Turf — 100 turfs. Take one by paying its price; hold it to earn.
 *
 * Money rules (all exact, integer wei):
 *
 * 1. Every turf starts free at `startPrice`. Taking a turf costs its current
 *    price; any ETH sent above it is refunded in the same transaction. After a
 *    take the turf's price becomes price * 120 / 100 (rounded down).
 *
 * 2. First take of a free turf: the whole price goes to the earnings pool.
 *
 * 3. Take of a held turf at price P, whose holder paid `paid`:
 *       increase   = P - paid
 *       toPrevious = paid + increase / 2      (rounded down)
 *       toPool     = P - toPrevious           (the odd wei goes to the pool)
 *    toPrevious is credited to the previous holder's claimable balance (pull
 *    payment: a holder that cannot receive ETH cannot block a take).
 *
 * 4. Earnings pool: every amount that enters it (creator fees through
 *    receive() or pull(), and the pool share of takes) is split equally over
 *    all 100 turfs: (amount + carried remainder) / 100 each, the remainder of
 *    that division is carried to the next distribution. A turf's share goes
 *    to whoever holds it at that moment. A free turf keeps its shares until
 *    its first take: its first holder receives everything it collected while
 *    free. Within a take, the pool share is split before the turf changes
 *    hands, so this turf's 1/100 of it goes to the outgoing holder (or, for a
 *    free turf, to its first holder).
 *
 * 5. When a turf changes hands, what it earned for the outgoing holder is
 *    credited to their claimable balance. claim() pays a wallet everything it
 *    is owed: its claimable balance plus what its current turfs have earned.
 *
 * No owner, no pause, no upgrade. ETH leaves only through claim() and the
 * excess refund of take().
 */
contract Turf {
    uint256 public constant TURFS = 100;
    /// Price after a take = price * PRICE_STEP_PCT / 100.
    uint256 public constant PRICE_STEP_PCT = 120;
    /// Share of a take's price increase paid to the previous holder, in percent (the rest goes to the pool).
    uint256 public constant PREVIOUS_SHARE_OF_INCREASE_PCT = 50;

    struct Slot {
        address holder; // address(0) = free
        uint64 since; // timestamp the current holder took it
        uint32 takes; // times this turf was taken
        uint256 price; // price to take it now (0 = startPrice, never taken)
        uint256 paid; // what the current holder paid
        uint256 debt; // accPerTurf when the current holder's earnings were last settled
    }

    struct TurfView {
        address holder;
        uint64 since;
        uint32 takes;
        uint256 price;
        uint256 paid;
        uint256 earned; // earned by the current holder (for a free turf: what its first holder will receive)
    }

    IFeeEscrow public immutable feeEscrow;
    uint256 public immutable startPrice;

    Slot[100] private _turfs;
    /// Cumulative wei earned per turf since deployment.
    uint256 public accPerTurf;
    /// Wei that did not divide by 100, carried to the next distribution.
    uint256 public carry;
    /// Total wei split over the turfs so far (fees + pool shares of takes, excluding the carry).
    uint256 public totalDistributed;
    /// Total creator fees / ETH received outside takes.
    uint256 public totalFunded;
    uint256 public totalTakes;
    /// Credited, not yet claimed.
    mapping(address => uint256) public claimable;

    uint256 private _lock = 1; // 1 free, 2 locked, 3 pulling from the escrow

    event Taken(uint256 indexed id, address indexed from, address indexed to, uint256 price, uint256 toPrevious, uint256 toPool);
    event Funded(uint256 amount);
    event Claimed(address indexed account, uint256 amount);

    error BadTurf();
    error PriceNotMet(uint256 price, uint256 sent);
    error AlreadyYours();
    error NothingToClaim();
    error PaymentFailed();
    error Reentrancy();
    error ZeroStartPrice();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(IFeeEscrow feeEscrow_, uint256 startPrice_) {
        if (startPrice_ == 0) revert ZeroStartPrice();
        feeEscrow = feeEscrow_;
        startPrice = startPrice_;
    }

    /// Creator fees (or anyone) fund the pool. During pull() the escrow's payment is counted by pull() itself.
    receive() external payable {
        if (_lock == 3) return;
        if (msg.value == 0) return;
        totalFunded += msg.value;
        _distribute(msg.value);
        emit Funded(msg.value);
    }

    // ------------------------------------------------------------- views

    function price(uint256 id) public view returns (uint256) {
        if (id >= TURFS) revert BadTurf();
        uint256 p = _turfs[id].price;
        return p == 0 ? startPrice : p;
    }

    /// What the next take of `id` pays: (price, toPrevious, toPool, next price).
    function quote(uint256 id) public view returns (uint256 p, uint256 toPrevious, uint256 toPool, uint256 nextPrice) {
        p = price(id);
        Slot storage s = _turfs[id];
        if (s.holder == address(0)) {
            toPool = p;
        } else {
            toPrevious = s.paid + (p - s.paid) * PREVIOUS_SHARE_OF_INCREASE_PCT / 100;
            toPool = p - toPrevious;
        }
        nextPrice = p * PRICE_STEP_PCT / 100;
    }

    function earned(uint256 id) public view returns (uint256) {
        if (id >= TURFS) revert BadTurf();
        return accPerTurf - _turfs[id].debt;
    }

    /// All 100 turfs in one call.
    function turfs() external view returns (TurfView[] memory out) {
        out = new TurfView[](TURFS);
        uint256 acc = accPerTurf;
        for (uint256 i = 0; i < TURFS; i++) {
            Slot storage s = _turfs[i];
            out[i] = TurfView({
                holder: s.holder,
                since: s.since,
                takes: s.takes,
                price: s.price == 0 ? startPrice : s.price,
                paid: s.paid,
                earned: acc - s.debt
            });
        }
    }

    /// Everything `account` can claim right now: credited balance + earnings of the turfs it holds.
    function claimableOf(address account) public view returns (uint256 total) {
        total = claimable[account];
        if (account == address(0)) return total;
        uint256 acc = accPerTurf;
        for (uint256 i = 0; i < TURFS; i++) {
            if (_turfs[i].holder == account) total += acc - _turfs[i].debt;
        }
    }

    /// ETH credited to this contract in the fee escrow, not yet pulled.
    function pendingFees() public view returns (uint256) {
        if (address(feeEscrow) == address(0)) return 0;
        try feeEscrow.balanceOf(address(this)) returns (uint256 b) {
            return b;
        } catch {
            return 0;
        }
    }

    /// Totals for the UI in one call.
    function totals()
        external
        view
        returns (uint256 distributed, uint256 funded, uint256 takes, uint256 pending, uint256 held, uint256 carried, uint256 start)
    {
        for (uint256 i = 0; i < TURFS; i++) if (_turfs[i].holder != address(0)) held++;
        return (totalDistributed, totalFunded, totalTakes, pendingFees(), held, carry, startPrice);
    }

    // ----------------------------------------------------------- actions

    /// Take turf `id` by paying at least its price (the excess is refunded).
    function take(uint256 id) external payable nonReentrant {
        if (id >= TURFS) revert BadTurf();
        _pull();
        Slot storage s = _turfs[id];
        address from = s.holder;
        if (from == msg.sender) revert AlreadyYours();
        (uint256 p, uint256 toPrevious, uint256 toPool, uint256 nextPrice) = quote(id);
        if (msg.value < p) revert PriceNotMet(p, msg.value);

        // pool share first: this turf's 1/100 goes to whoever holds it right now
        _distribute(toPool);
        if (from != address(0)) {
            // settle the outgoing holder: their earnings and their payout, both claimable
            claimable[from] += (accPerTurf - s.debt) + toPrevious;
            s.debt = accPerTurf;
        }
        // a free turf keeps its debt: its first holder inherits what it collected while free
        s.holder = msg.sender;
        s.since = uint64(block.timestamp);
        s.takes += 1;
        s.paid = p;
        s.price = nextPrice;
        totalTakes += 1;
        emit Taken(id, from, msg.sender, p, toPrevious, toPool);

        uint256 excess = msg.value - p;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            if (!ok) revert PaymentFailed();
        }
    }

    /// Pay the caller everything it is owed (credited balance + earnings of its turfs).
    function claim() external nonReentrant returns (uint256 amount) {
        _pull();
        uint256 acc = accPerTurf;
        amount = claimable[msg.sender];
        for (uint256 i = 0; i < TURFS; i++) {
            Slot storage s = _turfs[i];
            if (s.holder == msg.sender) {
                amount += acc - s.debt;
                s.debt = acc;
            }
        }
        if (amount == 0) revert NothingToClaim();
        claimable[msg.sender] = 0;
        emit Claimed(msg.sender, amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert PaymentFailed();
    }

    /// Anyone: claims this contract's creator fees from the Pons escrow into the pool.
    function pull() external nonReentrant returns (uint256) {
        return _pull();
    }

    // ---------------------------------------------------------- internal

    function _distribute(uint256 amount) private {
        uint256 total = amount + carry;
        uint256 each = total / TURFS;
        carry = total - each * TURFS;
        accPerTurf += each;
        totalDistributed += each * TURFS;
    }

    function _pull() private returns (uint256 amount) {
        if (address(feeEscrow) == address(0)) return 0;
        uint256 owed = pendingFees();
        if (owed == 0) return 0;
        uint256 before = address(this).balance;
        uint256 prev = _lock;
        _lock = 3;
        // A failing escrow must never block a take or a claim: skip it.
        try feeEscrow.claim() {} catch {}
        _lock = prev;
        amount = address(this).balance - before;
        if (amount > 0) {
            totalFunded += amount;
            _distribute(amount);
            emit Funded(amount);
        }
    }
}
