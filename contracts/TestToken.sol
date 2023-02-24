// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.0;

import "@gnosis.pm/util-contracts/contracts/GnosisStandardToken.sol";

// TestToken contract for testing purpose, here in place of Unicorn token from mainnet
contract TestToken is GnosisStandardToken{
    constructor() public {
        balances[msg.sender] = 10000000;
    }
}