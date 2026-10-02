// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ITurf {
    function take(uint256 id) external payable;

    function claim() external returns (uint256);
}

/// Pons' fee escrow as a recipient sees it: a credit and claim().
contract MockFeeEscrow {
    mapping(address => uint256) public balanceOf;
    bool public broken;

    function credit(address account) external payable {
        balanceOf[account] += msg.value;
    }

    function setBroken(bool b) external {
        broken = b;
    }

    function claim() external {
        require(!broken, "escrow: down");
        uint256 amount = balanceOf[msg.sender];
        balanceOf[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "escrow: pay");
    }
}

/// Same escrow, but pays with transfer() (2300 gas), to prove a pull still lands.
contract MockStingyEscrow {
    mapping(address => uint256) public balanceOf;

    function credit(address account) external payable {
        balanceOf[account] += msg.value;
    }

    function claim() external {
        uint256 amount = balanceOf[msg.sender];
        balanceOf[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }
}

/// A holder whose receive() always reverts.
contract RevertingHolder {
    function takeTurf(ITurf turf, uint256 id) external payable {
        turf.take{value: msg.value}(id);
    }

    function claimFrom(ITurf turf) external {
        turf.claim();
    }

    receive() external payable {
        revert("no ETH");
    }
}

/// Takes a turf, then tries to claim again from its receive().
contract ReentrantClaimer {
    ITurf public immutable turf;
    bool public reentered;
    bool public reentryFailed;

    constructor(ITurf turf_) {
        turf = turf_;
    }

    function takeTurf(uint256 id) external payable {
        turf.take{value: msg.value}(id);
    }

    function attack() external {
        turf.claim();
    }

    receive() external payable {
        if (reentered) return;
        reentered = true;
        try turf.claim() {} catch {
            reentryFailed = true;
        }
    }
}

/// Local stand-in for a Pons V2 curve: only the views the site reads.
contract MockCurve {
    uint256 public quoteReserve;
    uint256 public tokenReserve;
    bool public graduated;

    function set(uint256 q, uint256 t) external {
        quoteReserve = q;
        tokenReserve = t;
    }

    function getReserves() external view returns (uint256, uint256) {
        return (quoteReserve, tokenReserve);
    }
}

/// Local stand-in for a Pons V2 launcher token: an ERC-20 that knows its curve.
contract MockPonsToken is ERC20 {
    address public curve;

    constructor(address curve_) ERC20("Local Turf", "LTURF") {
        curve = curve_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
