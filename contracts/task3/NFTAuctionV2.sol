// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./NFTAuction.sol";

contract NFTAuctionV2 is NFTAuction {
    function testHello() public pure returns (string memory) {
        return "Hello, World!";
    }
}